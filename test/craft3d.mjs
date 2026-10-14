// Тест крафта и знаний 3D: целостность и достижимость рецептов, процесс ковки, чтение книг, бестиарий, источники, сохранение.
import { CFG3 } from '../3d/src/config3d.js';
import { BY_ID, CATALOG } from '../3d/src/data/items.js';
import { RECIPES, RECIPE_BY_ID } from '../3d/src/data/recipes3d.js';
import { TOMES, TOME_BY_ID } from '../3d/src/data/tomes3d.js';
import { CONTAINERS, DROPS } from '../3d/src/data/loot.js';
import { craft, craftStatus, readTome, sourcesOf, bestiaryEntry, newKnown, serializeKnown, sanitizeKnown, recipeKnown } from '../3d/src/craft3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };

// ---- целостность ----
ok(RECIPES.length >= 45 && new Set(RECIPES.map(r => r.id)).size === RECIPES.length, 'рецептов мало или id повторяются: ' + RECIPES.length);
ok(TOMES.length === 16 && new Set(TOMES.map(t => t.id)).size === 16, 'томов 16');
for (const r of RECIPES) {
  ok(BY_ID[r.result.id] && r.result.n >= 1, 'нет результата ' + r.id); for (const [m, n] of r.mats) ok(BY_ID[m] && n >= 1, `нет материала ${m} в ${r.id}`);
  ok(r.needs === null || TOME_BY_ID[r.needs], 'нет книги ' + r.needs); ok(r.ash >= 0 && r.text, 'стоимость и текст ' + r.id);
  ok(!r.mats.some(([m]) => m === r.result.id), 'рецепт тратит свой результат ' + r.id);
}
for (const t of TOMES) { ok(BY_ID['tome_' + t.id] && BY_ID['tome_' + t.id].cat === 'tome', 'нет вещи тома ' + t.id); ok(t.text && t.hint && /[а-яё]/i.test(t.name), 'текст тома ' + t.id); }
ok(TOMES.filter(t => RECIPES.some(r => r.needs === t.id)).length >= 11, 'книг без рецептов слишком много'); ok(TOMES.filter(t => t.teaches.bestiary || t.teaches.places || t.teaches.kinds).length >= 4, 'книг знаний мало');
// каждая книга с рецептами ссылается на существующие записи
for (const t of TOMES) { for (const e of t.teaches.bestiary || []) ok(CFG3.enemies[e], 'бестиарий: нет ' + e); for (const p of t.teaches.places || []) ok(CFG3.map.places.some(x => x.id === p), 'атлас: нет места ' + p); for (const k of t.teaches.kinds || []) ok(CONTAINERS[k], 'атлас: нет контейнера ' + k); }

// ---- достижимость: любой материал и книга добываются, а именные вещи только крафтом ----
const direct = id => { const s = sourcesOf(id); return s.containers.length || s.drops.length || s.bosses.length || s.shop; };
const obtainable = (id, seen = new Set()) => { if (direct(id)) return true; if (seen.has(id)) return false; seen.add(id); return RECIPES.filter(r => r.result.id === id).some(r => r.mats.every(([m]) => obtainable(m, new Set(seen)))); };
for (const r of RECIPES) { ok(obtainable(r.result.id), 'результат недостижим ' + r.id); for (const [m] of r.mats) ok(obtainable(m), `материал ${m} (${r.id}) недостижим`); if (r.needs) ok(direct('tome_' + r.needs), 'книга не добывается: ' + r.needs); }
for (const i of CATALOG.filter(i => /^(as_|wu_)/.test(i.id))) { const s = sourcesOf(i.id); ok(!s.containers.length && !s.drops.length && !s.bosses.length && !s.shop && s.craft.length === 1, `именная вещь ${i.id} добывается не только крафтом: ` + JSON.stringify(s)); }
for (const t of ['m_devourer_heart', 'm_eclipse_cloak', 'm_chief_fang']) { const s = sourcesOf(t); ok(s.bosses.length === 1 && !s.containers.length && !s.shop, 'трофей только с одного босса: ' + t); }
for (const t of TOMES.filter(t => /^(set|blades)_/.test(t.id))) { const s = sourcesOf('tome_' + t.id); ok(s.bosses.length === 1 && !s.containers.length && !s.shop, 'книга босса только с него: ' + t.id); }
ok(sourcesOf('m_ash_alloy').craft.length === 1 && !direct('m_ash_alloy'), 'сплав только крафтом');
// порядок и цены: трофеи в рецептах не дороже 2 на вещь; на сет нужно разумное число убийств
for (const r of RECIPES) for (const [m, n] of r.mats) if (/devourer_heart|eclipse_cloak|chief_fang/.test(m)) ok(n <= 2, 'слишком много трофеев в ' + r.id);
const need = t => RECIPES.filter(r => r.needs === t).reduce((a, r) => a + r.mats.filter(([m]) => /heart|cloak|fang/.test(m)).reduce((x, [, n]) => x + n, 0), 0);
ok(need('set_pogost') === 4 && need('blades_pogost') === 10 && need('blades_eclipse') === 12 && need('blades_rust') === 10, 'число трофеев на комплекты: ' + [need('set_pogost'), need('blades_pogost'), need('blades_eclipse'), need('blades_rust')]);

