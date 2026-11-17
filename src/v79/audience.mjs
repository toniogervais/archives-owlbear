import {element,button,isGM,nativeEditor,sheet} from '../v63/ui.mjs?v=4590';
import {libraryRequest} from '../v60/request.mjs?v=4590';

export function audience(value){
 if(value==null||value.all===true)return {all:true};
 const ids=key=>{if(!Array.isArray(value[key])||value[key].length>50||value[key].some(id=>typeof id!=='string'||!id||id.length>240))throw Error('Destinataires invalides.');return [...new Set(value[key])];};
 const live=ids('live'),owl=ids('owl');if(!live.length&&!owl.length)throw Error('Choisis au moins un joueur.');
 return {all:false,live,owl};
}
export async function connectedPlayers(){
 const live=(window.ArchivesLiveInvitations?.players?.()||[]).filter(p=>p.connected).map(p=>({id:p.id,name:p.name,transport:'live'}));
 const request=nativeEditor()?libraryRequest:window.ArchivesPresentationBridge?.connected?command=>window.ArchivesPresentationBridge.request(command):null;
 if(!request)return live;
 const result=await request({action:'recipients'});
 return [...live,...(result.players||[]).map(p=>({id:p.id,name:p.name,transport:'owl'}))];
}
export function chooseAudience(){
 if(!isGM())return Promise.resolve(null);
 return new Promise(resolve=>{
  const view=sheet('archives-presentation-audience','À qui montrer ?','Présentation'),all=element('input'),selected=element('input');
  all.type=selected.type='radio';all.name=selected.name='presentation-audience';all.checked=true;
  const label=(input,text)=>{const node=element('label');node.append(input,document.createTextNode(text));return node;};
  const list=element('div',null,'presentation-recipients'),allLabel=label(all,'Tout le monde'),selectedLabel=label(selected,'Seulement les joueurs cochés');
  view.content.append(allLabel,selectedLabel,list);view.status.textContent='Recherche des joueurs connectés…';
  let players=[],finished=false;
  const style=element('style');style.textContent='#archives-presentation-audience{width:min(440px,calc(100vw - 20px));box-sizing:border-box;max-height:calc(100dvh - 20px);overflow:auto}#archives-presentation-audience label{display:flex;align-items:center;gap:12px;min-height:44px;padding:6px 10px;cursor:pointer}#archives-presentation-audience input{width:21px;height:21px;flex:none;accent-color:#a5d8bd}#archives-presentation-audience .presentation-recipients{display:grid;gap:4px;margin:8px 0 16px}#archives-presentation-audience .presentation-recipient{border:1px solid #bda16f40;border-radius:9px}#archives-presentation-audience .presentation-send{width:100%;min-height:44px}';view.content.append(style);
  const send=button('Montrer',()=>{
   if(!isGM()){finish(null);return;}
   if(all.checked){finish({all:true});return;}
   const chosen=players.filter(p=>p.input.checked);
   if(!chosen.length){view.status.textContent='Coche le joueur qui doit recevoir la présentation.';return;}
   finish({all:false,live:chosen.filter(p=>p.transport==='live').map(p=>p.id),owl:chosen.filter(p=>p.transport==='owl').map(p=>p.id)});
  },'presentation-send');send.dataset.presentAudience='';view.content.append(send);
  function finish(value){if(finished)return;finished=true;view.dialog.close();resolve(value);}
  view.cleanup(()=>finish(null));
  void connectedPlayers().then(rows=>{
   if(finished)return;players=rows.map(p=>({...p,input:element('input')}));
   for(const p of players){p.input.type='checkbox';p.input.setAttribute('aria-label',p.name+' · '+(p.transport==='live'?'Archives':'Owlbear'));p.input.onchange=()=>{selected.checked=true;};const row=label(p.input,p.name+' · '+(p.transport==='live'?'Archives':'Owlbear'));row.className='presentation-recipient';list.append(row);}
   view.status.textContent=players.length?'Choisis tout le monde ou un ou plusieurs joueurs.':'Aucun joueur connecté pour le moment. « Tout le monde » inclut les joueurs qui rejoindront la session.';
  }).catch(error=>{if(!finished)view.status.textContent=error.message;});
 });
}
