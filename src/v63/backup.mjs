import {validSnapshot} from '../v57/room.mjs?v=4200';
import {openFileLibrary,validateFile,digest,validId} from '../v60/files.mjs?v=4200';
import {privateArtworkStore} from '../v58/model.mjs?v=4200';
import {normalizeCrop} from '../v61/token-crop.mjs';

const signature = new TextEncoder().encode('ARCHIVES-CAMPAGNE/1\n');
export const maxBackupBytes = 512 * 1024 * 1024;
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
        !safeText(item.data,36 * 1024 * 1024) || !imageData.test(item.data) || !categories.includes(item.category || 'personnage'))
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
export async function packBackup(data) {
  const files = [],blobs = [];
  for (const record of data.files || []) {
    const {entry,blob} = record;
    const file = new File([blob],entry.name,{type:entry.mime});
    const {mime,kind} = await validateFile(file),hash = await digest(blob);
    if (hash !== entry.hash || blob.size !== entry.size) throw Error('Le fichier « ' + entry.title + ' » est incomplet. Réimporte son original avant de sauvegarder.');
    files.push({id:entry.id,title:entry.title,name:entry.name,mime,kind,size:blob.size,hash,
      created:Number(entry.created) || Date.now(),links:entry.links || []});blobs.push(blob);
  }
  const manifest = validateManifest({format:'archives-campagne',schema:1,created:new Date().toISOString(),
    scenario:data.scenario,files,images:data.images || [],presets:data.presets || [],subcategories:data.subcategories || {}});
  const header = new TextEncoder().encode(JSON.stringify(manifest));
  if (header.length > maxHeaderBytes) throw Error('Le scénario et la bibliothèque d’images dépassent 64 Mo. Réduis les images avant cette sauvegarde.');
  const length = new Uint8Array(4);new DataView(length.buffer).setUint32(0,header.length,true);
  const blob = new Blob([signature,length,hexBytes(await digest(header)),header,...blobs],{type:'application/octet-stream'});
  if (blob.size > maxBackupBytes) throw Error('Cette sauvegarde dépasse 512 Mo. Enregistre séparément les médias les plus volumineux.');
  return {blob,summary:backupSummary(manifest,blob.size)};
}
export async function inspectBackup(blob) {
  if (!(blob instanceof Blob) || blob.size > maxBackupBytes || blob.size < signature.length + 36)
    throw Error('Choisis une sauvegarde .archives de moins de 512 Mo.');
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
