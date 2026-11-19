import {bridge,ready} from './bridge.mjs';
if(await ready()){const b=bridge([]);const cleanup=await b.installMenu();window.addEventListener('pagehide',cleanup,{once:true});}
