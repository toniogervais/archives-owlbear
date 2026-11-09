/* Télécommande SoundShow 2 — uniquement dans l'éditeur MJ Owlbear. */
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const decorate=(node,css)=>{node.style.cssText=css;return node;};
export function mountRemote(host,send){
  let state=null,kind='sound',search='',pending=false,disposed=false,signature='';
  const section=el('section');section.setAttribute('aria-label','Télécommande SoundShow');
  decorate(section,'padding:15px;border:1px solid #c7ad7555;border-radius:13px;background:#15121b;margin:10px 0;color:#f4e6cd');
  const title=el('h3','Télécommande SoundShow');decorate(title,'margin:0 0 7px;font-size:17px');
  const status=el('p','Connexion à SoundShow…');status.setAttribute('role','status');
  decorate(status,'font-size:13px;margin:4px 0 12px;color:#d5c6a7');
  const global=el('div');decorate(global,'display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px');
  const filters=el('div');decorate(filters,'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:9px');
  const searchBox=el('input');searchBox.type='search';searchBox.placeholder='Rechercher dans le projet…';
  searchBox.setAttribute('aria-label','Rechercher un son ou une vidéo');
  decorate(searchBox,'flex:1;min-width:160px;padding:9px;border-radius:8px;border:1px solid #c7ad7555;background:#0b0b14;color:#f4e6cd');
  const media=el('div'),playing=el('div'),nextVolume=el('div');
  decorate(media,'display:grid;gap:7px;max-height:270px;overflow-y:auto');
  decorate(playing,'display:grid;gap:7px;margin-top:8px;max-height:240px;overflow-y:auto');
  const heading=el('h4','En cours de lecture');decorate(heading,'margin:16px 0 7px;font-size:14px');
  const nextHeading=el('h4','Volume des prochains sons');decorate(nextHeading,'margin:14px 0 5px;font-size:13px');
  section.append(title,status,global,filters,media,heading,playing,nextHeading,nextVolume);
  host.append(section);
  function makeButton(label,cmd,attr={}){
    const button=el('button',label);button.type='button';
    decorate(button,'min-height:36px;padding:7px 10px;border-radius:8px;border:1px solid #bfa36d70;background:#423524;color:#f4e6cd;cursor:pointer;font:inherit;font-size:12px');
    if(attr.title)button.title=attr.title;
    if(attr.ariaLabel)button.setAttribute('aria-label',attr.ariaLabel);
    button.disabled=pending||!state?.connected||attr.locked===true;
    button.onclick=()=>void execute(cmd);
    return button;
  }
  async function execute(command){
    if(pending||disposed||!state?.connected)return;
    pending=true;status.textContent='Envoi de la commande à SoundShow…';
    for(const button of section.querySelectorAll('button'))button.disabled=true;
    try{
      const response=await send(command);
      if(disposed)return;
      status.textContent=response?.message||'Commande envoyée. L’état de SoundShow confirme ensuite son effet.';
      if(response?.state)update(response.state);
    }catch(error){if(!disposed)status.textContent=error.message||'Commande non envoyée.';}
    finally{pending=false;if(!disposed)render();}
  }
  function render(){
    if(disposed)return;
    const connected=state?.connected===true;
    if(!connected)status.textContent='Connecte SoundShow depuis le connecteur Windows, puis ouvre Owlbear avec son bouton.';
    else if(status.textContent.startsWith('Connexion')||status.textContent.startsWith('Connecte'))
      status.textContent='SoundShow connecté — sons et vidéos disponibles dans Les Archives.';
    global.replaceChildren(
      makeButton('⏸ Pause tout',{type:'pause_all'}),
      makeButton('▶ Reprendre tout',{type:'resume_all'}),
      makeButton('↘ Fondu général',{type:'fade_out_all'}),
      makeButton('■ Arrêter tout',{type:'stop_all'},{title:'Arrête tous les lecteurs non verrouillés'})
    );
    filters.replaceChildren();
    for(const [value,label] of [['sound','Sons'],['video','Vidéos'],['all','Tous']]){
      const control=makeButton(label,null);
      control.disabled=false;control.setAttribute('aria-pressed',String(kind===value));
      if(kind===value)control.style.borderColor='#f2d591';
      control.onclick=()=>{kind=value;render();};filters.append(control);
    }
    filters.append(searchBox);
    media.replaceChildren();
    const entries=(state?.media||[]).filter(item=>(kind==='all'||item.kind===kind)&&
      ((item.name||'')+' '+(item.category||'')).toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
    if(!entries.length)media.append(el('p',connected?'Aucun média correspondant.':'Les médias apparaîtront après la connexion.'));
    for(const item of entries.slice(0,70)){
      const row=el('div');decorate(row,'display:flex;align-items:center;gap:9px;justify-content:space-between;border:1px solid #f5deb424;border-radius:9px;padding:7px 9px');
      const info=el('div');decorate(info,'min-width:0;flex:1;overflow-wrap:anywhere;font-size:13px');
      const sub=el('small',item.category||'');decorate(sub,'display:block;opacity:.68;font-size:11px');
      info.append(el('strong',(item.kind==='sound'?'♫ ':'▣ ')+item.name),sub);
      const controls=el('div');decorate(controls,'display:flex;gap:5px;flex-wrap:wrap');
      controls.append(makeButton('▶ Jouer',{type:'play_playable',playable_id:item.id,action:'start'},
          {ariaLabel:'Jouer '+item.name}),
        makeButton('↗ Fondu',{type:'play_playable',playable_id:item.id,action:'fade_in'},
          {ariaLabel:'Démarrer en fondu '+item.name}));
      row.append(info,controls);media.append(row);
    }
    if(entries.length>70)media.append(el('p','Affichage limité à 70 médias : utilise la recherche pour affiner.'));
    playing.replaceChildren();
    const active=state?.active||[];
    if(!active.length)playing.append(el('p','Aucun son ni vidéo en cours.'));
    for(const item of active.slice(0,45)){
      const row=el('div');decorate(row,'border:1px solid #f5deb424;border-radius:9px;padding:9px');
      const header=el('div');decorate(header,'display:flex;gap:7px;align-items:center;justify-content:space-between;flex-wrap:wrap');
      const name=el('strong',(item.kind==='sound'?'♫ ':'▣ ')+item.name+(item.playing?' · lecture':' · pause'));decorate(name,'font-size:13px');
      const buttons=el('div');decorate(buttons,'display:flex;gap:5px;flex-wrap:wrap');
      buttons.append(makeButton(item.playing?'⏸ Pause':'▶ Reprendre',
         {type:'toggle_player_playback',player_id:item.id},{locked:item.locked}),
       makeButton('↘ Fondu',{type:'fade_out_player',player_id:item.id},{locked:item.locked}),
       makeButton('■ Stop',{type:'stop_player',player_id:item.id},{locked:item.locked}));
      header.append(name,buttons);
      const volume=el('label','Volume '+item.volume+' %');decorate(volume,'display:flex;align-items:center;gap:8px;font-size:12px;margin-top:6px');
      const slider=el('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=String(item.volume);
      slider.disabled=pending||!connected||item.locked===true;slider.style.flex='1';
      slider.setAttribute('aria-label','Volume de '+item.name);
      slider.onchange=()=>void execute({type:'set_player_volume',player_id:item.id,volume:Number(slider.value)});
      volume.append(slider);row.append(header,volume);playing.append(row);
    }
    nextVolume.replaceChildren();
    const value=Number.isInteger(state?.nextVolume)?state.nextVolume:100;
    const label=el('label','Volume par défaut : '+value+' %');
    decorate(label,'display:flex;align-items:center;gap:9px;font-size:12px');
    const slider=el('input');slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=String(value);
    slider.disabled=pending||!connected;slider.style.flex='1';
    slider.setAttribute('aria-label','Volume des prochains sons');
    slider.onchange=()=>void execute({type:'set_next_sound_volume',volume:Number(slider.value)});
    label.append(slider);nextVolume.append(label);
  }
  searchBox.addEventListener('input',()=>{search=searchBox.value;render();});
  function update(value){
    if(disposed||!value||typeof value!=='object')return;
    const next=JSON.stringify(value);
    if(next===signature)return;
    signature=next;state=value;render();
  }
  render();
  return {update,destroy(){disposed=true;section.remove();}};
}
