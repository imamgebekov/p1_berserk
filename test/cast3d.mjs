// Тест поз умений 3D (2026-11-03): у каждого умения каждого героя есть клип позы (или null — рывок/прыжок), и такой клип есть в наборах KayKit.
import { readFileSync, readdirSync } from 'node:fs';
import { CFG3 } from '../3d/src/config3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { castClipFor } from '../3d/src/anim3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const have = new Set(); for (const f of readdirSync('3d/models').filter(f => /^kk_anim_/.test(f))) { const raw = readFileSync('3d/models/' + f), jl = raw.readUInt32LE(12); for (const a of JSON.parse(raw.subarray(20, 20 + jl).toString()).animations || []) have.add(a.name.split('|').pop()); }
const C = CFG3.actors.cast; let n = 0, none = 0;
ok(Object.keys(C.style).sort().join() === Object.keys(ABILITIES).sort().join(), 'стиль задан не всем героям');
for (const [hero, list] of Object.entries(ABILITIES)) for (const a of list) { n++;
  const kind = a.kind || 'own', clip = castClipFor(CFG3, hero, a.id, kind);
  if (clip === null) { none++; continue; } ok(typeof clip === 'string' && have.has(clip), `${hero}/${a.id} (${kind}): клипа «${clip}» нет в наборах KayKit`); }
for (const [st, K] of Object.entries(C.kinds)) for (const [k, c] of Object.entries(K)) ok(c === null || have.has(c), `${st}.${k}: клипа «${c}» нет`);
for (const [id, c] of Object.entries(C.byId)) ok(c === null || have.has(c), `byId ${id}: клипа «${c}» нет`);
ok(none < n * .2 && none > 0, `без позы ${none} из ${n}`);
if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log(`Позы умений 3D: OK (умений ${n}, без позы ${none}, клипов KayKit ${have.size})`);
