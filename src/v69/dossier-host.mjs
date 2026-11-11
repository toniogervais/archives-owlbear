import {validSession} from '../v56/link.mjs';
// Only the public list and on-demand read operations cross a player's host.
export function dossierHost(channel,post,canRead){
  const pending=new Map();let closed=false;
  const receive=event=>{
    const data=event.data;if(closed||!canRead()||data?.type!=='dossier-result'||!pending.has(data.id))return;
    clearTimeout(pending.get(data.id));pending.delete(data.id);
    post('owl-dossier-result',{id:data.id,safe:data.safe===true,result:data.result,message:data.message});
  };
  channel.addEventListener('message',receive);
  return {
    receive(data){
      if(data.type!=='owl-dossier-command')return false;
      if(closed||!canRead()||!validSession(data.id)||pending.size>=4||pending.has(data.id))return true;
      const command=data.command||{};
      if(!['list','get'].includes(command.action))return true;
      pending.set(data.id,setTimeout(()=>pending.delete(data.id),185000));
      channel.postMessage({type:'dossier-command',id:data.id,command:{action:command.action,fileId:command.fileId}});return true;
    },
    dispose(){closed=true;channel.removeEventListener('message',receive);for(const timer of pending.values())clearTimeout(timer);pending.clear()}
  };
}
