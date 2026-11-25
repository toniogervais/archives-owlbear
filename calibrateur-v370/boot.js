(function(){
 let origin="",readyEvent=null,seen=0,replayed=false;const embedded=window.parent!==window;const ref=new URLSearchParams(location.search).get("obrref");
 try{if(ref){const normal=ref.replace(/-/g,"+").replace(/_/g,"/");const parts=atob(normal.padEnd(Math.ceil(normal.length/4)*4,"=")).split(" ");if(parts.length===2)origin=parts[0]}}catch{}
 function capture(e){if(!embedded||!origin||e.origin!==origin||e.source!==window.parent||e.data?.id!=="OBR_READY"||!e.data?.data?.ref||!e.data?.data?.userId)return;seen++;readyEvent=e}
 window.addEventListener("message",capture);
 window.calBoot={release(sdk){if(!sdk.isReady&&readyEvent&&!replayed){replayed=true;window.dispatchEvent(new MessageEvent("message",{origin:readyEvent.origin,source:readyEvent.source,data:readyEvent.data}))}window.removeEventListener("message",capture);readyEvent=null;return sdk.isReady},info(){return {embedded,hasRef:!!ref,validOrigin:!!origin,readySignals:seen,replayed}}};
})();