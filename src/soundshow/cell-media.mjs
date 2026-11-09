/* V4.26 — plusieurs médias SoundShow liés à la révélation d'une cellule, MJ uniquement. */
import {isGM,requireGM,notice,sheet,element,button} from '../v63/ui.mjs';
const allowed=['start','fade_in','crossfade','replace','toggle','toggle_fade'];
export function safeCellAttachments(items,catalog){
  if(!Array.isArray(items)||!Array.isArray(catalog))return [];
  const map=new Map(catalog.filter(v=>v&&['sound','video'].includes(v.kind)&&v.locked!==true).map(v=>[v.id,v]));
  const found=new Set();
  return items.filter(v=>v&&typeof v.id==='string'&&!found.has(v.id)&&map.has(v.id))
    .slice(0,16).map(v=>{found.add(v.id);const target=map.get(v.id);
      return {id:v.id,kind:target.kind,action:allowed.includes(v.action)?v.action:'start'};});
}
export function mountCellMedia({send,getRemote,refreshRemote,embedded}){
  const editorSlot=document.getElementById('cell-media-editor');
  let closed=false,activeDialog=null;
  function state(){return window.DuneApp?.getState?.();}
  function nodeOf(id){return (state()?.nodes||[]).find(n=>n.id===id)||null;}
  function selectedId(source){
    const s=state();return source==='context'?(s?.ctxTargetNodeId||s?.selectedId):s?.selectedId;
  }
  function choices(){return Array.isArray(getRemote()?.media)?getRemote().media.filter(v=>['sound','video'].includes(v.kind)):[];}
  function summary(){
    if(!editorSlot)return;
    const s=state();if(!s||!isGM()||s.selectedLinkId){editorSlot.hidden=true;return;}
    const node=nodeOf(s.selectedId);if(!node){editorSlot.hidden=true;return;}
    editorSlot.hidden=false;
    const count=Array.isArray(node.revealMedia)?node.revealMedia.length:0;
    editorSlot.replaceChildren();
    editorSlot.style.cssText='margin-top:12px;padding:11px;border:1px solid #ceaa6c55;border-radius:10px;background:#15121a';
    const heading=element('strong','♫ Sons et vidéos déclenchés à la révélation');
    heading.style.cssText='display:block;color:#ead2a0;margin-bottom:5px;font-size:13px';
    const info=element('p',count+' média(s) associé(s). Ils se déclenchent lorsque le MJ révèle cette cellule.');
    info.style.cssText='font-size:12px;line-height:1.4;margin:4px 0 7px';
    const openButton=button('Gérer les médias',()=>openPicker('editor'));
    openButton.style.cssText='border:1px solid #c5a5686c;color:#f5ddb3;padding:8px 10px;border-radius:8px;background:#332736;cursor:pointer';
    editorSlot.append(heading,info,openButton);
  }
  function openPicker(source='editor'){
    try{requireGM();if(!embedded)throw Error('Ouvre Les Archives dans ta salle Owlbear MJ.');
      const nodeId=selectedId(source),node=nodeOf(nodeId);
      if(!node)throw Error('Sélectionne une cellule avant d’associer des médias.');
      window.DuneApp?.closeContextMenus?.();
      const view=sheet('archives-cell-media-picker','Médias de la cellule · '+String(node.title||'').slice(0,65));
      activeDialog=view.dialog;
      const description=element('p','Sélectionne plusieurs sons ou vidéos du projet SoundShow. Ils démarreront une seule fois lors du prochain passage de cette cellule de « masquée » à « révélée ».');
      description.style.cssText='font-size:13px;line-height:1.5';
      const count=element('p','','studio-status');count.setAttribute('role','status');
      const search=element('input');search.type='search';search.placeholder='Rechercher un son ou une vidéo…';
      search.setAttribute('aria-label','Rechercher dans les médias SoundShow');
      search.style.cssText='width:100%;padding:10px;background:#171320;border:1px solid #ad8e57;border-radius:7px;color:#fff1d5';
      const list=element('div');list.style.cssText='overflow-y:auto;max-height:min(48vh,430px);display:grid;gap:6px;margin-top:10px';
      const existing=window.DuneApp.getCellRevealMedia(nodeId);
      const selected=new Map(existing.map(v=>[v.id,v]));
      function showCatalog(){
        const catalog=choices(),filter=search.value.toLocaleLowerCase('fr');
        list.replaceChildren();
        if(!catalog.length){list.append(element('p','Aucun média disponible. Connecte d’abord SoundShow et vérifie que le projet est chargé.'));return;}
        const filtered=catalog.filter(v=>(v.name+' '+v.category).toLocaleLowerCase('fr').includes(filter)).slice(0,180);
        if(!filtered.length)list.append(element('p','Aucun média correspondant.'));
        for(const item of filtered){
          const row=element('div');row.style.cssText='display:flex;align-items:center;gap:10px;padding:8px;background:#211a2a;border:1px solid #d0ac7555;border-radius:8px';
          const checkbox=element('input');checkbox.type='checkbox';checkbox.checked=selected.has(item.id);checkbox.disabled=item.locked===true;
          checkbox.setAttribute('aria-label','Associer '+item.name);
          checkbox.onchange=()=>{
            if(checkbox.checked&&selected.size>=16){checkbox.checked=false;notice('16 médias au maximum par cellule.');return;}
            if(checkbox.checked)selected.set(item.id,{id:item.id,kind:item.kind,action:'start'});
            else selected.delete(item.id);statusUpdate();showCatalog();
          };
          const name=element('span',(item.kind==='video'?'▣ ':'♫ ')+item.name+' · '+(item.category||''));
          name.style.cssText='font-size:12px;flex:1;overflow-wrap:anywhere;color:#f3ddba';
          const action=element('select');action.setAttribute('aria-label','Mode de lecture pour '+item.name);
          action.style.cssText='max-width:135px;background:#2c2337;color:#f0d8aa;border:1px solid #b39366;border-radius:6px;padding:5px';
          for(const [value,label] of [['start','Normal'],['fade_in','Fondu d’entrée'],['crossfade','Fondu enchaîné'],['replace','Remplacer'],['toggle','Lecture / arrêt'],['toggle_fade','Lecture / fondu']]){
            const option=element('option',label);option.value=value;action.append(option);
          }
          action.value=selected.get(item.id)?.action||'start';action.disabled=!checkbox.checked;
          action.onchange=()=>{if(selected.has(item.id)){selected.get(item.id).action=action.value;}};
          row.append(checkbox,name,action);list.append(row);
        }
      }
      function statusUpdate(){count.textContent=selected.size+'/16 médias associés · '+(choices().length||0)+' éléments disponibles.';}
      search.oninput=showCatalog;
      const save=button('Enregistrer les médias',()=>{
        try{requireGM();
          const normalized=safeCellAttachments([...selected.values()],choices());
          if(normalized.length!==selected.size)throw Error('Un média choisi n’est plus disponible dans SoundShow. Actualise la liste.');
          window.DuneApp.setCellRevealMedia(nodeId,normalized);
          view.dialog.close();summary();
        }catch(error){view.status.textContent=error.message;}
      });save.style.cssText='margin-top:12px;padding:11px;background:#67512d;color:#fff0cd;border:1px solid #ead09a;border-radius:9px;cursor:pointer';
      view.content.append(description,count,search,list,save);
      const ready=()=>{statusUpdate();showCatalog();};
      ready();
      void refreshRemote?.().then(()=>{if(view.dialog.isConnected)ready();}).catch(()=>{});
      view.dialog.addEventListener('close',()=>{activeDialog=null;},{once:true});
    }catch(err){notice(err.message);}
  }
  const revealHandler=event=>{
    const s=state();if(closed||!embedded||!isGM()||s?.playerMode||s?.strictReadOnly)return;
    const media=safeCellAttachments(event.detail?.media,choices());
    if(!media.length)return;
    if(!getRemote()?.connected){notice('SoundShow n’est pas connecté : les médias liés à la cellule ne peuvent pas être lancés.');return;}
    void(async()=>{
      for(const item of media){
        if(closed||!isGM())break;
        try{await send({type:'play_playable',playable_id:item.id,action:item.action});}
        catch(error){notice('Média lié à la cellule : '+error.message);break;}
      }
    })();
  };
  window.addEventListener('archives:cell-revealed',revealHandler);
  const editModal=document.getElementById('active-editor-modal');
  const observer=new MutationObserver(()=>{
    if(editModal?.classList.contains('open'))summary();
  });
  if(editModal)observer.observe(editModal,{attributes:true,attributeFilter:['class']});
  summary();
  return {
    openPicker,
    refresh:summary,
    destroy(){closed=true;observer.disconnect();window.removeEventListener('archives:cell-revealed',revealHandler);if(activeDialog?.open)activeDialog.close();editorSlot?.replaceChildren();}
  };
}
