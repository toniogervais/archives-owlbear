const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const mediaId='fr.archives-imaginaire.bridge/media-view-v60';
const media=p=>p.frameLocator('[id="'+mediaId+'"]');
const surface=p=>p.locator('[id="'+mediaId+'"]');
const frame=p=>p.frames().find(f=>f.url().includes('/media-view-v60.html'));
async function waitMedia(p,data){
 await media(p).locator('#media img').waitFor();
 await frame(p).waitForFunction(async expected=>{
  const img=document.querySelector('#media img');if(!img?.complete||!img.naturalWidth)return false;
  let blob;try{blob=await fetch(img.src).then(r=>r.blob())}catch{return false}
  const value=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob)});
  return value===expected&&document.body.dataset.phase==='open';
 },data);
 await frame(p).waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
 await frame(p).evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const box=await media(p).locator('#media img').boundingBox();
 const expected=await frame(p).evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.drawImage(document.querySelector('#media img'),0,0,1,1);return [...x.getImageData(0,0,1,1).data].slice(0,3)});
 // Inspect the screen's centre pixel, not merely the decoded hidden IMG.
 let actual,png;
 for(let attempt=0;attempt<6;attempt++){
  png=await p.screenshot({clip:{x:Math.floor(box.x+box.width/2),y:Math.floor(box.y+box.height/2),width:1,height:1}});const chunks=[];
  for(let offset=8;offset<png.length;){const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8);if(type==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));offset+=length+12}
  const raw=zlib.inflateSync(Buffer.concat(chunks));actual=[...raw.subarray(1,4)];
  if(actual.every((value,i)=>Math.abs(value-expected[i])<=2))return;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 console.log('PAINT',JSON.stringify({actual,expected,box,width:png.readUInt32BE(16),height:png.readUInt32BE(20),depth:png[24],type:png[25],styles:await frame(p).evaluate(()=>['body','#media','#media img'].map(selector=>{const e=document.querySelector(selector),s=getComputedStyle(e);return {selector,opacity:s.opacity,visibility:s.visibility,bounds:e.getBoundingClientRect().toJSON()}}))}));
 assert.deepEqual(actual,expected,'the chosen picture must actually be visible after both fades');
}
async function closeMedia(p){
 await media(p).getByRole('button',{name:'Fermer la présentation',exact:true}).click();
 assert.equal(await frame(p).evaluate(()=>document.body.dataset.phase),'closing');
 await surface(p).waitFor({state:'detached'});
}
module.exports={mediaId,media,surface,frame,waitMedia,closeMedia};
