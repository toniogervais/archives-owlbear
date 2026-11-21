import test from 'node:test';
import assert from 'node:assert/strict';
import {sectionExcerpt} from '../reader.mjs';
import {sourceContext,conciseSourceDescription} from '../source-descriptions.mjs';

const book=(...pages)=>({id:'core',displayTitle:'Livre de base',language:'fr',pages:pages.map(text=>({text}))});

test('une phrase interrompue en bas de page est reprise uniquement jusqu’à la prochaine rubrique',()=>{
 const index=[
  {id:'a',source:'core',title:'Premier secours',page:1,endPage:1,level:3},
  {id:'b',source:'core',title:'Autre procédure',page:2,endPage:2,level:3}
 ];
 const library=book(
  'Premier secours\nUne description certaine explique dans quelles circonstances on utilise le matériel pour',
  'terminer les soins en appliquant les étapes nécessaires.\nAutre procédure\nCe paragraphe traite exclusivement d’un autre sujet.'
 );
 const found=sectionExcerpt(index[0],library,index);
 assert.equal(found.matchedBy,'two-page-continuation');
 assert.equal(found.page,1);
 assert.equal(found.endPage,2);
 assert.equal(found.fullEndPage,2);
 assert.match(found.text,/terminer les soins/);
 assert.doesNotMatch(found.text,/Ce paragraphe traite/);
 assert.equal(sourceContext(index[0],library,found).exact,false);
 assert.ok(conciseSourceDescription(found,'fr'));
});

test('une rubrique terminée sur une page n’absorbe pas le début de la suivante',()=>{
 const index=[{id:'a',source:'core',title:'Pistolets légers',page:1,endPage:1,level:3}];
 const found=sectionExcerpt(index[0],book(
  'Pistolets légers\nCes armes sont adaptées aux situations de combat rapproché.',
  'Ce paragraphe concerne déjà une autre famille, sans titre indexé.'
 ),index);
 assert.equal(found.endPage,1);
 assert.doesNotMatch(found.text,/autre famille/);
});

test('le titre suivant sur la même page prime sur une continuation déclarée',()=>{
 const index=[
  {id:'a',source:'core',title:'Calibrage',page:1,endPage:2,level:3},
  {id:'b',source:'core',title:'Commande retardée',page:1,endPage:1,level:3}
 ];
 const found=sectionExcerpt(index[0],book(
  'Calibrage\nLe calibrage permet de préparer un appareil aux opérations.\nCommande retardée\nLe texte suivant concerne une commande, et non le calibrage',
  'Suite de la commande retardée, qui ne doit jamais rejoindre le calibrage.'
 ),index);
 assert.equal(found.endPage,1);
 assert.equal(found.text,'Le calibrage permet de préparer un appareil aux opérations.');
});

test('un titre immédiatement au début de la deuxième page ne devient pas une suite',()=>{
 const index=[
  {id:'a',source:'core',title:'Première action',page:1,endPage:1,level:3},
  {id:'b',source:'core',title:'Seconde action',page:2,endPage:2,level:3}
 ];
 const found=sectionExcerpt(index[0],book(
  'Première action\nIl faut encore contrôler plusieurs détails avant la fin du test pour',
  'Seconde action\nLe fonctionnement de cette action ne concerne pas la première.'
 ),index);
 assert.equal(found.endPage,1);
 assert.doesNotMatch(found.text,/fonctionnement/);
});

test('une référence non vérifiée ne récupère pas la description d’une rubrique voisine',()=>{
 const index=[
  {id:'a',source:'core',title:'Une action identifiée',page:1,endPage:1,level:3},
  {id:'b',source:'core',title:'Une autre action',page:1,endPage:1,level:3}
 ];
 const library=book('Une action identifiée\nLa notice exacte contient les conditions et les limites de cette action.\nUne autre action\nLa seconde notice est différente.');
 assert.equal(sectionExcerpt({...index[0],id:'missing',title:'Titre absent'},library,index),null);
 const found=sectionExcerpt(index[0],library,index);
 assert.equal(found.endPage,1);
 assert.doesNotMatch(found.text,/seconde notice/);
});
