export const fadeDuration = 300;
export function fade(element,from,to,duration=fadeDuration) {
  if(!element?.isConnected||typeof element.animate!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches)
    return {cancel(){},finished:Promise.resolve()};
  const animation=element.animate([{opacity:from},{opacity:to}],{duration,easing:'ease-in-out',fill:'both'});
  return {cancel:()=>animation.cancel(),finished:animation.finished.catch(()=>{})};
}
