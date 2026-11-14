import {validSnapshot} from '../v57/room.mjs?v=4210';
import {openFileLibrary,validateFile,validId} from '../v60/files.mjs?v=4210';
import {privateArtworkStore} from '../v58/model.mjs?v=4210';
import {digest} from '../v72/integrity.mjs?v=4490';
import {normalizeCrop} from '../v61/token-crop.mjs';

const signature = new TextEncoder().encode('ARCHIVES-CAMPAGNE/1\n');
export const maxBackupBytes = 2 * 1024 * 1024 * 1024;
const maxHeaderBytes = 64 * 1024 * 1024;
const keyName = 'ArchivesImaginaireImageSubcategories';
const categories = ['personnage','groupe','lieu','objet','ressource','evenement'];
const imageData = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const hexBytes = text => Uint8Array.from(text.match(/../g),pair => parseInt(pair,16));
const safeText = (value,max) => typeof value === 'string' && value.length <= max;
function validateManifest(value) {
  if (value?.format !== 'archives-campagne' || value.schema !== 1 || !validSnapshot(value.scenario) ||
      !Array.isArray(value.files) || value.files.length > 1000 || !Array.isArray(value.images) || value.images.length > 2000 ||
      !Array.isArray(value.presets) || value.presets.length > 10000) throw Error('Cette sauvegarde de campagne est invalide.');
  const ids = new Set();
  for (const entry of value.files) {
    if (!validId(entry.id) || ids.has(entry.id) || !safeText(entry.title,120) || !safeText(entry.name,240) ||
        !Number.isInteger(entry.size) || entry.size <= 0 || entry.size > 25 * 1024 * 1024 || !hashPattern.test(entry.hash) ||
        !Array.isArray(entry.links) || entry.links.length > 50 || !entry.links.every(link => safeText(link,300)))
      throw Error('Un fichier de la sauvegarde est invalide.');
    ids.add(entry.id);
  }
  ids.clear();
  for (const item of value.images) {
    if (!safeText(item.id,160) || !item.id || ids.has(item.id) || !safeText(item.name,240) ||
        !safeText(item.data,maxBackupBytes) || !imageData.test(item.data) || !categories.includes(item.category || 'personnage'))
      throw Error('Une image de la bibliothèque est invalide.');
    ids.add(item.id);
  }
  ids.clear();
  for (const preset of value.presets) {
    if (!safeText(preset.source,300) || !preset.source || ids.has(preset.source) || !hashPattern.test(preset.value?.identity) ||
        !['TOKEN','DOCUMENT'].includes(preset.value.kind)) throw Error('Un cadrage de la sauvegarde est invalide.');
    ids.add(preset.source);
  }
  if (value.subcategories && (typeof value.subcategories !== 'object' || Array.isArray(value.subcategories))) throw Error('Classement des images invalide.');
  return value;
}
export function backupSummary(manifest,bytes) {
  return {boards:manifest.scenario.boards.length,cells:manifest.scenario.boards.reduce((total,board) => total + board.nodes.length,0),
    files:manifest.files.length,images:manifest.images.length,presets:manifest.presets.length,created:manifest.created,bytes};
}
// Schema 2 stores original binary assets once, outside the small JSON index.
// Exact data-URI prefixes and explicit paths restore the original snapshot byte for byte.
const forbiddenPath = key => ['__proto__','prototype','constructor'].includes(String(key));
const dataPrefix = /^data:([^,\r\n]*);base64,/;
async function decodeDataUri(value,prefix) {
  const text=value.slice(prefix.length),parts=[];
  for(let offset=0;offset<text.length;offset+=1024*1024) {
    const part=text.slice(offset,offset+1024*1024);
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(part)||offset+part.length<text.length&&part.includes('='))throw Error('Un média intégré est invalide.');
    let bytes;try{const binary=atob(part);bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i)}catch{throw Error('Un média intégré est invalide.')}
    parts.push(bytes);if(offset&&offset%(4*1024*1024)===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return new Blob(parts);
}
async function encodeDataUri(blob,prefix) {
  const parts=[prefix],step=3*256*1024;
  for(let offset=0;offset<blob.size;offset+=step) {
    const bytes=new Uint8Array(await blob.slice(offset,offset+step).arrayBuffer());let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    parts.push(btoa(binary));
  }
  return parts.join('');
}
export async function packBackup(data) {
  if(!validSnapshot(data.scenario))throw Error('Cette sauvegarde de campagne est invalide.');
  const assets=[],blobs=[],byHash=new Map(),seenUris=new Map(),dataUris=[],files=[];
  let total=0;
  async function asset(blob,knownHash) {
    const hash=knownHash||await digest(blob),key=hash+':'+blob.size;
    if(byHash.has(key))return byHash.get(key);
    total+=blob.size;if(total>maxBackupBytes)throw Error('Cette sauvegarde dépasse 2 Go. Aucun original n’a été modifié.');
    const index=assets.length;byHash.set(key,index);assets.push({size:blob.size,hash});blobs.push(blob);return index;
  }
  async function extract(value,path) {
    if(typeof value==='string') {
      const match=dataPrefix.exec(value);
      if(!match||value.length===match[0].length)return value;
      let index=seenUris.get(value);
      if(index===undefined){index=await asset(await decodeDataUri(value,match[0]));seenUris.set(value,index)}
      dataUris.push({path,asset:index,prefix:match[0]});return null;
    }
    if(!value||typeof value!=='object')return value;
    if(path.length>100)throw Error('Le scénario contient trop de niveaux imbriqués.');
    const copy=Array.isArray(value)?[]:{};
    for(const key of Object.keys(value)){
      if(forbiddenPath(key))continue;
      copy[key]=await extract(value[key],path.concat(Array.isArray(value)?Number(key):key));
    }
    return copy;
  }
  // Validate the original library before removing its data fields from the index.
  validateManifest({format:'archives-campagne',schema:1,scenario:data.scenario,files:[],images:data.images||[],presets:data.presets||[],subcategories:data.subcategories||{}});
  const scenario=await extract(data.scenario,['scenario']),images=await extract(data.images||[],['images']);
  for(const {entry,blob} of data.files||[]) {
    const {mime,kind}=await validateFile(new File([blob],entry.name,{type:entry.mime})),hash=await digest(blob);
    if(hash!==entry.hash||blob.size!==entry.size)throw Error('Le fichier « '+entry.title+' » est incomplet. Réimporte son original avant de sauvegarder.');
    files.push({id:entry.id,title:entry.title,name:entry.name,mime,kind,size:blob.size,hash,created:Number(entry.created)||Date.now(),links:entry.links||[],asset:await asset(blob,hash)});
  }
  validateManifest({format:'archives-campagne',schema:1,scenario:data.scenario,files,images:data.images||[],presets:data.presets||[],subcategories:data.subcategories||{}});
  const manifest={format:'archives-campagne',schema:2,created:new Date().toISOString(),scenario,images,files,presets:data.presets||[],subcategories:data.subcategories||{},assets,dataUris};
  const header=new TextEncoder().encode(JSON.stringify(manifest));
  if(header.length>maxHeaderBytes)throw Error('L’index textuel de cette sauvegarde est trop volumineux. Aucun original n’a été modifié.');
  const length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,header.length,true);
  const blob=new Blob([signature,length,hexBytes(await digest(header)),header,...blobs],{type:'application/octet-stream'});
  if(blob.size>maxBackupBytes)throw Error('Cette sauvegarde dépasse 2 Go. Aucun original n’a été modifié.');
  const fingerprint=await digest(new TextEncoder().encode(JSON.stringify({...manifest,created:null})));
  return {blob,summary:backupSummary(manifest,blob.size),fingerprint};
}
export async function inspectBackup(blob) {
  if(!(blob instanceof Blob)||blob.size>maxBackupBytes||blob.size<signature.length+36)throw Error('Choisis une sauvegarde .archives de moins de 2 Go.');
  const fixed=new Uint8Array(await blob.slice(0,signature.length+36).arrayBuffer());
  if(!signature.every((byte,index)=>fixed[index]===byte))throw Error('Ce fichier n’est pas une sauvegarde de campagne .archives.');
  const length=new DataView(fixed.buffer).getUint32(signature.length,true),start=signature.length+36;
  if(!length||length>maxHeaderBytes||start+length>blob.size)throw Error('La sauvegarde est tronquée. Utilise une autre copie.');
  const header=new Uint8Array(await blob.slice(start,start+length).arrayBuffer());
  if(!(hexBytes(await digest(header))).every((byte,index)=>byte===fixed[signature.length+4+index]))throw Error('Le contenu de la sauvegarde a été altéré. Utilise une autre copie.');
  let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(header))}catch{throw Error('L’index de la sauvegarde est invalide.')}
  if(manifest?.schema===1)return inspectLegacyBackup(blob);
  if(manifest?.format!=='archives-campagne'||manifest.schema!==2||!Array.isArray(manifest.assets)||manifest.assets.length>20000||!Array.isArray(manifest.dataUris)||manifest.dataUris.length>50000||!Array.isArray(manifest.files))throw Error('Cette sauvegarde de campagne est invalide.');
  let offset=start+length;const assets=[];
  for(const entry of manifest.assets) {
    if(!Number.isSafeInteger(entry.size)||entry.size<=0||!hashPattern.test(entry.hash))throw Error('Un média de la sauvegarde est invalide.');
    if(offset+entry.size>blob.size)throw Error('Un média manque dans la sauvegarde. Aucune restauration n’a été faite.');
    const original=blob.slice(offset,offset+entry.size);offset+=entry.size;
    if(await digest(original)!==entry.hash)throw Error('Un média est endommagé. Aucune restauration n’a été faite.');
    assets.push(original);
  }
  if(offset!==blob.size)throw Error('La taille du fichier ne correspond pas à cette sauvegarde.');
  const decoded=new Map(),paths=new Set();let expanded=0;
  for(const ref of manifest.dataUris) {
    if(!Array.isArray(ref.path)||ref.path.length<2||ref.path.length>101||!['scenario','images'].includes(ref.path[0])||ref.path.some(key=>!(typeof key==='string'||Number.isInteger(key))||forbiddenPath(key))||!Number.isInteger(ref.asset)||!assets[ref.asset]||typeof ref.prefix!=='string'||ref.prefix.length>300||dataPrefix.exec(ref.prefix)?.[0]!==ref.prefix)throw Error('Une référence de média est invalide.');
    const key=JSON.stringify(ref.path);if(paths.has(key))throw Error('Une référence de média est répétée.');paths.add(key);
    let target=manifest;for(const part of ref.path.slice(0,-1)){
      if(!target||!Object.hasOwn(target,part))throw Error('Une référence de média est invalide.');target=target[part];
    }
    const last=ref.path.at(-1);if(!target||!Object.hasOwn(target,last)||target[last]!==null)throw Error('Une référence de média est invalide.');
    expanded+=assets[ref.asset].size;if(expanded>maxBackupBytes*4)throw Error('Le scénario déplié dépasse la capacité de cet appareil.');
    const assetKey=ref.asset+':'+ref.prefix;
    if(!decoded.has(assetKey))decoded.set(assetKey,await encodeDataUri(assets[ref.asset],ref.prefix));
    target[last]=decoded.get(assetKey);
  }
  const files=[];
  for(const entry of manifest.files) {
    if(!Number.isInteger(entry.asset)||!assets[entry.asset]||manifest.assets[entry.asset].size!==entry.size||manifest.assets[entry.asset].hash!==entry.hash)throw Error('Un fichier de la sauvegarde est invalide.');
    const blob=assets[entry.asset].slice(0,entry.size,entry.mime),{mime,kind}=await validateFile(new File([blob],entry.name,{type:entry.mime}));
    if(mime!==entry.mime||kind!==entry.kind)throw Error('Un fichier est endommagé. Aucune restauration n’a été faite.');
    files.push({entry:{id:entry.id,title:entry.title,name:entry.name,mime,kind,size:entry.size,hash:entry.hash,created:Number(entry.created)||Date.now(),links:entry.links?.slice(),released:false},blob});
  }
  validateManifest({...manifest,schema:1});
  return resultManifest(manifest,files,blob.size);
}
function resultManifest(manifest,files,bytes) {
  return {scenario:manifest.scenario,files,images:manifest.images.map(item=>({id:item.id,name:item.name,fileName:String(item.fileName||item.name).slice(0,240),mime:item.mime,data:item.data,width:item.width,height:item.height,created:Number(item.created)||Date.now(),category:item.category||'personnage',subcategory:String(item.subcategory||'').slice(0,120)})),
    presets:manifest.presets.map(({source,value})=>({source,value:{identity:value.identity,kind:value.kind,page:Number.isInteger(value.page)&&value.page>0?value.page:1,crop:normalizeCrop(value.crop)}})),subcategories:manifest.subcategories||{},summary:backupSummary(manifest,bytes)};
}
async function inspectLegacyBackup(blob) {
  if (!(blob instanceof Blob) || blob.size > maxBackupBytes || blob.size < signature.length + 36)
    throw Error('Choisis une sauvegarde .archives de moins de 2 Go.');
  const fixed = new Uint8Array(await blob.slice(0,signature.length + 36).arrayBuffer());
  if (!signature.every((byte,index) => fixed[index] === byte)) throw Error('Ce fichier n’est pas une sauvegarde de campagne .archives.');
  const length = new DataView(fixed.buffer).getUint32(signature.length,true),start = signature.length + 36;
  if (!length || length > maxHeaderBytes || start + length > blob.size) throw Error('La sauvegarde est tronquée. Utilise une autre copie.');
  const header = new Uint8Array(await blob.slice(start,start + length).arrayBuffer());
  const actual = hexBytes(await digest(header));
  if (!actual.every((byte,index) => byte === fixed[signature.length + 4 + index])) throw Error('Le contenu de la sauvegarde a été altéré. Utilise une autre copie.');
  let manifest;
  try { manifest = validateManifest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(header))); }
  catch (error) { throw Error('Lecture de la sauvegarde impossible : ' + error.message); }
  let offset = start + length;const files = [];
  for (const entry of manifest.files) {
    if (offset + entry.size > blob.size) throw Error('Un fichier manque dans la sauvegarde. Aucune restauration n’a été faite.');
    const file = blob.slice(offset,offset + entry.size,entry.mime);offset += entry.size;
    const {mime,kind} = await validateFile(new File([file],entry.name,{type:entry.mime}));
    if (mime !== entry.mime || kind !== entry.kind || await digest(file) !== entry.hash) throw Error('Le fichier « ' + entry.title + ' » est endommagé. Aucune restauration n’a été faite.');
    files.push({entry:{id:entry.id,title:entry.title,name:entry.name,mime,kind,size:entry.size,hash:entry.hash,
      created:Number(entry.created) || Date.now(),links:entry.links.slice(),released:false},blob:file});
  }
  if (offset !== blob.size) throw Error('La taille du fichier ne correspond pas à cette sauvegarde.');
  return {scenario:manifest.scenario,files,images:manifest.images.map(item => ({id:item.id,name:item.name,
    fileName:String(item.fileName || item.name).slice(0,240),mime:item.mime,data:item.data,width:item.width,height:item.height,
    created:Number(item.created) || Date.now(),category:item.category || 'personnage',subcategory:String(item.subcategory || '').slice(0,120)})),
    presets:manifest.presets.map(({source,value}) => ({source,value:{identity:value.identity,kind:value.kind,
      page:Number.isInteger(value.page) && value.page > 0 ? value.page : 1,crop:normalizeCrop(value.crop)}})),
    subcategories:manifest.subcategories || {},summary:backupSummary(manifest,blob.size)};
}
async function imageLibrary() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('ArchivesImaginaireImageLibrary',1);
    request.onupgradeneeded = () => request.result.createObjectStore('images',{keyPath:'id'}).createIndex('name','name');
    request.onerror = () => reject(request.error);request.onsuccess = () => resolve(request.result);
  });
}
function imagesRead(db) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction('images'),request = tx.objectStore('images').getAll();
    tx.oncomplete = () => resolve(request.result);tx.onabort = () => reject(tx.error);
  });
}
function imagesWrite(db,entries,replace = false) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction('images','readwrite'),store = tx.objectStore('images');
    if (replace) store.clear();for (const entry of entries) store.put(entry);
    tx.oncomplete = resolve;tx.onabort = () => reject(tx.error || Error('Restauration des images impossible.'));tx.onerror = () => {};
  });
}
export async function captureCampaign(room,owner,scenario,check = async () => {}) {
  await check();
  const files = await openFileLibrary(room,owner),art = await privateArtworkStore(room,owner),images = await imageLibrary();
  try {
    const entries = await files.list(),originals = [];
    for (const entry of entries) {
      await check();const blob = await files.blob(entry.id);
      if (!blob) throw Error('Original introuvable pour « ' + entry.title + ' ». Réimporte ce fichier avant de sauvegarder.');
      originals.push({entry,blob});
    }
    let subcategories = {};try { subcategories = JSON.parse(localStorage.getItem(keyName) || '{}'); } catch {}
    const result = {scenario,files:originals,images:await imagesRead(images),presets:await art.exportPresets(),subcategories};
    await check();return result;
  } finally { files.close();art.close();images.close(); }
}
async function checkpointStore(room,owner) {
  const db = await new Promise((resolve,reject) => {
    const open = indexedDB.open('archives-imaginaire-campaign-recovery',1);
    open.onupgradeneeded = () => open.result.createObjectStore('copies');
    open.onsuccess = () => resolve(open.result);open.onerror = () => reject(open.error);
  });
  const operate = (mode,fn) => new Promise((resolve,reject) => {
    const tx = db.transaction('copies',mode),request = fn(tx.objectStore('copies'));
    tx.oncomplete = () => resolve(request.result);tx.onabort = () => reject(tx.error || Error('Copie de sécurité impossible.'));tx.onerror = () => {};
  });
  return {get:() => operate('readonly',store => store.get([room,owner])),put:blob => operate('readwrite',store => store.put(blob,[room,owner])),close:() => db.close()};
}
export async function recoveryCopy(room,owner) {
  const store = await checkpointStore(room,owner);
  try { return await store.get(); } finally { store.close(); }
}
export async function restoreCampaign(room,owner,incoming,scenarioStore,currentScenario,check) {
  await check();const previous = await captureCampaign(room,owner,currentScenario,check);
  const copy = await packBackup(previous),recovery = await checkpointStore(room,owner);
  try { await check();await recovery.put(copy.blob); } finally { recovery.close(); }
  const files = await openFileLibrary(room,owner),art = await privateArtworkStore(room,owner),images = await imageLibrary();
  const restoreSubcategories = value => localStorage.setItem(keyName,JSON.stringify(value));
  try {
    await check();await files.restore(incoming.files);
    await check();await art.restorePresets(incoming.presets);
    await check();await imagesWrite(images,incoming.images);
    await check();restoreSubcategories({...previous.subcategories,...incoming.subcategories});
    await check();await scenarioStore.save(incoming.scenario);
    return {snapshot:incoming.scenario,summary:incoming.summary};
  } catch (error) {
    try {
      await files.restore(previous.files,true);await art.restorePresets(previous.presets,true);await imagesWrite(images,previous.images,true);
      restoreSubcategories(previous.subcategories);
    } catch { throw Error('Restauration interrompue. La copie de sécurité précédente est conservée dans Sauvegardes.'); }
    throw error;
  } finally { files.close();art.close();images.close(); }
}
