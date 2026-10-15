// Тест значков и сравнения вещей 3D (шаг P5): шаблоны ровно 16×16 из разрешённых знаков, у каждой вещи каталога есть значок и свой цвет,
// значок не пустой, камни — цветом редкости; сравнение по характеристикам учитывает заточку, у скорости удара меньше — лучше.
import { BY_ID, RARITY } from '../3d/src/data/items.js';
import { TEMPLATES, TEMPLATE_CHARS, templateOf, paletteOf, iconGrid } from '../3d/src/itemicons.js';
import { statDiff, scoreUp, score } from '../3d/src/inv.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
for (const [k, t] of Object.entries(TEMPLATES)) {
  ok(t.length === 16, `${k}: строк ${t.length}`);
  t.forEach((r, i) => { ok(r.length === 16, `${k}: строка ${i} шириной ${r.length}`); for (const ch of r) ok(TEMPLATE_CHARS.includes(ch), `${k}: чужой знак «${ch}»`); });
}
const used = new Set();
for (const it of Object.values(BY_ID)) {
  const t = templateOf(it); used.add(t);
  ok(TEMPLATES[t], `${it.id}: нет шаблона ${t}`);
  const P = paletteOf(it), g = iconGrid(it), filled = g.flat().filter(Boolean).length;
  ok(filled >= 20, `${it.id}: значок почти пустой (${filled})`);
  ok(Object.values(P).every(c => /^#[0-9a-f]{6}$/i.test(c)), `${it.id}: плохой цвет ${JSON.stringify(P)}`);
  ok(P.a !== '#a8a090' || ['material', 'craftmat'].includes(it.pool), `${it.id}: нет своего цвета`);
  if (!(it.cat === 'consumable' && (it.pool === 'potion' || it.pool === 'fairy'))) ok(P.r === RARITY[it.rar].color, `${it.id}: камень не цвета редкости`);
}
ok(Object.keys(TEMPLATES).every(k => used.has(k) || k === 'fists'), 'есть неиспользуемые шаблоны: ' + Object.keys(TEMPLATES).filter(k => !used.has(k)).join(','));
// разные виды оружия — разные значки
ok(new Set(['w_sword_steel', 'w_spear_steel', 'w_hammer_steel', 'w_axe_steel', 'w_greatsword_steel'].map(id => templateOf(BY_ID[id]))).size === 5, 'у оружия разных семейств одинаковые значки');
// сравнение
const s = BY_ID.w_sword_steel, i = BY_ID.w_sword_iron;
const d0 = statDiff(s, i), d2 = statDiff(s, i, 0, 2, .1);
ok(d0.find(r => r.k === 'dmg').d === 1 && d0.find(r => r.k === 'dmg').a === i.stats.dmg, 'урон: сталь лучше железа');
ok(d2.find(r => r.k === 'dmg').a === Math.round(i.stats.dmg * 1.2), 'заточка +2 учтена у надетого');
ok(statDiff(s, null).every(r => r.d === 0), 'без надетого стрелок нет');
const fast = { stats: { swing: .85 } }, slow = { stats: { swing: 1.2 } };
ok(statDiff(fast, slow)[0].d === 1 && statDiff(slow, fast)[0].d === -1, 'скорость удара: меньше — лучше');
ok(scoreUp(i, 0) === score(i) && scoreUp(i, 3, .1) > score(i), 'оценка с заточкой выше');

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 20).join('\n')); process.exit(1); }
console.log('Значки и сравнение вещей 3D: OK (шаблонов ' + Object.keys(TEMPLATES).length + ')');
