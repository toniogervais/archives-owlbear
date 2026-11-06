import { randomHex } from "./link.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// The fallback uses a stable random address. The secret never goes to PeerJS signalling.
function encryptedWire(connection, secret, challenge, side) {
  const key = crypto.subtle.importKey("raw", Uint8Array.from(secret.match(/../g), n => parseInt(n, 16)),
    "AES-GCM", false, ["encrypt", "decrypt"]);
  let outgoing = Promise.resolve(), incoming = Promise.resolve(), sent = 0, received = 0;
  let closed = false, onClose = () => {}, onMessage = () => {};
  const opposite = side === "archives" ? "owlbear" : "archives";
  const aad = (sender, sequence) => encoder.encode("archives-v56:" + challenge + ":" + sender + ":" + sequence);
  function stop() {
    if (closed) return;
    closed = true;
    connection.close();
    onClose();
  }
  connection.on("close", stop);
  connection.on("error", stop);
  connection.on("data", data => {
    incoming = incoming.then(async () => {
      if (closed) return;
      const {iv, cipher} = data || {};
      if (!(iv instanceof ArrayBuffer) || iv.byteLength !== 12 ||
          !(cipher instanceof ArrayBuffer) || cipher.byteLength > 12 * 1024 * 1024)
        throw Error("Message invalide.");
      const plain = await crypto.subtle.decrypt({name:"AES-GCM", iv:new Uint8Array(iv),
        additionalData:aad(opposite, ++received)}, await key, cipher);
      if (!closed) onMessage(JSON.parse(decoder.decode(plain)));
    }).catch(stop);
  });
  return {
    send(data) {
      outgoing = outgoing.then(async () => {
        if (closed) return;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt({name:"AES-GCM", iv, additionalData:aad(side, ++sent)},
          await key, encoder.encode(JSON.stringify(data)));
        if (!closed) connection.send({iv:iv.buffer, cipher});
      }).catch(stop);
    },
    onMessage(handler) { onMessage = handler; },
    onClose(handler) { onClose = handler; },
    close: stop
  };
}

export function listenForFallback(loadPeer, pairing, accept) {
  const [id, secret] = pairing.split(".");
  let peer, retry, stopped = false, addressRetries = 0;
  const sockets = new Set();
  function schedule() {
    if (!stopped && !retry) retry = setTimeout(() => {
      retry = null;
      if (peer?.disconnected && !peer.destroyed) {
        try { peer.reconnect(); return; } catch {}
      }
      void start();
    }, 6000);
  }
  async function start() {
    try {
      await loadPeer();
      if (stopped) return;
      peer?.destroy();
      peer = new window.Peer(id);
      peer.on("open", () => {
        addressRetries = 0;
        clearTimeout(retry);
        retry = null;
      });
      peer.on("disconnected", schedule);
      peer.on("error", error => {
        // A reload can briefly leave the previous tab registered at this address.
        if (error?.type === "unavailable-id" && addressRetries++ >= 2) return;
        if (!peer.open || peer.disconnected) schedule();
      });
      peer.on("connection", connection => {
        if (sockets.size >= 8) { connection.close(); return; }
        sockets.add(connection);
        const timer = setTimeout(() => { sockets.delete(connection); connection.close(); }, 12000);
        const forget = () => { sockets.delete(connection); clearTimeout(timer); };
        connection.on("close", forget);
        connection.on("error", forget);
        connection.on("open", () => {
          const challenge = randomHex(16);
          const wire = encryptedWire(connection, secret, challenge, "archives");
          accept(wire, () => clearTimeout(timer));
          connection.send({challenge});
        });
      });
    } catch { schedule(); }
  }
  void start();
  return () => {
    stopped = true;
    clearTimeout(retry);
    for (const connection of sockets) connection.close();
    peer?.destroy();
  };
}

export async function dialFallback(loadPeer, pairing, signal, attach) {
  const [id, secret] = pairing.split(".");
  await loadPeer();
  if (signal.aborted) return;
  const peer = new window.Peer();
  let connection, wire;
  let stopped = false;
  const close = () => {
    if (stopped) return;
    stopped = true;
    wire?.close();
    connection?.close();
    peer.destroy();
  };
  signal.addEventListener("abort", close, {once:true});
  peer.on("error", error => {
    if (!wire || error?.type === "peer-unavailable") close();
  });
  peer.on("open", () => {
    try { connection = peer.connect(id, {reliable:true}); }
    catch { close(); return; }
    connection.on("close", close);
    connection.on("error", close);
    connection.once("data", data => {
      if (!/^[a-f0-9]{32}$/.test(data?.challenge || "")) { close(); return; }
      wire = encryptedWire(connection, secret, data.challenge, "owlbear");
      attach(wire);
    });
  });
}
