import {assetKey} from '../v58/model.mjs?v=4210';
export function publicArtwork(items) {
  return items.filter(item => item?.visible === true && item.metadata?.[assetKey]?.id === item.id &&
    typeof item.image?.url === 'string' && item.image.url.startsWith('https://') &&
    ['image/png','image/jpeg','image/webp'].includes(item.image.mime)).slice(0,500).map(item => ({
      id:item.id,title:String(item.name || 'Document').slice(0,120),kind:item.layer === 'CHARACTER' ? 'TOKEN' : 'DOCUMENT',
      image:{url:item.image.url,mime:item.image.mime,width:item.image.width,height:item.image.height}
    }));
}
export async function publicItems(OBR) {
  if (!await OBR.scene.isReady()) return [];
  return publicArtwork(await OBR.scene.items.getItems());
}
