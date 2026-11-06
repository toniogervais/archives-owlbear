const api=window.ArchivesRelay;
const remote=new URLSearchParams(location.search).get("remote")==="1";
const player=new URLSearchParams(location.search).get("ro")==="1";
let peer, connection, revision=0, applying=false, pending=null, inFlight=false;
const overlay=document.createElement("div");
overlay.style.cssText="position:fixed;inset:0;z-index:999999;background:#17121fee;color:#ffeac0;display:none;place-items:center;padding:30px;text-align:center;font:18px system-ui";
overlay.setAttribute("role","status");
document.body.append(overlay);
overlay.tabIndex=-1;
window.addEventListener("keydown",event=>{
  if(overlay.style.display==="grid"){event.stopImmediatePropagation();event.preventDefault();}
},true);
function block(text){overlay.textContent=text;overlay.style.display="grid";overlay.focus();}
function unblock(){overlay.style.display="none";}
function copy(data){return JSON.parse(JSON.stringify(data));}
function send(message){if(connection?.open)connection.send(message);}
function flush(){
  if(!pending||inFlight||!connection?.open)return;
  inFlight=true;
  send({type:"edit",revision,payload:pending});
  pending=null;
}
if(remote){
  block("Connexion aux Archives principales…");
  const pairing=decodeURIComponent(location.hash.slice(1));
  history.replaceState(null,"",location.pathname+location.search);
  const parts=pairing.split(".");
  if(parts.length!==2||!/^[a-f0-9]{64}$/.test(parts[1])){
    block("Jumelage absent. Ferme cette vue et relie les Archives depuis le panneau Owlbear.");
  }else{
    await api.loadPeer();
    peer=new window.Peer();
    const timeout=setTimeout(()=>block("Les Archives principales ne répondent pas. Garde leur onglet ouvert puis rouvre cette vue."),20000);
    peer.on("open",()=>{
      connection=peer.connect(parts[0],{reliable:true,metadata:{secret:parts[1]}});
      connection.on("data",message=>{
        if(message?.type==="state"){
          clearTimeout(timeout);
          revision=message.revision;
          pending=null;inFlight=false;
          applying=true;
          try{api.apply(message.payload);unblock();}
          catch{block("Le scénario reçu ne peut pas être ouvert.");}
          finally{applying=false;}
          window.parent.postMessage({type:"archives:room:v51",room:message.room||""},location.origin);
        }else if(message?.type==="ack"){
          revision=message.revision;inFlight=false;flush();
        }else if(message?.type==="busy"){
          clearTimeout(timeout);block("Une autre vue des Archives est déjà ouverte dans Owlbear.");
        }
      });
      connection.on("close",()=>block("Connexion aux Archives principales interrompue. Garde leur onglet ouvert et rouvre cette vue."));
      connection.on("error",()=>block("Connexion aux Archives principales impossible."));
    });
    peer.on("error",()=>block("Connexion aux Archives principales impossible. Vérifie le jumelage."));
    window.addEventListener("archives:edit:v51",e=>{
      if(applying)return;
      pending=copy(e.detail);flush();
    });
    // The parent waits until edits have been acknowledged before closing.
    window.addEventListener("message",e=>{
      if(e.source!==window.parent||e.origin!==location.origin||e.data?.type!=="archives:flush:v51")return;
      const started=Date.now();
      const check=setInterval(()=>{
        if(!pending&&!inFlight){
          clearInterval(check);
          send({type:"map"});
          window.parent.postMessage({type:"archives:flushed:v51"},location.origin);
        }else if(Date.now()-started>10000){
          clearInterval(check);
          window.parent.postMessage({type:"archives:flush-error:v51"},location.origin);
        }
      },100);
    });
  }
}else if(player && window.parent!==window){
  block("Connexion au Salon Live…");
  const room=new URLSearchParams(location.search).get("room");
  await api.loadPeer();
  peer=new window.Peer();
  peer.on("open",()=>{
    connection=peer.connect(room,{reliable:true,metadata:{playerName:"Joueur · Owlbear"}});
    connection.on("data",data=>{
      if(data?.type==="archives:invite:v40"){
        window.dispatchEvent(new CustomEvent("archives:invite:v40",{detail:data}));return;
      }
      try{api.apply(data);unblock();}catch{block("Données du Salon Live invalides.");}
    });
    connection.on("close",()=>block("Le Salon Live est déconnecté. Rouvre les Archives après reconnexion du MJ."));
    connection.on("error",()=>block("Connexion au Salon Live impossible."));
  });
  peer.on("error",()=>block("Le Salon Live est inaccessible. Vérifie son code et la connexion du MJ."));
}else if(!player && window.parent===window){
  const button=document.createElement("button");
  button.type="button";button.textContent="Relier à Owlbear";
  button.className="btn";
  (document.getElementById("canvas-integrations-dock")||document.body).append(button);
  let pairing="";
  button.addEventListener("click",async()=>{
    if(window.DuneApp?.getState?.().playerMode)return;
    if(!pairing){
      button.disabled=true;
      try{
        await api.loadPeer();
        const bytes=crypto.getRandomValues(new Uint8Array(32));
        const secret=Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
        peer=new window.Peer();
        peer.on("connection",conn=>{
          if(conn.metadata?.secret!==secret){conn.close();return;}
          if(connection){conn.on("open",()=>{conn.send({type:"busy"});conn.close();});return;}
          connection=conn;
          conn.on("open",()=>{
            block("Édition en cours dans Owlbear. Cet onglet conserve la partie et le Salon Live.");
            conn.send({type:"state",revision,payload:copy(api.snapshot()),room:api.room()});
          });
          conn.on("data",m=>{
            if(connection!==conn)return;
            if(m?.type==="map"){
              const url=localStorage.getItem("archives_owlbear_room_url_v38");
              if(url)window.ArchivesLiveInvitations?.inviteToOwlbear(url);
              return;
            }
            if(m?.type!=="edit")return;
            if(m.revision!==revision){
              conn.send({type:"state",revision,payload:copy(api.snapshot()),room:api.room()});return;
            }
            try{
              applying=true;api.apply(m.payload);revision++;
              conn.send({type:"ack",revision});
            }catch{
              conn.send({type:"state",revision,payload:copy(api.snapshot()),room:api.room()});
            }finally{applying=false;}
          });
          const release=()=>{if(connection===conn){connection=null;unblock();}};
          conn.on("close",release);conn.on("error",release);
        });
        const id=await new Promise((resolve,reject)=>{peer.on("open",resolve);peer.on("error",reject);});
        pairing=id+"."+secret;
      }catch{window.alert("Le jumelage ne peut pas démarrer. Vérifie la connexion Internet.");}
      finally{button.disabled=false;}
    }
    if(pairing)window.prompt("Code privé MJ à coller dans « Relier les Archives » du panneau Owlbear. Garde cet onglet ouvert.",pairing);
  });
  window.addEventListener("archives:edit:v51",()=>{
    if(applying||!connection?.open)return;
    // snapshot() also emits a save event; do not recursively ask for a snapshot.
    revision++;
  });
}
window.addEventListener("pagehide",()=>peer?.destroy());
