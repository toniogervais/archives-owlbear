/* Empêche qu'un test ou un groupe de recette navigateur soit oublié en Pré-V5.
 * Vérifie l'inventaire, l'affectation unique et la cohérence de la matrice CI.
 */
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, '.github/workflows/pre-v5-verification.yml'), 'utf8');
const available = fs.readdirSync(__dirname)
  .filter(name => /^browser(?:-[a-z0-9-]+)?\.cjs$/i.test(name)).sort();
const assigned = [...source.matchAll(/\bnode\s+tests\/(browser(?:-[a-z0-9-]+)?\.cjs)\b/gi)]
  .map(match => match[1]);
const missing = available.filter(name => !assigned.includes(name));
const unknown = assigned.filter(name => !available.includes(name));
const duplicates = assigned.filter((name, index) => assigned.indexOf(name) !== index);
assert.deepEqual(missing, [], 'Parcours navigateur sans exécution CI');
assert.deepEqual(unknown, [], 'Référence CI à un test navigateur inexistant');
assert.deepEqual(duplicates, [], 'Test exécuté dans plusieurs groupes');
assert.ok(available.length >= 40, 'Inventaire navigateur incomplet');

// S'assurer qu'aucun groupe de la matrice n'est vide, manquant, ou inatteignable.
// Sans cette vérification, une coquille dans le nom d'un groupe peut produire
// un job CI vert qui n'a lancé strictement aucun test.
const matrix = source.match(/\bgroupe:\s*\[([^\]\n]+)\]/);
assert.ok(matrix, 'Matrice de groupes navigateur absente');
const groups = matrix[1].split(',').map(s => s.trim());
assert.ok(groups.every(Boolean), 'Nom de groupe navigateur vide');
assert.equal(new Set(groups).size, groups.length, 'Groupe CI dupliqué dans la matrice');
const cases = [...source.matchAll(/^\s{12}([a-z][a-z0-9-]*)\)\s*$/gm)]
  .map(m => m[1]);
assert.deepEqual(cases.slice().sort(), groups.slice().sort(),
  'Matrice CI et branches case des tests navigateur incohérentes');
for (const group of groups) {
  const escaped = group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const section = source.match(new RegExp('^\\s{12}' + escaped + '\\)\\s*\\n([\\s\\S]*?)^\\s{14};;', 'm'));
  assert.ok(section, 'Groupe sans branche case: ' + group);
  assert.match(section[1], /\bnode\s+tests\/browser(?:-[a-z0-9-]+)?\.cjs\b/i,
    'Groupe CI sans test navigateur: ' + group);
}
console.log('Recette Pré-V5 : ' + available.length +
  ' tests navigateurs répartis sans doublons dans ' + groups.length + ' groupes CI.');
