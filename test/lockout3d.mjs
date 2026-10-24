// Основа подземелий и рейдов (план подземелий, этап 1, решение владельца 2026-10-24). Откат награды: вход и бой — всегда; именная добыча
// и печати — раз в период (подземелье — до полуночи, рейд — до понедельника); героик — свой откат, уровень не ниже обычного
// (max(свой, heroic.lv) + add), печати на героике — ×heroic; откат и включённый героик переживают сохранение;
// костёр перед финальным боссом (лечит, возврат после гибели); подсказка у входа (уровень, отряд, боссы, откат, «Опасно»).
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnBoss, killEnemy, refreshGear, respawnPlayer } from '../3d/src/sim.js';
import { travel, levelAt, setHeroic, portalInfo } from '../3d/src/levels3d.js';
import { nextMidnight, nextMonday, lockOf, lockHours, packLockout, sanitizeLockout } from '../3d/src/lockout3d.js';
import { applyDungeonState } from '../3d/src/save3d.js';
import { BY_ID } from '../3d/src/data/items.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const T0 = new Date(2026, 9, 21, 15, 0).getTime();     // среда, 15:00 по местному времени
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; c.corpse.on = false; const W = createWorld(c, mulberry32(11)); W.lv = 62; refreshGear(W); let t = T0; W.now = () => t; W.setNow = v => { t = v; }; return W; };
const at = (W, id) => { const L = W.levels[id], r = L.map.rooms.find(q => q.x1 - q.x0 > 6) || L.map.rooms[0]; travel(W, id, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2); };
const kill = (W, id, fin = true) => { const p = W.player, def = W.cfg.bosses.list.find(b => b.level === id && !!b.final === fin); const d0 = W.drops.length, s0 = W.inv.seals || 0, e = spawnBoss(W, { ...def, x: p.x + 2, z: p.z }); killEnemy(W, e, 1); const got = W.drops.slice(d0).map(q => q.id); return { e, gear: got.filter(id => BY_ID[id].slot).length, own: got.filter(id => (def.loot || []).includes(id)).length, seals: (W.inv.seals || 0) - s0 }; };

// часы отката
{ const m = nextMidnight(T0), d = new Date(m); ok(d.getHours() === 0 && d.getDate() === 22 && m > T0, 'полночь не следующая');
  const w = new Date(nextMonday(T0)); ok(w.getDay() === 1 && w.getHours() === 0 && w.getDate() === 26, 'понедельник не следующий: ' + w);
  const mon = new Date(2026, 9, 26, 10).getTime(); ok(new Date(nextMonday(mon)).getDate() === 2, 'в понедельник откат — до следующего понедельника'); }

const W = mk(), C = W.cfg.relic, dun = W.cfg.dungeons.list.find(d => d.inst && !d.raid && W.cfg.bosses.list.some(b => b.level === d.id && b.final && (b.loot || []).length)), raid = W.cfg.dungeons.list.find(d => d.raid);
// подземелье: первый раз — добыча и печать; второй раз в те же сутки — без именной добычи и печатей; после полуночи — снова
{ at(W, dun.id); const a = kill(W, dun.id); ok(a.own >= 1 && a.seals === C.drop.dungeon, `первое убийство: своих вещей ${a.own}, печатей ${a.seals}`);
  const b = kill(W, dun.id); ok(b.own === 0 && b.gear === 0 && b.seals === 0 && W.ev.some(v => v.k === 'lockout'), `на откате: своих ${b.own}, снаряжения ${b.gear}, печатей ${b.seals}`);
  ok(lockOf(W, dun.id) && lockHours(W, dun.id) === 9, 'часов до обновления: ' + lockHours(W, dun.id));
  const m = kill(W, dun.id, false); ok(m.seals === 0 && m.own >= 0, 'промежуточный босс дал печать');
  W.setNow(nextMidnight(T0) + 60000); const c = kill(W, dun.id); ok(c.own >= 1 && c.seals === C.drop.dungeon, 'после полуночи награда не вернулась'); }
