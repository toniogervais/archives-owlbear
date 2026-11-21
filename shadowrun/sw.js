const CACHE='archives-sr6-compendium-1.4.3';
const FILES=['./','./index.html','./app.css','./app.mjs','./model.mjs','./reader.mjs','./source-descriptions.mjs','./content.mjs','./themes.mjs','./catalog.mjs','./profile-pools.mjs','./profile-sections.mjs','./action-types.mjs','./edge-catalog.mjs','./edge-general.mjs','./edge-combat.mjs','./edge-special.mjs','./translation.mjs','./archive-transfer.mjs','./window-controls.mjs','./table-books.mjs','./panel-size.mjs','./pdf-import.mjs','./search.mjs','./search-worker.mjs','./storage.mjs','./bridge.mjs','./bridge-core.mjs','./icon.svg','./data/sources.json','./data/index.json','./data/equipment.json','./data/profiles.json','./data/rules.json','./data/coverage.json','./data/terminology.json','../assets/owlbear-transfer-sdk-v55.mjs'].map(path=>path+'?v=144');
const allowed=new Set(FILES.map(p=>new URL(p,self.location.href).pathname));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('archives-sr6-compendium-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin||!allowed.has(u.pathname))return;
 e.respondWith(fetch(e.request).then(async r=>{if(r.ok){const cache=await caches.open(CACHE);await cache.put(e.request,r.clone());}return r;}).catch(async()=>{const cached=await caches.match(e.request,{ignoreSearch:true});if(cached)return cached;throw Error('Cette ressource n’a pas encore été conservée sur cet appareil.');}));
});
