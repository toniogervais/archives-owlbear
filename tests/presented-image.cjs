const assert=require('node:assert/strict');
const mediaId='fr.archives-imaginaire.bridge/media-view-v60';
const media=p=>p.frameLocator('[id="'+mediaId+'"]');
const surface=p=>p.locator('[id="'+mediaId+'"]');
const frame=p=>p.frames().find(f=>f.url().includes('/media-view-v60.html'));
async function waitMedia(p,data){
 await media(p).locator('#media img').waitFor();
 await frame(p).waitForFunction(async expected=>{
  const img=document.querySelector('#media img');if(!img?.complete||!img.naturalWidth)return false;
  const blob=await fetch(img.src).then(r=>r.blob());
  const value=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob)});
  return value===expected&&document.body.dataset.phase==='open';
 },data);
}
async function closeMedia(p){
 await media(p).getByRole('button',{name:'Fermer la présentation',exact:true}).click();
 assert.equal(await frame(p).evaluate(()=>document.body.dataset.phase),'closing');
 await surface(p).waitFor({state:'detached'});
}
module.exports={mediaId,media,surface,frame,waitMedia,closeMedia};
