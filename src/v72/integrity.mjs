// Incremental SHA-256 keeps a multi-gigabyte backup out of a single ArrayBuffer.
// Vendored @noble/hashes 1.8.0 (MIT); originals are never recompressed.
import {sha256} from '../vendor/noble-hashes/sha2.js';
const hex = bytes => Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
export async function digest(value) {
  if (!(value instanceof Blob)) return hex(sha256(value));
  const hash=sha256.create(),step=4*1024*1024;
  try {
    for(let offset=0;offset<value.size;offset+=step) {
      hash.update(new Uint8Array(await value.slice(offset,offset+step).arrayBuffer()));
      if(offset && offset%(step*8)===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return hex(hash.digest());
  } finally { hash.destroy(); }
}
