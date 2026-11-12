const crypto=require('node:crypto');
const owner='11111111-1111-4111-8111-111111111111';
function backend(){
 const campaigns=[],versions=[],objects=new Map(),calls=[],heads=new Map(),jobs=new Map();let failRemove=false;
 const catalog=id=>({revision:heads.get(id)||0,backups:versions.filter(row=>row.campaign_id===id).slice().reverse(),cleanup_pending:[...jobs.values()].filter(job=>job.campaign_id===id).length,cleanup_bytes:[...jobs.values()].filter(job=>job.campaign_id===id).reduce((sum,job)=>sum+job.byte_size,0)});
 async function receive(source,request){
  calls.push({op:request.op,table:request.table,source:source.page.url()});
  if(request.op==='auth')return {data:{user:{id:owner,email:'mj@example.test'}}};
  if(request.op==='upload'){objects.set(request.path,Buffer.from(request.bytes,'base64'));return {data:{path:request.path}}}
  if(request.op==='download'){const bytes=objects.get(request.path);return bytes?{data:bytes.toString('base64')}:{error:{message:'missing bytes'}}}
  if(request.op==='remove'){if(failRemove)return {error:{message:'Nettoyage de test interrompu'}};for(const path of request.paths)objects.delete(path);return {data:[]}}
  if(request.op==='list')return {data:[...objects.keys()].filter(path=>path.startsWith(request.prefix+'/')).map(path=>({name:path.slice(request.prefix.length+1)}))};
  if(request.op==='query'){
   const values=request.table==='campaigns'?campaigns:versions;
   if(request.insert){const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...request.insert};values.push(row);return {data:row}}
   let rows=values.filter(row=>(request.filters||[]).every(([key,value])=>row[key]===value));
   if(request.order)rows=rows.slice().sort((a,b)=>a[request.order.key]<b[request.order.key]?-1:1).map(x=>x);
   if(request.order?.ascending===false)rows.reverse();
   if(request.limit)rows=rows.slice(0,request.limit);
   return {data:request.single?rows[0]||null:rows};
  }
  if(request.op==='rpc'){
   const a=request.args,id=a.p_campaign_id;
   if(request.name==='archives_backup_catalog')return {data:catalog(id)};
   if(request.name==='archives_pending_backup_cleanup')return {data:[...jobs.values()].filter(job=>job.campaign_id===id)};
   if(request.name==='archives_finish_backup_cleanup'){for(const target of a.p_ids)jobs.delete(target);return {data:null}};
   if(request.name==='archives_delete_backups'){
    if((heads.get(id)||0)!==a.p_expected_revision)return {error:{message:'ARCHIVES_BACKUP_CONFLICT'}};
    const latest=versions.filter(row=>row.campaign_id===id).at(-1),deleted=[];
    for(let i=versions.length-1;i>=0;i--){const row=versions[i];if(row.campaign_id!==id||!a.p_ids.includes(row.id))continue;
     jobs.set(row.id,{id:row.id,campaign_id:id,byte_size:row.byte_size,paths:row.parts.map((part,index)=>owner+'/'+id+'/'+row.id+'/'+index)});
     versions.splice(i,1);deleted.push({id:row.id,bytes:row.byte_size});
    }
    if(deleted.length)heads.set(id,(heads.get(id)||0)+1);
    return {data:{deleted,latest_deleted:a.p_ids.includes(latest?.id),catalog:catalog(id)}};
   }
   if(request.name!=='archives_commit_backup')throw Error('Unknown RPC '+request.name);
   let row=versions.find(row=>row.id===a.p_id);
   if(!row){const current=heads.get(a.p_campaign_id)||0;
    if(current!==a.p_expected_revision)return {error:{message:'ARCHIVES_BACKUP_CONFLICT'}};
    row={id:a.p_id,campaign_id:a.p_campaign_id,owner_id:owner,created_at:new Date().toISOString(),revision:current+1,byte_size:a.p_parts.reduce((sum,part)=>sum+part.bytes,0),parts:a.p_parts,sha256:a.p_sha256,fingerprint:a.p_fingerprint,summary:a.p_summary};versions.push(row);heads.set(a.p_campaign_id,row.revision);
   }return {data:{backup:row,removed:[]}};
  }
  throw Error('Unknown fixture operation '+request.op);
 }
 return {campaigns,versions,objects,calls,heads,jobs,receive,failCleanup:value=>{failRemove=value}};
}
function initCloud(){
 if(location.origin!=='https://archives.test')return;
 localStorage.setItem('archives_supabase_url','https://archives.supabase.co');
 localStorage.setItem('archives_supabase_public_key','sb_publishable_fixture');
 const send=async data=>{if(window.__cloudOffline)throw Error('Réseau de test interrompu');return window.cloudFixture(data)};
 const user=async()=>send({op:'auth'});
 const query=table=>{
  const data={op:'query',table,filters:[]};
  const q={select:()=>q,eq:(key,value)=>{data.filters.push([key,value]);return q},order:(key,options={})=>{data.order={key,ascending:options.ascending!==false};return q},limit:limit=>{data.limit=limit;return q},insert:value=>{data.insert=value;return q},maybeSingle:()=>{data.single=true;return send(data)},single:()=>{data.single=true;return send(data)},then:(resolve,reject)=>send(data).then(resolve,reject)};return q;
 };
 window.supabase={createClient:()=>({supabaseUrl:'https://archives.supabase.co',auth:{getUser:user,getSession:async()=>{const result=await user();return {data:{session:{user:result.data.user}}}}},from:query,rpc:(name,args)=>send({op:'rpc',name,args}),storage:{from:()=>({
  upload:async(path,blob)=>{let binary='';const data=new Uint8Array(await blob.arrayBuffer());for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));return send({op:'upload',path,bytes:btoa(binary)})},
  download:async path=>{const reply=await send({op:'download',path});return reply.error?reply:{data:new Blob([Uint8Array.from(atob(reply.data),c=>c.charCodeAt(0))])}},
  remove:paths=>send({op:'remove',paths}),list:prefix=>send({op:'list',prefix})
 })}})};
}
module.exports={backend,initCloud,owner};
