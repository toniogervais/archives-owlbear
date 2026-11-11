const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('archives-app-v64-v55.html','utf8'),start=src.indexOf('// BEGIN SECURITY: player projection V4.7'),end=src.indexOf('// END SECURITY: player projection V4.7',start);
const project=vm.runInNewContext(src.slice(start,end)+'\nprojectPlayerPayload;',{Set,Array,Number,String,Object});
const base={boards:[{id:'act',name:'NOM_MJ_SECRET',nodes:[{id:'secret',title:'CELLULE_SECRETE',revealed:false}],links:[]}],activeBoardId:'act'};
const presentation={id:'7fe297a3-2dba-4bcc-935d-10dc5704e4e0',image:'data:image/png;base64,aGVsbG8=',published:true,title:'TITRE_MJ_SECRET',fileName:'FICHIER_SECRET.png',links:['CELLULE_SECRETE'],scope:['COMPTE_SECRET']};
test('An explicitly presented image publishes only the picture and a generic caption',()=>{
 const out=project({...base,playerPresentation:presentation});assert.equal(out.playerPresentation.image,presentation.image);assert.equal(out.playerPresentation.title,'Image partagée');
 for(const secret of ['NOM_MJ_SECRET','CELLULE_SECRETE','TITRE_MJ_SECRET','FICHIER_SECRET','COMPTE_SECRET'])assert.ok(!JSON.stringify(out).includes(secret));assert.equal(out.boards[0].nodes.length,0);
});
test('Private images, active URLs, SVG and invalid presentation descriptors cannot leave the sender',()=>{
 for(const value of [null,{...presentation,published:false},{...presentation,published:'true'},{...presentation,id:'invalid'},...['javascript:alert(1)','https://private.test/image.png','data:image/svg+xml;base64,aGVsbG8=','data:text/html;base64,aGVsbG8='].map(image=>({...presentation,image}))])assert.equal(project({...base,playerPresentation:value}).playerPresentation,null);
});
