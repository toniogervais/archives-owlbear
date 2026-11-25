import OBR, { buildShape, buildText } from "https://esm.sh/@owlbear-rodeo/sdk@3";

const CAGE_PREFIX = "calibration-cage-";
const tokenMetersInput = document.getElementById("tokenMeters");
const gridMetersInput = document.getElementById("gridMeters");
const calibrateBtn = document.getElementById("calibrateBtn");
const toggleCageBtn = document.getElementById("toggleCageBtn");
const statusEl = document.getElementById("status");
let ready=false, busy=false;

function setStatus(msg, isError = false) {
  statusEl.style.color = isError ? "#ff6b6b" : "#8ce99a";
  statusEl.textContent = msg;
}
async function run(fn) {
  if(!ready || busy) return;
  busy=true; calibrateBtn.disabled=toggleCageBtn.disabled=true;
  try { if(!await OBR.scene.isReady()) throw Error("Ouvre une scène."); await fn(); }
  catch(e){setStatus(e.message||String(e),true);}
  finally {busy=false; calibrateBtn.disabled=toggleCageBtn.disabled=!ready;}
}

// Récupère le premier token sélectionné par l'utilisateur.
async function getSelectedToken() {
  const selection = await OBR.player.getSelection();
  if (!selection || selection.length === 0) return null;
  const items = await OBR.scene.items.getItems(selection);
  return items.length > 0 ? items[0] : null;
}

// Calibre toute la scène sur le token choisi.
async function calibrateFromToken(token) {
  if (!token) {
    setStatus("Sélectionne d'abord un token sur la carte.", true);
    return;
  }
  if(token.type!=="IMAGE" || token.layer==="MAP") throw Error("Sélectionne un token, pas une carte.");
  const tokenMeters = parseFloat(tokenMetersInput.value) || 1;
  const gridMeters = parseFloat(gridMetersInput.value) || 1;
  if(!Number.isFinite(tokenMeters)||!Number.isFinite(gridMeters)||tokenMeters<=0||gridMeters<=0) throw Error("Les dimensions doivent être positives.");

  const nativeGridDpi = await OBR.scene.grid.getDpi();
  const tokenBounds = await OBR.scene.items.getItemBounds([token.id]);
  const tokenWidthPx = tokenBounds.width;

  if (!Number.isFinite(tokenWidthPx) || tokenWidthPx <= 0) {
    setStatus("Impossible de lire la taille de ce token.", true);
    return;
  }
  const desiredTokenPx = (tokenMeters / gridMeters) * nativeGridDpi;
  const scaleFactor = desiredTokenPx / tokenWidthPx;
  const anchor = tokenBounds.center;
  if(!Number.isFinite(scaleFactor)||scaleFactor<=0||!Number.isFinite(anchor?.x)||!Number.isFinite(anchor?.y)) throw Error("Échelle ou ancrage invalide.");

  await OBR.scene.grid.setScale(gridMeters+"m");
  await OBR.scene.grid.setType("SQUARE");
  const allItems = await OBR.scene.items.getItems();
  const idsToUpdate = allItems
    .filter((item) => !item.id.startsWith(CAGE_PREFIX))
    .map((item) => item.id);

  await OBR.scene.items.updateItems(idsToUpdate, (items) => {
    for (const item of items) {
      item.position = {
        x: anchor.x + (item.position.x - anchor.x) * scaleFactor,
        y: anchor.y + (item.position.y - anchor.y) * scaleFactor,
      };
      item.scale = {
        x: item.scale.x * scaleFactor,
        y: item.scale.y * scaleFactor,
      };
    }
  });

  const newBounds = await OBR.scene.items.getItemBounds([token.id]);
  const snapOffset = {
    x: newBounds.min.x % nativeGridDpi,
    y: newBounds.min.y % nativeGridDpi,
  };
  await OBR.scene.items.updateItems(idsToUpdate, (items) => {
    for (const item of items) {
      item.position = {
        x: item.position.x - snapOffset.x,
        y: item.position.y - snapOffset.y,
      };
    }
  });
  await drawCalibrationCage(token.id, gridMeters);
  setStatus("Grille calibrée : 1 case = "+gridMeters+" m");
}

