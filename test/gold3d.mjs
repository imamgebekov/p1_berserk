// Тест золотых вещей 3D (шаг G3b): шестая редкость — 11 вещей, статы выше лучшей клеймёной того же места, только у торговца
// (из сундуков и с врагов не выпадают); у каждой своя механика: «Солнце» (каждый 4-й удар — вспышка с оглушением),
// отражение блоком, солнечный щит кирасы, лечение критом, удар после переката, рывок скорости за убийство, двойная добыча,
// лечение вне боя.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, killEnemy, refreshGear, hurtPlayer } from '../3d/src/sim.js';
import { CATALOG, BY_ID, RARITY } from '../3d/src/data/items.js';
import { CONTAINERS, DROPS, SHOP, rollLoot } from '../3d/src/data/loot.js';
import { GOLD_K } from '../3d/src/data/gold3d.js';
import { HEROES, canWield } from '../3d/src/data/heroes3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const G = CATALOG.filter(i => i.rar === 5);

// ---------- 1. каталог ----------
ok(RARITY[5] && RARITY[5].name === 'Золотой' && G.length === 17 && G.every(i => i.pool === 'gold' && i.slot && i.stats), 'золотых вещей не 17 или не те');     // 12-я — Посох Зенита (Ирга); 13–16 — лёгкий комплект «Облачение Зари»
ok(G.every(i => i.gold || (i.perks || []).includes('sun')), 'у золотой вещи нет своей механики');
for (const it of G) {
  const light = ['head', 'body', 'boots'].includes(it.slot) && canWield('irga', it);     // лёгкая золотая броня сравнивается с лучшей лёгкой клеймёной
  const base = CATALOG.filter(i => i.rar === 4 && i.slot === it.slot && (it.slot === 'weapon' || it.slot === 'offhand' ? i.kind === it.kind : true) && (!light || canWield('irga', i)) && i.stats).sort((a, b) => b.value - a.value)[0];
  if (base) for (const [k, v] of Object.entries(base.stats)) if (v > 0 && k !== 'swing' && k !== 'reach') ok(it.stats[k] >= Math.round(v * GOLD_K), `${it.id}: ${k} ${it.stats[k]} не выше клеймёной (${v})`);
}
for (const h of Object.keys(HEROES)) ok(G.some(i => i.slot === 'weapon' && canWield(h, i)), `нет золотого оружия для ${h}`);
// ---------- 2. только у торговца ----------
{ const rng = mulberry32(9); let gold = 0;
  for (let i = 0; i < 4000; i++) for (const def of [...Object.values(CONTAINERS), ...Object.values(DROPS), SHOP]) for (const x of rollLoot(def, rng, 1, 150, 2)) if (BY_ID[x.id].rar === 5) gold++;
  ok(gold === 0, 'золото выпало из сундука или с врага: ' + gold); }

// ---------- 3. механики ----------
const mk = (eq = {}) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; c.bosses.list = []; c.enemies.roam.on = false;
  const W = createWorld(c, mulberry32(4)); W.player.x = 300; W.player.z = 0; Object.assign(W.inv.eq, eq); refreshGear(W); W.player.hp = W.player.maxhp; return W; };
const foe = (W, dx, dz, hp = 1e6) => { const e = spawnEnemy(W, 'brute', W.player.x + dx, W.player.z + dz); e.hp = e.maxhp = hp; e.cd = 99; e.mode = null; return e; };
const swing = W => { step(W, 1 / 60, { attackPress: true }); for (let i = 0; i < 60 && W.player.state !== 'idle'; i++) step(W, 1 / 60, {}); for (let i = 0; i < 20; i++) step(W, 1 / 60, {}); };
// «Солнце»: 3 замаха — без вспышки, 4-й — вспышка, враги рядом оглушены
{ const W = mk({ weapon: 'g_sundar' }), p = W.player; p.face = 0; const a = foe(W, 0, 1.6), b = foe(W, 1.2, 2.4); let suns = 0;
  for (let k = 0; k < 4; k++) { W.ev.length = 0; swing(W); suns += W.ev.filter(v => v.k === 'sun').length; if (k === 2) ok(suns === 0, 'вспышка раньше 4-го удара'); }
  ok(suns === 1 && b.hp < b.maxhp, 'на 4-й удар нет вспышки или она не задела соседа');
  const W2 = mk({ weapon: 'w_greatsword_black' }); W2.player.face = 0; foe(W2, 0, 1.6); for (let k = 0; k < 8; k++) { W2.ev.length = 0; swing(W2); ok(!W2.ev.some(v => v.k === 'sun'), 'вспышка без золотого оружия'); } }
