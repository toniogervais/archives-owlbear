/* V4.31 — hébergement automatique et privé des rendus de tokens.
   Seul le MJ authentifié peut écrire dans son dossier Supabase Storage.
   Les URL signées sont des capacités d'accès temporaires : ne jamais les
   publier dans la scène ni le canal joueur avant une révélation volontaire. */
import {artworkBlob,blobDigest,maxImageBytes} from './model.mjs?v=4310';

export const TOKEN_BUCKET='archives-owlbear-assets';
// 90 days avoids imminent broken assets while limiting URL exposure.
// Existing tokens can be re-signed during a subsequent GM transfer.
export const SIGNED_URL_SECONDS=90*24*60*60;
const objectExt={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};

export function hostedArtworkPath(ownerId,hash,mime) {
  if(!/^[a-f0-9-]{36}$/i.test(ownerId)||!/^[a-f0-9]{64}$/i.test(hash)||!objectExt[mime])
    throw Error('Identifiant de stockage du token invalide.');
  return ownerId+'/'+hash.toLowerCase()+'.'+objectExt[mime];
}
export function safeHostedImage(value) {
  if(!value||!['image/png','image/jpeg','image/webp'].includes(value.mime)||
    !Number.isInteger(value.width)||!Number.isInteger(value.height)||
    value.width<1||value.height<1||value.width>2400||value.height>3200||
    typeof value.url!=='string'||value.url.length>2400)return false;
  let url;
  try{url=new URL(value.url);}catch{return false;}
  return url.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)&&
    url.pathname.includes('/storage/v1/object/sign/'+TOKEN_BUCKET+'/')&&
    !!url.searchParams.get('token')&&!url.username&&!url.password;
}
export async function ensureHostedArtwork(art,{bridge=globalThis.ArchivesCloudBridge,report=()=>{}}={}){
  if(!bridge?.getClient)throw Error('Le stockage automatique nécessite la connexion Supabase des Archives.');
  const client=bridge.getClient();
  const auth=await client.auth.getUser();
  const user=auth.data?.user;
  if(auth.error||!user?.id)throw Error('Connecte ton compte MJ dans les réglages Supabase des Archives pour activer le transfert automatique.');
  const blob=artworkBlob(art);
  if(blob.size>maxImageBytes)throw Error('Le token dépasse la limite de stockage de 5 Mo.');
  const hash=await blobDigest(blob);
  const path=hostedArtworkPath(user.id,hash,art.mime);
  const bucket=client.storage.from(TOKEN_BUCKET);
  report('Envoi sécurisé de l’image HD vers Supabase…');
  const upload=await bucket.upload(path,blob,{contentType:art.mime,upsert:false,cacheControl:'31536000'});
  // A matching hash belongs to the same owner; already uploaded is normal.
  if(upload.error&&!(/already exists|duplicate/i.test(upload.error.message||'')||upload.error.statusCode==='409'))
    throw Error('Stockage automatique indisponible : '+upload.error.message+
      '. Vérifie que le script SQL du bucket privé est installé.');
  const signed=await bucket.createSignedUrl(path,SIGNED_URL_SECONDS);
  if(signed.error||!signed.data?.signedUrl)
    throw Error('Impossible de signer le lien privé du token : '+(signed.error?.message||'URL manquante'));
  // The unsigned storage path and private auth token never leave the editor.
  const image={url:signed.data.signedUrl,mime:art.mime,width:art.width,height:art.height};
  if(!safeHostedImage(image))throw Error('Le lien sécurisé retourné par Supabase est inattendu.');
  return {image,hash,path};
}
