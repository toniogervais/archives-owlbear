import {hasRoll, topicsOf} from './themes.mjs?v=134';
import {normalize} from './model.mjs?v=134';
import {matchFacet,quickEquipmentFacet} from './catalog.mjs?v=134';

const EXTRA={pv:['moniteur','dommages','blessures'],armure:['armure','armor','defensif'],initiative:['initiative','i/di'],piratage:['piratage','hacking','pirater','matrice'],pirater:['piratage','hacking','hacker'],drone:['drone','drones'],pnj:['npc','pnj','professionnalisme'],recharger:['recharger','recharge','chargeur'],tirer:['tir','tirer','attaque','firearms'],soigner:['soins','soigner','guerison','premiers','healing','medikit'],blesse:['blesse','blessures','dommages'],bete:['creature','bete'],saignement:['saignement','bleeding'],crocheter:['crocheter','crochetage','serrure'],esquiver:['esquiver','esquive','defense','dodge'],negocier:['negocier','negociation','influence'],discretement:['furtivite','discretion','se faufiler'],grimper:['escalade','escalader'],frapper:['frapper','combat rapproche','melee'],courir:['sprinter','sprint','course'],pistolet:['pistolet','pistols'],fusil:['fusil','rifle'],soin:['soins','soigner','guerison']};
const STOP=new Set('a au aux avec ce cet cette ces c est dans de des du d en et faire faut il je jet jets le les la l mon ma mes ne on ou par pas pour qu que quel quelle quels quelles qui sa se ses son sur tel tels un une vous comment dois doit situation situations'.split(' '));
export function queryWords(query){return normalize(query).replace(/[^\p{L}\p{N}+/×-]+/gu,' ').split(/\s+/).filter(w=>w&&!STOP.has(w));}
export function makeAliases(terms={}){
 const aliases=new Map();
 for(const [a,b] of Object.entries(terms)){
  const x=normalize(a),y=normalize(b);
  for(const [key,val] of [[x,y],[y,x]]){if(!aliases.has(key))aliases.set(key,new Set());aliases.get(key).add(val);}
 }
 for(const [key,vals] of Object.entries(EXTRA)){const s=aliases.get(key)||new Set();vals.forEach(v=>s.add(normalize(v)));aliases.set(key,s);}
 return aliases;
}
export function prepareEntries(entries){return entries.map(e=>({...e,
 _topics:topicsOf(e),
 _title:normalize([e.title,e.name,e.originalTitle,e.original?.name].filter(Boolean).join(' ')),
 _tags:normalize((e.tags||[]).join(' ')),
 _text:normalize([e.title,e.name,e.originalTitle,e.kind,e.topic,e.category,e.habitat,...(e.pools||[]),...(e.path||[]),...(e.tags||[]),e.summary,...(e.steps||[]),...Object.values(e.procedure||{}),...(e.kit||[]),...(e.fields||[]).flatMap(f=>[f.label,f.value]),...Object.values(e.sections||{})].filter(Boolean).join(' '))}));}
