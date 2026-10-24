// Подземелья 2.0 (4.15): генератор раскладки — все залы связаны, не перекрываются, число залов в пределах, боссы на главном пути
// в разных залах, вход внутри первого зала; одно зерно — одна раскладка. Заход в подземелье группы — каждый раз новая раскладка,
// враги, боссы и полные сундуки; сюжетные подземелья не меняются.
import { CFG3 } from '../3d/src/config3d.js';
import { genDef, mulberry } from '../3d/src/dungeongen3d.js';
import { makeLevelMap, roomAt, pathStep } from '../3d/src/map.js';
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

// двери и ключи (план подземелий, 2б): ключ каждой двери лежит в зале, куда можно дойти от входа без запертых дверей;
// железный сундук — за дверью; новый заход сбрасывает ключи подземелья
{ const LK = CFG3.dungeons.locks;
  for (const base of I) for (const seed of [5, 19]) {
    const nb = CFG3.bosses.list.filter(b => b.level === base.id).length, def = genDef(CFG3, { ...base, bosses: Array.from({ length: nb }, () => ({})) }, seed), M = makeLevelMap(CFG3, def), tag = `${base.id}#${seed}`;
    const lim = base.raid ? LK.raid : LK.dungeon, KD = M.doors.filter(d => !d.crack); ok(KD.length >= lim[0] && KD.length <= lim[1] && KD.every(d => d.lock && d.locked), `${tag}: запертых дверей ${KD.length}`);     // трещины тайников (2г) — не двери с ключом
    const reach = new Set([0]), q = [0]; while (q.length) { const r = q.shift(); for (const li of M.adj[r]) { const l = M.links[li]; if (M.doors.some(d => d.link === li && d.locked)) continue; const o = l.a === r ? l.b : l.a; if (!reach.has(o)) { reach.add(o); q.push(o); } } }
    for (const d of KD) { const kc = M.containers.find(c => c.key === d.lock), ri = kc ? roomAt(M, kc.x, kc.z) : -1; ok(kc && reach.has(ri), `${tag}: ключ ${d.lock} не достать без дверей`);
      const L = M.links[d.link], behind = reach.has(L.a) ? L.b : L.a; ok(!reach.has(behind) && M.containers.some(c => c.kind === 'ironchest' && roomAt(M, c.x, c.z) === behind), `${tag}: за дверью ${d.lock} нет железного сундука`); } }
  const W = createWorld((() => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; return c; })(), mulberry32(4)), id = I[0].id;
  travel(W, id, 0, 0); W.keys[id + '_k1'] = true; travel(W, 'surface', 0, 4); travel(W, id, 0, 0); ok(!W.keys[id + '_k1'], 'новый заход не сбросил ключи подземелья');
  ok(CFG3.dungeons.keys[id + '_k1'] && /ключ/.test(CFG3.dungeons.keys[id + '_k1']), 'у ключа нет имени'); }

// тайники (план подземелий, 2г): скрытый зал с «Тайником» за трещиной в стене зала; трещина не пускает, пока цела; удар рядом её рушит,
// просто подойти — нет; путь к тайнику до удара не строится
{ const SC = CFG3.dungeons.secrets;
  for (const base of I) for (const seed of [2, 23]) {
    const nb = CFG3.bosses.list.filter(b => b.level === base.id).length, def = genDef(CFG3, { ...base, bosses: Array.from({ length: nb }, () => ({})) }, seed), M = makeLevelMap(CFG3, def), tag = `${base.id}#${seed}`;
    const cr = M.doors.filter(d => d.crack), want = base.raid ? SC.raid : SC.dungeon; ok(cr.length >= 1 && cr.length <= want && cr.every(d => d.locked), `${tag}: трещин ${cr.length}`);
    for (const d of cr) { const hid = M.rooms.filter(r => r.crackDoor === d.id); ok(hid.length === 2 && hid.some(r => !r.corridor) && hid.some(r => r.corridor), `${tag}: за трещиной не зал с коридором`);
      const hall = hid.find(r => !r.corridor); ok(hall && M.containers.some(c => c.kind === 'cache' && roomAt(M, c.x, c.z) === hall.i), `${tag}: в тайнике нет «Тайника»`); }
    const halls = M.rooms.filter(r => !r.corridor); for (const a of halls) for (const b of halls) if (a !== b) ok(!(a.x0 < b.x1 - .01 && b.x0 < a.x1 - .01 && a.z0 < b.z1 - .01 && b.z0 < a.z1 - .01), `${tag}: залы ${a.id} и ${b.id} перекрываются`); }
  const W = createWorld((() => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; return c; })(), mulberry32(6)), id = I[0].id;
  travel(W, id, 0, 0); const d = W.map.doors.find(q => q.crack), p = W.player, hall = W.map.rooms.find(r => r.crackDoor === d.id && !r.corridor);
  ok(!pathStep(W.map, W.map.rooms[0].x0 + 2, (W.map.rooms[0].z0 + W.map.rooms[0].z1) / 2, (hall.x0 + hall.x1) / 2, (hall.z0 + hall.z1) / 2, W.keys), 'путь в тайник через целую трещину');
  W.enemies.length = 0; p.x = d.x + (d.vert ? -.9 : 0) * 1; p.z = d.z + (d.vert ? 0 : -.9); for (let i = 0; i < 30; i++) step(W, 1 / 60, {}); ok(d.locked && W.ev.some(v => v.k === 'crackNear'), 'трещина рухнула без удара или нет подсказки');
  for (let i = 0; i < 40 && d.locked; i++) { p.x = d.x + (d.vert ? -.9 : 0); p.z = d.z + (d.vert ? 0 : -.9); step(W, 1 / 60, { attack: true, attackPress: i % 10 === 0 }); }
  ok(!d.locked && W.ev.some(v => v.k === 'crack'), 'удар не пробил трещину'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Генератор подземелий 3D: OK');
