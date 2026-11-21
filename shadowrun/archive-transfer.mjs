import {profileSkillPools,profileChoicePools} from './profile-pools.mjs?v=139';

const MAX_LINK_LENGTH=70000;
const clean=(v,n=12000)=>String(v??'').slice(0,n);
const sourceRef=e=>[e.source==='core'?'Livre de base':e.source==='feu'?'Feu nourri':e.source==='companion'?'Compagnon du Sixième Monde':e.source==='rigger'?'À tombeau ouvert':e.source==='hacker'?'Hacker vaillant':e.source==='wild'?'Vie sauvage':e.source||'Source', 'p. '+(e.printedPage||e.page)].join(' · ');
const lines=(obj={},limit=50)=>Object.entries(obj).filter(([,v])=>v!==''&&v!=null).slice(0,limit).map(([k,v])=>k+' : '+clean(v,110)).join('\n');
function npcSheet(e){
 const pools=profileSkillPools(e);
 const attributes={};for(const key of ['CON','AGI','RÉA','FOR','VOL','LOG','INT','CHA','MAG','ESS'])attributes[key]=clean(e.attributes?.[key],32);
 const combat={};for(const key of ['SD','SD sans armure','I/DI','PA','ME','Moniteur physique','Moniteur étourdissant','DÉPLACEMENT','DRAIN'])combat[key]=clean(e.derived?.[key]??e.derived?.[key==='DÉPLACEMENT'?'Déplacement':key],72);
 const choices=profileChoicePools(e);
 const choicesText=choices.map(g=>g.title+'\n'+g.rows.map(r=>r.name+' : '+(r.total===null?'non chiffré':r.total+' D6')+(r.choiceSpecialization===null||r.choiceSpecialization===undefined?'':' ; avec spécialisation : '+r.choiceSpecialization+' D6')).join('\n')+'\n'+(g.disclaimer||'')).join('\n\n');
 const sections={
  competences:pools.length?pools.map(s=>s.name+' : '+(s.total===null?'non chiffré':s.total+' D6')+(s.specializations||[]).map(x=>' ; '+x.name+' : '+(x.total===null?'non chiffré':x.total+' D6')).join('')).join('\n'):clean(e.sections?.Compétences),
  sorts:clean(e.sections?.Sorts),augmentations:clean(e.sections?.Augmentations),
  equipement:clean(e.sections?.Équipement),armes:clean(e.sections?.Armes),
  pouvoirs:clean(e.sections?.Pouvoirs),notes:'Source : '+sourceRef(e)+'\n'+Object.entries(e.sections||{}).filter(([k])=>!['Compétences','Sorts','Augmentations','Équipement','Armes','Pouvoirs'].includes(k)).map(([k,v])=>k+' : '+v).join('\n')+(choicesText?'\nCompétences au choix (exclusives) :\n'+choicesText:'')+'\n'+(e.fields||[]).map(f=>f.label+' : '+f.value).join('\n')
 };
 const total=Number.parseInt(String(e.derived?.ME||''),10);
 const constitution=Number.parseInt(String(e.attributes?.CON||''),10);
 const volonte=Number.parseInt(String(e.attributes?.VOL||''),10);
 const physique=Number.parseInt(String(e.derived?.['Moniteur physique']||''),10);
 const etourdissement=Number.parseInt(String(e.derived?.['Moniteur étourdissant']||''),10);
 const physical=Number.isFinite(physique)?physique:Number.isFinite(total)?total:Number.isFinite(constitution)?8+Math.ceil(constitution/2):0;
 const stun=Number.isFinite(etourdissement)?etourdissement:Number.isFinite(total)?total:Number.isFinite(volonte)?8+Math.ceil(volonte/2):0;
 return {attributes,combat,sections,condition:{
  physical:{total:Math.min(physical,60),damage:0},
  stun:{total:Math.min(stun,60),damage:0}
 }};
}
export function toArchiveCell(e){
 if(!e||!['equipment','npc','creature'].includes(e.kind))throw Error('Seuls les équipements, PNJ et créatures sont transférables.');
 const person=e.kind==='npc'||e.kind==='creature';
 const title=clean(e.title||e.name,180);
 if(!title)throw Error('Fiche sans nom.');
 const descriptions=[e.summary,e.description].filter(Boolean).map(x=>clean(x,2000));
 const source=sourceRef(e),kind=person?'personnage':'objet';
 const gmDetails=[
  {title:'Référence de l’ouvrage',text:source},
  {title:'Caractéristiques',text:person?lines(e.attributes)+'\n'+lines(e.derived):e.fields?.map(f=>clean(f.label,100)+' : '+clean(f.value,200)).join('\n')||''}
 ];
 const pools=person?profileSkillPools(e):[];
 if(person)for(const [name,text] of Object.entries(e.sections||{}))
  if(text&&!(name==='Compétences'&&pools.length))gmDetails.push({title:clean(name,100),text:clean(text,9000)});
 if(person&&e.fields?.length)gmDetails.push({title:'Autres caractéristiques et informations de contact',text:e.fields.map(f=>clean(f.label)+' : '+clean(f.value)).join('\n')});
 const choices=person?profileChoicePools(e):[];
 if(choices.length)gmDetails.push({title:'Compétences exclusives au choix',text:choices.map(g=>g.title+' : '+g.rows.map(r=>r.name+' '+(r.total===null?'non chiffré':r.total+' D6')).join(' ; ')).join('\n')});
 if(e.kind==='equipment')gmDetails.push({title:'Catégorie et type',text:[e.category,...(e.path||[])].filter(Boolean).join(' › ')});
 if(pools.length)gmDetails.push({title:'Pools de D6',text:pools.map(s=>{
   const parts=[s.name+' : '+(s.total===null?'non chiffré':s.total+' D6')];
   for(const x of s.specializations||[])parts.push('Spécialisation '+x.name+' : '+(x.total===null?'non chiffré':x.total+' D6'));
   return parts.join(' ; ');
  }).join('\n')});
 const node={title,category:kind,shape:person?'octagon':'diamond',
  color:person?'#d4af37':'#9b59b6',border:'double',w:person?300:280,h:person?190:170,
  desc:descriptions.join('\n\n'),gmDescription:'Fiche Shadowrun 6 · '+source,
  faction:person?'Shadowrun 6':clean(e.category,150),revealed:false,bgImg:'',
  clues:[],gmDetails,sourceRef:{app:'shadowrun-6-compendium',id:clean(e.id,160),source:e.source,page:e.page,printedPage:e.printedPage}
 };
 if(person)node.npcSheet=npcSheet(e);
 return node;
}
function toBase64(bytes){
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function encodeArchiveImport(payload){
 const text=JSON.stringify(payload),raw=new TextEncoder().encode(text);
 if(raw.length>100000)throw Error('Cette fiche est trop volumineuse pour un transfert direct.');
 if(typeof CompressionStream==='function'){
  const stream=new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed=new Uint8Array(await new Response(stream).arrayBuffer());
  return 'gz.'+toBase64(compressed);
 }
 return 'json.'+toBase64(raw);
}
export async function archivesImportUrl(e,destination){
 if(!['canvas','library'].includes(destination))throw Error('Destination Archives invalide.');
 const payload={schema:'archives-sr6-transfer',version:1,destination,node:toArchiveCell(e)};
 const code=await encodeArchiveImport(payload);
 // If the compendium is opened *inside* Les Archives, keep the active campaign
 // and transfer the cell directly; no URL navigation, tab or public Owlbear data.
 try{
  const parent=window.parent;
  if(parent!==window&&parent.document?.getElementById('archives-sr6-frame')?.contentWindow===window){
   parent.postMessage({type:'archives:sr6-transfer:v1',code:'json.'+toBase64(raw)},location.origin);
   return 'Fiche envoyée aux Archives de cette campagne.';
  }
 }catch{/* Separate Owlbear iframe: use the main Archives window below. */}
 const url=new URL('../archives-app-v64-v55.html?v=4721&resume=1',import.meta.url);
 url.hash='sr6i='+code;
 if(url.href.length>MAX_LINK_LENGTH)throw Error('Cette fiche est trop longue : utilise l’export JSON.');
 return url.href;
}
// Synchronous navigation preserves the user's click gesture (popup blockers).
// Archives main is already named "archives-main" by its navigation module: reuse
// that window instead of opening duplicate tabs or unscoped Owlbear modals.
function currentArtworkThumbnail(){
 const area=document.querySelector('#detail .art-section');
 if(!area||!area.querySelector('h3')?.textContent?.includes('Illustration du livre'))return '';
 const image=area.querySelector('.plate-thumb img[src]');
 if(!image?.complete||!image.naturalWidth||!image.naturalHeight)return '';
 try{
  const canvas=document.createElement('canvas');canvas.width=180;canvas.height=180;
  const ctx=canvas.getContext('2d');
  const ratio=Math.min(180/image.naturalWidth,180/image.naturalHeight);
  const w=image.naturalWidth*ratio,h=image.naturalHeight*ratio;
  ctx.drawImage(image,(180-w)/2,(180-h)/2,w,h);
  const result=canvas.toDataURL('image/webp',.55);
  return result.length<28000&&result.startsWith('data:image/webp;base64,')?result:'';
 }catch{return '';}
}

export function sendToArchives(e,destination){
 if(!['canvas','library'].includes(destination))throw Error('Destination invalide.');
 const payload={schema:'archives-sr6-transfer',version:1,destination,node:toArchiveCell(e)};
 payload.node.bgImg=currentArtworkThumbnail();
 const raw=new TextEncoder().encode(JSON.stringify(payload));
 if(raw.length>45000)throw Error('Cette fiche est trop longue pour un lien direct.');
 const url=new URL('../archives-app-v64-v55.html?v=4721&resume=1',import.meta.url);
 url.hash='sr6i=json.'+toBase64(raw);
 if(url.href.length>MAX_LINK_LENGTH)throw Error('Cette fiche dépasse la taille du lien.');
 const target=window.open(url.href,'archives-main');
 if(!target)throw Error('Autorise les fenêtres depuis le compendium pour ouvrir Les Archives.');
 target.focus?.();
 return 'Les Archives s’ouvrent avec cette fiche. Le MJ conserve le choix du canevas ou de la réserve.';
}
