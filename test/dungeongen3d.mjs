// Подземелья 2.0 (4.15): генератор раскладки — все залы связаны, не перекрываются, число залов в пределах, боссы на главном пути
// в разных залах, вход внутри первого зала; одно зерно — одна раскладка. Заход в подземелье группы — каждый раз новая раскладка,
// враги, боссы и полные сундуки; сюжетные подземелья не меняются.
import { CFG3 } from '../3d/src/config3d.js';
import { genDef, mulberry } from '../3d/src/dungeongen3d.js';
import { makeLevelMap, roomAt } from '../3d/src/map.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const G = CFG3.dungeons.gen, I = CFG3.dungeons.list.filter(d => d.inst);

for (const base of I) for (const seed of [1, 7, 42]) {
  const nb = CFG3.bosses.list.filter(b => b.level === base.id).length, def = genDef(CFG3, { ...base, bosses: Array.from({ length: nb }, () => ({})) }, seed), M = makeLevelMap(CFG3, def);
  const tag = `${base.id}#${seed}`, halls = M.rooms.filter(r => !r.corridor), lim = base.raid ? G.raid : G.dungeon;
  const seen = new Set([0]), q = [0]; while (q.length) { const r = q.shift(); for (const li of M.adj[r]) { const l = M.links[li], o = l.a === r ? l.b : l.a; if (!seen.has(o)) { seen.add(o); q.push(o); } } }
  ok(seen.size === M.rooms.length, tag + ': не все залы связаны');
  ok(halls.length >= lim[0] * .8 && halls.length <= lim[1], `${tag}: залов ${halls.length}, ждём ${lim.join('–')}`);
  let over = 0; for (let a = 0; a < M.rooms.length; a++) for (let b = a + 1; b < M.rooms.length; b++) { const A = M.rooms[a], B = M.rooms[b]; if (Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > .01 && Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0) > .01) over++; }
  ok(!over, `${tag}: перекрытий залов ${over}`);
  ok(roomAt(M, def.entry.x, def.entry.z) === 0, tag + ': вход не в первом зале');
  const br = def.bosses.map(b => b.room); ok(new Set(br).size === br.length && br.every(Boolean), `${tag}: боссы в одном зале или без зала`);
  ok(def.spawns.reduce((a, s) => a + s.n, 0) >= halls.length * 2, tag + ': врагов мало');
  if (seed === 1) { const d2 = genDef(CFG3, { ...base, bosses: Array.from({ length: nb }, () => ({})) }, 1); ok(JSON.stringify(d2.rooms) === JSON.stringify(def.rooms), tag + ': одно зерно — разные раскладки'); }
}
// заход: новая раскладка каждый раз; враги, боссы, сундуки
{ const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(5));
  const id = 'inst_moss', d = c.dungeons.list.find(q => q.id === id), lay = [];
  for (let k = 0; k < 2; k++) {
    travel(W, id, d.entry.x, d.entry.z); step(W, 1 / 60, {}); const L = W.levels[id];
    lay.push(JSON.stringify(L.map.rooms.map(r => [r.x0, r.z0, r.x1, r.z1])));
    ok(W.lvl === id && roomAt(L.map, W.player.x, W.player.z) === 0, 'герой не у входа новой раскладки');
    ok(W.enemies.filter(e => !e.dead && !e.boss).length >= 35, 'врагов в подземелье мало: ' + W.enemies.length);     // 14–20 залов — около 50 врагов
    ok(W.enemies.filter(e => e.boss).length === c.bosses.list.filter(b => b.level === id).length, 'не все боссы на месте');
    ok(L.map.containers.length > 0 && L.map.containers.every(q => q.items && q.items.length), 'сундуки пустые или их нет');
    ok(W.enemies.filter(e => e.boss).every(e => roomAt(L.map, e.x, e.z) >= 0), 'босс вне залов');
    travel(W, 'surface', d.back.x, d.back.z);
  }
  ok(lay[0] !== lay[1], 'второй заход — та же раскладка');
  const cr = c.dungeons.list.find(q => q.id === 'crypt_pogost'), r0 = JSON.stringify(W.levels.crypt_pogost.map.rooms.map(r => [r.x0, r.z0]));
  travel(W, 'crypt_pogost', cr.entry.x, cr.entry.z); ok(JSON.stringify(W.levels.crypt_pogost.map.rooms.map(r => [r.x0, r.z0])) === r0, 'сюжетное подземелье поменяло раскладку'); }

// ключевые залы (план подземелий, 2а): залы боссов — по таблице и по порядку боссов, особые — в стороне от пути; одни и те же
// архетипы при любом зерне; обстановка внутри залов, твёрдые предметы — в карте и не на месте босса
{ const K = CFG3.dungeons.keyRooms;
  for (const base of I) { const T = K.list[base.id]; ok(T, `${base.id}: нет ключевых залов в таблице`); if (!T) continue;
    const nb = CFG3.bosses.list.filter(b => b.level === base.id).length, kinds = [];
    for (const seed of [3, 11]) { const def = genDef(CFG3, { ...base, bosses: Array.from({ length: nb }, () => ({})) }, seed), M = makeLevelMap(CFG3, def), tag = `${base.id}#${seed}`;
      const bk = def.bosses.map(b => (def.rooms.find(r => r.id === b.room) || {}).kind); ok(bk.every((k, i) => k === T.boss[Math.min(i, T.boss.length - 1)]), `${tag}: залы боссов ${bk} вместо ${T.boss}`);
      const sp = def.rooms.filter(r => r.kind && !def.bosses.some(b => b.room === r.id)).map(r => r.kind); ok(sp.length >= 1 && sp.every(k => T.special.includes(k)), `${tag}: особые залы ${sp}`); kinds.push(bk.join() + '|' + sp.join());
      for (const q of def.props) { const r = M.rooms.find(o => !o.corridor && q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1); ok(r && r.kind, `${tag}: предмет ${q.t} вне ключевого зала`); }
      ok(def.props.filter(q => q.r).every(q => M.solids.some(o => o.x === q.x && o.z === q.z)), `${tag}: твёрдый предмет не в карте`);
      for (const b of def.bosses) { const r = def.rooms.find(o => o.id === b.room); ok(!def.props.some(q => q.r && Math.hypot(q.x - r.x, q.z - r.z) < q.r + 1.5), `${tag}: предмет на месте босса`); } }
    ok(kinds[0].split('|')[0] === kinds[1].split('|')[0], `${base.id}: залы боссов меняются от зерна`); } }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Генератор подземелий 3D: OK');
