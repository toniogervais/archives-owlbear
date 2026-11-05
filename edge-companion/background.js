'use strict';
const ARCHIVES_ORIGIN='https://toniogervais.github.io';
const ARCHIVES_PREFIX='/archives-owlbear/';
const FALLBACK_URL=ARCHIVES_ORIGIN+ARCHIVES_PREFIX+'archives-app-v53-v41.html?resume=1';
const VALID_PAGES=new Set([
 'archives-app-v53-v41.html','archives-app-v52-v40.html',
 'archives.html','archives-integrated-v39.html'
]);
function isOwlbear(url){
 try{const u=new URL(url);return u.protocol==='https:'&&
 (u.hostname==='www.owlbear.rodeo'||u.hostname==='owlbear.rodeo')}catch{return false}
}
function isArchivesTab(tab){
 try{
  const u=new URL(tab?.url||'');
  return u.origin===ARCHIVES_ORIGIN&&u.pathname.startsWith(ARCHIVES_PREFIX)&&
  VALID_PAGES.has(u.pathname.slice(ARCHIVES_PREFIX.length))
 }catch{return false}
}
function priority(tab,windowId){
 return (tab.windowId===windowId?100:0)
 +(tab.url?.includes('archives-app-v53-v41.html')?40:0)
 +(tab.active?5:0);
}
async function focusArchives(windowId){
 const tabs=await chrome.tabs.query({url:ARCHIVES_ORIGIN+ARCHIVES_PREFIX+'*'});
 const found=tabs.filter(isArchivesTab).sort((a,b)=>priority(b,windowId)-priority(a,windowId))[0];
 if(found?.id!==undefined){
  await chrome.tabs.update(found.id,{active:true});
  await chrome.windows.update(found.windowId,{focused:true});
  return {ok:true,reused:true};
 }
 await chrome.tabs.create({windowId,url:FALLBACK_URL,active:true});
 return {ok:true,reused:false};
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message?.type!=='archives:return:v44'||!sender.tab||!isOwlbear(sender.tab.url))return false;
 focusArchives(sender.tab.windowId).then(sendResponse).catch(error=>
  sendResponse({ok:false,error:String(error?.message||error).slice(0,150)})
 );
 return true;
});
