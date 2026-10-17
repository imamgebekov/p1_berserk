// Тест сумки и добычи 3D (шаг A3): навык «Глубокие карманы» открывается рано и даёт +3 места за ранг, сумка вмещает ровно bagSlots,
// сохранение большой сумки загружается целиком, после сброса навыков вещи сверх размера не пропадают, но новые не берутся; добыча с врагов шлёт событие drop.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, refreshGear, bagSlots, bagCap, spawnEnemy, killEnemy } from '../3d/src/sim.js';
import { canRank, SKILLS } from '../3d/src/data/skills3d.js';
import { addItem } from '../3d/src/inv.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';
import { respec } from '../3d/src/progress3d.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const mk = (seed = 1) => { const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; return createWorld(c, mulberry32(seed)); };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
const fillers = Object.keys(BY_ID).filter(id => BY_ID[id].slot);   // снаряжение не складывается в стопки: одна вещь — одно место

// ---------- 1. навык «Глубокие карманы» ----------
{
  const S = SKILLS.pockets; ok(S && S.branch === 'wander' && S.tier === 1 && S.stats.bag === 3, 'навыка нет или он не в «Скитальце»');
  ok(canRank({}, 'pockets', 5) === 'locked' && canRank({ step: 3 }, 'pockets', 5) === 'ok', 'открывается не после 3 очков в ветке');
  const W = mk(); ok(bagSlots(W) === CFG3.bag.slots, 'без навыка сумка не базовая');
  W.skills = { step: 3, pockets: 3 }; refreshGear(W);
  ok(bagSlots(W) === CFG3.bag.slots + 9 && bagCap(CFG3) === CFG3.bag.slots + 9, `с тремя рангами сумка ${bagSlots(W)}, предел ${bagCap(CFG3)}`);
  const put = bagSlots(W) + 6;     // на 6 вещей больше, чем мест (вместимость — из конфига)
  let left = 0; for (const id of fillers.slice(0, put)) left += addItem(W.inv, id, 1, bagSlots(W));
  ok(fillers.length >= put + 1 && W.inv.bag.length === bagSlots(W) && left === put - bagSlots(W), `сумка вмещает не ровно ${bagSlots(W)}: ${W.inv.bag.length}`);
  // сохранение большой сумки загружается целиком
  const st = mem(); createSaver(W, st).write(true);
  const s = loadSave(bagCap(CFG3), st); ok(s && s.inv.bag.length === bagSlots(W), 'большая сумка обрезалась при загрузке: ' + (s && s.inv.bag.length));
  // сброс навыков: вещи остаются, новые не берутся
  W.inv.ash = 1e6; W.lv = 10; respec(W); refreshGear(W);
  ok(W.inv.bag.length === CFG3.bag.slots + 9 && bagSlots(W) === CFG3.bag.slots, 'после сброса навыков вещи пропали');
  const before = W.inv.bag.length; ok(addItem(W.inv, fillers[put], 1, bagSlots(W)) === 1 && W.inv.bag.length === before, 'переполненная сумка взяла вещь');
}
// ---------- 2. добыча с врага ----------
{
  const W = mk(3); let drops = 0, ids = new Set();
  for (let i = 0; i < 40; i++) { const e = spawnEnemy(W, 'brute', 10 + i, 10); W.ev.length = 0; killEnemy(W, e, 1); for (const v of W.ev) if (v.k === 'drop') { drops++; ok(BY_ID[v.id], 'событие drop с неизвестной вещью'); ids.add(v.id); } }
  ok(drops >= 20 && W.drops.length === drops, `добыча с рогачей: событий ${drops}, на земле ${W.drops.length}`);
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Сумка и добыча 3D: OK');
