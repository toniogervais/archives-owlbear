const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const number = (value,fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export function normalizeCrop(value = {}) {
  value ||= {};
  return {zoom:clamp(number(value.zoom,1),0.15,8),x:clamp(number(value.x,0),-8,8),y:clamp(number(value.y,0),-8,8)};
}
export function imagePlacement(width,height,crop = {},size = 512) {
  if (!(width > 0 && height > 0 && size > 0)) throw Error("Dimensions d’image invalides.");
  const state = normalizeCrop(crop),scale = Math.max(size / width,size / height) * state.zoom;
  const w = width * scale,h = height * scale;
  return {x:(size - w) / 2 + state.x * size,y:(size - h) / 2 + state.y * size,width:w,height:h};
}
export function zoomCropAt(crop,zoom,point = {x:0.5,y:0.5}) {
  const state = normalizeCrop(crop),next = normalizeCrop({...state,zoom}),ratio = next.zoom / state.zoom;
  return normalizeCrop({...next,x:point.x - 0.5 - (point.x - 0.5 - state.x) * ratio,
    y:point.y - 0.5 - (point.y - 0.5 - state.y) * ratio});
}
export function drawToken(ctx,picture,title,crop = {},size = ctx.canvas?.width || 512) {
  if (!(Number.isInteger(size) && size >= 128 && size <= 2400)) throw Error("Résolution du token invalide.");
  // Preview at 512px and HD output use the SAME normalized framing.
  // Source picture is always the original bitmap, never an enlarged preview.
  const unit = size / 512,centre = size / 2,radius = 248 * unit;
  ctx.clearRect(0,0,size,size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.save();ctx.beginPath();ctx.arc(centre,centre,radius,0,Math.PI * 2);ctx.clip();
  ctx.fillStyle = "#302139";ctx.fillRect(0,0,size,size);
  if (picture) {
    const box = imagePlacement(picture.width,picture.height,crop,size);
    ctx.drawImage(picture,box.x,box.y,box.width,box.height);
  } else {
    ctx.fillStyle = "#ffe3a0";ctx.font = "bold " + Math.round(132 * unit) + "px serif";
    ctx.textAlign = "center";ctx.textBaseline = "middle";
    ctx.fillText(String(title || "").trim().split(/\s+/).slice(0,2).map(word => Array.from(word)[0] || "").join("").toLocaleUpperCase("fr"),centre,centre);
  }
  ctx.restore();
  ctx.strokeStyle = "#d8b76b";ctx.lineWidth = 12 * unit;
  ctx.beginPath();ctx.arc(centre,centre,radius,0,Math.PI * 2);ctx.stroke();
}
export function installCropEditor({canvas,range,output,onChange = () => {}}) {
  let state = normalizeCrop(),picture,title = "",disabled = false,animation,disposed = false;
  const pointers = new Map(),off = [];
  const listen = (target,name,fn,options) => { target.addEventListener(name,fn,options);off.push(() => target.removeEventListener(name,fn,options)); };
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    return {x:(event.clientX - rect.left) / rect.width,y:(event.clientY - rect.top) / rect.height};
  };
  function paint() {
    if (disposed) return;drawToken(canvas.getContext("2d"),picture,title,state);
    range.value = String(Math.round(state.zoom * 100));output.value = output.textContent = Math.round(state.zoom * 100) + " %";
  }
  function update(next,notify = true) {
    state = normalizeCrop(next);
    if (!animation) animation = requestAnimationFrame(() => { animation = null;paint(); });
    if (notify) onChange({...state});
  }
  const enabled = () => !disabled && !!picture && !disposed;
  listen(canvas,"pointerdown",event => {
    if (!enabled() || event.button > 0) return;
    event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,point(event));canvas.classList.add("dragging");
  });
  listen(canvas,"pointermove",event => {
    if (!enabled() || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    const before = Array.from(pointers.values()).slice(0,2),old = pointers.get(event.pointerId),next = point(event);
    pointers.set(event.pointerId,next);
    if (pointers.size >= 2) {
      const after = Array.from(pointers.values()).slice(0,2);
      const midpoint = values => ({x:(values[0].x + values[1].x) / 2,y:(values[0].y + values[1].y) / 2});
      const distance = values => Math.hypot(values[0].x - values[1].x,values[0].y - values[1].y);
      const a = midpoint(before),b = midpoint(after),ratio = distance(before) > 0.005 ? distance(after) / distance(before) : 1;
      const zoomed = zoomCropAt(state,state.zoom * ratio,a);
      update({...zoomed,x:zoomed.x + b.x - a.x,y:zoomed.y + b.y - a.y});
    } else update({...state,x:state.x + next.x - old.x,y:state.y + next.y - old.y});
  });
  const end = event => {
    pointers.delete(event.pointerId);if (!pointers.size) canvas.classList.remove("dragging");
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  listen(canvas,"pointerup",end);listen(canvas,"pointercancel",end);listen(canvas,"lostpointercapture",event => { pointers.delete(event.pointerId);canvas.classList.remove("dragging"); });
  listen(canvas,"wheel",event => {
    if (!enabled()) return;event.preventDefault();event.stopPropagation();
    update(zoomCropAt(state,state.zoom * Math.exp(-event.deltaY * 0.002),point(event)));
  },{passive:false});
  listen(canvas,"keydown",event => {
    if (!enabled() || event.ctrlKey || event.altKey || event.metaKey) return;
    const step = (event.shiftKey ? 10 : 1) / 512;
    let next;
    if (event.key === "ArrowLeft") next = {...state,x:state.x - step};
    if (event.key === "ArrowRight") next = {...state,x:state.x + step};
    if (event.key === "ArrowUp") next = {...state,y:state.y - step};
    if (event.key === "ArrowDown") next = {...state,y:state.y + step};
    if (["+","="].includes(event.key)) next = zoomCropAt(state,state.zoom * 1.1);
    if (event.key === "-") next = zoomCropAt(state,state.zoom / 1.1);
    if (event.key === "Home") next = normalizeCrop();
    if (next) { event.preventDefault();event.stopPropagation();update(next); }
  });
  listen(range,"input",() => { if (enabled()) update(zoomCropAt(state,Number(range.value) / 100)); });
  paint();
  return {
    getState:() => ({...state}),
    setPicture(value,heading,preset) {
      const changed = picture !== value;picture = value;title = heading;
      if (preset) state = normalizeCrop(preset);else if (changed) state = normalizeCrop();
      range.disabled = !enabled();paint();
    },
    setDisabled(value) {
      disabled = value;range.disabled = !enabled();
      canvas.setAttribute("aria-disabled",String(disabled));
      if (disabled) { pointers.clear();canvas.classList.remove("dragging"); }
    },
    dispose() { disposed = true;off.forEach(fn => fn());if (animation) cancelAnimationFrame(animation);pointers.clear(); }
  };
}
