import {isGM,element} from '../v63/ui.mjs?v=4590';
function install(){
 const panel=document.getElementById('active-editor-description-panel'),modal=document.getElementById('active-editor-modal');if(!panel||!modal)return;
 const section=element('section'),label=element('label','Description MJ — privée'),text=element('textarea'),hint=element('p','Visible dans la fiche MJ uniquement. La description générale reste indépendante.');
 section.id='archives-gm-description-field';label.htmlFor='archives-gm-description';text.id='archives-gm-description';text.setAttribute('aria-label','Description MJ — privée');text.rows=5;text.maxLength=100000;hint.className='studio-hint';section.append(label,text,hint);panel.append(section);
 const css=element('style');css.textContent='#archives-gm-description-field{margin-top:16px;padding-top:12px;border-top:1px solid #a18a5d66}#archives-gm-description-field label{display:block;font-weight:700;color:#eed291;margin-bottom:8px}body.player-mode #archives-gm-description-field,body.strict-readonly #archives-gm-description-field{display:none!important}';document.head.append(css);
 const draw=()=>{
  const s=window.DuneApp?.getState?.(),node=s?.nodes.find(n=>n.id===s.selectedId),show=isGM()&&node&&!s.selectedLinkId&&modal.classList.contains('open');
  section.hidden=!show;if(!show){text.value='';delete text.dataset.id;return}
  const changed=text.dataset.id!==node.id;text.dataset.id=node.id;if(changed||document.activeElement!==text)text.value=node.gmDescription||'';
 };
 text.oninput=()=>{if(isGM()&&text.dataset.id)window.DuneApp.setGmDescription(text.dataset.id,text.value)};
 new MutationObserver(draw).observe(modal,{attributes:true,attributeFilter:['class','data-active-kind']});
 new MutationObserver(draw).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('archives:public-view',draw);draw();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
