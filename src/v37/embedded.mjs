// Only the same-origin host can select the synchronization context. No credentials or canvas data are sent.
const context = { campaignId: null, roomId: null };
window.ArchivesEmbeddedContext = context;
function apply() {
  const select = document.getElementById('v45-campaign');
  if (!select) return;
  select.value = context.campaignId || '';
  select.disabled = true;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}
window.addEventListener('message', event => {
  if (window.parent === window || event.source !== window.parent || event.origin !== location.origin) return;
  if (event.data?.type !== 'archives:context:v37') return;
  const { campaignId, roomId } = event.data;
  context.campaignId = typeof campaignId === 'string' && /^[0-9a-f-]{36}$/i.test(campaignId) ? campaignId : null;
  context.roomId = typeof roomId === 'string' ? roomId : null;
  window.ArchivesLiveDiagnostic?.stop();
  apply();
});
window.addEventListener('archives:campaigns-loaded', apply);
const icon = document.querySelector('.canvas-integration-item button[aria-label^="Owlbear Rodeo"]');
if (window.parent !== window && icon) {
  icon.disabled = false;
  icon.setAttribute('aria-label', 'Retour à Owlbear');
  icon.parentElement.title = 'Revenir à la carte Owlbear';
  icon.addEventListener('click', () => window.parent.postMessage({ type: 'archives:return:v37' }, location.origin));
}
if (window.parent !== window) window.parent.postMessage({ type: 'archives:ready:v37' }, location.origin);
