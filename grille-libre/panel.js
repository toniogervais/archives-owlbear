import {OBR,defaults,clean,getGrid,read,make,save,isGrid,TOOL,MOVE,SIZE} from "./common.js?v=120";
const $=id=>document.getElementById(id),fields=["cols","rows","width","height","x","y","rotation","color","opacity","thickness"];
let grid=null,busy=false,allowed=false,ready=false,dirty=false;
function status(t,err=false){$("status").textContent=t;$("status").classList.toggle("error",err)}
function paint(i,force=false){grid=i;if(!dirty||force){const s=i?read(i):defaults;for(const k of fields)$(k).value=k==="color"?s[k]:Math.round(s[k]*100)/100;dirty=false}const s=i?read(i):null;$("create").hidden=!!i;$("show").hidden=!i;$("lock").hidden=!i;$("show").textContent=s?.shown?"Masquer":"Afficher";$("lock").textContent=s?.locked?"Déverrouiller":"Verrouiller";$("show").setAttribute("aria-pressed",String(!!s?.shown));$("lock").setAttribute("aria-pressed",String(!!s?.locked));$("state").textContent=!i?"Aucune grille":(!s.shown?"Masquée":s.locked?"Visible · verrouillée":"Visible · modifiable");for(const k of fields)$(k).disabled=busy||!allowed||!ready;for(const k of ["create","show","lock","apply","center","select","remove"])$(k).disabled=busy||!allowed||!ready||(!i&&k!=="create")||((k==="select")&&(!s?.shown||s.locked));preview()}
function form(){return clean({...defaults,...Object.fromEntries(fields.map(k=>[k,$(k).value]))})}
function preview(){const s=form();$("cell").textContent=(s.width/s.cols).toFixed(2)+" × "+(s.height/s.rows).toFixed(2)+" px par case"}
async function refresh(force=false){if(!ready)return;paint(await getGrid(),force)}
async function run(fn){if(busy||!allowed||!ready)return;busy=true;paint(grid);try{await fn();await refresh(true);status("Enregistré dans cette scène")}catch(e){status(e?.message||String(e),true)}finally{busy=false;paint(grid)}}
for(const k of fields)$(k).addEventListener("input",()=>{dirty=true;preview()});
async function center(){return OBR.viewport.inverseTransformPoint({x:(await OBR.viewport.getWidth())/2,y:(await OBR.viewport.getHeight())/2})}
$("create").onclick=()=>run(async()=>{if(await getGrid())return;const p=await center();const s={...form(),...p,shown:true,locked:false};const i=make(s);await OBR.scene.items.addItems([i])});
$("apply").onclick=()=>run(async()=>{const i=await getGrid();if(i){const s=read(i);await save(i.id,{...form(),shown:s.shown,locked:s.locked})}});
$("show").onclick=()=>run(async()=>{const i=await getGrid();if(i){const s=read(i);await save(i.id,{...s,shown:!s.shown});if(s.shown)await OBR.player.deselect([i.id])}});
$("lock").onclick=()=>run(async()=>{const i=await getGrid();if(i){const s=read(i);await save(i.id,{...s,locked:!s.locked});if(!s.locked)await OBR.player.deselect([i.id])}});
$("center").onclick=()=>run(async()=>{const i=await getGrid();if(i)await save(i.id,{...read(i),...await center()})});
$("select").onclick=()=>run(async()=>{const i=await getGrid();if(i){const s=read(i);if(s.shown&&!s.locked)await OBR.player.select([i.id],true)}});
$("remove").onclick=()=>run(async()=>{const i=await getGrid();if(i&&confirm("Supprimer définitivement cette grille ?"))await OBR.scene.items.deleteItems([i.id])});
$("settings").addEventListener("submit",e=>{e.preventDefault();$("apply").click()});
OBR.onReady(async()=>{try{allowed=await OBR.player.getRole()==="GM";ready=await OBR.scene.isReady();paint(null,true);if(!allowed){status("Réglages réservés au MJ");return}if(ready)await refresh(true);status(ready?"":"Ouvre une scène Owlbear.");OBR.scene.onReadyChange(async value=>{ready=value;dirty=false;paint(null,true);if(value){await refresh(true);status("")}else status("Ouvre une scène Owlbear.")});OBR.scene.items.onChange(items=>{if(ready&&!busy)paint(items.find(isGrid)||null)})}catch(e){status(e?.message||String(e),true)}});
setTimeout(()=>{if(!OBR.isReady)status("Ouvre cette extension depuis Owlbear Rodeo.")},5000);
