// V4.6 — Login optionnel du MJ à Supabase depuis le menu de l'extension Owlbear.
// La session reste stockée par le SDK Supabase de ce site; jamais le mot de passe.
import { O as OBR } from "../../assets/index-BfJgTiPE.js";
import { c as createClient } from "../../assets/index-D5xPhma_.js";
import { publicConfig, SCENE_KEY, data } from "../v37/session.mjs";

const $=id=>document.getElementById(id);
const status=$("archives-v46-auth-status");
const form=$("archives-v46-auth-form");
const email=$("archives-v46-email");
const password=$("archives-v46-password");
const configPanel=$("archives-v46-config");
const endpoint=$("archives-v46-url");
const publicKey=$("archives-v46-key");
const reconnect=$("archives-v46-auth-logout");
const setup=$("archives-v55-transfer-setup");
const campaign=$("archives-v55-transfer-campaign");
const activate=$("archives-v55-transfer-scene");
let db=null,working=false;

function say(value){status.textContent=String(value||"").slice(0,250);}
function role(){return OBR.player.getRole();}
function findConfig(){
  try {return publicConfig(localStorage);}
  catch {return null;}
}
function fillConfig(){
  const saved=findConfig();
  endpoint.value=saved?.url||localStorage.getItem("archives_supabase_url")||"";
  publicKey.value=saved?.key||localStorage.getItem("archives_supabase_public_key")||"";
  configPanel.open=!saved;
  return saved;
}
function getClient(configuration){
  const cfg=configuration||findConfig();
  if(!cfg)throw Error("Ajoute l’URL Supabase et sa clé publique dans « Réglages de connexion ».");
  if(!db) db=createClient(cfg.url,cfg.key,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
  return db;
}
async function check(){
  if(await role()!=="GM"){form.closest("details").hidden=true;return;}
  const config=fillConfig();
  if(!config){say("Renseigne les paramètres publics de ton projet Supabase (une seule fois).");return;}
  const current=getClient(config);
  if(!data(await current.auth.getSession())?.session){say("Connecte le compte MJ pour activer les transferts.");return;}
  const session=await current.auth.getUser();
  if(session.error)throw session.error;
  const user=session.data?.user;
  if(user){
    say("Transferts : compte MJ connecté ("+String(user.email||"").slice(0,80)+").");
    password.value="";
    reconnect.hidden=false;
    const owned=data(await current.from("campaigns").select("id,name").eq("owner_id",user.id).order("name"))||[];
    campaign.replaceChildren(new Option("Choisir une campagne…",""),...owned.map(row=>new Option(row.name||row.id,row.id)));
    if(owned.length===1)campaign.value=owned[0].id;
    setup.hidden=!owned.length;
  }else{
    say("Compte MJ non connecté pour les transferts. Connecte-le ici une seule fois.");
    reconnect.hidden=true;
  }
}
async function saveConfig(){
  const url=endpoint.value.trim(),key=publicKey.value.trim();
  if(!url||!key){
    if(findConfig())return findConfig();
    throw Error("URL Supabase et clé publique nécessaires pour la première connexion.");
  }
  // Validate with the same trusted config routine used by the existing extension.
  const previous=findConfig();
  const entries=[
    "archives_owlbear_public_config_v27",
    "archives_supabase_url","archives_supabase_public_key"
  ];
  const oldValues=new Map(entries.map(k=>[k,localStorage.getItem(k)]));
  try{
    localStorage.setItem("archives_owlbear_public_config_v27",JSON.stringify({url,key}));
    localStorage.setItem("archives_supabase_url",url);
    localStorage.setItem("archives_supabase_public_key",key);
    const verified=publicConfig(localStorage);
    if(db && (!previous||verified.url!==previous.url||verified.key!==previous.key))
      db=null;
    return verified;
  }catch(e){
    entries.forEach(k=>{
      const old=oldValues.get(k);
      if(old===null)localStorage.removeItem(k);
      else localStorage.setItem(k,old);
    });
    throw e;
  }
}
form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(working)return;
  working=true;
  const submit=$("archives-v46-auth-submit");
  submit.disabled=true;
  try{
    if(await role()!=="GM")throw Error("Réservé au meneur.");
    const cfg=await saveConfig();
    const mail=email.value.trim(),pass=password.value;
    if(!mail||!pass)throw Error("Renseigne ton e-mail et ton mot de passe Archives.");
    say("Connexion au compte Archives…");
    const result=await getClient(cfg).auth.signInWithPassword({email:mail,password:pass});
    if(result.error)throw result.error;
    password.value="";
    configPanel.open=false;
    await check();
  }catch(e){password.value="";say("Connexion impossible : "+(e.message||String(e)));}
  finally{working=false;submit.disabled=false;}
});
reconnect.addEventListener("click",async()=>{
  try{
    if(await role()!=="GM")return;
    await getClient().auth.signOut();
    reconnect.hidden=true;setup.hidden=true;
    say("Compte déconnecté dans l'extension Owlbear.");
  }catch(e){say("Déconnexion impossible : "+e.message);}
});
activate.addEventListener("click",async()=>{
  if(activate.disabled)return;
  activate.disabled=true;
  try{
    if(await role()!=="GM")throw Error("Réservé au meneur.");
    const id=campaign.value;
    if(!id)throw Error("Choisis une campagne.");
    if(!await OBR.scene.isReady())throw Error("Ouvre une scène Owlbear.");
    const roomId=OBR.room.id;
    const client=getClient();
    const user=data(await client.auth.getUser())?.user;
    if(!user)throw Error("Reconnecte le compte MJ.");
    const owned=data(await client.from("campaigns").select("owner_id").eq("id",id).maybeSingle());
    if(owned?.owner_id!==user.id)throw Error("Choisis une campagne qui t’appartient.");
    const link=data(await client.from("owlbear_room_links").select("room_id").eq("campaign_id",id).maybeSingle());
    if(link?.room_id && link.room_id!==roomId &&
      !window.confirm("Cette campagne est reliée à une autre salle. La relier à la salle ouverte ?"))return;
    if(link?.room_id!==roomId){
      data(await client.from("owlbear_room_links").upsert({
        campaign_id:id,room_id:roomId,updated_by:user.id,updated_at:new Date().toISOString()
      },{onConflict:"campaign_id"}));
    }
    if(OBR.room.id!==roomId||!await OBR.scene.isReady())throw Error("La salle ou la scène a changé.");
    let scene=(await OBR.scene.getMetadata())?.[SCENE_KEY];
    if(!/^[A-Za-z0-9_-]{8,128}$/.test(scene||"")){
      scene=crypto.randomUUID();
      await OBR.scene.setMetadata({[SCENE_KEY]:scene});
    }
    if((await OBR.scene.getMetadata())?.[SCENE_KEY]!==scene)throw Error("La scène a changé.");
    data(await client.rpc("archives_set_active_scene",{p_campaign_id:id,p_scene_key:scene}));
    say("Scène prête à recevoir les éléments de cette campagne.");
  }catch(error){say(error.message||String(error));}
  finally{activate.disabled=false;}
});
OBR.onReady(()=>{void check().catch(error=>say("État non disponible : "+error.message));});
