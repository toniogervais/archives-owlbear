/* V4.64 — Import sécurisé de fiches PNJ : JSON, CSV, TXT et PDF texte. */
const A=['CON','AGI','RÉA','FOR','VOL','LOG','INT','CHA','MAG','ESS'];
const C=['SD','I/DI','PA','ME','DÉPLACEMENT','DRAIN'];
const S={competences:['compétences','competences','skills'],sorts:['sorts','spells'],augmentations:['augmentations','implants'],equipement:['équipement','equipement','equipment','équipements'],armes:['armes','weapons'],pouvoirs:['pouvoirs','powers'],notes:['notes mj','notes','commentaires']};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[’']/g,"'").trim();
const aliases={CON:['CON','CONSTITUTION'],AGI:['AGI','AGILITE'], 'RÉA':['REA','REACTION'],FOR:['FOR','FORCE'],VOL:['VOL','VOLONTE'],LOG:['LOG','LOGIQUE'],INT:['INT','INTUITION'],CHA:['CHA','CHARISME'],MAG:['MAG','MAGIE'],ESS:['ESS','ESSENCE'],SD:['SD','SCORE DEFENSIF'],'I/DI':['I/DI','INITIATIVE','DES D INITIATIVE'],PA:['PA','POINTS D ATTAQUE'],ME:['ME','MONITEUR ETOURDISSEMENT'],'DÉPLACEMENT':['DEPLACEMENT','MOUVEMENT'],DRAIN:['DRAIN']};
const attrMap=new Map(A.flatMap(k=>aliases[k].map(alias=>[normalize(alias),['attributes',k]])));
const combatMap=new Map(C.flatMap(k=>aliases[k].map(alias=>[normalize(alias),['combat',k]])));
const secMap=new Map(Object.entries(S).flatMap(([k,vals])=>vals.map(alias=>[normalize(alias),['sections',k]])));
const keyOf=s=>{
 const n=normalize(s).replace(/[:\s]+$/,'').replace(/[_-]/g,' ').replace(/\s+/g,' ');
 if(attrMap.has(n))return attrMap.get(n);
 if(combatMap.has(n))return combatMap.get(n);
 if(secMap.has(n))return secMap.get(n);
 if(['PROFESSIONNALISME','PROFESSIONALISME','PROFESSIONALISM'].includes(n))return ['root','professionnalisme'];
 if(/^(PHYSIQUE|MONITEUR PHYSIQUE|DEGATS PHYSIQUES|POINTS DE VIE)$/.test(n))return ['condition','physical'];
 if(/^(ETOURDISSEMENT|MONITEUR ETOURDISSEMENT|DEGATS ETOURDISSANTS)$/.test(n))return ['condition','stun'];
 return null;
};
const sheet=()=>({attributes:{},combat:{},sections:{},condition:{}});
function put(out,key,value){
 const where=keyOf(key);if(!where)return false;
 const [group,field]=where;
 const val=String(value??'').trim();
 if(!val)return false;
 if(group==='root'){const n=Number(val);if(!Number.isInteger(n)||n<0||n>99)return false;out.professionnalisme=n;return true}
 if(group==='condition'){
  const numbers=val.match(/\d+/g)||[];
  if(numbers.length===0)return false;
  const total=Number(numbers.length>1?numbers[1]:numbers[0]),damage=Number(numbers.length>1?numbers[0]:0);
  if(total>60||total<0||damage>total)return false;
  out.condition[field]={total,damage};return true;
 }
 const limit=group==='sections'?12000:group==='attributes'?32:72;
 out[group][field]=val.slice(0,limit);return true;
}
const count=out=>Object.values(out.attributes).filter(Boolean).length+Object.values(out.combat).filter(Boolean).length+Object.values(out.sections).filter(Boolean).length+Object.keys(out.condition).length+(out.professionnalisme!==undefined?1:0);
function fromObject(raw){
 const object=raw?.npcSheet||raw?.npc||raw?.sheet||raw;
 if(!object||typeof object!=='object'||Array.isArray(object))throw Error('Le fichier JSON ne contient pas de fiche PNJ.');
 const result=sheet();
 for(const [k,v]of Object.entries(object)){
  if(['attributes','caracteristiques','caractéristiques','combat','sections'].includes(k)&&v&&typeof v==='object'&&!Array.isArray(v)){
   for(const [key,val]of Object.entries(v))put(result,key,val);
  }else if(k==='condition'&&v&&typeof v==='object'){
   for(const [kind,label]of [['physical','Physique'],['stun','Étourdissement']]){
    const x=v[kind];if(!x)continue;
    if(typeof x==='object'&&x.total!==undefined)put(result,label,(x.damage||0)+'/'+x.total);
    else put(result,label,x);
   }
  }else if(typeof v==='string'||typeof v==='number')put(result,k,v);
 }
 return result;
}
const parseCsvLine=(line,sep)=>{
 const fields=[];let value='',quote=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];if(c==='"'&&line[i+1]==='"'&&quote){value+='"';i++}
  else if(c==='"')quote=!quote;
  else if(c===sep&&!quote){fields.push(value.trim());value=''}
  else value+=c;
 }
 fields.push(value.trim());return fields;
};
function parseCSV(text){
 const rows=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),result=sheet();
 if(!rows.length)return result;
 const sep=rows[0].includes('\t')?'\t':rows[0].includes(';')?';':',';
 const parsed=rows.map(x=>parseCsvLine(x,sep));
 if(parsed.length>1&&parsed[0].length>2&&parsed[1].length===parsed[0].length){
  for(let i=0;i<parsed[0].length;i++)put(result,parsed[0][i],parsed[1][i]);
 }else{
  for(const row of parsed){
   if(row.length>=2)put(result,row[0],row.slice(1).join(sep));
  }
 }
 return result;
}
function parseText(text){
 const result=sheet(),lines=text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
 // Tables à deux lignes, telles que les encadrés de Shadowrun : noms puis valeurs.
 for(let i=0;i<lines.length-1;i++){
  const words=lines[i].split(/\s+/),values=lines[i+1].split(/\s+/);
  if(words.filter(x=>attrMap.has(normalize(x))).length>=5&&values.length>=words.length){
   for(let k=0;k<words.length;k++)put(result,words[k],values[k]);i++;
  }
 }
 // Libellés sur chaque ligne : CON : 3, Équipement : ...
 let section=null;
 for(const line of lines){
  const header=/^([^:]{2,54})\s*:\s*(.*)$/.exec(line);
  if(header){
   const key=keyOf(header[1]);
   if(key){if(put(result,header[1],header[2]))section=key[0]==='sections'?key[1]:null;
    else section=key[0]==='sections'?key[1]:null;
    continue}
  }
  const professional=/^Professionnalisme\s*:?\s*(\d{1,2})\b/i.exec(line);
  if(professional){put(result,'Professionnalisme',professional[1]);section=null;continue}
  // Paires courtes sur la même ligne (évite de confondre phrases de description).
  const stats=line.match(/(?:^|\s)(CON|AGI|RÉA|REA|FOR|VOL|LOG|INT|CHA|MAG|ESS)\s*:?\s*(-?\d+(?:[.,]\d+)?)(?=\s|$)/gi);
  if(stats&&stats.length>=2){for(const pair of stats){const match=pair.trim().match(/^(\S+)\s*:?\s*(\S+)/);if(match)put(result,match[1],match[2])}section=null;continue}
  if(section){const previous=result.sections[section]||'';result.sections[section]=(previous?previous+'\n':'')+line.slice(0,12000-previous.length)}
 }
 return result;
}
export function parseNpcText(text,filename='fiche.txt'){
 const content=String(text||'');if(content.length>1024*1024)throw Error('Le fichier texte est trop volumineux (1 Mo maximum).');
 const ext=String(filename).toLowerCase().split('.').pop();
 let result;
 if(ext==='json')result=fromObject(JSON.parse(content));
 else if(ext==='csv'||ext==='tsv')result=parseCSV(content);
 else result=parseText(content);
 if(count(result)<1)throw Error('Aucune caractéristique reconnue. Utilise des libellés comme CON, AGI, Professionnalisme, Armes ou Équipement.');
 return {fields:result,count:count(result)};
}
export async function readNpcFile(file){
 if(!file||file.size>5*1024*1024)throw Error('Fichier trop volumineux : 5 Mo maximum.');
 const ext=String(file.name).toLowerCase().split('.').pop();
 if(['json','txt','csv','tsv'].includes(ext))return parseNpcText(await file.text(),file.name);
 if(ext!=='pdf')throw Error('Formats acceptés : PDF texte, TXT, CSV et JSON.');
 let pdfjs;
 try{pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs')}
 catch{throw Error('Lecture PDF indisponible. Vérifie la connexion Internet ou importe un fichier TXT, CSV ou JSON.')}
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
 const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 if(doc.numPages>12)throw Error('Le document PDF dépasse 12 pages. Exporte seulement la fiche du personnage.');
 const pages=[];
 for(let i=1;i<=doc.numPages;i++){
  const content=await (await doc.getPage(i)).getTextContent();
  const rows=new Map();
  for(const item of content.items){
   if(!item.str?.trim())continue;
   const y=Math.round(item.transform?.[5]||0),x=item.transform?.[4]||0;
   if(!rows.has(y))rows.set(y,[]);
   rows.get(y).push({x,text:item.str});
  }
  pages.push([...rows].sort((a,b)=>b[0]-a[0]).map(([,words])=>words.sort((a,b)=>a.x-b.x).map(w=>w.text).join(' ')).join('\n'));
 }
 const extracted=pages.join('\n');
 if(!extracted.trim())throw Error('Ce PDF ne contient pas de texte extractible. Pour un PDF scanné, utilise une transcription TXT ou une fiche JSON.');
 return parseNpcText(extracted,'fiche.txt');
}
window.ArchivesNpcImport={parseNpcText,readNpcFile};
