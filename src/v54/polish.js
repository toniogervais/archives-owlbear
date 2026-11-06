/* V4.14 — Effets locaux non bloquants : ni nouveaux boutons ni flux de données. */
(function(){
  "use strict";
  const mq=window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):{matches:false};
  const timers=new WeakMap();
  const enabled=()=>!mq.matches&&!document.body.classList.contains("fx-disabled");
  function flash(el,kind){
    if(!el||!enabled()||el.disabled)return;
    const cls=kind==="dock"?"archives-v54-tap":"archives-v54-press";
    const old=timers.get(el);
    if(old)clearTimeout(old);
    el.classList.remove(cls);
    // Force a fresh animation when the same button is pressed several times.
    void el.offsetWidth;
    el.classList.add(cls);
    timers.set(el,setTimeout(()=>{el.classList.remove(cls);timers.delete(el)},650));
  }
  document.addEventListener("click",e=>{
    if(!e.target||!e.target.closest)return;
    const dock=e.target.closest("#quick-icon-dock > .quick-icon-btn");
    if(dock){flash(dock,"dock");return;}
    const control=e.target.closest("button.btn,.mini-btn,.tab-btn,#settings-fab,#create-fab,.circle-toggle-btn");
    if(control)flash(control,"button");
  },{capture:true,passive:true});
  // FLIP movement only for programmatic re-layout, never during direct dragging.
  const nodeLayer=document.getElementById("nodes-layer");
  if(!nodeLayer||!window.MutationObserver)return;
  let snapshot=new Map(),ready=false,dragging=false,releaseTimer;
  function capture(){
    const next=new Map(),changed=[];
    nodeLayer.querySelectorAll(".node-cell[data-id]").forEach(node=>{
      const id=node.getAttribute("data-id");
      const x=parseFloat(node.style.left),y=parseFloat(node.style.top);
      if(!id||!Number.isFinite(x)||!Number.isFinite(y))return;
      next.set(id,{x,y});
      const old=snapshot.get(id);
      if(old&&ready&&Math.abs(old.x-x)+Math.abs(old.y-y)>3)
        changed.push({node,dx:old.x-x,dy:old.y-y});
    });
    snapshot=next;
    if(!ready){ready=true;return;}
    if(dragging||!enabled()||document.hidden||changed.length>50)return;
    for(const {node,dx,dy} of changed){
      if(Math.abs(dx)>2800||Math.abs(dy)>2800||typeof node.animate!=="function")continue;
      try{
        node.animate(
          [{transform:"translate3d("+dx+"px,"+dy+"px,0)"},{transform:"translate3d(0,0,0)"}],
          {duration:380,easing:"cubic-bezier(.18,.78,.24,1)"}
        );
      }catch(_){}
    }
  }
  capture();
  const observer=new MutationObserver(()=>capture());
  observer.observe(nodeLayer,{childList:true});
  document.addEventListener("pointerdown",e=>{
    if(e.target?.closest?.("#nodes-layer .node-cell,#canvas-viewport,#quick-dock-handle,#sidebar-resizer")){
      clearTimeout(releaseTimer);dragging=true;
    }
  },{capture:true,passive:true});
  const release=()=>{
    clearTimeout(releaseTimer);
    releaseTimer=setTimeout(()=>{capture();dragging=false},100);
  };
  document.addEventListener("pointerup",release,{capture:true,passive:true});
  document.addEventListener("pointercancel",release,{capture:true,passive:true});
  window.addEventListener("blur",()=>{dragging=false;capture()});
})();
