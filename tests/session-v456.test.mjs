import test from 'node:test';
import assert from 'node:assert/strict';
import {publicConnection} from '../src/v78/connection.mjs';
import {autoBackup} from '../src/v71/autosave.mjs';
const jwt=role=>'header.'+btoa(JSON.stringify({role})).replace(/=/g,'')+'.signature';
test('A device connection link admits public configuration and rejects secret credentials and foreign destinations',()=>{
 assert.deepEqual(publicConnection({url:' https://archives.supabase.co/ ',key:'sb_publishable_test'}),{url:'https://archives.supabase.co',key:'sb_publishable_test'});
 assert.equal(publicConnection({url:'https://archives.supabase.co',key:jwt('anon')}).key,jwt('anon'));
 for(const key of [jwt('service_role'),'sb_secret_test','password',''])assert.throws(()=>publicConnection({url:'https://archives.supabase.co',key}));
 for(const url of ['http://archives.supabase.co','https://archives.supabase.co.evil.test','https://evil.test/archives.supabase.co','https://archives.supabase.co/path'])assert.throws(()=>publicConnection({url,key:'sb_publishable_test'}));
 assert.deepEqual(Object.keys(publicConnection({url:'https://archives.supabase.co',key:'sb_publishable_test',password:'NEVER_COPY',access_token:'NEVER_COPY'})),['url','key']);
});
test('A failed manual upload has no successful timestamp and a retry saves the complete captured session without enabling automatic saves',async()=>{
 let binding=null,fail=true,writes=0;const fingerprint='a'.repeat(64),data={blob:new Blob(['complete session']),fingerprint,summary:{cells:4,images:3,files:2}};
 const engine=autoBackup({read:()=>binding,write:b=>binding=b,capture:async()=>data,cloud:{
  context:async()=>({user:{id:'owner'},project:'https://archives.supabase.co'}),
  save:async input=>{writes++;assert.equal(input.blob,data.blob);if(fail)throw Error('Upload interrupted');return {revision:1,created_at:'2026-11-16T12:00:00Z'}}
 }});
 let result=await engine.bind({campaignId:'campaign',owner:'owner',project:'https://archives.supabase.co',revision:0},{automatic:false});
 assert.equal(result.state,'error');assert.equal(binding.savedAt,undefined);assert.equal(binding.enabled,false);assert.equal(writes,1);
 fail=false;result=await engine.manualSave();assert.equal(result.state,'saved');assert.equal(binding.revision,1);assert.ok(binding.savedAt);assert.equal(binding.enabled,false);assert.equal(writes,2);
 engine.change();assert.equal(engine.status().state,'pending','manual edits remain visibly unsaved without scheduling an upload');await engine.save();assert.equal(writes,2,'focus and reconnect cannot silently save a manual session');engine.dispose();
});
