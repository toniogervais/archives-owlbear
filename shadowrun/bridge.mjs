import OBR from '../assets/owlbear-transfer-sdk-v55.mjs?v=135';
import * as storage from './storage.mjs?v=135';
import {createBridge} from './bridge-core.mjs?v=135';
export {OBR};
export function bridge(equipment){return createBridge(OBR,storage,equipment);}
export function ready(){return new Promise(resolve=>{if(!OBR.isAvailable)return resolve(false);OBR.onReady(()=>resolve(true));});}
