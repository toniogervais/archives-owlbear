import {sheet,button,element,requireGM,notice} from './ui.mjs';
import {campaignRequest} from '../v71/campaign-io.mjs';
import {mountCloudBackups,pauseCloudBackup} from '../v71/cloud-ui.mjs';
const size = bytes => (bytes / 1024 / 1024).toLocaleString('fr',{maximumFractionDigits:1}) + ' Mo';
export function openBackup() {
  requireGM();const view = sheet('archives-campaign-backup','Sauvegardes','Campagne privée');
  const {content,dialog,status} = view;
  content.append(element('h3','Copie supplémentaire en fichier'),element('p','Un fichier .archives pour conserver aussi une copie indépendante du scénario, du journal MJ, des bibliothèques et des cadrages des tokens.','studio-hint'));
  const tools = element('div',null,'studio-actions'),preview = element('section');preview.hidden = true;
  const input = element('input');input.type = 'file';input.accept = '.archives';input.hidden = true;
  const download = button('Enregistrer la campagne',async () => {
    view.busy(true);status.textContent = 'Préparation et vérification des fichiers…';
    try {
      const result = await campaignRequest({action:'export',snapshot:window.ArchivesRelay.snapshot()});
      if (!dialog.open) return;
      const url = URL.createObjectURL(result.blob),link = element('a');link.href = url;link.download = 'Campagne_Archives_'+new Date().toISOString().slice(0,10)+'.archives';
      document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(url),10000);
      status.textContent = 'Sauvegarde prête : '+result.summary.files+' fichier(s), '+result.summary.images+' image(s), '+size(result.blob.size)+'.';
    } catch (error) { status.textContent = error.message; }
    finally { view.busy(false); }
  },'primary');
  const choose = button('Restaurer une campagne…',() => input.click());
  const recover = button('Copie précédant la dernière restauration',() => { void inspect({action:'inspect-recovery'}); });
  tools.append(download,choose);content.append(tools,input,preview);
  content.append(element('p','Les scènes et cartes natives d’Owlbear se conservent dans Owlbear. La sauvegarde inclut la bibliothèque d’images de cet appareil. Le fichier .archives est privé : il contient aussi les secrets du MJ.','studio-hint'));
  const recoveryRow = element('details'),summary = element('summary','Récupérer une version précédente');recoveryRow.append(summary,recover);content.append(recoveryRow);
  mountCloudBackups(view,inspect);
  async function inspect(command,hooks = {}) {
    view.busy(true);status.textContent = 'Vérification de l’intégrité de la sauvegarde…';preview.hidden = true;
    try {
      const result = await campaignRequest(command);if (!dialog.open) return;
      preview.replaceChildren(element('h3','Vérifier avant de restaurer'));
      const counts = element('div',null,'studio-counts');
      for (const [label,value] of [['Actes',result.summary.boards],['Cellules',result.summary.cells],['Documents',result.summary.files],['Images',result.summary.images]]) {
        const box = element('span');box.append(element('strong',String(value)),document.createTextNode(label));counts.append(box);
      }
      preview.append(counts,element('p','Le scénario ouvert sera remplacé avec son état de révélation. Les bibliothèques et cadrages seront fusionnés. Les présentations de médias seront arrêtées. Une copie de la campagne actuelle sera conservée sur cet appareil avant la restauration.','studio-hint'));
      const confirm = button('Restaurer cette campagne',async () => {
        view.busy(true);status.textContent = 'Copie de sécurité puis restauration…';
        const previous = window.ArchivesRelay.snapshot();let restored = false;
        window.dispatchEvent(new CustomEvent('archives:restore-begin'));
        try {
          await hooks.before?.();
          await campaignRequest({action:'restore',token:result.token,previous});restored = true;
          if(hooks.after)await hooks.after();else pauseCloudBackup();
          if (dialog.open) dialog.close();notice('Campagne restaurée. Les secrets et les fichiers restent côté MJ.');
        } catch (error) { status.textContent = error.message; }
        finally { window.dispatchEvent(new CustomEvent('archives:restore-end',{detail:{safe:restored}}));view.busy(false); }
      },'primary');preview.append(confirm);preview.hidden = false;
      status.textContent = 'Sauvegarde vérifiée : '+size(result.summary.bytes)+'. Aucun changement n’a encore été fait.';
    } catch (error) { status.textContent = error.message; }
    finally { view.busy(false); }
  }
  input.onchange = () => { const file = input.files[0];input.value = '';if (file) void inspect({action:'inspect',file}); };
}
