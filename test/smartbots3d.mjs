// Г9 «Умные спутники и враги»: честные лужи и притяжение (успеть уйти), спутники уходят от замаха слама, кольца и рывка, лекарь
// идёт к раненому, бойцы заходят за спину босса, «Пинок» сбивает чтение, нанятый — почти как бот сбора; враги бьют приёмами свою
// цель, раненый колдун отходит; босс раз в фазу прыгает на дальнего лекаря. Без отряда босс выбирает приёмы как раньше.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnBoss, spawnEnemy } from '../3d/src/sim.js';
import { spawnAlly, skillOf, allyHp, allyMaxHpOf } from '../3d/src/squad3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (atks, seed = 9, f) => {
  const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; c.bosses.phaseMoves = null; c.terrain.on = false;
  c.bosses.sig = { bogwarden: { attacks: atks } }; if (f) f(c);
  const W = createWorld(c, mulberry32(seed)), p = W.player; W.hero = 'vale'; W.lv = 40; p.hp = p.maxhp = 1e6;
  const e = spawnBoss(W, { type: 'bogwarden', x: p.x + 7, z: p.z, attacks: [], phases: [] }); e.hp = e.maxhp = 1e8; e.alert = true; e.b.cd = 1; return { W, p, e };
};
const run = (W, sec, fn) => { for (let i = 0; i < sec * 60; i++) { if (fn && fn(i)) return true; step(W, 1 / 60, {}); W.ev.length = 0; } return false; };
const team = (W, types) => types.map((t, k) => { const a = spawnAlly(W, t); a.lfg = true; a.x = W.player.x - 1 - k * .6; a.z = W.player.z + 1; return a; });
// доля приёмов вида kind, под которые попал каждый спутник (здоровье возвращаем каждый кадр)
function share(kind, atk, types, sec = 40) {
  const { W, e, p } = mk([atk]); const as = team(W, types); let inst = 0, last = null; const hit = {};
  const oA = W.fx.hurtA; W.fx.hurtA = (a, d, x) => { oA(a, d, x); (hit[inst] || (hit[inst] = new Set())).add(a.id); };
  run(W, sec, () => { const A = e.b.atk; if (A && A !== last && A.kind === kind && !A.after) { last = A; inst++; } p.hp = p.maxhp; p.x = e.x - 9; for (const a of as) { a.hp = a.maxhp; a.dead = false; } return false; });
  const n = Math.max(1, inst - 1); return Object.fromEntries(as.map(a => [a.type, Object.keys(hit).filter(k => +k < inst && hit[k].has(a.id)).length / n]));
}

// 1. лужа: первый тик не сразу — успеть уйти
{ const { W, p, e } = mk([{ kind: 'pools', wind: .3, n: 1, r: 2, dur: 6, mul: 1, cd: 99, range: 99 }]); p.x = e.x - 5; p.z = e.z;
  run(W, 3, () => (W.bzones || []).length > 0); const h0 = p.hp; run(W, .35); ok(p.hp === h0, 'лужа бьёт в первый же миг');
  run(W, 1); ok(p.hp < h0, 'лужа не бьёт стоящего'); }
// 2. притяжение: тянет, удар — позже; ушедший из круга цел
for (const leave of [false, true]) {
  const { W, p, e } = mk([{ kind: 'pull', name: 'т', wind: .3, r: 14, force: 8, inner: 3.6, mul: 1, cd: 99, range: 14 }]); p.x = e.x - 10; p.z = e.z; let pulled = false;
  run(W, 3, () => { if (e.b.atk && e.b.atk.after) pulled = true; return pulled; }); ok(pulled, 'после притяжения нет отложенного удара');
  if (leave) { p.x = e.x - 9; } const h0 = p.hp; run(W, 1.2); ok(leave ? p.hp === h0 : p.hp < h0, `притяжение: ${leave ? 'ушёл — получил урон' : 'остался — без урона'}`); }
// 3. уклонение спутников: слам (защитник терпит), рывок, кольцо
{ const s = share('slam', { kind: 'slam', wind: .9, r: 4.4, mul: 1, cd: 3, range: 6 }, ['c_thorn', 'c_vale']);
  ok(s.c_vale < .5, `боец не уходит от слама: ${(s.c_vale * 100).toFixed(0)}%`); ok(s.c_thorn > .5, 'защитник бегает от слама'); }
{ const s = share('charge', { kind: 'charge', wind: .9, len: 12, width: 2.6, mul: 1, cd: 4, range: 15 }, ['c_thorn', 'c_vale']);
  ok(s.c_vale < .6 && s.c_thorn < .7, `рывок бьёт всех: ${JSON.stringify(s)}`); }
{ const s = share('nova', { kind: 'nova', wind: 1.1, r: 7.5, inner: 2.5, mul: 1, cd: 5, range: 99 }, ['c_thorn', 'c_vale', 'c_irga']);
  ok(s.c_irga < .4, `лекарь стоит в кольце: ${(s.c_irga * 100).toFixed(0)}%`); }
// 4. «Пинок»: без защитника чтение сбивает боец
{ const { W, e } = mk([{ kind: 'cast', name: 'ч', wind: 2.8, r: 99, mul: 1, cd: 6, range: 99 }]); team(W, ['c_vale']); let c = 0, k = 0;
  for (let i = 0; i < 60 * 25; i++) { step(W, 1 / 60, {}); for (const v of W.ev) { if (v.k === 'bossCast') c++; if (v.k === 'bossInterrupt') k++; } W.ev.length = 0; W.player.hp = W.player.maxhp; for (const a of W.allies) a.hp = a.maxhp; }
  ok(c >= 2 && k >= 1, `боец не сбивает чтение: чтений ${c}, сбито ${k}`); }
