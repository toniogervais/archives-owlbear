import {bridge,ready} from './bridge.mjs?v=137';
if(await ready()){const b=bridge([]);const cleanup=await b.installMenu();window.addEventListener('pagehide',cleanup,{once:true});}
