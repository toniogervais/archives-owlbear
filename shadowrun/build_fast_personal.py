"""Make the user's existing complete HTML lighter without publishing book text.

Usage: python3 shadowrun/build_fast_personal.py input.html output.html
The source and output files must remain outside the public repository.
"""
import base64,gzip,json,re,sys
from pathlib import Path

def safe(data):return json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
source=Path(sys.argv[1]);target=Path(sys.argv[2]);html=source.read_text()
match=re.search(r'<script type="application/json" id="data">([\s\S]*?)</script>',html)
if not match:raise ValueError('The complete V2 source is required.')
data=json.loads(match[1]);data['version']='2.1';data['date']='2026-11-19'
# Preserve the current edition's carefully audited tables and divergences, and
# carry forward the additional independently written procedures and contacts.
public=Path(__file__).parent/'data'
known={re.sub(r'[^a-z0-9]','',g['title'].lower()) for g in data['guides']}
field_names={'test':'Jet de dés','opposition':'Opposition','threshold':'Seuil','action':'Action et timing','effect':'Effet','limits':'Limites','cost':'Karma','example':'Exemple'}
for r in json.loads((public/'rules.json').read_text()):
    k=re.sub(r'[^a-z0-9]','',r['title'].lower())
    if k in known:continue
    known.add(k);p=r.get('procedure',{})
    fields=[[field_names.get(k,k),v] for k,v in p.items() if k!='test']+[[f['label'],f['value']] for f in r.get('fields',[])]
    warning=r.get('warning','')
    if 'récupérer naturellement' in r['title'].lower():warning='La règle française indique Constitution + Volonté ; un exemple indique Constitution + Constitution. La fiche Repos : physique conserve les deux passages.'
    data['guides'].append(dict(id=r['id'],title=r['title'],topic=r['topic'],summary=r['summary'],formula=p.get('test',''),fields=fields,steps=r.get('steps',[]),refs=[dict(source=r['source'],page=r['page'])],quotes=[],tags=r.get('tags',[]),warning=warning,optional=r.get('optional',False),related=r.get('related',[]),kind='guide',source=r['source'],page=r['page'],verified=True))
for p in json.loads((public/'profiles.json').read_text()):
    if p['source']=='companion' and not any(x['id']==p['id'] for x in data['profiles']):
        data['profiles'].append({**p,'name':p['title']})
zip_text=base64.b64encode(gzip.compress(safe(data).encode(),compresslevel=9,mtime=0)).decode()
seed={**data,'books':[{**b,'pages':[]} for b in data['books']],'index':[],'equipment':[],'profiles':[],'tests':[],'legacyGuides':[],'facsimiles':{}}
seed['totals']={k:len(data[k]) for k in ['guides','index','equipment','profiles','tests','legacyGuides']}
seed['totals']['pages']=sum(b['pageCount'] for b in data['books'])
html=html[:match.start()]+ '<script type="application/json" id="data">'+safe(seed)+'</script>\n<script type="application/octet-stream" id="sr6-packed">'+zip_text+'</script>'+html[match.end():]
script=re.search(r'<script>([\s\S]*?)</script>',html)
js=script[1]
start=js.index('for(const c of D.guides)');end=js.index('function sectionText',start)
js=js[:start]+'''for(const c of D.guides)add({...c,type:'guide'});
const nextTask=()=>new Promise(resolve=>setTimeout(resolve,0));
async function ingest(rows,convert){let n=0;for(const row of rows){add(convert(row));if(++n%100===0)await nextTask();}}
async function buildFullCatalog(){
 CARDS.length=0;PAGE_CARDS.length=0;
 await ingest(D.guides,c=>({...c,type:'guide'}));
 await ingest(D.index,e=>({...e,type:'rule',summary:'',refs:[{source:e.source,page:e.page}],searchText:sectionText(e,5000)}));
 await ingest(D.legacyGuides,e=>({...e,type:'rule',summary:'',refs:[{source:e.source,page:e.page}],searchText:ptext(e.source,e.page),legacy:true}));
 await ingest(D.equipment,e=>({...e,title:e.name,type:'equipment',topic:'equipement',refs:[{source:e.source,page:e.tablePage||e.page}],fields:(e.fields||[]).map(f=>[f.label,f.value]),searchText:[e.category,...(e.path||[])].join(' ')}));
 await ingest(D.profiles,e=>({...e,title:e.name,type:'profile',topic:e.kind==='npc'?'mj':'creatures',refs:[{source:e.source,page:e.page}],searchText:Object.values(e.sections||{}).join(' ')}));
 await ingest(D.tests,e=>({...e,type:'test',summary:'',refs:[{source:e.source,page:e.page}],searchText:ptext(e.source,e.page).slice(e.start,e.end).trim()}));
 let n=0;for(const b of D.books)for(const p of b.pages){const c={id:`page-${b.id}-${p.number}`,title:`${b.displayTitle} — ${plabel(b.id,p.number)}`,type:'page',source:b.id,page:p.number,topic:p.topic,_nt:norm(b.displayTitle),_tags:'',_nb:norm(p.text)};PAGE_CARDS.push(c);BY_ID.set(c.id,c);if(++n%60===0)await nextTask();}
}
'''+js[end:]
js=js.replace("const p=b?.pages[n-1]?.printed;", "const p=b?.pages[n-1]?.printed??(n-(b?.printedOffset??2));")
js=js.replace("if(!p)return '<p>Page indisponible.</p>';", "if(!p)return '<p>Les fiches pratiques sont déjà disponibles. Le texte des ouvrages se prépare…</p>';")
js=js.replace("BOOKS.get('core').pages[243].layout", "BOOKS.get('core').pages[243]?.layout||''")
# Source quotes are available on demand; they do not expand long passages by default.
js=js.replace('<details open><summary>Extrait exact du manuel</summary>', '<details><summary>Extrait exact du manuel</summary>')
for field in ['equipment','profiles','index','tests']:
    js=js.replace('D.'+field+'.length', '(D.totals?.'+field+'??D.'+field+'.length)')
