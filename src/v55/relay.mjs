const api=window.ArchivesRelay;
const remote=new URLSearchParams(location.search).get("remote")==="1";
const player=new URLSearchParams(location.search).get("ro")==="1";
let peer, connection, revision=0, applying=false, pending=null, inFlight=false;
let returning=false, mapRequested=false;
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
  let pairing="",lastSeen=0;
  try{pairing=decodeURIComponent(location.hash.slice(1));}catch(_){}
  history.replaceState(null,"",location.pathname+location.search);
  const parts=pairing.split(".");
  if(parts.length!==2||!/^[a-f0-9]{64}$/.test(parts[1])){
    block("Jumelage absent. Relie les Archives depuis le panneau Owlbear.");
  }else{
    await api.loadPeer();
    const sessionId=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,"0")).join("");
    let retryTimer=null,handshakeTimer=null,attempt=0,lastPong=Date.now(),ready=false,halted=false;
    const unsafe=()=>!!pending||inFlight;
    const clearHandshake=()=>{clearTimeout(handshakeTimer);handshakeTimer=null;};
    function safety(){
      halted=true;clearHandshake();clearTimeout(retryTimer);
      block("Des modifications ne sont pas encore confirmées. Pour éviter toute perte, la reconnexion est bloquée. Vérifie les Archives principales.");
      if(returning){returning=false;window.parent.postMessage({type:"archives:flush-error:v55"},location.origin);}
    }
    function retry(reason){
      clearHandshake();
      if(halted||unsafe()){safety();return;}
      block((reason||"Connexion interrompue.")+" Reconnexion automatique en cours…");
      if(retryTimer)return;
      const delay=document.hidden?6000:Math.min(16000,1200*2**Math.min(attempt++,4));
      retryTimer=setTimeout(()=>{retryTimer=null;connect();},delay);
    }
    function connect(){
      if(halted||unsafe()){safety();return;}
      if(!peer||peer.destroyed){retry("Service de jumelage indisponible.");return;}
      if(peer.disconnected){
        try{peer.reconnect()}catch(_){}
        retry("Service de jumelage interrompu.");return;
      }
      if(!peer.open){retry("En attente du jumelage.");return;}
      if(connection?.open&&ready)return;
      if(connection){try{connection.close()}catch(_){}connection=null;}
      let conn;
      try{conn=peer.connect(parts[0],{reliable:true,metadata:{secret:parts[1],session:sessionId}})}
      catch(_){retry("Archives principales injoignables.");return;}
      connection=conn;ready=false;
      handshakeTimer=setTimeout(()=>{
        if(connection!==conn||ready)return;
        connection=null;try{conn.close()}catch(_){}
        retry("Les Archives principales ne répondent pas encore.");
      },14000);
      conn.on("data",message=>{
        if(connection!==conn)return;
        lastPong=Date.now();
        if(message?.type==="pong")return;
        if(message?.type==="state"){
          clearHandshake();
          if(unsafe()){safety();return;}
          revision=message.revision;
          applying=true;
          try{api.apply(message.payload);ready=true;attempt=0;unblock()}
          catch(_){halted=true;block("Le scénario reçu ne peut pas être ouvert.");}
          finally{applying=false;}
          if(ready)window.parent.postMessage({type:"archives:room:v55",room:message.room||""},location.origin);
        }else if(message?.type==="ack"){
          revision=message.revision;inFlight=false;flush();
        }else if(message?.type==="map-ack"&&returning){
          returning=false;window.parent.postMessage({type:"archives:flushed:v55"},location.origin);
        }else if(message?.type==="busy"){
          clearHandshake();halted=true;block("Une autre vue des Archives est active dans Owlbear.");
        }else if(message?.type==="persist-error"){
          clearHandshake();halted=true;inFlight=false;
          block("Sauvegarde non confirmée dans les Archives principales.");
          window.parent.postMessage({type:"archives:flush-error:v55"},location.origin);
        }
      });
      conn.on("close",()=>{
        if(connection!==conn)return;
        connection=null;ready=false;
        if(returning){returning=false;window.parent.postMessage({type:"archives:flush-error:v55"},location.origin)}
        retry("Liaison momentanément perdue.");
      });
      conn.on("error",()=>{
        if(connection!==conn)return;
        connection=null;ready=false;try{conn.close()}catch(_){}
        retry("Connexion momentanément impossible.");
      });
    }
    peer=new window.Peer();
    peer.on("open",()=>{clearTimeout(retryTimer);retryTimer=null;connect()});
    peer.on("disconnected",()=>{
      // A signalling websocket can drop while an existing WebRTC data channel still works.
      try{peer.reconnect()}catch(_){}
      if(ready&&connection?.open)return;
      ready=false;
      if(unsafe()){safety();return;}
      retry("Service de jumelage momentanément déconnecté.");
    });
    peer.on("error",error=>{
      console.warn("Archives : jumelage",error?.type||error);
      if(ready&&connection?.open)return;
      retry("Jumelage momentanément indisponible.");
    });
    const wake=()=>{
      if(document.hidden||halted)return;
      if(ready&&connection?.open){lastPong=Date.now();send({type:"ping"})}
      else{clearTimeout(retryTimer);retryTimer=null;connect()}
    };
    document.addEventListener("visibilitychange",wake);
    window.addEventListener("focus",wake);
    setInterval(()=>{
      if(document.hidden||halted||!ready||!connection?.open)return;
      if(Date.now()-lastPong>18000){
        const old=connection;connection=null;ready=false;
        try{old.close()}catch(_){}
        retry("La liaison ne répond plus après une période d'inactivité.");
        return;
      }
      send({type:"ping"});
    },5000);
    window.addEventListener("archives:edit:v55",event=>{
      if(applying||halted)return;
      pending=copy(event.detail);flush();
    });
    window.addEventListener("message",event=>{
      if(event.source!==window.parent||event.origin!==location.origin)return;
      if(event.data?.type==="archives:can-relink:v55"){
        window.parent.postMessage({type:"archives:can-relink-result:v55",safe:!unsafe()},location.origin);
        return;
      }
      if(event.data?.type!=="archives:flush:v55")return;
      const started=Date.now();returning=true;mapRequested=false;
      const check=setInterval(()=>{
        if(!returning){clearInterval(check);return;}
        if(!pending&&!inFlight&&!mapRequested&&ready&&connection?.open){
          mapRequested=true;send({type:"map"});
        }
        if(Date.now()-started>10000){
          returning=false;clearInterval(check);
          window.parent.postMessage({type:"archives:flush-error:v55"},location.origin);
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
          const sameSession=typeof conn.metadata?.session==="string"&&
            conn.metadata.session.length>=8&&conn.metadata.session===connection?.metadata?.session;
          if(connection?.open&&Date.now()-lastSeen<42000&&!sameSession){
            conn.on("open",()=>{conn.send({type:"busy"});conn.close()});return;
          }
          if(connection){try{connection.close()}catch(_){}connection=null;unblock();}
          connection=conn;
          conn.on("open",()=>{
            lastSeen=Date.now();
            block("Édition en cours dans Owlbear. Cet onglet conserve la partie et le Salon Live.");
            conn.send({type:"state",revision,payload:copy(api.snapshot()),room:api.room()});
          });
          conn.on("data",m=>{
            if(connection!==conn)return;
            lastSeen=Date.now();
            if(m?.type==="ping"){conn.send({type:"pong"});return;}
            if(m?.type==="map"){
              const url=localStorage.getItem("archives_owlbear_room_url_v38");
              try{if(url)window.ArchivesLiveInvitations?.inviteToOwlbear(url);}
              finally{conn.send({type:"map-ack"});}
              return;
            }
            if(m?.type!=="edit")return;
            if(m.revision!==revision){
              conn.send({type:"state",revision,payload:copy(api.snapshot()),room:api.room()});return;
            }
            try{
              applying=true;
              api.apply(m.payload);
              // An acknowledgement is only safe if the central backup truly persisted.
              // saveState() may swallow QuotaExceededError; verify the exact saved snapshot.
              const stored=JSON.parse(localStorage.getItem("jdr_architect_save_v12")||"null");
              const current=api.snapshot();
              if(!stored||JSON.stringify(stored)!==JSON.stringify(current))
                throw Error("La sauvegarde locale ne correspond pas au scénario courant.");
              revision++;
              conn.send({type:"ack",revision});
            }catch(error){
              console.error("Archives : modification non confirmée",error);
              conn.send({type:"persist-error"});
            }finally{applying=false;}
          });
          const release=()=>{if(connection===conn){connection=null;unblock();}};
          conn.on("close",release);conn.on("error",release);
        });
        const id=await new Promise((resolve,reject)=>{peer.on("open",resolve);peer.on("error",reject);});
        pairing=id+"."+secret;
        peer.on("disconnected",()=>{try{peer.reconnect()}catch(_){}});
        peer.on("error",error=>console.warn("Jumelage MJ",error));
      }catch{window.alert("Le jumelage ne peut pas démarrer. Vérifie la connexion Internet.");}
      finally{button.disabled=false;}
    }
    if(pairing)window.prompt("Code privé MJ à coller dans « Relier les Archives » du panneau Owlbear. Garde cet onglet ouvert.",pairing);
  });
  button.title="Clic : copier le code. Clic droit : renouveler le code privé.";
  button.addEventListener("contextmenu",event=>{
    event.preventDefault();
    if(connection?.open){window.alert("Termine d'abord l'édition depuis Owlbear.");return;}
    try{peer?.destroy()}catch(_){}
    peer=null;pairing="";button.click();
  });
  window.addEventListener("archives:edit:v55",()=>{
    if(applying||!connection?.open)return;
    // snapshot() also emits a save event; do not recursively ask for a snapshot.
    revision++;
  });
}
window.addEventListener("pagehide",()=>peer?.destroy());
