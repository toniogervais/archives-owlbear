// Lecteur SoundShow pour le MJ — les données audio ne quittent jamais le PC.
const e=(tag,cl,text)=>{const el=document.createElement(tag);if(cl)el.className=cl;if(text!=null)el.textContent=text;return el;};
export const safeProgress=(position,duration)=>Number.isFinite(duration)&&duration>0?Math.min(100,Math.max(0,(position||0)*100/duration)):0;
export const formatClock=t=>Number.isFinite(t)?Math.floor(Math.max(0,t)/60).toString().padStart(2,'0')+':'+Math.floor(Math.max(0,t)%60).toString().padStart(2,'0'):'--:--';
function peaksFor(id,count=84){
  // Motif purement visuel : SoundShow ne transmet pas les échantillons audio.
  let hash=0;for(const ch of id)hash=((hash*31+ch.charCodeAt(0))|0);
  const values=[];for(let i=0;i<count;i++){hash=(hash*1664525+1013904223)|0;const v=(hash>>>0)/4294967295;
    values.push(.13+.68*(.42*Math.abs(Math.sin(i*.31))+.58*v));}
  return values;
}
export function mountMiniPlayer(host,{send,readState,isGM}){
  const root=e('section','ss-mini-player');
  const head=e('div','ss-player-head'),label=e('strong',null,'Lecteur SoundShow'),count=e('span','ss-player-count');
  head.append(label,count);
  const selected=e('select','ss-player-select');
  selected.setAttribute('aria-label','Choisir le son ou la vidéo en cours');
  const waveLabel=e('small','ss-wave-caption','Frise indicative · la forme réelle des échantillons n’est pas disponible dans l’API SoundShow');
  const wave=e('div','ss-wave-area'),canvas=e('canvas','ss-wave-canvas');
  canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Frise de progression audio indicative');
  wave.append(canvas);
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
  root.append(head,selected,wave,waveLabel,timeline,actions,volumeBox,empty);
  host.append(root);
  let state=null,activeId='',current=null,disposed=false,editingSeek=false,editingVolume=false;
  let promise=null,lastStatus='',frame=0;
  function currentList(){return (state?.active||[]).filter(v=>v?.id&&['sound','video'].includes(v.kind));}
  function pick(){
    const list=currentList();
    if(!list.some(p=>p.id===activeId))activeId=list[0]?.id||'';
    current=list.find(p=>p.id===activeId)||null;
    selected.replaceChildren();
    for(const p of list){const o=e('option',null,(p.kind==='sound'?'♫ ':'▣ ')+p.name);
      o.value=p.id;selected.append(o);}
    selected.value=activeId;
    const disabled=!current||!state?.connected||!isGM()||current.locked;
    selected.hidden=list.length<2;selected.disabled=!list.length;
    wave.hidden=!current;waveLabel.hidden=!current;timeline.hidden=!current;
    actions.hidden=!current;volumeBox.hidden=false;
    volumeTitle.textContent=current?'Volume du lecteur':'Volume des prochains sons';
    empty.hidden=!!current;
    for(const btn of Object.values(buttons))btn.disabled=disabled;
    seek.disabled=disabled||!(Number(current?.duration)>0||Number(current?.timelineDuration)>0);
    volume.disabled=!state?.connected||!isGM()||(current?.locked===true);
    if(!editingVolume){const v=Number.isFinite(current?.volume)?current.volume:(Number.isInteger(state?.nextVolume)?state.nextVolume:100);volume.value=String(v);volNum.textContent=v+' %';}
    buttons.loop?.setAttribute('aria-pressed',String(!!current?.loop));
    buttons.pause.textContent=current?.playing?'⏸':'▶';
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
    if(disposed||!current||wave.hidden)return;
    const ratio=window.devicePixelRatio||1;
    const width=Math.max(1,Math.floor(canvas.getBoundingClientRect().width)),
      height=Math.max(1,Math.floor(canvas.getBoundingClientRect().height));
    const ctx=canvas.getContext('2d');if(!ctx)return;
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    }
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
    const values=peaksFor(current.source||current.id,Math.max(30,Math.round(width/4)));
    const durationSeconds=Number(current.duration)||Number(current.timelineDuration)||0;
    const percent=durationSeconds>0?safeProgress(estimatedTime(),durationSeconds)/100:0;
    const barWidth=width/values.length;const mid=height/2;
    values.forEach((v,i)=>{
      const h=Math.max(2,v*height*.93);
      ctx.fillStyle=i/values.length<=percent?'#eccf94':'#63596b';
      ctx.fillRect(i*barWidth+1,mid-h/2,Math.max(1,barWidth-2),h);
    });
    if(durationSeconds>0){
      ctx.fillStyle='#fff2c6';ctx.fillRect(percent*width-1,0,2,height);
    }
    if(!editingSeek)seek.value=String(Math.round(percent*100));
    time.textContent=formatClock(estimatedTime());
    duration.textContent=formatClock(durationSeconds);
  }
  async function run(command){
    if(disposed||promise||!current||current.locked||!state?.connected||!isGM())return;
    promise=command;for(const b of Object.values(buttons))b.disabled=true;
    try{await send(command);lastStatus='';}catch(err){lastStatus=String(err.message||err);empty.hidden=false;empty.textContent=lastStatus;}
    finally{promise=null;pick();}
  }
  buttons.pause.onclick=()=>void run({type:'toggle_player_playback',player_id:activeId});
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
    if(current)void run({type:'set_player_volume',player_id:activeId,volume:v});
    else void send({type:'set_next_sound_volume',volume:v}).catch(err=>{empty.hidden=false;empty.textContent=err.message||'Volume indisponible.';});
  };
  const tick=()=>{if(disposed)return;if(current&&!root.closest('[hidden]'))draw();frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  pick();
  return {update(next){state=next;pick();},destroy(){disposed=true;cancelAnimationFrame(frame);root.remove();}};
}