# Refresh the coverage and book information after asynchronous hydration as well.
a=js.index("$('bookList').innerHTML=");b=js.index('applyFont();home();',a)
js=js[:a]+'function updateBookInformation(){\n'+js[a:b].replace('V2 — 19/11/2026','V2.1 — 19/11/2026')+'\n}\nupdateBookInformation();\n'+js[b:]
js+='''
const packedNode=document.getElementById('sr6-packed');
const loadingStatus=document.getElementById('loadingStatus');
async function unpackOnDevice(packed){
 if(typeof DecompressionStream==='undefined')throw Error('La lecture des textes complets nécessite un navigateur récent.');
 const bytes=Uint8Array.from(atob(packed),c=>c.charCodeAt(0));
 return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
async function decodeBooks(packed){
 const taskCode=`onmessage=async({data})=>{try{const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));const value=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());postMessage({value});}catch(e){postMessage({error:e.message});}};`;
 let worker,url;
 try{
  url=URL.createObjectURL(new Blob([taskCode],{type:'text/javascript'}));worker=new Worker(url);
  return await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('La préparation des livres a pris trop de temps. Les fiches pratiques restent disponibles.')),15000);
   worker.onmessage=({data})=>{clearTimeout(timer);data.error?reject(Error(data.error)):resolve(data.value);};
   worker.onerror=()=>{clearTimeout(timer);reject(Error('La lecture en arrière-plan est indisponible.'));};worker.postMessage(packed);
  });
 }catch{return unpackOnDevice(packed);}
 finally{worker?.terminate();if(url)URL.revokeObjectURL(url);}
}
async function loadBooks(){
 loadingStatus.textContent='Fiches prêtes · préparation des livres…';loadingStatus.dataset.state='loading';
 try{
  const full=await decodeBooks(packedNode.textContent.trim());
  Object.assign(D,full);BOOKS.clear();for(const b of D.books)BOOKS.set(b.id,b);
  await buildFullCatalog();updateBookInformation();
  loadingStatus.textContent='Tout le contenu est prêt';loadingStatus.dataset.state='ready';
  if(S.active)openCard(S.active,false);else{home();paintResults();}
  packedNode.remove();
 }catch(error){loadingStatus.textContent=error.message+' Les fiches restent consultables.';loadingStatus.dataset.state='error';}
}
// Let the first usable screen paint before reading the complete book payload.
setTimeout(loadBooks,0);
'''
js='(()=>{\n'+js+'\n})();'
html=html[:script.start(1)]+js+html[script.end(1):]
html=html.replace('<title>SR6 — Compendium de consultation</title>','<title>SR6 — Compendium de consultation rapide</title>')
html=html.replace('</style>','\n#loadingStatus{display:block;font-size:.76rem;color:var(--muted);max-width:310px}#loadingStatus[data-state="ready"]{color:var(--accent)}\n</style>',1)
html=html.replace('<div class="header-actions">','<div class="header-actions"><span id="loadingStatus" role="status">Fiches prêtes · préparation des livres…</span>',1)
html=html.replace('>V2<','>V2.1<')
target.parent.mkdir(parents=True,exist_ok=True);target.write_text(html)
(target.parent/'SR6_V2_1_main.js').write_text(js)
print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'previousBytes':source.stat().st_size,'guides':len(data['guides']),'profiles':len(data['profiles']),'pages':seed['totals']['pages']}))