// Щит Восхода: блок возвращает урон
{ const W = mk({ offhand: 'g_sunrise' }), p = W.player; p.face = 0; const e = foe(W, 0, 2); const h0 = e.hp; hurtPlayer(W, 40, e.x, e.z, null, e);
  ok(e.hp < h0 && W.ev.some(v => v.k === 'reflect'), 'Щит Восхода не вернул удар'); }
// Кираса Солнца: щит заряжается и берёт удар первым, потом перезарядка
{ const W = mk({ body: 'g_sunplate' }), p = W.player; step(W, 1 / 60, {}); ok(W.aegis === 40, 'солнечный щит не зарядился: ' + W.aegis);
  const hp0 = p.hp; hurtPlayer(W, 10, p.x + 1, p.z, null, null); ok(p.hp === hp0 && W.aegis < 40, 'щит не взял удар'); p.inv = 0;
  for (let i = 0; i < 6; i++) { hurtPlayer(W, 200, p.x + 1, p.z, null, null); p.inv = 0; }
  ok(W.aegis <= 0, 'щит не разбился'); const t0 = W.aegisT; for (let i = 0; i < 60 * 5; i++) step(W, 1 / 60, {}); ok(W.aegis <= 0 && W.aegisT < t0, 'щит вернулся без перезарядки');
  for (let i = 0; i < 60 * 16; i++) step(W, 1 / 60, {}); ok(W.aegis === 40, 'щит не вернулся через 20 с'); }
// Венец Полудня: крит лечит
{ const W = mk({ head: 'g_nooncrown', weapon: 'w_sword_iron' }), p = W.player; p.face = 0; foe(W, 0, 1.4); p.hp = 50; W.rng = () => 0; swing(W);
  const W2 = mk({ head: 'a_head_helm_black', weapon: 'w_sword_iron' }); W2.player.face = 0; foe(W2, 0, 1.4); W2.player.hp = 50; W2.rng = () => 0; swing(W2);
  ok(p.hp > W2.player.hp, `крит не лечит: ${p.hp} против ${W2.player.hp}`); }
// Плащ Рассвета: удар сразу после переката сильнее
{ const dmgAfter = roll => { const W = mk({ cloak: 'g_dawncloak', weapon: 'w_sword_iron' }), p = W.player; p.face = 0; W.rng = () => .99; const e = foe(W, 0, 1.4); if (roll) p.lastRollEnd = W.t; else p.lastRollEnd = -99; const h = e.hp; swing(W); return h - e.hp; };
  ok(dmgAfter(true) > dmgAfter(false) * 1.4, 'удар после переката не сильнее'); }
// Сапоги Ветра: убийство — рывок скорости
{ const W = mk({ boots: 'g_galeboots' }), e = foe(W, 3, 0, 10); const s0 = W.gear.spd; killEnemy(W, e, 1); refreshGear(W); ok(W.gear.spd >= s0 + 30, 'нет рывка скорости за убийство'); }
// Перстень Мидаса: добыча дважды
{ const drops = ring => { const W = mk(ring ? { ring: 'g_midas' } : {}); W.rng = () => 0; const e = foe(W, 3, 0, 10); W.drops.length = 0; killEnemy(W, e, 1); return W.drops.length; };
  ok(drops(true) >= 2 * drops(false) && drops(false) > 0, `добыча не удвоилась: ${drops(true)} против ${drops(false)}`); }
// Знак Солнца: вне боя лечит, сразу после удара — нет
{ const W = mk({ amulet: 'g_sunsign' }), p = W.player; p.hp = 20; hurtPlayer(W, 1, p.x + 1, p.z, null, null);
  const h0 = p.hp; for (let i = 0; i < 60 * 3; i++) step(W, 1 / 60, {}); const early = p.hp - h0;
  for (let i = 0; i < 60 * 1.5; i++) step(W, 1 / 60, {});                       // за порогом 4 с без урона
  const h1 = p.hp; for (let i = 0; i < 60 * 3; i++) step(W, 1 / 60, {}); const late = p.hp - h1;
  ok(late > early + p.maxhp * .025 * 2, `вне боя не лечит: за 3 с сначала +${early.toFixed(1)}, потом +${late.toFixed(1)}`); }

if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].slice(0, 20).join('\n')); process.exit(1); }
console.log('Золотые вещи 3D: OK');
