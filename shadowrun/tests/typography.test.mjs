import test from 'node:test';
import assert from 'node:assert/strict';
import {extractHeadingLines,printedHeadingBoundary} from '../source-headings.mjs';
import {sectionExcerpt} from '../reader.mjs';

const medikitPages={
 id:'core',
 language:'fr',
 pages:[
  {text:'Soins\nTexte général\nPremiers soins\nDescription des premiers soins.\nMédikit\nLe malade doit être connecté au médikit et le suivi est',headingLines:[{text:'Soins',size:21},{text:'Premiers soins',size:16},{text:'Médikit',size:16}]},
  {text:'COMBAT // SOINS\n124\nSHADOWRUN : SIXIÈME ÉDITION\ncomplété pendant la période de récupération.\nSorts\nLes soins magiques ont une procédure distincte.',headingLines:[{text:'Sorts',size:16}]}
 ]
};

test('les en-têtes de page et les phrases de corps ne sont pas des titres',()=>{
 const rows=[{text:'SOINS // COMBAT',size:11},{text:'123',size:15},{text:'Soins',size:21},{text:'Premiers soins',size:16},{text:'Médikit',size:16},{text:'Effectuez un test de Biotech et Logique.',size:9.5}];
 assert.deepEqual(extractHeadingLines(rows).map(x=>x.text),['Soins','Premiers soins','Médikit']);
});

test('Médikit : deux pages correctes sans intégrer Sorts',()=>{
 const idx=[{id:'kit',source:'core',title:'Médikit',page:1,endPage:1,level:3}];
 const found=sectionExcerpt(idx[0],medikitPages,idx);
 assert.ok(found);
 assert.equal(found.page,1);
 assert.equal(found.endPage,2);
 assert.match(found.text,/complété pendant la période/);
 assert.doesNotMatch(found.text,/soins magiques|SHADOWRUN|Sorts/);
});

test('Premiers soins : une page seulement, sans texte du Médikit',()=>{
 const idx=[{id:'aid',source:'core',title:'Premiers soins',page:1,endPage:1,level:3}];
 const found=sectionExcerpt(idx[0],medikitPages,idx);
 assert.equal(found.page,1);
 assert.equal(found.endPage,1);
 assert.doesNotMatch(found.text,/Médikit|Le malade/);
});

test('Soins : le titre de sous-rubrique ne coupe pas la rubrique mère',()=>{
 const idx=[{id:'all',source:'core',title:'Soins',page:1,endPage:2,level:2}];
 const excerpt=sectionExcerpt(idx[0],medikitPages,idx);
 assert.match(excerpt.text,/Premiers soins/);
 assert.match(excerpt.text,/Médikit/);
 assert.match(excerpt.text,/Sorts/);
});

test('même nom dans deux sections différentes : la taille typographique ne confond pas les titres',()=>{
 const raw='Saab Javelin 878TI/\nGladius 998TI\nDescription particulière.\nToyota Daytripper\nUne autre voiture.';
 const heads=[[{text:'Saab Javelin 878TI/',size:16},{text:'Gladius 998TI',size:16},{text:'Toyota Daytripper',size:16}]];
 const pos=printedHeadingBoundary(raw,heads,['Saab Javelin 878TI/ Gladius 998TI'],4);
 assert.match(raw.slice(0,pos),/Description particulière/);
 assert.doesNotMatch(raw.slice(0,pos),/Une autre voiture/);
});

test('une rubrique absente n’emprunte jamais le texte de la rubrique précédente',()=>{
 const idx=[{id:'unknown',source:'core',title:'Nom absent',page:1,endPage:1,level:3}];
 assert.equal(sectionExcerpt(idx[0],medikitPages,idx),null);
});
