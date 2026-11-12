import {button,element,isGM,sheet} from '../v63/ui.mjs';
import {pictureFrame,frameFields,frameTransform} from './picture-model.mjs';

const pointers=new Map();let active=false,gesture,node,frame,flushTimer;
const state=()=>window.DuneApp?.getState?.();
const selected=()=>{const s=state();return s&&!s.selectedLinkId?s.nodes.find(item=>item.id===s.selectedId):null;};
const commit=(id,fields)=>window.DuneApp.commitCellPicture(id,fields);
function chooseLibrary(id,items) {
  const current=state()?.nodes?.find(item=>item.id===id);
  if(!isGM()||!current)return;
  const view=sheet('archives-cell-image-library','Choisir une image','Pour la cellule : '+(current.title||'Sans titre'));
  const search=element('input'),grid=element('div',null,'studio-grid'),tools=element('div',null,'studio-tools'),type=element('select'),subcategory=element('select');
  const types=[['','Tous les types'],['personnage','Personnages'],['groupe','Groupes'],['lieu','Lieux'],['objet','Objets'],['ressource','Ressources'],['evenement','Événements']];
  search.type='search';search.placeholder='Rechercher une image…';search.setAttribute('aria-label','Rechercher une image de la bibliothèque');
  type.setAttribute('aria-label','Type d’image');subcategory.setAttribute('aria-label','Sous-catégorie d’image');
  for(const [value,label] of types){const option=element('option',label);option.value=value;type.append(option)}
  type.value=types.some(([value])=>value===current.category)&&items.some(item=>(item.category||'personnage')===current.category)?current.category:'';
  function categories(){
    const names=[...new Set(items.filter(item=>!type.value||(item.category||'personnage')===type.value).map(item=>item.subcategory||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
    subcategory.replaceChildren(element('option','Toutes les sous-catégories'));subcategory.firstChild.value='';
    for(const name of names){const option=element('option',name);option.value=name;subcategory.append(option)}
  }
  tools.append(type,subcategory);view.content.append(search,tools,grid);
  function render(){
    grid.replaceChildren();const query=search.value.toLocaleLowerCase('fr');
    for(const item of items.filter(item=>(!type.value||(item.category||'personnage')===type.value)&&(!subcategory.value||item.subcategory===subcategory.value)&&String(item.name).toLocaleLowerCase('fr').includes(query))){
      const card=element('article',null,'studio-card'),image=element('img');image.src=item.data;image.alt=item.name;image.loading='lazy';
      image.style.objectFit='contain';
      card.append(image,element('h3',item.name),button('Utiliser cette image',()=>{finishPictureGesture();commit(id,{bgImg:item.data,bgZoom:1,bgOffsetX:0,bgOffsetY:0,bgFit:'contain'});view.dialog.close();}));grid.append(card);
    }
    if(!grid.children.length)grid.append(element('p',items.length?'Aucune image dans cette sélection. Essaie un autre type ou efface la recherche.':'Ta bibliothèque est vide. Ajoute des images depuis le catalogue des Archives.','studio-hint'));
    view.status.textContent=grid.querySelectorAll('article').length+' image(s) disponible(s).';
  }
  search.oninput=subcategory.onchange=render;type.onchange=()=>{categories();render()};categories();render();
}
function chooseCellLibrary(){const current=selected();if(isGM()&&current)window.ArchivesImageLibrary?.pickForCell(current.id)}
function chooseSource() {
  const current=selected();if(!isGM()||!current)return;
  const id=current.id,view=sheet('archives-cell-image-source','Ajouter une image','Cellule : '+(current.title||'Sans titre'));
  const actions=element('div',null,'studio-actions'),online=element('div');online.hidden=true;
  const url=element('input');url.type='url';url.placeholder='https://…/image.jpg';url.setAttribute('aria-label','Adresse directe de l’image');
  const apply=button('Utiliser cette image',()=>{
    let address;try{address=new URL(url.value);if(address.protocol!=='https:'||address.username||address.password)throw Error();}
    catch{view.status.textContent='Colle l’adresse HTTPS du fichier image.';return;}
    const image=new Image();view.busy(true);
    image.onload=()=>{finishPictureGesture();commit(id,{bgImg:address.href,bgZoom:1,bgOffsetX:0,bgOffsetY:0,bgFit:'contain'});view.dialog.close();};
    image.onerror=()=>{view.status.textContent='Cette adresse ne fournit pas une image accessible. Tu peux importer son fichier depuis ton ordinateur.';view.busy(false);};image.src=address.href;
  });
  online.append(element('p','Dans Google Images, ouvre l’image choisie puis copie son adresse directe ici.','studio-hint'),url,apply);
  actions.append(button('Rechercher sur Google',()=>{
    online.hidden=false;
    window.open('https://www.google.com/search?tbm=isch&q='+encodeURIComponent(current.title||'JDR illustration'),'_blank','noopener,noreferrer');url.focus();
  }),button('Choisir sur l’ordinateur',()=>{
    const input=element('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';
    input.onchange=()=>{
      const file=input.files?.[0];if(!file)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>25*1024*1024){view.status.textContent='Choisis une image PNG, JPG ou WebP de moins de 25 Mo.';return;}
      const reader=new FileReader();reader.onload=()=>{finishPictureGesture();commit(id,{bgImg:reader.result,bgZoom:1,bgOffsetX:0,bgOffsetY:0,bgFit:'contain'});view.dialog.close();};reader.onerror=()=>{view.status.textContent='Le fichier ne peut pas être lu.';};reader.readAsDataURL(file);
    };input.click();
  }),button('Bibliothèque des Archives',()=>{view.dialog.close();window.ArchivesImageLibrary.pickForCell(id);}));
  view.content.append(element('p','Choisis la source de l’image. Tu pourras ensuite zoomer et la déplacer dans l’aperçu.','studio-hint'),actions,online);
}
function install() {
  if(!isGM())return;
  const stage=document.getElementById('active-editor-preview-stage');if(!stage)return;
  const tools=element('div',null,'cell-picture-tools'),label=element('label','Zoom de l’image'),range=element('input'),output=element('output'),hint=element('p','Attrape l’image pour la déplacer. Zoome avec la molette, le curseur ou deux doigts.','studio-hint');
  range.type='range';range.id='archives-cell-image-zoom';range.min='15';range.max='800';range.value='100';range.setAttribute('aria-label','Zoom de l’image dans la cellule');label.htmlFor=range.id;
  const fit=mode=>{finish();const current=selected();if(current?.bgImg)commit(current.id,{bgFit:mode,bgZoom:1,bgOffsetX:0,bgOffsetY:0});};
  const entire=button('Image entière',()=>fit('contain'),'btn btn-inline'),fill=button('Remplir la cellule',()=>fit('cover'),'btn btn-inline');
  entire.title='Afficher toute la photo en conservant ses proportions';fill.title='Remplir la cellule en recadrant la photo';
  tools.style.flexWrap='wrap';tools.append(entire,fill,label,range,output);stage.after(tools,hint);stage.style.touchAction='none';
  function draw(){
    const current=node||selected();if(!current?.bgImg)return;
    const value=frame||pictureFrame(current);
    for(const cell of document.querySelectorAll('#world .node-cell,#active-editor-preview-stage .node-cell')){
      if(cell.closest('#world')&&cell.dataset.id!==current.id)continue;
      const image=cell.querySelector('.cell-bg-img-layer');if(!image)continue;
      image.style.backgroundSize=current.bgFit==='contain'?'contain':'cover';image.style.backgroundPosition='50% 50%';image.style.transform=frameTransform(value);
    }
    range.value=String(Math.round(value.zoom*100));output.value=range.value+' %';
  }
  function finish(){
    if(!active)return;active=false;pointers.clear();gesture=null;stage.classList.remove('picture-dragging');
    if(node&&frame)commit(node.id,{...frameFields(frame),bgFit:node.bgFit==='contain'?'contain':'cover'});
    node=frame=null;
  }
  function begin(){
    const current=selected();if(!current?.bgImg)return false;
    clearTimeout(flushTimer);node=current;frame=pictureFrame(current);active=true;return true;
  }
  function geometry(){
    const cell=stage.querySelector('.node-cell'),rect=cell?.getBoundingClientRect()||stage.getBoundingClientRect(),image=cell?.querySelector('.cell-bg-img-layer');
    return {width:Math.max(1,image?image.clientWidth*rect.width/cell.offsetWidth:rect.width),height:Math.max(1,image?image.clientHeight*rect.height/cell.offsetHeight:rect.height)};
  }
  function baseline(){
    const values=[...pointers.values()],rect=geometry();
    gesture={frame:{...frame},rect,point:values[0],distance:values.length>1?Math.hypot(values[1].x-values[0].x,values[1].y-values[0].y):0,
      centre:values.length>1?{x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2}:values[0]};
  }
  stage.addEventListener('pointerdown',event=>{
    if(event.button!==0||(!active&&!begin()))return;
    clearTimeout(flushTimer);
    event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});stage.setPointerCapture(event.pointerId);stage.classList.add('picture-dragging');baseline();
  });
  stage.addEventListener('pointermove',event=>{
    if(!active||!pointers.has(event.pointerId))return;event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const values=[...pointers.values()],centre=values.length>1?{x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2}:values[0];
    frame=pictureFrame({bgZoom:values.length>1&&gesture.distance?gesture.frame.zoom*Math.hypot(values[1].x-values[0].x,values[1].y-values[0].y)/gesture.distance:gesture.frame.zoom,
      bgOffsetX:gesture.frame.x+(centre.x-gesture.centre.x)/gesture.rect.width,bgOffsetY:gesture.frame.y+(centre.y-gesture.centre.y)/gesture.rect.height});draw();
  });
  function up(event){if(!pointers.delete(event.pointerId))return;if(!pointers.size)finish();else baseline();}
  stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);stage.addEventListener('lostpointercapture',up);
  range.oninput=()=>{if(!active&&!begin())return;frame.zoom=Number(range.value)/100;draw();clearTimeout(flushTimer);flushTimer=setTimeout(finish,180);};
  stage.addEventListener('wheel',event=>{if(!selected()?.bgImg)return;event.preventDefault();if(!active&&!begin())return;frame.zoom=Math.max(.15,Math.min(8,frame.zoom*Math.exp(-event.deltaY*.0015)));draw();clearTimeout(flushTimer);flushTimer=setTimeout(finish,180);},{passive:false});
  stage.addEventListener('dblclick',event=>{if(!selected()?.bgImg){event.preventDefault();chooseSource();}});
  const observer=new MutationObserver(()=>{
    if(active)return;const current=selected();tools.hidden=hint.hidden=!current?.bgImg;stage.classList.toggle('picture-editable',!!current?.bgImg);
    if(current?.bgImg){const value=pictureFrame(current);range.value=String(Math.round(value.zoom*100));output.value=range.value+' %';
      entire.setAttribute('aria-pressed',String(current.bgFit==='contain'&&value.zoom===1&&value.x===0&&value.y===0));
      fill.setAttribute('aria-pressed',String(current.bgFit!=='contain'&&value.zoom===1&&value.x===0&&value.y===0));}
  });observer.observe(stage,{childList:true});
  window.addEventListener('blur',finish);document.getElementById('active-editor-modal')?.addEventListener('transitionend',()=>{if(!document.getElementById('active-editor-modal').classList.contains('open'))finish();});
  window.ArchivesCellPicture={get isInteracting(){return active;},finish,chooseSource,chooseLibrary,chooseCellLibrary};tools.hidden=hint.hidden=true;
}
function finishPictureGesture(){window.ArchivesCellPicture?.finish();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
