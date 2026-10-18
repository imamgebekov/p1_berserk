// Тест камней силы (2026-10-18): каталог, гнёзда по редкости, выпадение (без W.rng), кузнец (вставить, вынуть, сплавить),
// камни едут с вещью (надеть, снять, сохранить, бросить и поднять, продать, ковка, смена героя), сплав в ударе и при смерти.
import { CFG3 } from '../3d/src/config3d.js';
import { BY_ID, CATALOG } from '../3d/src/data/items.js';
import { createWorld, step, spawnEnemy, killEnemy, dropItem, refreshGear, switchHero } from '../3d/src/sim.js';
import { equipAt, unequip, serialize, deserialize, socketsOf, createInv } from '../3d/src/inv.js';
import { sellItem } from '../3d/src/economy3d.js';
import { gemDropOf, socketGem, unsocketGem, fuseGems, gemsAt, weaponMix, gemId } from '../3d/src/stones3d.js';
import { applyStatus } from '../3d/src/status3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const S = CFG3.stones, MAX = 40;
function mk(weapon, R0 = .5) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.player.autoAim = 0; cfg.weather.force = 'clear'; cfg.enemies.roam.on = false;
  let R = R0; const W = createWorld(cfg, () => R); W.setR = v => { R = v; };
  if (weapon) W.inv.eq.weapon = weapon; W.player.x = 0; W.player.z = 0; W.player.face = Math.PI / 2; W.player.inv = 1e9; step(W, 1 / 60, {}); return W;
}
const foe = (W, x, z, type = 'brute') => { const e = spawnEnemy(W, type, x, z); e.hp = e.maxhp = 1e6; e.alert = true; e.state = 'rec'; e.t = -1e9; e.cd = 99; return e; };
const give = (W, id, n = 1) => W.inv.bag.push({ id, n });
const RARE = 'w_sword_steel_storm', PLAIN3 = 'w_sword_black', TWO = CATALOG.find(i => i.slot === 'weapon' && i.rar === 4 && i.kind === 'sword').id;

// ---------- 1. каталог и гнёзда ----------
{ const g = CATALOG.filter(i => i.cat === 'gem'); ok(g.length === 21 && new Set(g.map(i => i.gem)).size === 7 && g.every(i => i.rank >= 1 && i.rank <= 3 && i.text && i.stack === 20), 'камней не 7 × 3 или у камня нет текста');
  ok(BY_ID[gemId('fire', 1)].name === 'Осколок огня' && BY_ID[gemId('storm', 3)].name === 'Сердце молнии', 'имена камней');
  ok([0, 1, 2, 3, 4, 5].every(r => socketsOf({ slot: 'weapon', rar: r }, CFG3) === S.sockets[r]) && socketsOf({ slot: 'body', rar: 5 }, CFG3) === 0, 'гнёзда по редкости неверны'); }

// ---------- 2. выпадение ----------
{ const W = mk(); let n = 0, rngCalls = 0; const r0 = W.rng; W.rng = () => { rngCalls++; return r0(); };
  for (let i = 0; i < 4000; i++) { const e = { id: i + 1, type: 'imp', danger: 0 }; W.kills = i; if (gemDropOf(W, e)) n++; }
  ok(Math.abs(n / 4000 - S.drop) < .02, `осколок с беса не по шансу: ${(n / 4000).toFixed(3)}`); ok(rngCalls === 0, 'выпадение камня берёт W.rng');
  ok(gemDropOf(W, { id: 5, type: 'imp' }) === gemDropOf(W, { id: 5, type: 'imp' }), 'выпадение не повторяется');
  ok(gemDropOf(W, { id: 1, type: 'devourer', boss: true }) === gemId('venom', 3), 'босс не отдаёт сердце');
  let el = 0; for (let i = 0; i < 400; i++) { W.kills = i; const g = gemDropOf(W, { id: i, type: 'brute', elite: true }); if (g) { el++; ok(g === gemId('earth', 2), 'элита отдаёт не камень своей стихии'); } }
  ok(el > 120 && el < 280, 'камень с элиты не по шансу: ' + el);
  W.rain = 1; let wet = 0; for (let i = 0; i < 2000; i++) { W.kills = i; const g = gemDropOf(W, { id: i, type: 'imp' }); if (g) { wet++; ok(g === gemId('water', 1), 'в дождь падает не вода'); } } ok(wet > 0, 'в дождь камни не падают');
  const W2 = mk(); const e = foe(W2, 5, 0, 'devourer'); e.boss = true; e.b = { minions: [] }; e.hp = 0; W2.drops.length = 0; killEnemy(W2, e, 1);
  ok(W2.drops.some(d => d.id === gemId('venom', 3)), 'с убитого босса не лежит сердце'); }

