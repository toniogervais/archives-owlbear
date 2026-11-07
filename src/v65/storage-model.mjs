export function storageAmounts(estimate) {
  const {usage,quota}=estimate||{};
  if(!Number.isFinite(usage)||usage<0||!Number.isFinite(quota)||quota<=0)throw Error('La capacité disponible n’est pas communiquée par ce navigateur.');
  return {used:usage,capacity:quota,available:Math.max(0,quota-usage),ratio:Math.min(1,usage/quota)};
}
export function storageText(bytes) {
  const units=['o','Ko','Mo','Go','To'];let index=0,value=Math.max(0,bytes);
  while(value>=1000&&index<units.length-1){value/=1000;index++;}
  return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:value<10?1:0}).format(value)+' '+units[index];
}
