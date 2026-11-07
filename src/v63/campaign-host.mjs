import {validSnapshot} from '../v57/room.mjs?v=4190';
import {captureCampaign,packBackup,inspectBackup,recoveryCopy,restoreCampaign} from './backup.mjs';
export function campaignHost({OBR,store,canEdit,snapshot,replace,post,beforeRestore = async () => {}}) {
  const candidates = new Map();let closed = false;
  const check = async () => {
    if (closed || !canEdit() || await OBR.player.getRole() !== 'GM') throw Error('Opération réservée au maître de jeu.');
  };
  return {
    async receive(data) {
      try {
        await check();const command = data.command || {};let result;
        if (command.action === 'export') {
          const scenario = validSnapshot(command.snapshot) ? command.snapshot : snapshot();
          if (!validSnapshot(scenario)) throw Error('Ouvre un scénario avant de sauvegarder.');
          const campaign = await captureCampaign(OBR.room.id,OBR.player.id,scenario,check);
          result = await packBackup(campaign);
        } else if (['inspect','inspect-recovery'].includes(command.action)) {
          const blob = command.action === 'inspect' ? command.file : await recoveryCopy(OBR.room.id,OBR.player.id);
          if (!blob) throw Error('Aucune copie précédant une restauration n’est encore disponible.');
          const incoming = await inspectBackup(blob);await check();
          candidates.clear();const token = crypto.randomUUID();candidates.set(token,incoming);
          setTimeout(() => candidates.delete(token),300000);result = {token,summary:incoming.summary};
        } else if (command.action === 'restore') {
          const incoming = candidates.get(command.token);
          if (!incoming) throw Error('Choisis de nouveau la sauvegarde avant de la restaurer.');
          await beforeRestore();await check();
          const previous = validSnapshot(command.previous) ? command.previous : snapshot();
          result = await restoreCampaign(OBR.room.id,OBR.player.id,incoming,store,previous,check);
          replace(result.snapshot);candidates.delete(command.token);
          await check();post('owl-campaign-restored',{snapshot:result.snapshot});
          result = {summary:result.summary};
        } else throw Error('Commande de sauvegarde inconnue.');
        await check();post('owl-campaign-result',{id:data.id,safe:true,result});
      } catch (error) {
        if (!closed && canEdit()) post('owl-campaign-result',{id:data.id,safe:false,message:error.message || 'Opération impossible.'});
      }
    },
    dispose() { closed = true;candidates.clear(); }
  };
}
