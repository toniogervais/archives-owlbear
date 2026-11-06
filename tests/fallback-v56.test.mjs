import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { test } from "node:test";
import { listenForFallback, dialFallback } from "../src/v56/peer.mjs";

test("Fallback carries encrypted edits and rejects a wrong secret", {timeout:5000}, async () => {
  const peers = new Map(), network = [];
  class Connection extends EventEmitter {
    send(data) {
      network.push(data);
      queueMicrotask(() => this.other.emit("data", structuredClone(data)));
    }
    close() {
      if (this.closed) return;
      this.closed = this.other.closed = true;
      this.emit("close");
      this.other.emit("close");
    }
  }
  class Peer extends EventEmitter {
    constructor(id) {
      super();
      this.id = id;
      if (id) peers.set(id, this);
      queueMicrotask(() => { this.open = true; this.emit("open"); });
    }
    connect(id, options) {
      assert.deepEqual(options, {reliable:true}, "signalling receives no pairing secret");
      const a = new Connection(), b = new Connection();
      a.other = b;
      b.other = a;
      peers.get(id).emit("connection", b);
      queueMicrotask(() => { a.emit("open"); b.emit("open"); });
      return a;
    }
    destroy() {
      this.destroyed = true;
      if (this.id) peers.delete(this.id);
    }
  }
  globalThis.window = {Peer};
  const loadPeer = async () => {};
  const address = "archives-" + "a".repeat(32);
  const pairing = address + "." + "b".repeat(64);
  const observed = new EventEmitter();
  const stop = listenForFallback(loadPeer, pairing, (wire, accept) => {
    wire.onClose(() => observed.emit("closed"));
    wire.onMessage(data => {
      assert.deepEqual(data, {type:"attach", roomId:"room"});
      accept();
      wire.onMessage(edit => {
        assert.deepEqual(edit, {type:"edit", text:"contenu privé"});
        wire.send({type:"ack"});
      });
      wire.send({type:"state", text:"scénario privé"});
    });
  });
  const good = new AbortController(), wrong = new AbortController();
  try {
    await Promise.resolve();
    const ack = once(observed, "ack");
    await dialFallback(loadPeer, pairing, good.signal, wire => {
      wire.onMessage(data => {
        if (data.type === "state") {
          assert.equal(data.text,"scénario privé");
          wire.send({type:"edit",text:"contenu privé"});
        } else observed.emit("ack", data);
      });
      wire.send({type:"attach",roomId:"room"});
    });
    assert.deepEqual(await ack,[{type:"ack"}]);
    assert.ok(network.slice(1).every(data=>data.cipher instanceof ArrayBuffer));
    assert.doesNotMatch(JSON.stringify(network), /contenu privé|scénario privé/);

    const rejected = once(observed,"closed");
    let received=false;
    await dialFallback(loadPeer, address + "." + "c".repeat(64), wrong.signal, wire => {
      wire.onMessage(() => { received=true; });
      wire.send({type:"attach",roomId:"room"});
    });
    await rejected;
    assert.equal(received,false);
  } finally {
    good.abort();
    wrong.abort();
    stop();
    delete globalThis.window;
  }
});
