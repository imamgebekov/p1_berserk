// Тест этапа 4 «круче»: случайные свойства вещей, «Надеть лучшее», «Продать хуже надетого», замок, сохранение,
// событие «Пепельный вор». Свойства — только у редких и выше, в пределах cfg.affix.max, бой без них не меняется.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, killEnemy, equipBest, dropItem, spawnEnemy } from '../3d/src/sim.js';
import { rollAffixes, affixFor, affixLines, affixCount, rollGems } from '../3d/src/affix3d.js';
import { createInv, entryOf, gearStats, serialize, deserialize, scoreUp, socketsOf } from '../3d/src/inv.js';
import { sellWorse } from '../3d/src/economy3d.js';
import { eventLine } from '../3d/src/events3d.js';
import { CATALOG, BY_ID } from '../3d/src/data/items.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const A = CFG3.affix;

// ---------- 1. свойства: число по редкости, пределы, повтор по зерну ----------
{
  const gear = CATALOG.filter(i => i.slot && i.pool !== 'unique' && i.pool !== 'setunique');
  let bad = 0, over = 0, noq = 0, n = 0;
  for (const it of gear.slice(0, 400)) for (const il of [1, 30, 60]) {
    const af = rollAffixes(CFG3, it.id, il, 12345 + n++), want = A.count[it.rar] || 0, jewel = it.slot === 'ring' || it.slot === 'amulet';
    if (affixCount(af) !== want) bad++;
    if (jewel ? af && 'q' in af : !(af && af.q >= A.quality[0] && af.q <= A.quality[1])) noq++;     // качество — у оружия и брони, у украшений его нет
    for (const [k, v] of Object.entries(af || {})) if (k !== 'q' && !(v > 0 && v <= A.max[k])) over++;
  }
  ok(noq === 0, `качество вне разброса или у украшения: ${noq}`);
  ok(bad === 0, `число свойств не по редкости: ${bad}`);
  ok(over === 0, `свойства вне пределов: ${over}`);
  const rare = gear.find(i => i.rar === 3 && i.slot === 'weapon');
  ok(JSON.stringify(rollAffixes(CFG3, rare.id, 20, 7)) === JSON.stringify(rollAffixes(CFG3, rare.id, 20, 7)), 'одно зерно — разные свойства');
  const lo = rollAffixes(CFG3, rare.id, 1, 7), hi = rollAffixes(CFG3, rare.id, 60, 7);
  ok(Object.keys(lo).every(k => hi[k] >= lo[k]), 'на высоком уровне свойства слабее');
  const off = clone(); off.affix.on = false; ok(rollAffixes(off, rare.id, 20, 7) === null, 'affix.on=false — свойства есть');
  ok(affixLines({ crit: 3 }, { crit: 'крит %' })[0] === '+3 крит %', 'строка свойства');
  // учёт в силе и оценке
  const inv = createInv(); inv.eq.weapon = rare.id; const g0 = gearStats(inv).dmg; inv.af.weapon = { dmg: 5 };
  ok(gearStats(inv).dmg === g0 + 5, 'свойство надетой вещи не входит в силу');
  ok(scoreUp(rare, 0, .1, 20, { dmg: 5 }) > scoreUp(rare, 0, .1, 20, null), 'свойство не входит в оценку');
}
// ---------- 1b. качество, шансы стихий, камни внутри (3.99) ----------
{
  const w = CATALOG.find(i => i.slot === 'weapon' && i.rar === 2), inv = createInv(); inv.eq.weapon = w.id;
  const g0 = gearStats(inv).dmg; inv.af.weapon = { q: 1.15 }; const gHi = gearStats(inv).dmg; inv.af.weapon = { q: .85 }; const gLo = gearStats(inv).dmg;
  ok(gHi > g0 && gLo < g0, `качество не меняет урон: ${gLo} / ${g0} / ${gHi}`);
  ok(scoreUp(w, 0, .1, 20, { q: 1.15 }) > scoreUp(w, 0, .1, 20, { q: .85 }), 'качество не входит в оценку');
  inv.af.weapon = { burnCh: 7 }; ok(gearStats(inv).burnCh === 7, 'шанс поджога не в силе вещи');
  const qs = CATALOG.filter(i => i.slot === 'weapon' && i.rar === 2).slice(0, 20).map((it, i) => rollAffixes(CFG3, it.id, 20, 900 + i).q);
  ok(new Set(qs).size > 10, 'качество почти не меняется: ' + qs.join(','));
  // камни внутри: золотая — всегда один, фиолетовая и клеймёная — изредка, ниже — никогда
  const gems = rar => { const its = CATALOG.filter(i => i.rar === rar && (i.slot === 'weapon' || i.slot === 'body') && socketsOf(i, CFG3) > 0); let c = 0, m = 0; for (let k = 0; k < 400; k++) { const it = its[k % its.length], g = rollGems(CFG3, it.id, 77 + k, socketsOf(it, CFG3)); if (g) { c++; if (g.filter(Boolean).length !== 1 || g.length !== socketsOf(it, CFG3) || !BY_ID[g[0]]) m++; } } return { k: c / 400, m, n: its.length }; };
  const g5 = gems(5), g3 = gems(3), g2 = gems(2);
  ok(g5.n && g5.k === 1 && !g5.m, 'золотая без камня или камней не один: ' + JSON.stringify(g5));
  ok(g3.k > A.gems.purple * .6 && g3.k < A.gems.purple * 1.4 && !g3.m, 'фиолетовые с камнем не изредка: ' + JSON.stringify(g3));
  ok(g2.k === 0, 'синяя с камнем внутри');
}
// ---------- 1c. шанс стихии срабатывает в бою: урон по манекену растёт, без шанса — бой как был ----------
{
  const run = ch => { const c = clone(); c.enemies.count = 0; c.wanderer.on = false; c.events.on = false; c.ambient.on = false; c.bosses.list = []; c.map.places = [];
    const W = createWorld(c, mulberry32(4)); W.inv.af.weapon = ch ? { burnCh: ch, poisonCh: ch, bleedCh: ch, shockCh: ch } : null; W.player.inv = 1e9;
    const e = spawnEnemy(W, 'brute', W.player.x, W.player.z - 2.2); e.hp = e.maxhp = 1e5; e.cd = 1e9; W.player.face = Math.PI;
    for (let i = 0; i < 600; i++) { e.x = W.player.x; e.z = W.player.z - 2.2; e.cd = 1e9; W.player.hp = W.player.maxhp; step(W, 1 / 60, { attackPress: i % 6 === 0, aimPt: { x: e.x, z: e.z } }); W.ev.length = 0; }
    return { W, dmg: e.maxhp - e.hp }; };
  const a = run(0), b = run(30);
  ok(b.W.gear.burnCh === 30 && a.W.gear.burnCh === 0, 'шанс стихии не попал в силу героя');
  ok(a.dmg > 0 && b.dmg > a.dmg * 1.05, `шанс стихии не добавил урона: ${Math.round(a.dmg)} → ${Math.round(b.dmg)}`);
}
// ---------- 2. сохранение: свойства и замок переживают круг, мусор отбрасывается ----------
{
  const rare = CATALOG.find(i => i.rar === 3 && i.slot === 'body');
  const inv = createInv(); inv.bag.push({ ...entryOf(rare.id, 0, null, 25, { armor: 4, hp: 20 }), lock: true });
  inv.eq.weapon = 'w_sword_steel'; inv.af.weapon = { crit: 3 };
  const d = deserialize(JSON.parse(JSON.stringify(serialize(inv))), 30);
  ok(d.bag[0].af && d.bag[0].af.armor === 4 && d.bag[0].lock === true && d.af.weapon && d.af.weapon.crit === 3, 'свойства или замок потерялись: ' + JSON.stringify(d));
  const junk = deserialize({ bag: [{ id: rare.id, n: 1, il: 25, af: { armor: 999, nope: 3, hp: 'x' } }] }, 30);
  const af = junk.bag[0].af || {};
  ok(!('nope' in af) && !('hp' in af) && (af.armor || 0) <= A.max.armor, 'мусор в свойствах не отброшен: ' + JSON.stringify(af));
  const qd = deserialize({ bag: [{ id: rare.id, n: 1, il: 25, af: { q: 1.12, armor: 3 } }, { id: rare.id, n: 1, il: 25, af: { q: 9 } }] }, 30);
  ok(qd.bag[0].af && qd.bag[0].af.q === 1.12 && qd.bag[1].af && qd.bag[1].af.q === A.quality[1], 'качество не пережило сохранение: ' + JSON.stringify(qd.bag.map(b => b.af)));
  const old = deserialize({ bag: [{ id: rare.id, n: 1, il: 25 }] }, 30); ok(!old.bag[0].af, 'старая вещь получила свойства');
}
// ---------- 3. мир: «Надеть лучшее», «Продать хуже надетого», замок, без переброса при броске ----------
const mk = (seed = 1, tweak) => { const c = clone(); c.enemies.count = 0; c.wanderer.on = false; c.events.on = false; for (const dd of c.dungeons.list) dd.spawns = []; if (tweak) tweak(c); return createWorld(c, mulberry32(seed)); };
{
  const W = mk(3), slot = 'body', worn = W.inv.eq[slot];
  const cands = CATALOG.filter(i => i.slot === slot && i.rar <= 3 && i.pool !== 'unique' && i.pool !== 'setunique');
  const B = W.cfg.smith.bonus, cur = worn ? scoreUp(BY_ID[worn], W.inv.up[slot] || 0, B, W.inv.il[slot], W.inv.af[slot]) : -1;
  const best = cands.reduce((a, b) => (scoreUp(b, 0, B, 30) > scoreUp(a, 0, B, 30) ? b : a));
  const worst = cands.reduce((a, b) => (scoreUp(b, 0, B, 1) < scoreUp(a, 0, B, 1) ? b : a));
  W.inv.bag.push(entryOf(worst.id, 0, null, 1, null), entryOf(best.id, 0, null, 30, { armor: 5 }));
  ok(scoreUp(best, 0, B, 30, { armor: 5 }) > cur, 'проба: лучшая вещь не лучше надетой');
  const n = equipBest(W);
  ok(n >= 1 && W.inv.eq[slot] === best.id && W.inv.af[slot] && W.inv.af[slot].armor === 5, `«Надеть лучшее» не надело лучшее (${n}, ${W.inv.eq[slot]})`);
  ok(equipBest(W) === 0, 'повторное «Надеть лучшее» снова меняет');
  // продажа хуже надетого: замок и редкость ≥4 остаются
  W.nearMerchant = true; W.night = false;
  W.inv.bag.length = 0;
  W.inv.bag.push(entryOf(worst.id, 0, null, 1, null), { ...entryOf(worst.id, 0, null, 1, null), lock: true });
  const epic = CATALOG.find(i => i.slot === slot && i.rar === 4 && i.pool !== 'unique' && i.pool !== 'setunique');
  if (epic) W.inv.bag.push(entryOf(epic.id, 0, null, 1, null));
  const ash0 = W.inv.ash, r = sellWorse(W);
  ok(r !== -1 && r.n === 1 && W.inv.ash === ash0 + r.sum && r.sum > 0, 'продажа хуже надетого: ' + JSON.stringify(r));
  ok(W.inv.bag.some(s => s.lock) && (!epic || W.inv.bag.some(s => s.id === epic.id)), 'продана вещь под замком или великая');
  W.nearMerchant = false; ok(sellWorse(W) === -1, 'продажа без торговца');
  // брошенная и поднятая вещь не получает новых свойств
  W.inv.bag.length = 0; const rare = CATALOG.find(i => i.rar === 3 && i.slot === 'boots');
  W.inv.bag.push(entryOf(rare.id, 0, null, 20, null));
  ok(dropItem(W, 0) && W.drops.length && W.drops[W.drops.length - 1].mine, 'бросок без метки «своя»');
  const dq = W.drops[W.drops.length - 1]; dq.x = W.player.x; dq.z = W.player.z; dq.t = 0;
  for (let i = 0; i < 90 && !W.inv.bag.length; i++) { step(W, 1 / 60, {}); W.ev.length = 0; }
  ok(W.inv.bag.length === 1 && !W.inv.bag[0].af, 'поднятая своя вещь получила свойства (перебор): ' + JSON.stringify(W.inv.bag[0]));
  // новая вещь с земли — со свойствами
  W.inv.bag.length = 0; W.drops.push({ id: rare.id, n: 1, x: W.player.x, z: W.player.z, t: 0, cd: 0, il: 20 });
  for (let i = 0; i < 90 && !W.inv.bag.length; i++) { step(W, 1 / 60, {}); W.ev.length = 0; }
  ok(W.inv.bag.length === 1 && W.inv.bag[0].af && affixCount(W.inv.bag[0].af) === A.count[3], 'новая редкая вещь без свойства');
  const a1 = affixFor(W, rare.id, 20), a2 = affixFor(W, rare.id, 20); ok(a1 && a2, 'affixFor без свойств');
}
// ---------- 4. «Пепельный вор»: появляется, убегает, пойман — награда, упущен — исчезает ----------
const mkT = seed => { const W = mk(seed, c => { c.events.on = true; c.events.kinds = { thief: 1 }; c.events.first = [3, 3]; }); W.player.x = 0; W.player.z = 48; return W; };
const evs = [];
const run = (W, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) { step(W, 1 / 60, input); for (const v of W.ev) if (/^ev/.test(v.k)) evs.push(v); W.ev.length = 0; } };
const until = (W, k, sec) => { const n = evs.length; for (let i = 0; i < sec * 60; i++) { run(W, 1 / 60); const v = evs.slice(n).find(q => q.k === k); if (v) return v; } return null; };
const thiefOf = W => W.event && W.enemies.find(e => e.id === W.event.foes[0]);
{
  const W = mkT(2), st = until(W, 'evStart', 6), th = thiefOf(W), T = CFG3.events.thief;
  ok(st && st.kind === 'thief' && th && th.type === 'ash_thief' && !th.elite, 'вор не появился или он элита');
  const d0 = th && Math.hypot(th.x - W.player.x, th.z - W.player.z);
  ok(d0 >= T.dist[0] - .5 && d0 <= T.dist[1] + .5, `вор в ${d0 && d0.toFixed(1)} м`);
  ok(/Пепельный вор/.test(eventLine(W)), 'нет строки события');
  W.player.x = th.x + 8; W.player.z = th.z; run(W, 1.5); const d1 = th && Math.hypot(th.x - W.player.x, th.z - W.player.z);
  ok(d1 > 8 + 4, `вор не убегает: 8 → ${d1 && d1.toFixed(1)}`);
  const hp0 = W.player.hp; run(W, 1); ok(W.player.hp >= hp0, 'вор бьёт героя');
  const ash0 = W.inv.ash, drops0 = W.drops.length; killEnemy(W, th, 1);
  const done = until(W, 'evDone', 1);
  ok(done && done.kind === 'thief' && W.inv.ash > ash0 && W.drops.length > drops0, 'нет награды за вора');
  ok(W.drops.some(q => BY_ID[q.id] && BY_ID[q.id].rar === 3 && q.il), 'нет великой вещи из мешка');
}
{
  const W = mkT(5); until(W, 'evStart', 6); const th = thiefOf(W);
  ok(th, 'вор не появился (2)');
  const fail = until(W, 'evFail', CFG3.events.thief.time + 2);
  ok(fail && fail.why === 'escaped' && th && !W.enemies.includes(th) && !W.event, 'упущенный вор не исчез: ' + JSON.stringify(fail));
}
// бой не сдвигается: появление вора идёт на своём генераторе
{
  const a = mkT(7), b = mk(7); const ra = a.rng(), rb = b.rng(); run(a, 4); run(b, 4);
  ok(ra === rb && a.rng() === b.rng(), 'вор сдвинул генератор боя');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 25).join('\n')); process.exit(1); }
console.log('Свойства вещей и «Пепельный вор» 3D: OK');
