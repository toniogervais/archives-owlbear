export function publicConnection(value){
 if(!value||typeof value.url!=='string'||typeof value.key!=='string')throw Error('Lien de connexion invalide.');
 const url=value.url.trim().replace(/\/$/,''),key=value.key.trim();let allowed=key.startsWith('sb_publishable_');
 if(!allowed)try{allowed=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon'}catch{}
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!allowed||key.length>6000)throw Error('Ce lien doit contenir uniquement l’adresse du projet et sa clé publique.');
 return {url,key};
}
