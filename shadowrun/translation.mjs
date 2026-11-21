// Traduction à la demande : modèle embarqué au navigateur, aucun texte n'est envoyé à un service externe.
export function canTranslateLocally(){
 return typeof globalThis.Translator?.create==='function';
}
function chunks(text,max=1400){
 const out=[];let block='';
 for(const line of String(text||'').split(/(?<=\n)/)){
  if(block.length+line.length>max&&block){out.push(block);block='';}
  if(line.length>max){if(block){out.push(block);block='';}for(let i=0;i<line.length;i+=max)out.push(line.slice(i,i+max));}
  else block+=line;
 }
 if(block)out.push(block);
 return out;
}
export async function translatePassage(text,progress=()=>{}){
 if(!canTranslateLocally())throw Error('La traduction française intégrée n’est pas disponible dans ce navigateur.');
 const translator=await globalThis.Translator.create({sourceLanguage:'en',targetLanguage:'fr'});
 try{
  const parts=chunks(text),result=[];
  for(let i=0;i<parts.length;i++){
   result.push(await translator.translate(parts[i]));
   progress(i+1,parts.length);
  }
  return result.join('');
 }finally{translator.destroy?.();}
}
