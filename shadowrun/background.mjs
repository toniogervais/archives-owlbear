import {bridge,ready} from './bridge.mjs?v=143';
if(await ready()){const b=bridge([]);const cleanup=await b.installMenu();window.addEventListener('pagehide',cleanup,{once:true});}
