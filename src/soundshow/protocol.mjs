export const autoLinkProtocol = 'archives:soundshow:link-v1';
export const owlbearLinkProtocol = 'archives:soundshow:owlbear-link-v1';
export function validLocalBridgeOrigin(origin) {
  try {
    const value=new URL(origin);
    return value.protocol==='http:' && ['127.0.0.1','localhost'].includes(value.hostname) && !!value.port && !value.username && !value.password;
  } catch { return false; }
}
export const soundShowChannel = 'fr.archives-imaginaire.bridge/soundshow-v1';
export const soundShowModal = soundShowChannel + '/player';
export function validSession(value) {
  return !!value && value.version === 1 && typeof value.peer === 'string' &&
    /^[A-Za-z0-9_-]{8,100}$/.test(value.peer) && typeof value.secret === 'string' &&
    /^[A-Za-z0-9_-]{32,128}$/.test(value.secret);
}
export function encodeSession(value) {
  if (!validSession(value)) throw Error('La connexion SoundShow est invalide.');
  return 'SS2.' + value.peer + '.' + value.secret;
}
export function decodeSession(code) {
  if (typeof code !== 'string' || code.length > 240) throw Error('Copie le code de connexion affiché par le connecteur.');
  const parts = code.trim().split('.');
  const session = {version:1,peer:parts[1],secret:parts[2]};
  if (parts.length !== 3 || parts[0] !== 'SS2' || !validSession(session)) throw Error('Le code SoundShow est incomplet ou invalide.');
  return session;
}
export const sameSession = (a,b) => a === b || !!a && !!b && a.peer === b.peer && a.secret === b.secret;
export function publicPlayback(value) {
  if (!value || value.type !== 'playback' || typeof value.active !== 'boolean') return null;
  if (!value.active) return {type:'playback',active:false};
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.id)) return null;
  return {type:'playback',active:true,id:value.id,title:String(value.title || 'Vidéo du MJ').slice(0,160),
    playing:value.playing === true,muted:value.muted === true,
    volume:Math.max(0,Math.min(1,Number.isFinite(value.volume) ? value.volume : 1))};
}
