import { O as OBR } from '../../assets/index-BfJgTiPE.js';
const toolId = 'fr.archives-imaginaire.bridge/archives';
const modalId = 'fr.archives-imaginaire.bridge/archives-viewer';
const url = new URL('../../archives-host-v38.html', import.meta.url).href;
async function start() {
  if (!OBR.isAvailable) return;
  await new Promise(resolve => OBR.onReady(resolve));
  async function update() {
    if (await OBR.player.getRole() !== 'GM') { await OBR.tool.remove(toolId); return; }
    await OBR.tool.create({
      id: toolId,
      icons: [{ icon: new URL('../../icon.svg', import.meta.url).href, label: 'Les Archives — ouvrir en un clic' }],
      onClick: async () => {
        if (await OBR.player.getRole() !== 'GM') return;
        await OBR.modal.open({ id: modalId, url, fullScreen: true, hideBackdrop: true, hidePaper: true });
      }
    });
  }
  await update();
  OBR.player.onChange(() => { void update().catch(console.error); });
}
start().catch(console.error);
