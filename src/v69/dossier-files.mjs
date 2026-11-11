/* Fichiers du dossier : publication explicite, consultation à la demande, contrôle du rôle à chaque transfert. */
import {validId,validSharedFile,publicFile,fileChunks,fileReceiver} from '../v60/files.mjs?v=4420';
const network='fr.archives-imaginaire.bridge/dossier-v442';
export const dossierEntry=entry=>entry?.dossier?.version && validSharedFile({...entry,version:entry.dossier.version})
  ? publicFile({...entry,version:entry.dossier.version}) : null;
export function installDossierFiles(OBR,{channel,isMember,getStore,getRole,getConnection,isClosed}) {
  const pending=new Map(),sending=new Set();let disposed=false;
  const live=()=>!disposed&&!isClosed();
  const send=data=>OBR.broadcast.sendMessage(network,data);
  const reply=(id,safe,result,message)=>{if(live())channel.postMessage({type:'dossier-result',id,safe,result,message})};
  async function catalog(){return (await (await getStore()).list()).map(dossierEntry).filter(Boolean).slice(0,100)}
  async function shared(id,version){
    const store=await getStore(),entry=await store.get(id),publication=dossierEntry(entry);
    if(!publication||version&&publication.version!==version)throw Error('Ce fichier a été retiré du dossier des joueurs.');
    return {store,publication};
  }
  function finish(id,safe,result,message){const state=pending.get(id);if(!state)return;clearTimeout(state.timer);pending.delete(id);reply(id,safe,result,message)}
  function resetTimeout(id,state){clearTimeout(state.timer);state.timer=setTimeout(()=>finish(id,false,null,'Le chargement a été interrompu. Garde la salle du MJ ouverte et réessaie.'),25000)}
  const local=event=>{
    const data=event.data;if(!live()||data?.type!=='dossier-command'||!validId(data.id))return;
    const {id,command={}}=data;
    void (async()=>{
      if(!['list','get'].includes(command.action)||command.action==='get'&&!validId(command.fileId))throw Error('Consultation invalide.');
      if(getRole()==='GM'){
        if(command.action==='list'){const entries=await catalog();if(getRole()==='GM')reply(id,true,{entries});return}
        const {store,publication}=await shared(command.fileId),blob=await store.blob(publication.id);
        await shared(publication.id,publication.version);
        if(!blob)throw Error('Le fichier original est introuvable.');
        reply(id,true,{entry:publication,blob});return;
      }
      if(getRole()!=='PLAYER'||pending.size>=4)throw Error('Consultation indisponible. Réessaie dans un instant.');
      const gm=(await OBR.party.getPlayers()).find(player=>player.role==='GM');
      if(!gm)throw Error('Le MJ doit être connecté pour consulter les fichiers partagés.');
      if(!live()||getRole()!=='PLAYER')return;
      const state={sender:gm.connectionId,action:command.action,fileId:command.fileId,queue:Promise.resolve()};pending.set(id,state);resetTimeout(id,state);
      try{await send({type:'request',requestId:id,to:state.sender,action:command.action,fileId:command.fileId})}
      catch(error){finish(id,false,null,'La demande de fichier n’a pas pu être envoyée.')}
    })().catch(error=>reply(id,false,null,error.message));
  };
  channel.addEventListener('message',local);
  const off=OBR.broadcast.onMessage(network,event=>{
    const data=event.data;
    if(!live()||!data||!validId(data.requestId)||data.to!==getConnection())return;
    void (async()=>{
      if(data.type==='request'){
        if(getRole()!=='GM'||!await isMember(event.connectionId,'PLAYER')||!live())return;
        const to=event.connectionId,requestId=data.requestId;
        if(data.action==='list'){
          const entries=await catalog(),count=Math.max(1,Math.ceil(entries.length/10));
          for(let index=0;index<count;index++){
            await getStore();if(!live())return;
            await send({type:'catalog',to,requestId,index,count,entries:entries.slice(index*10,index*10+10)});
          }
          return;
        }
        if(data.action!=='get'||!validId(data.fileId)||sending.has(to)||sending.size>=8)return;
        sending.add(to);
        try{
          const {store,publication}=await shared(data.fileId),blob=await store.blob(publication.id);
          if(!blob||blob.size!==publication.size)throw Error('Le fichier original est indisponible.');
          await shared(publication.id,publication.version);
          await send({type:'file',requestId,to,entry:publication});
          const transfer=crypto.randomUUID();
          for await(const part of fileChunks(blob)){
            if(!live()||getRole()!=='GM')break;
            if(part.index%8===0){await shared(publication.id,publication.version);if(!await isMember(to,'PLAYER'))break}
            await send({type:'data',requestId,to,...publication,transfer,...part});
            if(part.index%8===7)await new Promise(resolve=>setTimeout(resolve,30));
          }
        }catch(error){if(live()&&getRole()==='GM')await send({type:'error',to,requestId,message:'Ce fichier est indisponible ou a été retiré du dossier.'})}
        finally{sending.delete(to)}
        return;
      }
      const state=pending.get(data.requestId);
      if(getRole()!=='PLAYER'||!state||state.sender!==event.connectionId||!await isMember(event.connectionId,'GM')||!live()||pending.get(data.requestId)!==state)return;
      if(data.type==='catalog'&&state.action==='list'&&Number.isInteger(data.count)&&data.count>=1&&data.count<=10&&
          Number.isInteger(data.index)&&data.index>=0&&data.index<data.count&&Array.isArray(data.entries)&&data.entries.length<=10&&data.entries.every(validSharedFile)){
        state.parts||=new Map();state.count||=data.count;
        if(state.count!==data.count)return;
        state.parts.set(data.index,data.entries.map(publicFile));resetTimeout(data.requestId,state);
        if(state.parts.size===state.count)finish(data.requestId,true,{entries:Array.from({length:state.count},(_,index)=>state.parts.get(index)).flat()});
      }else if(data.type==='file'&&state.action==='get'&&!state.receiver&&data.entry?.id===state.fileId&&validSharedFile(data.entry)){
        state.entry=publicFile(data.entry);state.receiver=fileReceiver(state.entry,validSharedFile);resetTimeout(data.requestId,state);
      }else if(data.type==='data'&&state.receiver){
        state.queue=state.queue.then(async()=>{
          if(!live()||getRole()!=='PLAYER'||pending.get(data.requestId)!==state)return;
          const result=await state.receiver.push(data);if(!result)return;
          resetTimeout(data.requestId,state);
          if(result.blob)finish(data.requestId,true,{entry:state.entry,blob:result.blob});
        }).catch(()=>finish(data.requestId,false,null,'Le fichier reçu est incomplet. Réessaie.'));
      }else if(data.type==='error')finish(data.requestId,false,null,'Ce fichier est indisponible ou a été retiré du dossier.');
    })().catch(()=>{if(pending.has(data.requestId))finish(data.requestId,false,null,'Le dossier ne répond pas. Réessaie.')});
  });
  return {
    async share(entry,remove=false){
      const store=await getStore();
      if(remove){await store.put({...entry,dossier:null});return {}}
      const entries=await catalog();if(!dossierEntry(entry)&&entries.length>=100)throw Error('Le dossier contient déjà 100 fichiers. Retire un fichier avant d’en ajouter un autre.');
      const next={...entry,dossier:{version:crypto.randomUUID()}},publication=dossierEntry(next);
      if(!publication)throw Error('Ce fichier ne peut pas être ajouté au dossier.');
      await getStore();await store.put(next);return {entry:publication};
    },
    dispose(){disposed=true;channel.removeEventListener('message',local);off?.();for(const state of pending.values())clearTimeout(state.timer);pending.clear()}
  };
}