// ---- процесс ----
const mk = (seed = 1) => { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = cfg.map.places.slice(); return createWorld(cfg, mulberry32(seed)); };
const atSmith = W => { const b = W.map.buildings.find(x => x.npc && x.npc.kind === 'smith'); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; W.player.inv = 1e9; step(W, 1 / 60, {}); return b; };
const give = (W, id, n = 1) => W.inv.bag.push({ id, n });
{ const W = mk(); const r = RECIPE_BY_ID.ingot; step(W, 1 / 60, {});
  ok(craftStatus(W, r) === 'far' && craft(W, 'ingot') === 'far', 'ковка издалека'); atSmith(W);
  ok(craft(W, 'ingot') === 'mats', 'нет материалов'); give(W, 'm_ore', 3); give(W, 'm_coal', 1); W.inv.ash = 4; ok(craft(W, 'ingot') === 'ash', 'нет пепла'); W.inv.ash = 50;
  ok(craft(W, 'ingot') === 'ok' && W.inv.ash === 45 && W.inv.bag.some(s => s.id === 'm_ingot') && !W.inv.bag.some(s => s.id === 'm_ore'), 'ковка не списала материалы'); ok(W.known.items.m_ingot === 1 && W.ev.some(v => v.k === 'craft'), 'запись о предмете и событие');
  ok(craft(W, 'steel') === 'tome' && !recipeKnown(W.known, RECIPE_BY_ID.steel), 'рецепт без книги'); ok(craft(W, 'нет') === 'none', 'неизвестный рецепт'); }
{ // полная сумка: ничего не списывается
  const W = mk(2); atSmith(W); give(W, 'm_ore', 5); give(W, 'm_coal', 2); W.inv.ash = 50; for (let i = W.inv.bag.length; i < W.cfg.bag.slots; i++) give(W, 'w_sword_rust', 1); const before = JSON.stringify(W.inv.bag);
  ok(craft(W, 'ingot') === 'full' && JSON.stringify(W.inv.bag) === before && W.inv.ash === 50, 'при полной сумке крафт списал'); }
{ // уникальный клинок: основа + трофей + сплав; улучшенная основа не идёт в дело
  const W = mk(3); atSmith(W); W.known.tomes.blades_eclipse = 1; W.inv.ash = 1000; give(W, 'w_sword_black', 1); give(W, 'm_eclipse_cloak', 2); give(W, 'm_ash_alloy', 1);
  W.inv.bag[0].up = 2; ok(craft(W, 'wu_ember') === 'mats', 'улучшенная основа не должна идти в крафт'); delete W.inv.bag[0].up; ok(craft(W, 'wu_ember') === 'ok' && W.inv.bag.length === 1 && W.inv.bag[0].id === 'wu_ember' && W.inv.ash === 750, 'уникальный клинок: ' + JSON.stringify(W.inv.bag)); }
{ // именная часть сета
  const W = mk(4); atSmith(W); W.known.tomes.set_rust = 1; W.inv.ash = 500; for (const [m, n] of [['m_chief_fang', 1], ['m_ash_alloy', 2], ['m_silver_thread', 2], ['m_black_resin', 1]]) give(W, m, n);
  ok(craft(W, 'as_rust_head') === 'ok' && W.inv.bag.some(s => s.id === 'as_rust_head'), 'именная часть не скрафтилась'); }
{ // цепочка: руда → слиток → сталь → сплав (с книгами)
  const W = mk(5); atSmith(W); W.known.tomes.smelting = 1; W.known.tomes.alloy = 1; W.inv.ash = 500; give(W, 'm_ore', 12); give(W, 'm_coal', 12); give(W, 'm_ash_salt', 4); give(W, 'm_soot', 2);
  for (let i = 0; i < 4; i++) ok(craft(W, 'ingot') === 'ok', 'слиток ' + i); ok(craft(W, 'steel') === 'ok' && craft(W, 'steel') === 'ok', 'сталь'); ok(craft(W, 'alloy') === 'ok' && W.inv.bag.some(s => s.id === 'm_ash_alloy'), 'сплав'); }

