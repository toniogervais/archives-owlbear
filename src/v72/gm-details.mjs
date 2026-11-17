import {element,button,sheet,isGM,notice} from '../v63/ui.mjs?v=4580';
function open() {
  if(!isGM())return;
  const state=window.DuneApp.getState(),node=state.nodes.find(n=>n.id===state.selectedId);
  if(!node||state.selectedLinkId)return;
  const view=sheet('archives-gm-details','Informations de la fiche MJ','Catégories privées · '+(node.title||'Cellule'));
  view.content.append(element('p','Ces catégories apparaissent sous le portrait de la fiche MJ. Elles restent privées, même si la cellule est révélée.','studio-hint'));
  const list=element('div');list.className='gm-details-list';view.content.append(list);
  function row(value={}) {
    const group=element('section'),name=element('input'),text=element('textarea');
    group.className='gm-detail-row';group.dataset.id=value.id||crypto.randomUUID();
    name.type='text';name.maxLength=120;name.value=value.title||'';name.placeholder='Nom de la catégorie : attitude, voix, passé…';name.setAttribute('aria-label','Nom de la catégorie');
    text.rows=4;text.maxLength=100000;text.value=value.text||'';text.placeholder='Informations réservées au MJ…';text.setAttribute('aria-label','Informations de la catégorie');
    const remove=button('Supprimer cette catégorie',()=>group.remove());group.append(name,text,remove);list.append(group);return name;
  }
  (node.gmDetails||[]).forEach(row);
  const add=button('＋ Nouvelle catégorie',()=>{if(list.children.length<128)row().focus()});add.id='archives-gm-details-add';
  const save=button('Enregistrer',()=>{
    try {
      if(window.DuneApp.getState().selectedId!==node.id)throw Error('La cellule active a changé. Rouvre ses informations.');
      window.DuneApp.setGmDetails(node.id,[...list.children].map(group=>({id:group.dataset.id,title:group.querySelector('input').value,text:group.querySelector('textarea').value})));
      view.dialog.close();notice('Catégories enregistrées dans la fiche MJ.');
    }catch(error){view.status.textContent=error.message}
  },'primary');view.content.append(add,save);
}
function install() {
  const header=document.querySelector('#active-editor-modal .settings-head');if(!header)return;
  const style=element('style');style.textContent=`
  #archives-gm-details-trigger{width:34px;height:34px;flex:0 0 auto;margin-left:auto;border:1px solid #c4aa72;border-radius:9px;background:#34253f;color:#ffe1a2;font-size:19px;cursor:pointer}
  #active-editor-modal[data-active-kind="link"] #archives-gm-details-trigger,body.player-mode #archives-gm-details-trigger,body.strict-readonly #archives-gm-details-trigger{display:none!important}
  #archives-gm-details .gm-details-list{display:flex;flex-direction:column;gap:15px;margin:16px 0}
  #archives-gm-details .gm-detail-row{padding:12px;border:1px solid #b49a6655;border-radius:10px;display:grid;gap:8px}
  #archives-gm-details input,#archives-gm-details textarea{box-sizing:border-box;width:100%;font:inherit;line-height:1.5;padding:10px;border:1px solid #9a8270;border-radius:7px;background:#15111c;color:#fff0dc}
  #archives-gm-details textarea{resize:vertical;min-height:100px}
  `;document.head.append(style);
  const trigger=button('☷',open);trigger.id='archives-gm-details-trigger';trigger.title='Catégories privées de la fiche MJ';trigger.setAttribute('aria-label',trigger.title);header.insertBefore(trigger,header.lastElementChild);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
