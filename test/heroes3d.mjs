// Тест героев 3D (шаг B1): у каждого вида оружия есть хозяин, чужое оружие не надевается, множители героя работают
// (у Торна — как раньше), сохранение версии 3 хранит героя, старое сохранение — Торн, чужое оружие в руке уходит в сумку.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, refreshGear, switchHero } from '../3d/src/sim.js';
import { abilityPoints, upgradeAbility } from '../3d/src/abilities3d.js';
import { HEROES, HERO_IDS, DEFAULT_HERO, canWield } from '../3d/src/data/heroes3d.js';
import { CATALOG, BY_ID, KIND_NAME } from '../3d/src/data/items.js';
import { addItem, equipAt } from '../3d/src/inv.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const mk = (hero, seed = 1) => { const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(seed)); if (hero) W.hero = hero; refreshGear(W); W.player.hp = W.player.maxhp; return W; };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
const weapon = kind => CATALOG.find(i => i.slot === 'weapon' && i.kind === kind && i.pool === 'weapon').id;

// ---------- 1. данные ----------
{
  const kinds = new Set(CATALOG.filter(i => i.slot === 'weapon').map(i => i.kind));
  for (const k of kinds) ok(HERO_IDS.some(h => HEROES[h].open && HEROES[h].kinds.includes(k)), `оружие «${k}» никому не подходит`);
  for (const h of HERO_IDS) ok(HEROES[h].kinds.every(k => KIND_NAME[k]) && CFG3.heroes[h], `у героя ${h} неизвестное оружие или нет чисел в конфиге`);
  ok(DEFAULT_HERO === 'thorn' && HEROES.thorn.kinds.includes('sword') && HEROES.thorn.kinds.includes('greatsword'), 'Торну не подходит меч или двуручник (оружие баланса)');
  ok(HEROES.jay.open && HEROES.jay.kinds.length && HEROES.jay.kinds.every(k => CATALOG.some(i => i.kind === k && i.pool === 'ranged')) && BY_ID[HEROES.jay.start] && canWield('jay', BY_ID[HEROES.jay.start]), 'Сойка без луков или без стартового лука');
  ok(!canWield('jay', BY_ID[weapon('sword')]) && !canWield('thorn', BY_ID[HEROES.jay.start]) && !canWield('vale', BY_ID[HEROES.jay.start]), 'луки не только у Сойки');
  ok(canWield('vale', BY_ID[weapon('rapier')]) && !canWield('vale', BY_ID[weapon('hammer')]) && !canWield('thorn', BY_ID[weapon('dagger')]), 'запреты оружия не те');
  ok(canWield('vale', BY_ID[CATALOG.find(i => i.slot === 'body').id]), 'броня запрещена');
  const c = CFG3.heroes.thorn; ok(c.hp === 1 && c.speed === 1 && !c.crit, 'Торн не как прежний герой');
}
// ---------- 2. надеть: чужое не надевается, своё — да ----------
{
  const W = mk('vale'); addItem(W.inv, weapon('axe'), 1, 30); addItem(W.inv, weapon('rapier'), 1, 30);
  const ai = W.inv.bag.findIndex(s => BY_ID[s.id].kind === 'axe');
  ok(!equipAt(W.inv, ai, W.hero) && !W.inv.eq.weapon && W.inv.bag.length === 2, 'Вейл надел топор');
  const ri = W.inv.bag.findIndex(s => BY_ID[s.id].kind === 'rapier');
  ok(equipAt(W.inv, ri, W.hero) && BY_ID[W.inv.eq.weapon].kind === 'rapier', 'Вейл не надел рапиру');
  const T = mk('thorn'); addItem(T.inv, weapon('dagger'), 1, 30); ok(!equipAt(T.inv, 0, T.hero), 'Торн надел кинжал');
  ok(equipAt(T.inv, 0), 'без героя проверка мешает (старые вызовы)');
}
// ---------- 3. множители героя ----------
{
  const T = mk('thorn'), V = mk('vale');
  ok(T.player.maxhp === CFG3.player.hp && V.player.maxhp === Math.round(CFG3.player.hp * CFG3.heroes.vale.hp), `здоровье: Торн ${T.player.maxhp}, Вейл ${V.player.maxhp}`);
  ok(V.gear.crit - T.gear.crit === CFG3.heroes.vale.crit, 'нет прибавки крита у Вейла');
  const run = W => { W.player.x = 40; W.player.z = 40; const x0 = W.player.x; for (let i = 0; i < 60; i++) step(W, 1 / 60, { mx: 1, mz: 0 }); return W.player.x - x0; };
  const dt = run(mk('thorn', 3)), dv = run(mk('vale', 3));
  ok(Math.abs(dv / dt - CFG3.heroes.vale.speed) < .05, `скорость: Вейл/Торн ${(dv / dt).toFixed(3)}`);
}
// ---------- 4. сохранение версии 3 ----------
{
  const W = mk('vale'), st = mem(); addItem(W.inv, weapon('dagger'), 1, 30); equipAt(W.inv, 0, W.hero); createSaver(W, st).write(true);
  const s = loadSave(30, st); ok(s && s.hero === 'vale' && BY_ID[s.inv.eq.weapon].kind === 'dagger', 'герой не сохранился');
  // старое сохранение (версия 2) с кинжалом в руке: Торн, кинжал в сумке, ничего не пропало
  const d = JSON.parse(st.o['berserk3d.save']); d.v = 2; delete d.hero;
  for (let i = 0; i < 30; i++) d.inv.bag.push({ id: weapon('hammer'), n: 1 });    // сумка полна — кинжал всё равно не пропадает
  st.setItem('berserk3d.save', JSON.stringify(d));
  const s2 = loadSave(30, st); ok(s2 && s2.hero === 'thorn' && !s2.inv.eq.weapon && s2.inv.bag.some(b => BY_ID[b.id].kind === 'dagger'), 'старое сохранение: не Торн или кинжал пропал');
  HEROES.jay.open = false;     // закрытый герой (как Сойка в B1) в сохранении — Торн
  for (const bad of ['jay', 'gatz', 42]) { const e = JSON.parse(st.o['berserk3d.save']); e.v = 3; e.hero = bad; st.setItem('berserk3d.save', JSON.stringify(e)); const s3 = loadSave(30, st); ok(s3 && s3.hero === 'thorn', `герой «${bad}» не заменён Торном`); }
  HEROES.jay.open = true;
}

