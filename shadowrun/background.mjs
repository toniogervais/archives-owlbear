import {bridge,ready} from './bridge.mjs?v=141';
if(await ready()){const b=bridge([]);const cleanup=await b.installMenu();window.addEventListener('pagehide',cleanup,{once:true});}
