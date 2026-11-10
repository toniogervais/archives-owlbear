import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ensureHostedArtwork,hostedArtworkPath,safeHostedImage,TOKEN_BUCKET} from '../src/v58/hosted-assets.mjs';

const load=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const owner='12345678-1234-1234-1234-123456789abc';
const art=()=>({id:crypto.randomUUID(),version:crypto.randomUUID(),mime:'image/png',
 width:2048,height:2048,data:'data:image/png;base64,'+Buffer.from('safe-test').toString('base64')});

test('One-click hosting stores a private token in authenticated owner path, returning an HTTPS signed URL',async()=>{
 let uploaded,requested,reported=[];
 const bridge={getClient:()=>({
   auth:{getUser:async()=>({data:{user:{id:owner}}})},
   storage:{from:(bucket)=>{
     assert.equal(bucket,TOKEN_BUCKET);
     return {
       upload:async(path,blob,options)=>{uploaded={path,blob,options};return {data:{path}};},
       createSignedUrl:async(path,seconds)=>{requested={path,seconds};return {
         data:{signedUrl:'https://project-example.supabase.co/storage/v1/object/sign/'+TOKEN_BUCKET+'/'+path+'?token=private_signed_token'}};}
     };
   }}
 })};
 const result=await ensureHostedArtwork(art(),{bridge,report:x=>reported.push(x)});
 assert.match(uploaded.path,new RegExp('^'+owner+'/[a-f0-9]{64}\\.png$'));
 assert.equal(uploaded.blob.type,'image/png');
 assert.equal(uploaded.options.upsert,false);
 assert.equal(result.image.width,2048);
 assert.ok(requested.seconds>3600);
 assert.equal(safeHostedImage(result.image),true);
 assert.ok(reported.length>0);
});

test('Reject insecure image links and invalid owner paths',()=>{
 const base={url:'https://example.org/token.png?token=bad',mime:'image/png',width:2048,height:2048};
 assert.equal(safeHostedImage(base),false);
 assert.equal(safeHostedImage({...base,url:'http://project.supabase.co/storage/v1/object/sign/archives-owlbear-assets/x?token=bad'}),false);
 assert.equal(safeHostedImage({...base,url:'https://project.supabase.co/storage/v1/object/public/archives-owlbear-assets/x?token=bad'}),false);
 assert.equal(safeHostedImage({...base,url:'https://project.supabase.co.evil.org/storage/v1/object/sign/archives-owlbear-assets/x?token=bad'}),false);
 assert.throws(()=>hostedArtworkPath('../other','a'.repeat(64),'image/png'),/invalide/);
});

test('Standalone Archives sends one-click commands to linked GM background and avoids manual asset pick for hosted token',()=>{
 const ui=load('src/v58/transfer-ui.mjs');
 const background=load('src/v58/transfers.mjs');
 const relay=load('src/v58/main-relay.mjs');
 const html=load('archives-app-v64-v55.html');
 assert.match(ui,/window\.ArchivesTokenBridge\?\.connected/);
 assert.match(ui,/tryDirectHosting\(art/);
 assert.match(ui,/🐻 Envoyer vers Owlbear/);
 assert.match(html,/src\/v58\/main-relay\.mjs\?v=4310/);
 assert.match(background,/if \(hosted\)/);
 assert.match(background,/safeHostedImage\(command\.hosted\)/);
 assert.match(background,/artwork-main-command/);
 assert.match(relay,/authorizeSoundShowFrame/);
 assert.doesNotMatch(ui,/actions\.append\(button,share,frame\)/);
 const sql=load('sql/archives-owlbear-private-assets-v431.sql');
 assert.match(sql,/public = false/);
 assert.match(sql,/storage\.foldername\(name\)/);
});
