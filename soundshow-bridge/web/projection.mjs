// Keep the video call negotiated between cues. Disabled tracks send black and silence.
export async function chooseProjection() {
  if(!navigator.mediaDevices?.getDisplayMedia)throw Error('Ouvre le connecteur dans Chrome ou Edge sur le PC du MJ.');
  const stream=await navigator.mediaDevices.getDisplayMedia({
    video:{displaySurface:'window',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},
    audio:true,windowAudio:'window',systemAudio:'exclude',monitorTypeSurfaces:'exclude',
    selfBrowserSurface:'exclude',surfaceSwitching:'exclude'
  });
  const video=stream.getVideoTracks()[0];
  if(video?.getSettings().displaySurface!=='window'){
    for(const track of stream.getTracks())track.stop();
    throw Error('Choisis la fenêtre de projection SoundShow dans la rubrique « Fenêtre ».');
  }
  gateProjection(stream,null);
  return stream;
}
export function gateProjection(stream,item) {
  for(const track of stream.getTracks())
    track.enabled=track.kind==='video'?!!item:!!item?.playing&&!item.muted;
}
