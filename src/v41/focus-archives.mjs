// Reuse an existing Archives tab without navigating/reloading it.
// Browsers may partition browsing context groups or block focus; in that case
// the new tab is navigated to the explicit fallback page.
export function focusArchives(fallbackUrl, open=window.open.bind(window)){
  const tab=open("","archives-main");
  if(!tab)return false;
  try{
    const current=tab.location.href;
    const url=new URL(current);
    const expected=new URL(fallbackUrl);
    if(current==="about:blank" ||
       url.origin!==expected.origin ||
       url.pathname!==expected.pathname){
      tab.location.replace(fallbackUrl);
    }
    // Existing Archives V4.1: focus only, retaining the editor state.
  }catch{
    // Cross-origin window handles can be focused but must not be inspected.
    // We do not reload a potentially existing same named tab.
  }
  try{tab.focus()}catch{}
  return true;
}
