// Боссы подземелий (план подземелий, этап 3): у каждого финального босса подземелья — вторая фаза на половине здоровья: новый приём и
// смена зала (flood — герой медленнее, collapse — горящий пол по краям, embers — пепел с потолка, dark — свет гаснет); реплики при
// встрече, на смене фазы и при гибели; гибель босса или уход с уровня снимают смену зала.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnBoss, killEnemy } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const S = CFG3.bosses.sig, D = CFG3.dungeons.list.filter(d => d.inst && !d.raid);
const finals = D.map(d => CFG3.bosses.list.find(b => b.level === d.id && b.final));
// данные
for (const b of finals) { const P = S[b.type] && S[b.type].p2; ok(P && P.add && P.add.name && ['flood', 'collapse', 'embers', 'dark'].includes(P.room) && P.say, `${b.level}/${b.type}: нет второй фазы`);
  ok(S[b.type].lines && S[b.type].lines.aggro && S[b.type].lines.death, `${b.type}: нет реплик`); }
ok(new Set(finals.map(b => S[b.type].p2 && S[b.type].p2.room)).size === 4, 'смены зала не всех четырёх видов');
// бой: герой рядом, бессмертный; босс в своём подземелье
const fight = b => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; c.dungeons.traps.on = false; c.dungeons.roomEvents.on = false;
  const W = createWorld(c, mulberry32(5)), p = W.player; W.lv = 60; travel(W, b.level, 0, 0); W.enemies.length = 0; p.hp = p.maxhp = 1e9;
  const e = spawnBoss(W, { ...b, x: p.x + 4, z: p.z }); return { W, p, e }; };
const run = (W, sec, f) => { for (let i = 0; i < Math.round(sec * 60); i++) { if (f) f(i); step(W, 1 / 60, {}); } };
const seen = new Set();
for (const b of finals) { const P = S[b.type].p2; if (seen.has(P.room)) continue; seen.add(P.room);
  const { W, p, e } = fight(b), evs = []; const keep = W.ev.push.bind(W.ev); W.ev.push = (...a) => { evs.push(...a); return keep(...a); };
  run(W, .5); ok(evs.some(v => v.k === 'bossSay' && v.text === S[b.type].lines.aggro), `${b.type}: нет реплики при встрече`);
  e.hp = e.maxhp * .49; run(W, .2); ok(e.b.p2 && e.b.extra.some(a => a.name === P.add.name), `${b.type}: вторая фаза не добавила приём`);
  ok(W.bossRoom && W.bossRoom.kind === P.room && evs.some(v => v.k === 'bossRoom') && evs.some(v => v.k === 'bossSay' && v.text === P.say), `${b.type}: нет смены зала или реплики фазы`);
  if (P.room === 'collapse') ok((W.bzones || []).filter(z => z.room).length >= 8, `${b.type}: пол по краям не горит`);
  if (P.room === 'embers') { e.b.cd = 99; run(W, CFG3.bosses.room.embers.every + 1, () => { e.hp = e.maxhp * .4; }); ok((W.bzones || []).some(z => z.met), `${b.type}: пепел не сыплется`); }
  if (P.room === 'flood') { const sp = () => { p.x = e.x + 6; p.z = e.z; const x0 = p.x; for (let i = 0; i < 30; i++) step(W, 1 / 60, { mx: 1, mz: 0 }); return p.x - x0; }, slow = sp(); const R = W.bossRoom; W.bossRoom = null; const fast = sp(); W.bossRoom = R;
    ok(slow < fast * .95, `${b.type}: в затопленном зале герой не медленнее (${slow.toFixed(2)} / ${fast.toFixed(2)})`); }
  killEnemy(W, e, 1); ok(!W.bossRoom && !(W.bzones || []).some(z => z.room) && evs.some(v => v.k === 'bossSay' && v.text === S[b.type].lines.death), `${b.type}: гибель не сняла смену зала или нет последних слов`); }
ok(seen.size === 4, 'проверены не все смены зала: ' + [...seen]);
// уход с уровня снимает смену зала
{ const b = finals[0], { W, e } = fight(b); run(W, .2); e.hp = e.maxhp * .49; run(W, .2); ok(W.bossRoom, 'нет смены зала'); travel(W, 'surface', 0, 4); ok(!W.bossRoom, 'смена зала осталась наверху'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Вторая фаза боссов подземелий 3D: OK (' + [...seen].join(', ') + ')');