// рейд: каждый босс — 3 печати раз в неделю; полночь не сбрасывает
{ W.setNow(T0); at(W, raid.id); const b1 = W.cfg.bosses.list.find(b => b.level === raid.id && !b.final);
  const k1 = (() => { const p = W.player, s0 = W.inv.seals || 0, e = spawnBoss(W, { ...b1, x: p.x + 2, z: p.z }); killEnemy(W, e, 1); return (W.inv.seals || 0) - s0; })();
  ok(k1 === C.drop.raid, 'печатей с босса рейда ' + k1); W.setNow(nextMidnight(T0) + 1000);
  const k2 = (() => { const p = W.player, s0 = W.inv.seals || 0, e = spawnBoss(W, { ...b1, x: p.x + 2, z: p.z }); killEnemy(W, e, 1); return (W.inv.seals || 0) - s0; })();
  ok(k2 === 0, 'рейд сбросился в полночь'); ok(lockOf(W, raid.id).until === nextMonday(T0), 'откат рейда не до понедельника'); }
// героик: уровень не ниже обычного, свой откат, печати ×heroic
{ W.setNow(T0 + 3600000); const hi = W.cfg.dungeons.list.filter(d => d.inst && !d.raid && (d.level || 0) > 62).sort((a, b) => b.level - a.level)[0] || dun;
  at(W, hi.id); const lv0 = levelAt(W, W.player.x, W.player.z); ok(setHeroic(W, hi.id, true), 'героик не включился');
  const lv1 = levelAt(W, W.player.x, W.player.z), H = W.cfg.instances.heroic; ok(lv1 === Math.max(lv0, H.lv) + H.add, `уровень героика ${lv1} при обычном ${lv0}`);
  at(W, dun.id); setHeroic(W, dun.id, true); const h = kill(W, dun.id); ok(h.seals === C.drop.dungeon * C.drop.heroic && h.own >= 1, `героик на откате обычного: печатей ${h.seals}, своих ${h.own}`); }
// сохранение: откат и героик переживают перезагрузку; просроченный откат отбрасывается
{ const pack = JSON.parse(JSON.stringify(packLockout(W))), s = sanitizeLockout(pack, W.now());
  ok(Object.keys(s).length >= 3, 'откат не сохранился: ' + Object.keys(s)); ok(!Object.keys(sanitizeLockout(pack, nextMonday(T0) + 8 * 86400000)).length, 'просроченный откат не отброшен');
  const W2 = mk(); W2.lv = 62; applyDungeonState(W2, { lockout: s, heroic: [dun.id] }); ok(lockOf(W2, dun.id, true) && W2.levels[dun.id].heroic, 'после загрузки нет отката или героика'); }

// костёр перед финальным боссом: есть в каждом подземелье с боссами, лечит, после гибели — возврат к нему; выход наверх гасит его
{ const W3 = mk(); W3.setNow(T0); const id = dun.id; at(W3, id); const F = W3.map.fire;
  ok(F && W3.map.rooms.some(r => F.x >= r.x0 && F.x <= r.x1 && F.z >= r.z0 && F.z <= r.z1), 'нет костра в подземелье или он вне залов');
  if (F) { const p = W3.player; travel(W3, id, F.x + 1, F.z); p.hp = p.maxhp * .3; p.calm = 0; W3.enemies.length = 0; for (let i = 0; i < 120; i++) step(W3, 1 / 60, {});
    ok(p.hp > p.maxhp * .3 + 1, 'костёр в подземелье не лечит'); ok(W3.dfire && W3.dfire.lvl === id, 'костёр не стал точкой возврата');
    p.x = F.x + 10; p.dead = true; respawnPlayer(W3); ok(W3.lvl === id && Math.hypot(p.x - F.x, p.z - F.z) < 3 && !p.dead, 'после гибели герой не у костра подземелья');
    travel(W3, 'surface', 0, 4); ok(!W3.dfire, 'выход наверх не погасил костёр'); } }
// подсказка у входа: уровень, отряд, боссы и откат; «Опасно» — если герой ниже
{ const W4 = mk(); W4.setNow(T0); const q = { to: dun.id, up: false }; W4.lv = 1; const a = portalInfo(W4, q); ok(a && /Рек\. \d+ ур\./.test(a.text) && /отряд 4/.test(a.text) && /боссов \d/.test(a.text) && a.warn && /Опасно/.test(a.text), 'подсказка у входа: ' + JSON.stringify(a));
  W4.lv = 80; at(W4, dun.id); kill(W4, dun.id); const b = portalInfo(W4, q); ok(!b.warn && /награда взята: 1/.test(b.text) && /обновится через 9 ч/.test(b.text), 'подсказка после убийства: ' + b.text);
  ok(portalInfo(W4, { to: 'surface', up: true }) === null, 'подсказка на выходе'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Откат подземелий 3D: OK (${dun.name}, ${raid.name})`);
