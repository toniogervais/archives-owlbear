/* Empêche qu'un ancien test navigateur soit oublié lors de la recette Pré-V5.
 * Une seule exécution de chaque fichier dans les groupes CI, même après ajout de tests.
 */
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, '.github/workflows/pre-v5-verification.yml'), 'utf8');
const available = fs.readdirSync(__dirname).filter(name => /^browser(?:-[a-z0-9-]+)?\.cjs$/i.test(name)).sort();
const assigned = [...source.matchAll(/\bnode\s+tests\/(browser(?:-[a-z0-9-]+)?\.cjs)\b/gi)].map(match => match[1]);
const missing = available.filter(name => !assigned.includes(name));
const unknown = assigned.filter(name => !available.includes(name));
const duplicates = assigned.filter((name,index) => assigned.indexOf(name)!==index);
assert.deepEqual(missing, [], 'Parcours navigateur sans exécution CI');
assert.deepEqual(unknown, [], 'Référence CI à un test navigateur inexistant');
assert.deepEqual(duplicates, [], 'Test exécuté dans plusieurs groupes');
assert.ok(available.length >= 40, 'Inventaire navigateur incomplet');
console.log('Recette Pré-V5 : '+available.length+' tests navigateurs répartis sans doublons dans les groupes CI.');