function groups(query,aliases){
 const q=normalize(query),words=queryWords(query);
 const expanded=words.map(w=>[w,...(aliases.get(w)||[]),...(w.length>4&&w.endsWith('s')?[w.slice(0,-1)]:[])]);
 for(const [phrase,values] of aliases){if(phrase.includes(' ')&&q.includes(phrase)){for(let i=0;i<words.length;i++)if(phrase.split(' ').includes(words[i]))expanded[i].push(...values);}}
 return expanded;
}
// A single typo is accepted only if the exact/alias search has no results.
function nearWord(a,b){
 if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false;
 if(a.length===b.length){const d=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])d.push(i);return d.length===1||d.length===2&&d[1]===d[0]+1&&a[d[0]]===b[d[1]]&&a[d[1]]===b[d[0]];}
 if(a.length>b.length)[a,b]=[b,a];let i=0,j=0,skips=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;}else{if(++skips>1)return false;j++;}}return true;
}
export function searchEntries(entries,{query='',kind='',topic='',source='',favorites=null,limit=100,offset=0,practicalOnly=false,category='',family='',subcategory=''}={},aliases=new Map()){
 const gs=groups(query,aliases),q=normalize(query),meaning=queryWords(query).join(' ');let results=[];
 const candidates=entries.filter(e=>!(kind&&(kind==='rolls'?!hasRoll(e):e.kind!==kind)||topic&&!(e._topics||topicsOf(e)).includes(topic)||source&&e.source!==source||favorites&&!favorites.has(e.id)||category&&e.category!==category&&e.habitat!==category&&!(e.path||[]).some(p=>normalize(p)===normalize(category))||practicalOnly&&!e.summary&&!e.attributes&&!e.fields?.length||!matchFacet(e,{kind,topic,family,subcategory})));
 function collect(fuzzy=false){
  for(const e of candidates){
   if(gs.some(g=>!g.some(w=>e._text.includes(w)||e._title.includes(w)||fuzzy&&e._title.split(/[^\p{L}]+/u).some(t=>nearWord(w,t)))))continue;
   const score=(q&&e._title===q?1200:0)+(meaning&&e._title.includes(meaning)?260:0)+(q&&e._title.startsWith(q)?220:0)+gs.reduce((s,g)=>s+(g.some(w=>e._title.includes(w))?40:g.some(w=>e._tags?.includes(w))?28:1),0)+(meaning&&(e.tags||[]).some(t=>queryWords(t).join(' ')===meaning)?200:0)+(e.kind==='roll'? -18:0)+(e.procedure?90:0)+(e.summary?45:0)+(e.attributes?35:0)+(e.fields?.length?8:0)+(e.kind==='page'?-65:0);
   results.push({entry:e,score});
  }
 }
 collect();let corrected=false;if(!results.length&&gs.some(g=>g[0].length>=5)){collect(true);corrected=results.length>0;}
 results.sort((a,b)=>q?(b.score-a.score||(a.entry.title||a.entry.name).localeCompare(b.entry.title||b.entry.name,'fr')||a.entry.page-b.entry.page):((a.entry.title||a.entry.name).localeCompare(b.entry.title||b.entry.name,'fr')||a.entry.source.localeCompare(b.entry.source,'fr')||a.entry.page-b.entry.page));
 // Browse without a typed query: interleave items across families/types.
 // This avoids presenting only the first 75 alphabetic AK/crossbow variants.
 if(!q&&kind==='equipment'){
  const buckets=new Map();
  for(const result of results){
   const facet=quickEquipmentFacet(result.entry);
   const key=family?facet.subcategory:facet.family;
   if(!buckets.has(key))buckets.set(key,[]);
   buckets.get(key).push(result);
  }
  const order=[...buckets.values()],balanced=[];
  for(let i=0;balanced.length<results.length;i++){
   for(const bucket of order)if(i<bucket.length)balanced.push(bucket[i]);
  }
  results=balanced;
 }
 return {total:results.length,corrected,items:results.slice(offset,offset+limit).map(({entry:{_text,_title,_tags,...entry}})=>entry)};
}
export function libraryPages(library){return (library?.books||[]).flatMap(b=>b.pages.filter(p=>p.text.trim()).map(p=>({id:`page:${b.id}:${p.number}`,title:`${b.displayTitle||b.title} · p. ${p.printed>0?p.printed:'PDF '+p.number}`,kind:'page',source:b.id,topic:p.topic,page:p.number,printedPage:p.printed,summary:p.text.slice(0,190),_title:normalize(b.title),_text:normalize(p.text)})));}
export function profileText(e){
 const pl={test:'Jet',opposition:'Opposition',threshold:'Seuil',action:'Action',effect:'Effet',limits:'Limites',example:'Exemple'};
 return [e.title||e.name,e.summary,...(e.pools||[]),...Object.entries(e.procedure||{}).map(([k,v])=>`${pl[k]||k} : ${v}`),...(e.steps||[]),Object.entries(e.attributes||{}).map(([k,v])=>`${k} ${v}`).join(' · '),Object.entries(e.derived||{}).map(([k,v])=>`${k} ${v}`).join(' · '),...Object.entries(e.sections||{}).map(([k,v])=>`${k} : ${v}`),...(e.fields||[]).map(f=>`${f.label} : ${f.value}`),`${e.source} · p. ${e.printedPage}`].filter(Boolean).join('\n');
}
export function profileRolls(e){
 const a=e.attributes;if(!a)return [];
 const numeric=k=>/^\d+$/.test(a[k]??'')?Number(a[k]):null;
 const rows=[];const sum=(label,keys,extra=0)=>{const values=keys.map(numeric);if(values.some(v=>v===null))return;rows.push({label,value:`${values.reduce((s,n)=>s+n,extra)}D6`,formula:keys.map(k=>`${k} ${a[k]}`).join(' + ')+(extra?' + compétence '+extra:'')});};
 sum('Défense physique',['RÉA','INT']);sum('Résister aux dommages',['CON']);
 const skills=e.sections?.Compétences||'';
 for(const [label,skill,attr] of [['Perception','Perception','INT'],['Discrétion','Furtivité','AGI'],['Attaque de mêlée','Combat rapproché','AGI'],['Tir','Armes à feu','AGI'],['Lancement de sorts','Sorcellerie','MAG']]){
  const m=new RegExp('(?:^|[,;]\\s*)'+skill+'\\s+(\\d+)(?:\\b)').exec(skills);if(m)sum(label,[attr],Number(m[1]));
 }
 return rows;
}
