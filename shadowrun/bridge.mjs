import OBR from '../assets/owlbear-transfer-sdk-v55.mjs?v=137';
import * as storage from './storage.mjs?v=137';
import {createBridge} from './bridge-core.mjs?v=137';
export {OBR};
export function bridge(equipment){return createBridge(OBR,storage,equipment);}
export function ready(){return new Promise(resolve=>{if(!OBR.isAvailable)return resolve(false);OBR.onReady(()=>resolve(true));});}
