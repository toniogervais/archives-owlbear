export function screenCommand(value) {
  if (!value || !['ARCHIVES','OWLBEAR'].includes(value.target) || !['STAY','OPTIONAL','REQUIRED'].includes(value.policy))
    throw Error('Choisis un écran et un mode de suivi.');
  let recipients;
  if (value.recipients !== undefined) {
    if (!Array.isArray(value.recipients) || !value.recipients.length || value.recipients.length > 100 ||
      value.recipients.some(id => typeof id !== 'string' || !id || id.length > 160) || value.policy === 'STAY')
      throw Error('Choisis un joueur connecté.');
    recipients = [...new Set(value.recipients)];
  }
  return {target:value.target,policy:value.policy,...(recipients ? {recipients} : {})};
}
export function clampPanel(position,width,height,viewportWidth,viewportHeight) {
  return {left:Math.max(8,Math.min(Number(position?.left)||8,Math.max(8,viewportWidth-width-8))),
    top:Math.max(8,Math.min(Number(position?.top)||8,Math.max(8,viewportHeight-height-8)))};
}
