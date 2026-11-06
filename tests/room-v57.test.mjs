import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { snapshotChunks, snapshotReader } from "../src/v57/room.mjs";

test("A player snapshot with images and French text is reassembled within Owlbear's message limit", async () => {
  const snapshot = {boards:[{id:"acte-1", links:[], nodes:[
    {title:"À l’abri du jour", bgImg:"data:image/png;base64,"+randomBytes(40000).toString("base64")}
  ]}]};
  const parts = await snapshotChunks(snapshot);
  assert.ok(parts.length > 1);
  const id = randomUUID(), revision = randomUUID();
  let actual;
  const receive = snapshotReader((payload, version) => {
    actual = payload;
    assert.equal(version, revision);
  }, () => assert.fail("The complete snapshot should decode"));
  for (const part of parts.reverse()) {
    const message = {...part, id, revision};
    assert.ok(Buffer.byteLength(JSON.stringify(message)) < 16 * 1024);
    await receive(message, "gm");
  }
  assert.deepEqual(actual, snapshot);
});

test("A malformed or oversized packet never reaches the player view", async () => {
  const receive = snapshotReader(() => assert.fail("Unexpected snapshot"), () => assert.fail("Invalid header started a download"));
  await receive({id:randomUUID(), revision:randomUUID(), index:0, count:5000, chunk:"AAAA", encoding:"raw"},"gm");
  await receive({id:randomUUID(), revision:randomUUID(), index:0, count:1, chunk:"A".repeat(14000), encoding:"raw"},"gm");
});
