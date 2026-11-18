import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('src/v81/npc-import.mjs','utf8');
const ctx={window:{},Number,Math,Object,Array,Map,String};
vm.runInNewContext(code.replace(/^export /gm,'')+'\nwindow.__parse=parseNpcText;',ctx);
const parse=ctx.window.__parse;
test('Import JSON : valeurs Shadowrun, moniteurs et champs facultatifs',()=>{
 const json=JSON.stringify({npcSheet:{professionnalisme:3,attributes:{CON:'5',AGI:4,'RÉA':'3'},combat:{'I/DI':'7/2'},sections:{armes:'Pistolet Colt',equipement:'Commlink'},condition:{physical:{total:11,damage:3}}}});
 const data=parse(json,'pnj.json');
 assert.equal(data.count,8);
 assert.equal(data.fields.professionnalisme,3);
 assert.equal(data.fields.attributes.CON,'5');
 assert.equal(data.fields.attributes.AGI,'4');
 assert.equal(data.fields.combat['I/DI'],'7/2');
 assert.equal(data.fields.sections.equipement,'Commlink');
 assert.equal(data.fields.condition.physical.damage,3);
 assert.equal(data.fields.condition.physical.total,11);
});
test('Import TXT : tableau de caractéristiques du manuel et rubriques',()=>{
 const text=['Professionnalisme 3','CON AGI RÉA FOR VOL LOG INT CHA MAG ESS','3 4 3 3 2 4 3 2 5 6','Compétences : Armes à feu 5','Équipement : armure et commlink','Armes : pistolet lourd','Dégâts physiques : 2/10'].join('\n');
 const data=parse(text,'pnj.txt');
 assert.equal(data.fields.professionnalisme,3);
 assert.equal(data.fields.attributes['RÉA'],'3');
 assert.equal(data.fields.attributes.ESS,'6');
 assert.equal(data.fields.sections.competences,'Armes à feu 5');
 assert.equal(data.fields.sections.armes,'pistolet lourd');
 assert.equal(data.fields.condition.physical.damage,2);
});
test('Import CSV : tableau à colonnes et libellé-valeur',()=>{
 const headers=parse('CON;AGI;RÉA;FOR;VOL;LOG;INT;CHA;MAG;ESS\n4;3;2;1;6;5;4;3;2;1','f.csv');
 assert.equal(headers.fields.attributes.CON,'4');
 assert.equal(headers.fields.attributes.MAG,'2');
 const rows=parse('Professionnalisme;4\nCON;5\nArmes;"Couteau; fusil"','fiche.csv');
 assert.equal(rows.fields.professionnalisme,4);
 assert.equal(rows.fields.attributes.CON,'5');
 assert.equal(rows.fields.sections.armes,'Couteau; fusil');
});
test('Refus des fichiers inconnus et des formats sans information PNJ',()=>{
 assert.throws(()=>parse('hello world','fiche.txt'),/Aucune caractéristique/);
 assert.throws(()=>parse('{}','fiche.json'),/Aucune caractéristique/);
 assert.throws(()=>parse('{mauvais','fiche.json'));
});
test('Le bouton sous le portrait a disparu et le clic droit conserve la présentation',()=>{
 const brief=fs.readFileSync('src/v68/cell-brief.mjs','utf8');
 const context=fs.readFileSync('src/v72/presentation.mjs','utf8');
 assert.ok(!brief.includes("brief-share-image','▣ Montrer"));
 assert.ok(context.includes("document.addEventListener('contextmenu'"));
 assert.ok(context.includes("button('Montrer aux joueurs'"));
 assert.ok(brief.includes("img.onload=()=>queueFit(false)"));
 assert.ok(brief.includes("fitPortraits(cards)"));
 const css=fs.readFileSync('src/v80/npc-sheet.css','utf8');
 assert.ok(css.includes('object-fit:contain!important'));
 assert.ok(css.includes('container-type:inline-size'));
 assert.ok(css.includes('npc-stat-label'));
});
test('Import non destructif par validation explicite dans la fenêtre MJ',()=>{
 const npc=fs.readFileSync('src/v80/npc-sheet.mjs','utf8');
 assert.ok(npc.includes("Importer un fichier"));
 assert.ok(npc.includes('Compléter les champs'));
 assert.ok(npc.includes("Remplacer les valeurs déjà renseignées"));
 assert.ok(npc.includes("replace.checked||!String(input.value).trim()"));
 assert.ok(npc.includes("clique sur Enregistrer pour les conserver"));
 const html=fs.readFileSync('archives-app-v64-v55.html','utf8');
 assert.ok(html.includes('src/v81/npc-import.mjs?v=4700'));
});
