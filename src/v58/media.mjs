import { maxImageBytes } from "./model.mjs";

const rasterTypes = ["image/png","image/jpeg","image/webp"];
const maxFileBytes = 25 * 1024 * 1024;
const cleanText = value => {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  return template.content.textContent || "";
};

export async function prepareSource(input) {
  const source = {...input,title:String(input.title || "Sans titre").slice(0,120),text:cleanText(input.text)};
  let file = input.file;
  if (!file && input.data) {
    const url = String(input.data);
    if (!url.startsWith("https://") && !/^data:image\/(png|jpeg|webp);base64,/.test(url))
      throw Error("Choisis une image PNG, JPG ou WebP enregistrée sur ton appareil.");
    let response;
    try { response = await fetch(url,{mode:"cors",credentials:"omit",referrerPolicy:"no-referrer"}); }
    catch { throw Error("Cette image distante ne peut pas être copiée. Choisis son fichier sur ton appareil."); }
    if (!response.ok) throw Error("L’image choisie est inaccessible.");
    file = await response.blob();
  }
  if (file) {
    if (!file.size || file.size > maxFileBytes) throw Error("Choisis un fichier de moins de 25 Mo.");
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) {
      const pdfjs = await import("../../assets/pdfjs-4.10.38/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../assets/pdfjs-4.10.38/pdf.worker.mjs",import.meta.url).href;
      const task = pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,
        useSystemFonts:true,stopAtErrors:true,disableAutoFetch:true});
      source.pdf = await task.promise;
      source.pages = source.pdf.numPages;
    } else if (file.type === "text/plain" || /\.txt$/i.test(file.name || "")) {
      source.text = await file.text();
      if (source.text.length > 12000) throw Error("Ce texte dépasse 12 000 caractères. Prépare un extrait ou utilise un PDF.");
    } else {
      if (!rasterTypes.includes(file.type)) throw Error("Formats acceptés : PNG, JPG, WebP, PDF et TXT. Exporte les autres documents en PDF.");
      source.bitmap = await createImageBitmap(file);
      if (source.bitmap.width > 12000 || source.bitmap.height > 12000 || source.bitmap.width * source.bitmap.height > 60000000) {
        source.bitmap.close();
        throw Error("Cette image est trop grande. Réduis-la à moins de 12 000 pixels par côté.");
      }
    }
  }
  source.release = () => { source.bitmap?.close(); void source.pdf?.destroy(); };
  return source;
}
function canvas(width,height) {
  const el = document.createElement("canvas");
  el.width = Math.round(width); el.height = Math.round(height);
  return el;
}
function wrap(ctx,text,width) {
  const lines = [];
  for (const paragraph of text.replace(/\r/g,"").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const trial = line ? line + " " + word : word;
      if (ctx.measureText(trial).width <= width) { line = trial; continue; }
      if (line) lines.push(line);
      line = "";
      for (const ch of word) {
        if (ctx.measureText(line + ch).width > width) { lines.push(line); line = ""; }
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}
export async function renderSource(source,{kind,title,text,page = 1,includeText = false}) {
  let picture = source.bitmap;
  if (source.pdf) {
    const pdfPage = await source.pdf.getPage(page);
    const original = pdfPage.getViewport({scale:1});
    const scale = Math.min(2,2200 / original.width,2800 / original.height);
    const viewport = pdfPage.getViewport({scale});
    picture = canvas(viewport.width,viewport.height);
    await pdfPage.render({canvasContext:picture.getContext("2d"),viewport,background:"white"}).promise;
    pdfPage.cleanup();
  }
  let out;
  if (kind === "TOKEN") {
    out = canvas(512,512);
    const ctx = out.getContext("2d");
    ctx.save();ctx.beginPath();ctx.arc(256,256,248,0,Math.PI * 2);ctx.clip();
    ctx.fillStyle = "#302139";ctx.fillRect(0,0,512,512);
    if (picture) {
      const width = picture.width, height = picture.height, side = Math.min(width,height);
      ctx.drawImage(picture,(width - side) / 2,(height - side) / 2,side,side,0,0,512,512);
    } else {
      ctx.fillStyle = "#ffe3a0";ctx.font = "bold 132px serif";ctx.textAlign = "center";ctx.textBaseline = "middle";
      ctx.fillText(title.trim().split(/\s+/).slice(0,2).map(word => word[0]).join("").toLocaleUpperCase("fr"),256,256);
    }
    ctx.restore();ctx.strokeStyle = "#d8b76b";ctx.lineWidth = 12;ctx.beginPath();ctx.arc(256,256,248,0,Math.PI * 2);ctx.stroke();
  } else {
    const docText = includeText ? String(text || "").trim() : "";
    if (!picture && !docText) throw Error("Ajoute le texte du document ou choisis un fichier.");
    const probe = canvas(1200,100), pc = probe.getContext("2d");
    pc.font = "28px sans-serif";
    const lines = docText ? wrap(pc,docText,1080) : [];
    if (lines.length > 68) throw Error("Le texte dépasse la page. Réduis-le ou transfère un PDF page par page.");
    if (picture && !lines.length) {
      const scale = Math.min(1,2200 / picture.width,2800 / picture.height);
      out = canvas(picture.width * scale,picture.height * scale);
      out.getContext("2d").drawImage(picture,0,0,out.width,out.height);
    } else {
      const photoHeight = picture ? Math.min(800,1080 * picture.height / picture.width) : 0;
      const height = 180 + photoHeight + lines.length * 39;
      if (height > 3200) throw Error("L’image et le texte dépassent la page. Raccourcis le texte ou utilise le fichier seul.");
      out = canvas(1200,Math.max(700,height));
      const ctx = out.getContext("2d");ctx.fillStyle = "#fbf5e7";ctx.fillRect(0,0,out.width,out.height);
      ctx.fillStyle = "#27202a";ctx.font = "bold 36px serif";
      const heading = wrap(ctx,title,1080);
      if (heading.length > 2) throw Error("Raccourcis le titre pour qu’il tienne sur le document.");
      heading.forEach((line,index) => ctx.fillText(line,60,65 + index * 42));
      let top = 150;
      if (picture) { const width = photoHeight * picture.width / picture.height;ctx.drawImage(picture,60 + (1080 - width) / 2,top,width,photoHeight);top += photoHeight + 32; }
      ctx.font = "28px sans-serif";
      lines.forEach((line,index) => ctx.fillText(line,60,top + index * 39));
    }
  }
  let data = out.toDataURL("image/png");
  if (data.length > maxImageBytes * 4 / 3) data = out.toDataURL("image/webp",0.9);
  if (data.length > maxImageBytes * 4 / 3) throw Error("Le rendu est trop volumineux. Réduis la taille de l’image.");
  return {id:crypto.randomUUID(),version:crypto.randomUUID(),width:out.width,height:out.height,
    mime:data.startsWith("data:image/webp") ? "image/webp" : "image/png",data};
}