// 5. лекарь идёт к раненому вне радиуса и лечит
{ const { W, p, e } = mk([]); e.b.cd = 99; const [h] = team(W, ['c_irga']); h.x = p.x + 18; h.z = p.z; run(W, .05); p.hp = p.maxhp * .3; const h0 = p.hp;
  run(W, 5); ok(p.hp > h0, 'лекарь не дошёл до раненого героя'); }
// 6. боец у босса — за спиной (босс смотрит на защитника)
{ const { W, e } = mk([{ kind: 'slam', wind: .5, r: 1, mul: .01, cd: 99, range: .1 }]); const [t, v] = team(W, ['c_thorn', 'c_vale']); W.player.x = e.x - 20;
  let back = 0, n = 0; run(W, 12, i => { t.hp = t.maxhp; v.hp = v.maxhp; if (i > 240 && i % 10 === 0) { n++; if ((v.x - e.x) * Math.sin(e.face) + (v.z - e.z) * Math.cos(e.face) < 0) back++; } return false; });
  ok(n && back / n > .6, `боец не за спиной босса: ${(back / Math.max(1, n) * 100).toFixed(0)}%`); }
// 7. нанятый: навык не ниже hire, здоровье почти как у бота сбора
{ const { W } = mk([]); const L = W.cfg.squad.live; const hs = [0, 1, 2, 3, 4, 5].map(() => spawnAlly(W, 'c_vale'));
  ok(hs.every(a => skillOf(W, a) >= L.smart.hire), 'навык нанятого ниже порога'); ok(new Set(hs.map(a => skillOf(W, a).toFixed(3))).size >= 4, 'навык нанятых одинаковый');
  ok(allyMaxHpOf(W, hs[0]) === Math.round(allyHp(W, W.cfg.squad.types.c_vale) * W.cfg.squad.gear.naked.hp) && W.cfg.squad.gear.naked.hp >= .85, 'нанятый без вещей слишком слаб'); }
// 8. враг бьёт приёмом свою цель: колдунья, которая бьёт спутника, кладёт порчу под спутника
{ const { W, p, e } = mk([]); e.b.cd = 99; e.dead = true; const [t] = team(W, ['c_jay']); p.x = 20; p.z = 0; t.x = 0; t.z = 0; W.player.inv = 1e9;     // стрелок не сбивает замах
  const w = spawnEnemy(W, 'witch', 6, 0); w.alert = true; w.taunt = { id: t.id, t: 99 }; w.thr = { [t.id]: 999 }; let under = false;
  run(W, 6, () => { t.hp = t.maxhp; if (W.haz.some(h => Math.hypot(h.x - t.x, h.z - t.z) < 1.5)) under = true; return under; }); ok(under, 'колдунья бьёт порчей героя, а не свою цель'); }
// 9. раненый колдун отходит от героя
{ const { W, p, e } = mk([]); e.dead = true; W.player.inv = 1e9; const w = spawnEnemy(W, 'witch', p.x + 2.5, p.z); w.alert = true; w.hp = w.maxhp * .2; const d0 = Math.hypot(w.x - p.x, w.z - p.z);
  run(W, 1); ok(Math.hypot(w.x - p.x, w.z - p.z) > d0 + 2, 'раненый колдун не отходит'); }
// 10. босс раз в фазу прыгает на дальнего лекаря
{ const { W, e } = mk([{ kind: 'blink', name: 'с', wind: .5, r: 3, mul: .01, cd: 3, range: 30 }]); const [t, h] = team(W, ['c_thorn', 'c_irga']); t.x = e.x - 2; t.z = e.z; h.x = e.x - 12; h.z = e.z + 3; W.player.x = e.x - 3; e.b.cd = 0;
  let hunts = 0, firstAt = null; for (let i = 0; i < 60 * 12; i++) { step(W, 1 / 60, {}); for (const v of W.ev) if (v.k === 'bossHunt') { hunts++; if (firstAt == null) firstAt = v.id; } W.ev.length = 0; t.hp = t.maxhp; h.hp = h.maxhp; }
  ok(hunts === 1 && firstAt === h.id, `охота на лекаря: ${hunts} раз, цель ${firstAt}`); }
// 11. без отряда босс выбирает приёмы как раньше (веса не трогают генератор)
{ const atks = [{ kind: 'slam', wind: .4, r: 3, mul: .1, cd: 2, range: 99 }, { kind: 'nova', wind: .4, r: 6, inner: 2, mul: .1, cd: 2, range: 99 }, { kind: 'pools', wind: .4, n: 2, r: 2, dur: 3, mul: .1, cd: 2, range: 99 }];
  const seq = on => { const { W, e } = mk(atks, 5, c => { c.bosses.smart.on = on; }); const out = []; let last = null; run(W, 20, () => { const A = e.b.atk; if (A && A !== last) { last = A; out.push(A.kind); } return false; }); return out.join(); };
  ok(seq(true) === seq(false), 'без отряда порядок приёмов босса изменился'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Умные спутники и враги 3D: OK');