// ---------- 3. кузнец ----------
{ const W = mk(RARE); W.nearNpc = 'smith'; W.inv.ash = 1000; give(W, gemId('water', 1), 2);
  ok(socketGem(W, { slot: 'weapon' }, 0, gemId('water', 1)) === 'ok' && W.inv.gem.weapon[0] === gemId('water', 1), 'камень не встаёт в надетое оружие');
  ok(W.inv.bag.find(s => s.id === gemId('water', 1)).n === 1, 'камень не списан из сумки');
  ok(socketGem(W, { slot: 'weapon' }, 0, gemId('water', 1)) === 'busy' && socketGem(W, { slot: 'weapon' }, 1, gemId('water', 1)) === 'none', 'занятое или лишнее гнездо принимает камень');
  W.nearNpc = null; ok(unsocketGem(W, { slot: 'weapon' }, 0, MAX) === 'far', 'вынуть можно не у кузнеца'); W.nearNpc = 'smith';
  const a0 = W.inv.ash; ok(unsocketGem(W, { slot: 'weapon' }, 0, MAX) === 'ok' && W.inv.ash === a0 - S.unsocket[0] && !W.inv.gem.weapon && W.inv.bag.find(s => s.id === gemId('water', 1)).n === 2, 'вынуть: пепел, камень в сумку целым');
  W.inv.ash = 0; socketGem(W, { slot: 'weapon' }, 0, gemId('water', 1)); ok(unsocketGem(W, { slot: 'weapon' }, 0, MAX) === 'ash', 'вынуть без пепла');
  // в сумке: камень перед оружием — индекс сдвигается
  const W2 = mk(); W2.nearNpc = 'smith'; give(W2, gemId('fire', 1)); give(W2, TWO); ok(socketGem(W2, { idx: 1 }, 1, gemId('fire', 1)) === 'ok' && W2.inv.bag.length === 1 && W2.inv.bag[0].id === TWO && W2.inv.bag[0].g[1] === gemId('fire', 1), 'камень в оружие из сумки: сдвиг индекса');
  ok(gemsAt(W2, { idx: 0 }).length === 2, 'у оранжевого не 2 гнезда');
  // сплав
  const W3 = mk(); W3.nearNpc = 'smith'; W3.inv.ash = 100; give(W3, gemId('ice', 1), 4);
  ok(fuseGems(W3, gemId('ice', 1), MAX) === 'ok' && W3.inv.bag.find(s => s.id === gemId('ice', 1)).n === 1 && W3.inv.bag.some(s => s.id === gemId('ice', 2)) && W3.inv.ash === 100 - S.fuse.ash[0], 'сплав 3 → 1');
  ok(fuseGems(W3, gemId('ice', 1), MAX) === 'few' && fuseGems(W3, gemId('ice', 3), MAX) === 'max', 'сплав из одного или сердца'); }

// ---------- 4. камни едут с вещью ----------
{ const W = mk(RARE); W.inv.gem.weapon = [gemId('venom', 2)]; give(W, PLAIN3);
  equipAt(W.inv, W.inv.bag.length - 1); const back = W.inv.bag.find(s => s.id === RARE);
  ok(back && back.g && back.g[0] === gemId('venom', 2) && !W.inv.gem.weapon, 'снятое при смене оружие потеряло камень');
  equipAt(W.inv, W.inv.bag.indexOf(back)); ok(W.inv.gem.weapon && W.inv.gem.weapon[0] === gemId('venom', 2), 'надетое из сумки потеряло камень');
  ok(unequip(W.inv, 'weapon', MAX) && W.inv.bag.some(s => s.id === RARE && s.g), 'снятое в сумку потеряло камень');
  const d = deserialize(JSON.parse(JSON.stringify(serialize(W.inv))), MAX, 'thorn', CFG3); ok(d.bag.some(s => s.id === RARE && s.g && s.g[0] === gemId('venom', 2)), 'сохранение потеряло камень в сумке');
  const junk = deserialize({ bag: [{ id: RARE, n: 1, g: ['m_ore', 'gem_fire_1', 'x'] }, { id: 'w_sword_iron', n: 1, g: ['gem_fire_1'] }], eq: { weapon: RARE }, gem: { weapon: ['gem_fire_9'] } }, MAX, 'thorn', CFG3);
  ok(!junk.bag.find(s => s.id === RARE).g && !junk.bag.find(s => s.id === 'w_sword_iron').g && !junk.gem.weapon, 'мусор в камнях из сохранения принят');
  const W2 = mk(); W2.inv.bag = [{ id: RARE, n: 1, g: [gemId('fire', 1)], up: 2 }]; dropItem(W2, 0); ok(W2.drops.length === 1 && W2.drops[0].g && W2.drops[0].up === 2, 'брошенная вещь потеряла камень или заточку');
  W2.drops[0].x = W2.player.x; W2.drops[0].z = W2.player.z; step(W2, 1 / 60, {}); ok(W2.inv.bag.some(s => s.id === RARE && s.g && s.up === 2), 'поднятая вещь потеряла камень или заточку');
  const W3 = mk(); W3.nearMerchant = true; W3.inv.bag = [{ id: RARE, n: 1, g: [gemId('earth', 2)] }]; ok(sellItem(W3, 0) === 'ok' && W3.inv.bag.length === 1 && W3.inv.bag[0].id === gemId('earth', 2), 'проданное оружие забрало камень');
  W3.inv.bag = [{ id: TWO, n: 1, g: [gemId('earth', 2), gemId('fire', 1)] }]; for (let i = 1; i < MAX; i++) W3.inv.bag.push({ id: 'm_ore', n: 20 }); W3.cfg.bag.slots = MAX; refreshGear(W3);
  ok(sellItem(W3, 0) === 'full' && W3.inv.bag[0].g && W3.inv.bag.length === MAX, 'продажа при полной сумке съела камень');
  const W4 = mk(RARE); W4.inv.gem.weapon = [gemId('fire', 1)]; switchHero(W4, 'jay'); ok(W4.inv.bag.some(s => s.id === RARE && s.g), 'смена героя потеряла камень'); }

