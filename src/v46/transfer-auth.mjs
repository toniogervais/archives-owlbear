// V4.6 — Login optionnel du MJ à Supabase depuis le menu de l'extension Owlbear.
// La session reste stockée par le SDK Supabase de ce site; jamais le mot de passe.
import { O as OBR } from "../../assets/index-BfJgTiPE.js";
import { c as createClient } from "../../assets/index-D5xPhma_.js";
import { publicConfig } from "../v37/session.mjs";

const $=id=>document.getElementById(id);
const status=$("archives-v46-auth-status");
const form=$("archives-v46-auth-form");
const email=$("archives-v46-email");
const password=$("archives-v46-password");
const configPanel=$("archives-v46-config");
const endpoint=$("archives-v46-url");
const publicKey=$("archives-v46-key");
const reconnect=$("archives-v46-auth-logout");
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
  if(await role()!=="GM"){form.hidden=true;say("Connexion réservée au meneur.");return;}
  const config=fillConfig();
  if(!config){say("Renseigne les paramètres publics de ton projet Supabase (une seule fois).");return;}
  const current=getClient(config);
  const session=await current.auth.getUser();
  if(session.error)throw session.error;
  const user=session.data?.user;
  if(user){
    say("Transferts : compte MJ connecté ("+String(user.email||"").slice(0,80)+").");
    password.value="";
    reconnect.hidden=false;
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
    say("Compte connecté. Actualise une fois Owlbear pour activer le transfert automatique des tokens.");
    reconnect.hidden=false;
  }catch(e){password.value="";say("Connexion impossible : "+(e.message||String(e)));}
  finally{working=false;submit.disabled=false;}
});
reconnect.addEventListener("click",async()=>{
  try{
    if(await role()!=="GM")return;
    await getClient().auth.signOut();
    reconnect.hidden=true;
    say("Compte déconnecté dans l'extension Owlbear.");
  }catch(e){say("Déconnexion impossible : "+e.message);}
});
OBR.onReady(()=>{void check().catch(error=>say("État non disponible : "+error.message));});
