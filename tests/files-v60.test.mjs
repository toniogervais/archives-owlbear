import test from "node:test";
import assert from "node:assert/strict";
import { validateFile,validPublication,publicFile,fileChunks,fileReceiver,digest,maxMediaBytes } from "../src/v60/files.mjs";
function wav(length = 24044) {
  const bytes = new Uint8Array(length);bytes.set(new TextEncoder().encode("RIFF"),0);bytes.set(new TextEncoder().encode("WAVE"),8);
  return new File([bytes],"note-privee.wav",{type:"audio/wav"});
}
test("Library accepts supported original files and rejects disguised active content and oversized media",async() => {
  assert.deepEqual(await validateFile(wav()),{kind:"AUDIO",mime:"audio/wav"});
  assert.deepEqual(await validateFile(new File([wav()],"note.wav",{type:"audio/x-pn-wav"})),{kind:"AUDIO",mime:"audio/wav"});
  assert.deepEqual(await validateFile(new File(["%PDF-1.4\n"],"piece.pdf",{type:"application/pdf"})),{kind:"DOCUMENT",mime:"application/pdf"});
  await assert.rejects(validateFile(new File(["<html>private</html>"],"piece.pdf",{type:"application/pdf"})),/contenu/);
  await assert.rejects(validateFile(new File(["<svg onload='alert(1)'/>"],"image.svg",{type:"image/svg+xml"})),/Formats/);
  await assert.rejects(validateFile(wav(maxMediaBytes + 1)),/8 Mo/);
});
test("Public media descriptor never contains original filename, linked cells, journal, owner or another file",() => {
  const input = {id:crypto.randomUUID(),version:crypto.randomUUID(),title:"Enregistrement révélé",mime:"audio/wav",size:123,hash:"a".repeat(64),
    fileId:"private-file-id",name:"nom-secret-original.wav",links:["cellule-secrète"],scope:["room","owner"],secret:"mot de passe",journal:"notes MJ"};
  const output = publicFile(input);
  assert.equal(validPublication(output),true);
  assert.deepEqual(Object.keys(output).sort(),["hash","id","mime","size","title","version"]);
  for (const value of ["private-file-id","nom-secret-original","cellule-secrète","owner","mot de passe","notes MJ"]) assert.ok(!JSON.stringify(output).includes(value));
  assert.equal(validPublication({...output,size:maxMediaBytes + 1}),false);
  assert.equal(validPublication({...output,mime:"text/html"}),false);
});
test("Chunked media stays below 16 KB and reconstructs exact bytes with an integrity check",async() => {
  const blob = wav(),publication = {id:crypto.randomUUID(),version:crypto.randomUUID(),title:"Note sonore",mime:blob.type,size:blob.size,hash:await digest(blob)};
  const parts = [];for await (const part of fileChunks(blob)) parts.push({id:publication.id,version:publication.version,transfer:crypto.randomUUID(),...part});
  const transfer = crypto.randomUUID();parts.forEach(part => { part.transfer = transfer;assert.ok(Buffer.byteLength(JSON.stringify({...part,type:"data",to:["player-a","player-b"]})) < 16384); });
  const receiver = fileReceiver(publication);
  assert.equal(await receiver.push({...parts[0],index:-1}),null);
  assert.equal(await receiver.push({...parts[0],chunk:"A".repeat(20000)}),null);
  assert.equal(await receiver.push({...parts[0],id:crypto.randomUUID()}),null);
  let result = await receiver.push(parts[0]);assert.ok(result.progress < 100);
  assert.equal(await receiver.push(parts[0]),null,"duplicate chunk adds no progress");
  for (const part of parts.slice(1)) result = await receiver.push(part);
  assert.equal(result.progress,100);assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()),new Uint8Array(await blob.arrayBuffer()));
});
test("Corrupted media is never returned as a playable file",async() => {
  const blob = wav(100),publication = {id:crypto.randomUUID(),version:crypto.randomUUID(),title:"Note sonore",mime:blob.type,size:blob.size,hash:"b".repeat(64)};
  const receiver = fileReceiver(publication);
  for await (const part of fileChunks(blob)) await assert.rejects(receiver.push({id:publication.id,version:publication.version,transfer:crypto.randomUUID(),...part}),/incomplet/);
});
