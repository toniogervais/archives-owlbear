export function downloadArchive(blob,name='Campagne_Archives') {
  const safe=String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,160)||'Campagne_Archives';
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=safe+'.archives';document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