async function drawCalibrationCage(tokenId, gridMeters) {
  await removeCalibrationCage();
  const dpi = await OBR.scene.grid.getDpi();
  const bounds = await OBR.scene.items.getItemBounds([tokenId]);
  const center = bounds.center;
  const rings = [1, 3, 5];
  const newItems = [];
  rings.forEach((cells, idx) => {
    const size = cells * dpi;
    const rect = buildShape()
      .id(CAGE_PREFIX+"ring-"+idx)
      .shapeType("RECTANGLE")
      .layer("POINTER")
      .position({ x: center.x - size / 2, y: center.y - size / 2 })
      .width(size)
      .height(size)
      .strokeColor(idx === 0 ? "#00ff88" : "#bb99ff")
      .strokeWidth(idx === 0 ? 4 : 2)
      .strokeDash(idx === 0 ? [] : [10, 10])
      .fillOpacity(0)
      .locked(true)
      .disableHit(true)
      .build();

    const label = buildText()
      .id(CAGE_PREFIX+"label-"+idx)
      .layer("POINTER")
      .position({ x: center.x - size / 2 + 6, y: center.y - size / 2 + 4 })
      .textType("PLAIN")
      .plainText(cells * gridMeters+" m")
      .fontSize(18)
      .fillColor(idx === 0 ? "#00ff88" : "#bb99ff")
      .locked(true)
      .disableHit(true)
      .build();
    newItems.push(rect, label);
  });
  await OBR.scene.items.addItems(newItems);
}

async function removeCalibrationCage() {
  const all = await OBR.scene.items.getItems();
  const cageIds = all.filter((i) => i.id.startsWith(CAGE_PREFIX)).map((i) => i.id);
  if (cageIds.length > 0) await OBR.scene.items.deleteItems(cageIds);
}

calibrateBtn.addEventListener("click", () => run(async () => {
  const token = await getSelectedToken();
  await calibrateFromToken(token);
}));
toggleCageBtn.addEventListener("click", () => run(async () => {
  const all = await OBR.scene.items.getItems();
  const hasCage = all.some((i) => i.id.startsWith(CAGE_PREFIX));
  if (hasCage) {
    await removeCalibrationCage();
    setStatus("Jauge masquée.");
  } else {
    const token = await getSelectedToken();
    if (!token) {
      setStatus("Sélectionne un token pour afficher sa jauge.", true);
      return;
    }
    const gridMeters = parseFloat(gridMetersInput.value) || 1;
    if(!Number.isFinite(gridMeters)||gridMeters<=0) throw Error("La taille de case doit être positive.");
    await drawCalibrationCage(token.id, gridMeters);
    setStatus("Jauge affichée autour du token.");
  }
}));

let initialized=false;
async function init(){
  if(initialized||!OBR.isReady)return;
  initialized=true;
  try{
    ready=await OBR.player.getRole()==="GM";
    if(!ready){setStatus("Réservé au MJ.",true);return;}
    calibrateBtn.disabled=toggleCageBtn.disabled=false;
    setStatus("Sélectionne un token pour commencer.");
    await OBR.contextMenu.create({
      id: "calibrate-grid-context-menu",
      icons: [{
        icon: new URL("icon.svg", location.href).href,
        label: "Calibrer la grille sur ce token",
        filter: {roles:["GM"], every: [{ key: "layer", value: "CHARACTER" }], min:1, max:1},
      }],
      async onClick(context) {
        if (context.items.length > 0) await run(()=>calibrateFromToken(context.items[0]));
      },
    });
  }catch(e){setStatus(e.message||String(e),true);}
}
window.calBoot?.release(OBR);
if(OBR.isAvailable){OBR.onReady(()=>void init());if(OBR.isReady)void init();setTimeout(()=>{if(!initialized)setStatus("Connexion SDK non reçue. Rouvre l’extension dans Owlbear.",true)},15000)}
else setStatus("Ouvre l’extension depuis une salle Owlbear.",true);
