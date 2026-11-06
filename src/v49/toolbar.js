/* V4.9: reduction d'outils independante des actions du canevas. */
(function(){
  "use strict";
  var KEY="archives_toolbar_collapsed_v49";
  function setup(){
    var dock=document.getElementById("quick-icon-dock");
    if(!dock||document.getElementById("archives-toolbar-collapse"))return;
    var handle=document.getElementById("quick-dock-handle");
    var toggle=document.createElement("button");
    toggle.type="button";toggle.id="archives-toolbar-collapse";
    toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    if(handle)handle.insertAdjacentElement("afterend",toggle);
    else dock.prepend(toggle);
    function keepVisible(){
      if(!dock.classList.contains("dock-positioned"))return;
      var x=parseFloat(dock.style.left),y=parseFloat(dock.style.top);
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      dock.style.left=Math.max(4,Math.min(x,Math.max(4,innerWidth-dock.offsetWidth-4)))+"px";
      dock.style.top=Math.max(4,Math.min(y,Math.max(4,innerHeight-dock.offsetHeight-4)))+"px";
    }
    function apply(collapsed,save){
      dock.classList.toggle("archives-toolbar-collapsed",!!collapsed);
      toggle.setAttribute("aria-expanded",String(!collapsed));
      toggle.setAttribute("aria-label",collapsed?"Déployer la barre d’outils":"Réduire la barre d’outils");
      toggle.title=toggle.getAttribute("aria-label");
      toggle.querySelector("path").setAttribute("d",collapsed?"m9 6 6 6-6 6":"m6 9 6 6 6-6");
      keepVisible();
      if(save){try{localStorage.setItem(KEY,collapsed?"1":"0");}catch(e){}}
    }
    var wasCollapsed=false;
    try{wasCollapsed=localStorage.getItem(KEY)==="1";}catch(e){}
    apply(wasCollapsed,false);
    toggle.addEventListener("click",function(e){
      e.preventDefault();e.stopPropagation();
      apply(!dock.classList.contains("archives-toolbar-collapsed"),true);
    });
    window.addEventListener("resize",keepVisible);
    window.ArchivesToolbar={
      toggle:function(){toggle.click();},
      isCollapsed:function(){return dock.classList.contains("archives-toolbar-collapsed");}
    };
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});
  else setup();
})();
