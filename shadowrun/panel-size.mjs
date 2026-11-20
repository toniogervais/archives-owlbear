// The OBR action is capped by the host viewport. Measure intrinsic content
// rather than the iframe itself, which would feed its dimensions back.
export function panelSize({screenWidth,screenHeight,content,wide=false,home=false,mode='auto'}){
 if(mode==='large')return {width:Math.round(Math.min(Math.max(280,screenWidth-24),1440)),height:Math.round(Math.min(Math.max(240,screenHeight-72),1080))};
 const width=Math.min(Math.max(280,screenWidth-20),home?970:wide?1070:870);
 const maxHeight=Math.max(240,Math.min(930,screenHeight-96));
 return {width:Math.round(width),height:Math.round(Math.min(maxHeight,Math.max(Math.min(370,maxHeight),content)))};
}
export function observePanel(obr) {
 if(!obr.isAvailable||new URLSearchParams(location.search).get('tab')==='mj'||new URLSearchParams(location.search).get('view')==='fullscreen')return ()=>{};
 const article=document.querySelector('#detail');
 let timer,lastW,lastH,chain=Promise.resolve();
 function measure(){
  const opened=document.querySelector('dialog[open]');
  const home=Boolean(article.querySelector('.theme-grid,.welcome'));
  const frame=document.querySelector('.workspace');
  const outside=frame.getBoundingClientRect().top+(document.querySelector('footer')?.offsetHeight||32)+16;
  const body=Array.from(article.children).reduce((sum,el)=>{const css=getComputedStyle(el);return sum+el.getBoundingClientRect().height+parseFloat(css.marginBlockStart||0)+parseFloat(css.marginBlockEnd||0);},0);
  const content=opened?Math.max(opened.scrollHeight+52,430):outside+body+42;
  const hostW=window.screen.availWidth||window.screen.width;
  const hostH=window.screen.availHeight||window.screen.height;
  const wide=Boolean(article.querySelector('.stat-grid,.plate-gallery,.table-wrap'));
  const {width,height}=panelSize({screenWidth:hostW,screenHeight:hostH,content,wide,home,mode:document.body.dataset.panelSize==='large'?'large':'auto'});
  chain=chain.catch(()=>{}).then(async()=>{
   if(lastW!==width){await obr.action.setWidth(width);lastW=width;}
   if(lastH!==height){await obr.action.setHeight(height);lastH=height;}
  }).catch(()=>{});
 }
 const queue=()=>{clearTimeout(timer);timer=setTimeout(measure,70);};
 const observer=new MutationObserver(queue);
 observer.observe(article,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden']});
 observer.observe(document.body,{attributes:true,attributeFilter:['data-panel-size']});
 for(const dialog of document.querySelectorAll('dialog'))observer.observe(dialog,{attributes:true,attributeFilter:['open'],childList:true,subtree:true});
 article.addEventListener('load',queue,true);
 window.addEventListener('orientationchange',queue);window.addEventListener('resize',queue);window.addEventListener('sr6-panel-size',queue);
 queue();
 return ()=>{observer.disconnect();clearTimeout(timer);article.removeEventListener('load',queue,true);window.removeEventListener('orientationchange',queue);window.removeEventListener('resize',queue);window.removeEventListener('sr6-panel-size',queue);};
}
