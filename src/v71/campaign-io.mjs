import {isGM,nativeEditor,request} from '../v63/ui.mjs';
import {captureCampaign,packBackup,inspectBackup,recoveryCopy,restoreCampaign} from '../v63/backup.mjs?v=4460';
const check = async () => { if (!isGM()) throw Error('Commande réservée au maître de jeu.'); };
const scope = ['standalone','local'];
const candidates = new Map();
export async function campaignRequest(command) {
  await check();
  if (nativeEditor()) return request('campaign',command);
  if (window.parent !== window) throw Error('Ouvre la campagne dans ses Archives principales pour utiliser les sauvegardes en ligne.');
  const snapshot = () => window.ArchivesRelay.snapshot();
  if (command.action === 'export') return packBackup(await captureCampaign(...scope,command.snapshot || snapshot(),check));
  if (command.action === 'inspect' || command.action === 'inspect-recovery') {
    const blob = command.action === 'inspect' ? command.file : await recoveryCopy(...scope);
    if (!blob) throw Error('Aucune copie précédant une restauration n’est disponible sur cet appareil.');
    const incoming = await inspectBackup(blob),token = crypto.randomUUID();candidates.clear();candidates.set(token,incoming);
    setTimeout(() => candidates.delete(token),300000);return {token,summary:incoming.summary};
  }
  if (command.action === 'restore') {
    const incoming = candidates.get(command.token);
    if (!incoming) throw Error('Choisis de nouveau la sauvegarde avant de la restaurer.');
    const result = await restoreCampaign(...scope,incoming,{save:async value => { await check();window.ArchivesRelay.apply(value); }},snapshot(),check);
    candidates.delete(command.token);window.dispatchEvent(new CustomEvent('archives:campaign-restored'));return {summary:result.summary};
  }
  throw Error('Commande de sauvegarde inconnue.');
}