// ---- чтение книг ----
{ const W = mk(6); give(W, 'tome_atlas_polya'); give(W, 'tome_medic'); give(W, 'tome_medic');
  const i = W.inv.bag.findIndex(s => s.id === 'tome_atlas_polya'); ok(readTome(W, i) === 'ok' && W.known.tomes.atlas_polya && W.known.bestiary.hound === 2 && W.known.places.polya && W.known.kinds.wagon, 'чтение атласа');
  ok(!W.inv.bag.some(s => s.id === 'tome_atlas_polya'), 'прочитанная книга не потрачена'); ok(W.ev.some(v => v.k === 'tome'), 'нет события чтения');
  const seenAt = (x, z) => { const c = W.cfg.map.cell, R = W.cfg.world.radius, n = W.seenN; return W.seen[Math.floor((z + R) / c) * n + Math.floor((x + R) / c)] === 1; }; ok(seenAt(48, 40), 'атлас не открыл место на карте');
  const j = W.inv.bag.findIndex(s => s.id === 'tome_medic'); ok(readTome(W, j) === 'ok' && recipeKnown(W.known, RECIPE_BY_ID.salve), 'книга открыла рецепты'); const cnt = W.inv.bag.filter(s => s.id === 'tome_medic').length;
  ok(readTome(W, W.inv.bag.findIndex(s => s.id === 'tome_medic')) === 'known' && W.inv.bag.filter(s => s.id === 'tome_medic').length === cnt, 'повторное чтение съело книгу'); ok(readTome(W, 99) === 'none', 'чтение несуществующего'); give(W, 'f_rye'); ok(readTome(W, W.inv.bag.length - 1) === 'none', 'еда читается как книга'); }
// знания приходят сами: убийство, контейнер, вход в место, подбор
{ const W = mk(7); W.player.x = 20; W.player.z = 20; W.inv.eq.weapon = 'w_sword_iron'; W.player.hp = W.player.maxhp = 1e5; const e = spawnEnemy(W, 'imp', 21.5, 20); e.hp = 1; e.alert = true; e.state = 'rec'; e.t = -1e9; W.player.face = Math.PI / 2; for (let i = 0; i < 40; i++) step(W, 1 / 60, { attack: true }); ok(W.known.bestiary.imp === 1, 'убийство не открыло запись');
  const c = W.map.containers.find(x => x.b >= 0); W.player.x = c.x; W.player.z = c.z; step(W, 1 / 60, {}); ok(W.known.kinds[c.kind] === 1 && c.items.length < 99 && Object.keys(W.known.items).length > 0, 'контейнер/предмет не отмечены'); W.player.x = 0; W.player.z = 6; step(W, 1 / 60, {}); ok(W.known.places.brod, 'вход в место не отмечен'); }

// ---- источники и бестиарий ----
{ const s = sourcesOf('f_rye'); ok(s.containers.includes('crate') && s.drops.includes('imp') && s.shop, 'источники еды: ' + JSON.stringify(s)); const t = sourcesOf('m_beast_hide'); ok(t.drops.includes('hound') && !t.containers.length, 'шкура только с гончей и ghoul-подобных: ' + JSON.stringify(t));
  const u = sourcesOf('wu_ember'); ok(u.craft[0] === 'wu_ember' && !u.containers.length, 'источники клинка'); const m = sourcesOf('m_ore'); ok(m.uses.includes('ingot') && m.containers.length, 'использование руды'); }
for (const ty of ['imp', 'brute', 'hound', 'ghoul', 'devourer', 'lord', 'chief']) { const b = bestiaryEntry(ty, CFG3); ok(b && b.name && b.where.length && b.hp > 0 && b.loot.length, 'запись бестиария ' + ty + ' ' + JSON.stringify(b)); }
ok(bestiaryEntry('lord', CFG3).immune.length === 2 && bestiaryEntry('ghoul', CFG3).on === 'яд' && bestiaryEntry('devourer', CFG3).where.includes('Погост') && bestiaryEntry('hound', CFG3).where.length >= 2, 'содержимое записей'); ok(bestiaryEntry('нет', CFG3) === null, 'неизвестный враг');

// ---- сохранение ----
{ const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const W = mk(8); W.known.tomes.smelting = 1; W.known.bestiary.ghoul = 2; W.known.places.pogost = 1; W.known.kinds.chest = 1; W.known.items.f_rye = 1; createSaver(W, st).write(true); const l = loadSave(30, st);
  ok(l.known.tomes.smelting && l.known.bestiary.ghoul === 2 && l.known.places.pogost && l.known.kinds.chest && l.known.items.f_rye, 'знания не сохранились: ' + JSON.stringify(l.known));
  const g = sanitizeKnown({ tomes: ['нет', 'alloy', 5], bestiary: { ghoul: 9, нет: 1, imp: 1 }, places: ['pogost', 'x'], kinds: ['chest', 'z'], items: ['f_rye', 'q'.repeat(3)] }, CFG3); ok(Object.keys(g.tomes).join() === 'alloy' && Object.keys(g.bestiary).join() === 'imp' && Object.keys(g.places).join() === 'pogost' && Object.keys(g.kinds).join() === 'chest' && Object.keys(g.items).join() === 'f_rye', 'мусор в знаниях: ' + JSON.stringify(g));
  ok(Object.keys(sanitizeKnown(null, CFG3).tomes).length === 0 && Object.keys(sanitizeKnown('x', CFG3).items).length === 0, 'пустые знания'); ok(Object.keys(serializeKnown(newKnown())).length === 5, 'формат записи'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 30).join('\n')); process.exit(1); }
console.log('Крафт и знания 3D: OK');
