const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const enabled = () => !reduced.matches && !document.body.classList.contains('fx-disabled');
const running = new Set(),seenBackgrounds = new Map();
function animate(element,frames,duration = 240) {
  if (!enabled() || !element?.isConnected || typeof element.animate !== 'function') return;
  const animation = element.animate(frames,{duration,easing:'cubic-bezier(.22,.75,.25,1)'});
  running.add(animation);animation.finished.catch(() => {}).finally(() => running.delete(animation));return animation;
}
function retire(element) {
  element.inert = true;element.style.pointerEvents = 'none';
  if (!enabled()) element.remove();else setTimeout(() => { if (!element.open) element.remove(); },210);
  return true;
}
function dismiss(element,onDone) {
  if (!element?.isConnected) return;
  element.inert = true;
  const finish = () => { if (element.isConnected) onDone?.();element.remove(); };
  const fade = animate(element,[{opacity:getComputedStyle(element).opacity},{opacity:0}],180);
  if (fade) fade.finished.catch(() => {}).finally(finish);else finish();
}
window.ArchivesAppearance = {enabled,retire,dismiss};
function stop() { if (!enabled()) { for (const animation of running) animation.cancel();running.clear(); } }
reduced.addEventListener('change',stop);
new MutationObserver(stop).observe(document.body,{attributes:true,attributeFilter:['class']});
const watched = new WeakMap();
function imageAppears(image) {
  const source = image.getAttribute('src');
  if (!source || watched.get(image) === source || image.dataset.studioGhost) return;
  watched.set(image,source);
  const show = () => {
    if (!image.isConnected || watched.get(image) !== source || image.hidden || !image.getClientRects().length) return;
    animate(image,[{opacity:0},{opacity:1}],280);
  };
  if (image.complete && image.naturalWidth) show();else image.addEventListener('load',show,{once:true});
}
function backgroundAppears(element) {
  const cell = element.closest('.node-cell'),id = cell?.getAttribute('data-id'),source = element.style.backgroundImage;
  const key = String(window.DuneApp?.getState?.().activeBoardId || '') + ':' + id;
  if (!id || !source || seenBackgrounds.get(key) === source) return;
  seenBackgrounds.set(key,source);
  if (seenBackgrounds.size > 3000) seenBackgrounds.clear();
  animate(element,[{opacity:0},{opacity:element.style.opacity || 1}],300);
}
function scan(root) {
  if (!(root instanceof Element)) return;
  if (root.matches('img')) imageAppears(root);
  if (root.matches('.cell-bg-img-layer')) backgroundAppears(root);
  root.querySelectorAll('img,.cell-bg-img-layer').forEach(el => el.matches('img') ? imageAppears(el) : backgroundAppears(el));
}
scan(document.body);
new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'attributes') { if (record.target.matches('img')) imageAppears(record.target); }
    else for (const node of record.addedNodes) scan(node);
  }
}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
let tooltip,timer,target;
function hideTooltip() { clearTimeout(timer);if (tooltip) tooltip.dataset.visible = 'false';target = null; }
function tooltipFor(button) {
  if (!button || button.disabled || matchMedia('(hover:none)').matches) return;
  const text = button.getAttribute('title') || button.dataset.studioLabel || button.getAttribute('aria-label');
  if (!text) return;
  button.dataset.studioLabel = text;button.removeAttribute('title');target = button;
  clearTimeout(timer);timer = setTimeout(() => {
    if (target !== button || !button.isConnected) return;
    if (!tooltip) { tooltip = document.createElement('div');tooltip.className = 'studio-tooltip';tooltip.setAttribute('role','tooltip');tooltip.id = 'archives-command-tooltip';document.body.append(tooltip); }
    tooltip.textContent = button.dataset.studioLabel;const rect = button.getBoundingClientRect();
    tooltip.style.left = Math.max(8,Math.min(rect.left,innerWidth - 266)) + 'px';tooltip.style.top = Math.min(innerHeight - 60,rect.bottom + 9) + 'px';
    tooltip.dataset.visible = 'true';
  },350);
}
document.addEventListener('pointerover',event => tooltipFor(event.target.closest?.('#top-hud button,#quick-icon-dock button')),{passive:true});
document.addEventListener('pointerout',event => { if (target && !target.contains(event.relatedTarget)) hideTooltip(); },{passive:true});
document.addEventListener('focusin',event => tooltipFor(event.target.closest?.('#top-hud button,#quick-icon-dock button')));
document.addEventListener('focusout',hideTooltip);document.addEventListener('pointerdown',hideTooltip,{capture:true,passive:true});
document.addEventListener('keydown',event => { if (event.key === 'Escape') hideTooltip(); });
window.addEventListener('blur',hideTooltip);document.addEventListener('scroll',hideTooltip,{capture:true,passive:true});