// ---------- 5. смена героя без потери прогресса ----------
{
  const W = mk('thorn'); W.lv = 20; W.ap = abilityPoints(20, CFG3); W.inv.ash = 777; W.skills = { hand: 2 };
  Object.assign(W.inv.eq, { weapon: 'w_greatsword_black', offhand: 's_tower_iron' }); W.inv.up.weapon = 2; upgradeAbility(W, 'charge'); upgradeAbility(W, 'cry'); refreshGear(W);
  ok(!switchHero(W, 'thorn') && !switchHero(W, 'gatz'), 'смена на того же или неизвестного героя прошла');
  ok(switchHero(W, 'jay') && W.hero === 'jay', 'Сойка не выбралась');
  ok(W.lv === 20 && W.inv.ash === 777 && W.skills.hand === 2 && W.ap === abilityPoints(20, CFG3) && !Object.keys(W.ab).length, 'смена героя потеряла прогресс или не вернула очки умений');
  ok(W.inv.eq.weapon === HEROES.jay.start && !W.inv.eq.offhand && W.inv.bag.some(s => s.id === 'w_greatsword_black' && s.up === 2) && W.inv.bag.some(s => s.id === 's_tower_iron'), 'чужое не ушло в сумку или Сойка без лука');
  W.inv.bag.push({ id: 'w_rapier_steel', n: 1 }, { id: 'w_dagger_iron', n: 1 });
  ok(switchHero(W, 'vale') && BY_ID[W.inv.eq.weapon].kind === 'rapier' && W.inv.bag.some(s => s.id === HEROES.jay.start), 'Вейл не взял лучший свой клинок из сумки');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Герои 3D: OK');
