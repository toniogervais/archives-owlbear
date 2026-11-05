'use strict';
const TRUSTED_SOURCE_ORIGIN='https://toniogervais.github.io';
const REQUEST_TYPE='archives:return:v44';
const ACK_TYPE='archives:return:ack:v44';
const recent=new Set();
window.addEventListener('message',event=>{
 const data=event.data;
 if(event.origin!==TRUSTED_SOURCE_ORIGIN||
 event.source===window||
 data?.type!==REQUEST_TYPE||
 typeof data?.id!=='string'|| !/^[\w-]{1,100}$/.test(data.id)||
 recent.has(data.id))return;
 recent.add(data.id);
 if(recent.size>100)recent.clear();
 try{
  chrome.runtime.sendMessage({type:REQUEST_TYPE},response=>{
   const ok=!chrome.runtime.lastError&&response?.ok===true;
   try{event.source?.postMessage({type:ACK_TYPE,id:data.id,ok},event.origin)}catch{}
  });
 }catch{
  try{event.source?.postMessage({type:ACK_TYPE,id:data.id,ok:false},event.origin)}catch{}
 }
});
