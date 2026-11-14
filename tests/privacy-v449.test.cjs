const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('archives-app-v64-v55.html','utf8'),a=src.indexOf('// BEGIN SECURITY: player projection V4.7'),b=src.indexOf('// END SECURITY: player projection V4.7',a);
const project=vm.runInNewContext(src.slice(a,b)+'\nprojectPlayerPayload;',{Set,Array,Number,String,Object});
test('All six revealed cell types retain their public descriptions but never publish private named GM categories or act names',()=>{
 const kinds=['personnage','groupe','lieu','objet','ressource','evenement'];
 const result=project({activeBoardId:'a',boards:[{id:'a',name:'SECRET_ACTE_449',nodes:kinds.map((category,i)=>({id:'n'+i,title:'Public '+category,desc:'Description publique',revealed:true,gmDetails:[{id:'private',title:'RUBRIQUE_PRIVEE_449',text:'DESCRIPTION_PRIVEE_449'}]})),links:[]},{id:'b',name:'SECRET_FIN_449',nodes:[{id:'b1',revealed:true,title:'Visible'}],links:[]}]});
 const wire=JSON.stringify(result);for(const key of ['SECRET_ACTE_449','SECRET_FIN_449','RUBRIQUE_PRIVEE_449','DESCRIPTION_PRIVEE_449','gmDetails'])assert.ok(!wire.includes(key));
 assert.equal(result.boards[0].name,'Scène 1');assert.equal(result.boards[1].name,'Scène 2');assert.equal(result.boards[0].nodes.length,6);assert.equal(result.boards[0].nodes[0].desc,'Description publique');
});