// ---------- 5. правила сплава ----------
{ const f = gemId('fire', 1), w = gemId('water', 2);
  ok(weaponMix(BY_ID[RARE], []) === null, 'без камней есть сплав');
  let m = weaponMix(BY_ID[RARE], [w]); ok(m.a === 'storm' && m.b === 'water' && m.rank === 2, 'стихия вещи + камень');
  m = weaponMix(BY_ID[PLAIN3], [f]); ok(m.a === 'fire' && m.b === null, 'камень в вещи без стихии');
  m = weaponMix(BY_ID[RARE], [f, gemId('storm', 1)]); ok(m.a === 'fire' && m.b === 'storm' && m.amp, 'два камня: сплав камней, стихия вещи усиливает'); }

// ---------- 6. сплав в бою ----------
const hitWith = (weapon, gems, setup) => { const W = mk(weapon, 0); W.inv.gem.weapon = gems; refreshGear(W); const e = foe(W, 1.6, 0); const o = foe(W, 3.4, 0); if (setup) setup(W, e, o);
  W.ev.length = 0; const ev = []; for (let i = 0; i < 50; i++) { step(W, 1 / 60, { attack: i < 2 }); ev.push(...W.ev); W.ev.length = 0; } return { W, e, o, ev }; };
{ const r = hitWith(RARE, [gemId('water', 1)], (W, e, o) => applyStatus(W, o, 'wet', 0, 6)); ok(r.ev.some(v => v.k === 'react' && v.name === 'Грозовой поток') && r.o.hp < 1e6, 'грозовой меч + камень воды не бьёт молнией по мокрым'); }
{ const r = hitWith(PLAIN3, [gemId('fire', 1)]); ok(r.e.st && r.e.st.burn, 'камень огня в оружии без стихии не поджигает'); }
{ const r = hitWith(TWO, [gemId('fire', 1), gemId('fire', 1)]); ok(r.o.st && r.o.st.burn, '«Пекло» не перекидывает огонь на соседа'); }
{ const r = hitWith(TWO, [gemId('venom', 1), gemId('venom', 1)]); const W = r.W; r.e.hp = 1; W.player.state = 'idle'; for (let i = 0; i < 60; i++) step(W, 1 / 60, { attack: i < 2 });
  ok(r.e.dead && r.o.st && r.o.st.poison, '«Чума» не перекидывает яд при смерти'); }
{ const W = mk(TWO, 0); W.inv.gem.weapon = [gemId('blood', 1), gemId('blood', 1)]; refreshGear(W); const e = foe(W, 1.6, 0); W.player.hp = 10; W.player.maxhp = 1000;
  for (let i = 0; i < 50; i++) step(W, 1 / 60, { attack: i < 2 }); ok(W.player.hp > 10, '«Жажда» не лечит ударом'); void e; }
{ const r = hitWith('w_sword_steel', []); ok(!r.ev.some(v => v.k === 'react' || v.k === 'mix'), 'оружие без камней даёт сплав'); }

if (fails.length) { console.error('Камни силы 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Камни силы 3D: OK');
