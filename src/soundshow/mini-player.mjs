// Lecteur SoundShow pour le MJ — les données audio ne quittent jamais le PC.
const e=(tag,cl,text)=>{const el=document.createElement(tag);if(cl)el.className=cl;if(text!=null)el.textContent=text;return el;};
export const safeProgress=(position,duration)=>Number.isFinite(duration)&&duration>0?Math.min(100,Math.max(0,(position||0)*100/duration)):0;
export const formatClock=t=>Number.isFinite(t)?Math.floor(Math.max(0,t)/60).toString().padStart(2,'0')+':'+Math.floor(Math.max(0,t)%60).toString().padStart(2,'0'):'--:--';
export function mountMiniPlayer(host,{send,readState,isGM}){
  const root=e('section','ss-mini-player');
  const head=e('div','ss-player-head'),label=e('strong',null,'Lecteur SoundShow'),count=e('span','ss-player-count');
  head.append(label,count);
  const selected=e('select','ss-player-select');
  selected.setAttribute('aria-label','Choisir le son ou la vidéo en cours');
  const timeline=e('div','ss-player-timeline'),time=e('span',null,'00:00'),duration=e('span',null,'--:--');
  const seek=e('input','ss-player-seek');seek.type='range';seek.min='0';seek.max='100';seek.step='1';seek.value='0';
  seek.setAttribute('aria-label','Avancer ou reculer dans la lecture');
  timeline.append(time,seek,duration);
  const actions=e('div','ss-player-actions');
  const buttons={};
  for(const [key,title,symbol] of [
    ['pause','Pause / reprendre','⏯'],['loop','Lecture en boucle','↻'],
    ['stop','Arrêt','■'],['fade','Fondu sortant','↘']
  ]){const btn=e('button','ss-player-btn',symbol);btn.type='button';btn.title=title;btn.setAttribute('aria-label',title);buttons[key]=btn;actions.append(btn);}
  const volumeBox=e('label','ss-player-volume'),volumeTitle=e('span',null,'Volume'),volNum=e('output',null,'100 %');
  const volume=e('input');volume.type='range';volume.min='0';volume.max='100';volume.step='1';volume.value='100';
  volume.setAttribute('aria-label','Volume du lecteur SoundShow');
  volumeBox.append(volumeTitle,volume,volNum);
  const empty=e('p','ss-player-empty','Aucun son en cours. Lance une case de la grille.');
  root.append(head,selected,timeline,actions,volumeBox,empty);
  host.append(root);
  let state=null,activeId='',current=null,lastPlayed=null,lastProject='',disposed=false,editingSeek=false,editingVolume=false;
  let promise=null,lastStatus='',frame=0;
  const ended=()=>!!current && !(state?.active||[]).some(item=>item.id===current.id);
  function currentList(){return (state?.active||[]).filter(v=>v?.id&&['sound','video'].includes(v.kind));}
  function pick(){
    const active=currentList();
    if(active.length){lastPlayed={...active[0]};if(!active.some(p=>p.id===activeId))activeId=active[0].id;}
    const list=active.length?active:(lastPlayed?[lastPlayed]:[]);
    if(!list.some(p=>p.id===activeId))activeId=list[0]?.id||'';
    current=list.find(p=>p.id===activeId)||null;
    selected.replaceChildren();
    for(const p of list){const o=e('option',null,(p.kind==='sound'?'♫ ':'▣ ')+p.name);
      o.value=p.id;selected.append(o);}
    selected.value=activeId;
    const finished=ended();
    const disabled=!current||!state?.connected||!isGM()||current.locked;
    selected.hidden=list.length<2;selected.disabled=!list.length;
    timeline.hidden=!current;
    actions.hidden=!current;volumeBox.hidden=false;
    volumeTitle.textContent=current?'Volume du lecteur':'Volume des prochains sons';
    empty.hidden=!!current;
    for(const btn of Object.values(buttons))btn.disabled=disabled||finished;
    buttons.pause.disabled=disabled||finished&&!current?.source;
    seek.disabled=disabled||finished||!(Number(current?.duration)>0||Number(current?.timelineDuration)>0);
    volume.disabled=!state?.connected||!isGM()||(current?.locked===true);
    if(finished)empty.textContent='Lecture terminée · ▶ pour relancer ce média.';
    else empty.textContent='Aucun son en cours. Lance une case de la grille.';
    if(!editingVolume){const v=Number.isFinite(current?.volume)?current.volume:(Number.isInteger(state?.nextVolume)?state.nextVolume:100);volume.value=String(v);volNum.textContent=v+' %';}
    buttons.loop?.setAttribute('aria-pressed',String(!!current?.loop));
    buttons.pause.textContent=current?.playing&&!finished?'⏸':'▶';
    if(current)draw();
  }
  function estimatedTime(){
    if(!current)return 0;
    const durationMs=Number(current.duration)||Number(current.timelineDuration)||0;
    let value=Number(current.position)||0;
    const observed=Number(current.observedAt)||0;
    if(current.playing&&observed)value+=Math.min(4,Math.max(0,(Date.now()-observed)/1000));
    if(current.loop&&durationMs>0)value%=durationMs;
    return durationMs>0?Math.max(0,Math.min(value,durationMs)):Math.max(0,value);
  }
  function draw(){
    if(disposed||!current)return;
    const durationSeconds=Number(current.duration)||Number(current.timelineDuration)||0;
    const percent=durationSeconds>0?safeProgress(estimatedTime(),durationSeconds):0;
    if(!editingSeek)seek.value=String(Math.round(percent));
    time.textContent=formatClock(estimatedTime());
    duration.textContent=formatClock(durationSeconds);
  }
  async function run(command){
    if(disposed||promise||!current||current.locked||!state?.connected||!isGM())return;
    if(ended()&&command.type!=='play_playable')return;
    promise=command;for(const b of Object.values(buttons))b.disabled=true;
    try{await send(command);lastStatus='';}catch(err){lastStatus=String(err.message||err);empty.hidden=false;empty.textContent=lastStatus;}
    finally{promise=null;pick();}
  }
  buttons.pause.onclick=()=>void run(ended()?{type:'play_playable',playable_id:current.source,action:'start'}:{type:'toggle_player_playback',player_id:activeId});
  buttons.loop.onclick=()=>void run({type:'toggle_player_loop',player_id:activeId});
  buttons.stop.onclick=()=>void run({type:'stop_player',player_id:activeId});
  buttons.fade.onclick=()=>void run({type:'fade_out_player',player_id:activeId});
  selected.onchange=()=>{activeId=selected.value;pick();};
  seek.addEventListener('input',()=>{editingSeek=true;});
  seek.addEventListener('change',()=>{
    const value=Number(seek.value);editingSeek=false;
    if(current&&!seek.disabled)void run({type:'seek_player',player_id:activeId,position_percent:value});
  });
  volume.oninput=()=>{editingVolume=true;volNum.textContent=volume.value+' %';};
  volume.onchange=()=>{
    const v=Number(volume.value);editingVolume=false;
    if(volume.disabled)return;
    if(current&&!ended())void run({type:'set_player_volume',player_id:activeId,volume:v});
    else void send({type:'set_next_sound_volume',volume:v}).catch(err=>{empty.hidden=false;empty.textContent=err.message||'Volume indisponible.';});
  };
  const tick=()=>{if(disposed)return;if(current&&!root.closest('[hidden]'))draw();frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  pick();
  return {update(next){
    const nextProject=String(next?.project||'');
    if(lastProject&&nextProject&&lastProject!==nextProject){lastPlayed=null;activeId='';}
    if(nextProject)lastProject=nextProject;
    state=next;pick();
  },destroy(){disposed=true;cancelAnimationFrame(frame);root.remove();}};
}
