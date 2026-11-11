import test from 'node:test';
import assert from 'node:assert/strict';
import {dossierEntry} from '../src/v69/dossier-files.mjs';
import {validSharedFile,validPublication,fileChunks,fileReceiver,digest,maxDocumentBytes,maxMediaBytes} from '../src/v60/files.mjs';
const id='3d4d89f1-1b17-4b1c-96f6-419752ddff59',version='daf511a2-5a0b-490b-91ca-1b731aa831d6';
const base={id,title:'Rapport public',mime:'text/plain',size:24,hash:'a'.repeat(64)};
test('Only explicit dossier publication exposes a file, with no private library metadata',()=>{
 const entry={...base,name:'NOM_PRIVE.txt',scope:['room','owner'],links:['cellule-cachee'],released:true};
 assert.equal(dossierEntry(entry),null,'presenting a sound must not add it to the dossier implicitly');
 assert.equal(dossierEntry({...entry,dossier:{version:'invalid'}}),null);
 assert.deepEqual(dossierEntry({...entry,dossier:{version}}),{...base,version});
 assert.equal(dossierEntry({...entry,dossier:null}),null);
});
test('Dossier allows bounded inert documents; the existing media protocol continues to reject documents',()=>{
 assert.equal(validSharedFile({...base,version,size:maxDocumentBytes}),true);
 assert.equal(validSharedFile({...base,version,size:maxDocumentBytes+1}),false);
 assert.equal(validPublication({...base,version}),false);
 assert.equal(validSharedFile({...base,version,mime:'text/html'}),false);
 assert.equal(validSharedFile({...base,version,mime:'image/svg+xml'}),false);
 assert.equal(validSharedFile({...base,version,mime:'audio/mpeg',size:maxMediaBytes+1}),false);
});
test('On-demand dossier documents are reassembled with the same byte-level integrity check as media',async()=>{
 const blob=new Blob(['Document public <script>texte inactif</script>\n'.repeat(1000)],{type:'text/plain'});
 const publication={...base,version,size:blob.size,hash:await digest(blob)};
 assert.throws(()=>fileReceiver(publication),/invalide/);
 const receiver=fileReceiver(publication,validSharedFile);let result;
 for await(const part of fileChunks(blob))result=await receiver.push({id,version,transfer:id,...part});
 assert.equal(await result.blob.text(),await blob.text());
});
