// Свои приёмы боссов (4.18б): у каждого босса новых подземелий и рейдов — свой именной приём; метеоры бьют стоящих на метке и не бьют
// ушедших; притяжение тянет героя к боссу; скачок ставит босса к цели; укрытие бьёт всех вне зелёного круга; подпитка лечит босса,
// пока жива подмога; финальный босс Престола Бездны встаёт во второй стадии и умирает только со второго раза.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnBoss, killEnemy } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const PLACES = CFG3.dungeons.list.filter(d => d.inst).map(d => d.id);     // план подземелий, 3а: свой приём — у боссов всех подземелий и рейдов

// 1. свои именные приёмы, имена не повторяются
{ const names = new Map();
  for (const id of PLACES) for (const b of CFG3.bosses.list.filter(q => q.level === id)) {
    const S = CFG3.bosses.sig[b.type]; ok(S && S.attacks.length && S.attacks.every(a => a.name), `${id}/${b.type}: нет своего приёма`);
    for (const a of (S && S.attacks) || []) { ok(!names.has(a.name), `приём «${a.name}» у ${b.type} и ${names.get(a.name)}`); names.set(a.name, b.type); } }
  ok(CFG3.bosses.sig.voidking.stage2 && CFG3.bosses.sig.voidking.stage2.attacks.length >= 5, 'у Короля Пустоты нет второй стадии'); }

// стенд: босс с одним приёмом, герой рядом и бессмертен по здоровью
const mk = (type, atk, extra = {}) => {
  const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.bosses.list = []; c.events.on = false; c.wanderer.on = false;
  c.bosses.sig = { [type]: { attacks: [atk], ...extra } }; c.bosses.phaseMoves = null;
  const W = createWorld(c, mulberry32(9)), p = W.player; W.lv = 60; p.hp = p.maxhp = 1e6;
  const e = spawnBoss(W, { type, x: p.x + 6, z: p.z, attacks: [], phases: [] }); e.alert = true; e.b.cd = 0; return { W, p, e };
};
const run = (W, sec, fn) => { for (let i = 0; i < sec * 60; i++) { if (fn && fn(i)) return true; step(W, 1 / 60, {}); } return false; };

// 2. метеоры: стоишь — больно, ушёл — цел
for (const stay of [true, false]) {
  const { W, p } = mk('bogwarden', { kind: 'meteor', name: 'т', wind: .3, n: 3, r: 2, arm: 1, mul: 2, cd: 99, range: 99, around: 6 });
  run(W, 4, () => (W.bzones || []).some(z => z.met)); const z = (W.bzones || []).find(q => q.met); ok(z, 'метеоры не упали');
  if (!z) continue; if (!stay) { p.x = z.x + 9; p.z = z.z; for (const q of W.bzones) q.x = z.x, q.z = z.z; }
  const hp0 = p.hp; run(W, 1.6); ok(stay ? p.hp < hp0 : p.hp === hp0, `метеор: ${stay ? 'стоял — без урона' : 'ушёл — получил урон'} (${hp0 - p.hp})`);
  ok(!(W.bzones || []).some(q => q.met), 'метка метеора не исчезла после удара'); }
// 3. притяжение
{ const { W, p, e } = mk('rootgnaw', { kind: 'pull', name: 'т', wind: .3, r: 14, force: 7, inner: 3.6, mul: 1, cd: 99, range: 14 });
  p.x = e.x - 11; p.z = e.z; const d0 = Math.hypot(p.x - e.x, p.z - e.z); let got = false;
  run(W, 3, () => { if (e.b.atk && e.b.atk.kind === 'pull') got = true; return got && !e.b.atk; }); const d1 = Math.hypot(p.x - e.x, p.z - e.z);
  ok(got && d1 < d0 - 4, `притяжение не тянет: ${d0.toFixed(1)} → ${d1.toFixed(1)}`); }
// 4. скачок
{ const { W, p, e } = mk('barghest', { kind: 'blink', name: 'т', wind: .3, r: 3, mul: 1, cd: 99, range: 30 });
  p.x = e.x - 16; p.z = e.z; e.b.home = { x: e.x, z: e.z }; const hp0 = p.hp; let got = false;
  run(W, 2, () => { if (e.b.atk && e.b.atk.kind === 'blink') got = true; return got && !e.b.atk; });
  ok(got && Math.hypot(p.x - e.x, p.z - e.z) < 4 && p.hp < hp0, `скачок: до героя ${Math.hypot(p.x - e.x, p.z - e.z).toFixed(1)} м, урон ${hp0 - p.hp}`); }
// 5. укрытие: в круге — цел, вне — больно
for (const inside of [true, false]) {
  const { W, p, e } = mk('drownchoir', { kind: 'safe', name: 'т', wind: 1, r: 3, safeD: 6, mul: 2, cd: 99, range: 99 }); let a = null;
  run(W, 2, () => { a = e.b.atk && e.b.atk.kind === 'safe' ? e.b.atk : a; return !!a; });
  if (!a) { ok(false, 'укрытие не начато'); continue; }
  p.x = inside ? a.x : a.x + 8; p.z = a.z; const hp0 = p.hp; run(W, 1.5, () => { if (inside) { p.x = a.x; p.z = a.z; } return false; });
  ok(inside ? p.hp === hp0 : p.hp < hp0, `укрытие: ${inside ? 'в круге — урон' : 'вне круга — без урона'}`); }
// 6. подпитка
{ const { W, p, e } = mk('thornlord', { kind: 'summon', type: 'ghoul', n: 2, cd: 99, range: 99 }, { drain: .05 }); e.hp = e.maxhp * .5;
  run(W, 2, () => e.b.minions.length > 0); for (const m of e.b.minions) { m.x = p.x + 40; m.z = p.z; } const h0 = e.hp; run(W, 2);
  ok(e.b.minions.length && e.hp > h0 + e.maxhp * .05, `подпитка не лечит: ${h0} → ${e.hp}`); }
// 7. вторая стадия Короля Пустоты
{ const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.map.places = []; c.bosses.list = []; c.events.on = false; c.wanderer.on = false;
  const W = createWorld(c, mulberry32(4)), p = W.player, def = CFG3.bosses.list.find(b => b.type === 'voidking');
  const e = spawnBoss(W, { ...def, level: undefined, x: p.x + 8, z: p.z }); e.hp = 0; W.ev.length = 0; killEnemy(W, e, 1);
  ok(!e.dead && e.hp > e.maxhp * .5 && e.stage === 2 && W.ev.some(v => v.k === 'bossphase' && /вторая стадия/.test(v.what)), 'Король Пустоты не встал во второй стадии');
  ok(e.b.def.attacks.some(a => a.kind === 'meteor') && e.b.def.attacks.some(a => a.kind === 'pull'), 'во второй стадии нет своих приёмов');
  e.hp = 0; killEnemy(W, e, 1); ok(e.dead, 'вторая стадия не умирает'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Свои приёмы боссов 3D: OK');
