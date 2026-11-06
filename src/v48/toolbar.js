/* V4.8 — Réduire / déployer la barre d'icônes sans toucher aux actions.
   Le déplacement et la sauvegarde du canevas conservent leur code existant. */
(function(){
  "use strict";
  const KEY="archives_quick_dock_collapsed_v48";
  const ID="quick-dock-collapse-toggle";
  const ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function initialize(){
    const dock=document.getElementById("quick-icon-dock");
    if(!dock||document.getElementById(ID))return;
    const grip=document.getElementById("quick-dock-handle");
    const toggle=document.createElement("button");
    toggle.id=ID;
    toggle.type="button";
    toggle.innerHTML=ICON;
    if(grip&&grip.nextSibling)dock.insertBefore(toggle,grip.nextSibling);
    else dock.prepend(toggle);

    function reposition(){
      // La barre mobile garde ses anciennes coordonnées. Si elle était à
      // l'extrémité de l'écran, déplier ne doit pas masquer le chevron.
      if(!dock.classList.contains("dock-positioned"))return;
      let left=Number.parseFloat(dock.style.left);
      let top=Number.parseFloat(dock.style.top);
      if(!Number.isFinite(left)||!Number.isFinite(top))return;
      left=Math.min(Math.max(left,6),Math.max(6,innerWidth-dock.offsetWidth-6));
      top=Math.min(Math.max(top,6),Math.max(6,innerHeight-dock.offsetHeight-6));
      dock.style.left=Math.round(left)+"px";
      dock.style.top=Math.round(top)+"px";
    }
    function apply(collapsed){
      dock.classList.toggle("is-collapsed",collapsed);
      toggle.setAttribute("aria-expanded",String(!collapsed));
      const label=collapsed?"Afficher la barre d’outils":"Réduire la barre d’outils";
      toggle.setAttribute("aria-label",label);
      toggle.title=label;
      reposition();
      try{localStorage.setItem(KEY,collapsed?"1":"0")}catch{}
    }
    let collapsed=false;
    try{collapsed=localStorage.getItem(KEY)==="1"}catch{}
    apply(collapsed);
    toggle.addEventListener("click",e=>{
      e.preventDefault();
      e.stopPropagation();
      apply(!dock.classList.contains("is-collapsed"));
    });
    window.addEventListener("resize",reposition);
    window.ArchivesToolbarV48={isCollapsed:()=>dock.classList.contains("is-collapsed"),toggle:()=>apply(!dock.classList.contains("is-collapsed"))};

    // Le contrôle de synchronisation utilisait un caractère unicode alors que
    // les autres boutons possèdent déjà des icônes SVG avec traits fins.
    const diagnostic=document.getElementById("archives-sync-diag-open");
    if(diagnostic){
      diagnostic.replaceChildren();
      diagnostic.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 12l4.7-3.5M6.5 15.5h11"/><circle cx="12" cy="12" r="1.5"/></svg>';
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize,{once:true});
  else initialize();
})();