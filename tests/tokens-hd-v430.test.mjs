import test from 'node:test';
import assert from 'node:assert/strict';
import {drawToken,imagePlacement} from '../src/v61/token-crop.mjs';
import {exportHighDefinitionToken,tokenExportFits,tokenSizes} from '../src/v58/media.mjs';

function mockCanvasFor(exportData) {
  const records=[];
  const makeCanvas=(width,height)=>{
    const ctx={canvas:{width,height},clearRect(){},save(){},restore(){},beginPath(){},arc(){},clip(){},fillRect(){},stroke(){},
      drawImage(image,x,y,w,h){records.push({width,height,sourceWidth:image.width,sourceHeight:image.height,x,y,w,h})},
      fillText(){},set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},
      set imageSmoothingEnabled(v){records.push({smoothing:v})},
      set imageSmoothingQuality(v){records.push({quality:v})}
    };
    return {width,height,getContext:()=>ctx,toDataURL:(mime,quality)=>exportData(width,mime,quality)};
  };
  return {makeCanvas,records};
}

test('L’aperçu conserve son cadrage, le rendu HD utilise directement le bitmap original',async()=>{
  const source={width:3200,height:1800},crop={zoom:1.3,x:.15,y:-.12};
  const {makeCanvas,records}=mockCanvasFor((size,mime)=>mime==='image/png'?'data:image/png;base64,AAAA':'data:image/webp;base64,AAAA');
  const out=await exportHighDefinitionToken(source,'Portrait',crop,{makeCanvas});
  assert.equal(out.width,2048);assert.equal(out.height,2048);assert.equal(out.mime,'image/png');
  const drawn=records.find(record=>record.sourceWidth===3200);
  assert.ok(drawn);assert.equal(drawn.width,2048);
  assert.deepEqual({x:drawn.x,y:drawn.y,width:drawn.w,height:drawn.h},imagePlacement(3200,1800,crop,2048));
  assert.ok(records.some(item=>item.quality==='high'));
  const preview=mockCanvasFor(()=>null);
  const canvas=preview.makeCanvas(512,512);
  drawToken(canvas.getContext('2d'),source,'Portrait',crop,512);
  const small=preview.records.find(record=>record.sourceWidth===3200);
  assert.ok(Math.abs(drawn.x/4-small.x)<1e-9);
  assert.ok(Math.abs(drawn.y/4-small.y)<1e-9);
});

test('En cas de PNG trop lourd, le WebP HD conserve la taille de 2048 pixels',async()=>{
  const {makeCanvas}=mockCanvasFor((size,mime)=>mime==='image/png'?'data:image/png;base64,'+'A'.repeat(400):'data:image/webp;base64,'+'A'.repeat(80));
  const art=await exportHighDefinitionToken({width:2000,height:2000},'Test',{}, {makeCanvas,limit:100});
  assert.equal(art.width,2048);assert.equal(art.mime,'image/webp');
  assert.equal(tokenExportFits(art.data,100),true);
});

test('Le générateur réduit la taille uniquement si nécessaire et respecte la limite Owlbear',async()=>{
  const attempts=[];
  const {makeCanvas}=mockCanvasFor((size,mime)=>{attempts.push([size,mime]);return 'data:'+mime+';base64,'+'A'.repeat(size>=1024?400:80)});
  const art=await exportHighDefinitionToken({width:1800,height:1800},'Test',{}, {makeCanvas,limit:100});
  assert.equal(art.width,768);
  assert.ok(attempts.some(([size])=>size===2048));
  assert.ok(attempts.some(([size])=>size===768));
  assert.deepEqual(tokenSizes,[2048,1536,1024,768,512]);
  assert.equal(tokenExportFits('data:image/png;base64,'+'A'.repeat(400),100),false);
});

test('Le générateur HD signale explicitement les dépassements de taille',async()=>{
  const {makeCanvas}=mockCanvasFor((size,mime)=>'data:'+mime+';base64,'+'A'.repeat(400));
  await assert.rejects(exportHighDefinitionToken({width:300,height:300},'Test',{}, {makeCanvas,limit:100}),/dépasse/);
});
