import {normalize} from './model.mjs';

const EXTRA={pv:['moniteur','dommages','blessures'],points:['points'],vie:['etat','moniteur'],armure:['armure','armor','defensif'],initiative:['initiative','i/di'],piratage:['piratage','hacking','cracking','matrice'],decker:['decker','hacker'],drone:['drone','drones'],pnj:['npc','pnj','professionnalisme'],recharger:['recharger','recharge'],tirer:['tir','tirer','attaque','firearms'],soigner:['soins','guerison','premiers','healing'],bete:['creature','bete'],saignement:['saignement','bleeding']};
export function makeAliases(terms={}){
 const aliases=new Map();
 for(const [a,b] of Object.entries(terms)){
  const x=normalize(a),y=normalize(b);
  for(const [key,val] of [[x,y],[y,x]]){if(!aliases.has(key))aliases.set(key,new Set());aliases.get(key).add(val);}
 }
 for(const [key,vals] of Object.entries(EXTRA)){const s=aliases.get(key)||new Set();vals.forEach(v=>s.add(normalize(v)));aliases.set(key,s);}
 return aliases;
}
export function prepareEntries(entries){return entries.map(e=>({...e,_title:normalize([e.title,e.name,e.originalTitle,e.original?.name].filter(Boolean).join(' ')),_text:normalize([e.title,e.name,e.originalTitle,e.kind,e.topic,e.category,e.habitat,...(e.path||[]),...(e.tags||[]),e.summary,...(e.steps||[]),...(e.fields||[]).flatMap(f=>[f.label,f.value]),...Object.values(e.sections||{})].filter(Boolean).join(' '))}));}
function groups(query,aliases){
 const q=normalize(query);if(!q)return [];
 const words=q.split(' ').filter(Boolean);const expanded=words.map(w=>[w,...(aliases.get(w)||[])]);
 // A phrase such as "combat rapproché" also matches its original English name.
 for(const [phrase,values] of aliases){if(phrase.includes(' ')&&q.includes(phrase)){for(let i=0;i<words.length;i++)if(phrase.split(' ').includes(words[i]))expanded[i].push(...values);}}
 return expanded;
}
export function searchEntries(entries,{query='',kind='',topic='',source='',favorites=null,limit=100,offset=0}={},aliases=new Map()){
 const gs=groups(query,aliases),q=normalize(query);let results=[];
 for(const e of entries){
  if(kind&&e.kind!==kind||topic&&e.topic!==topic||source&&e.source!==source||favorites&&!favorites.has(e.id))continue;
  if(gs.some(g=>!g.some(w=>e._text.includes(w)||e._title.includes(w))))continue;
  const score=(q&&e._title===q?1000:0)+(q&&e._title.startsWith(q)?220:0)+gs.reduce((s,g)=>s+(g.some(w=>e._title.includes(w))?35:1),0)+(e.summary?8:0)+(e.attributes?8:0)+(e.kind==='page'?-40:0);
  results.push({entry:e,score});
 }
 results.sort((a,b)=>b.score-a.score||(a.entry.title||a.entry.name).localeCompare(b.entry.title||b.entry.name,'fr')||a.entry.page-b.entry.page);
 return {total:results.length,items:results.slice(offset,offset+limit).map(({entry:{_text,_title,...entry}})=>entry)};
}
export function libraryPages(library){return (library?.books||[]).flatMap(b=>b.pages.filter(p=>p.text.trim()).map(p=>({id:`page:${b.id}:${p.number}`,title:`${b.displayTitle||b.title} · p. ${p.printed>0?p.printed:'PDF '+p.number}`,kind:'page',source:b.id,topic:p.topic,page:p.number,printedPage:p.printed,summary:p.text.slice(0,190),_title:normalize(b.title),_text:normalize(p.text)})));}
export function profileText(e){
 return [e.title||e.name,`${e.source} · p. ${e.printedPage}`,Object.entries(e.attributes||{}).map(([k,v])=>`${k} ${v}`).join(' · '),Object.entries(e.derived||{}).map(([k,v])=>`${k} ${v}`).join(' · '),...Object.entries(e.sections||{}).map(([k,v])=>`${k} : ${v}`)].join('\n');
}
