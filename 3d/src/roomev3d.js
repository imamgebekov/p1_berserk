// События залов (план подземелий, этап 2д, решение владельца 2026-10-24): в залах главного пути — одно-два события на заход:
// ambush — засада: когда герой входит в зал, врываются волны врагов; после последней — награда;
// trial — испытание у алтаря: подошёл к алтарю — выстоять trial.time с в зале под набегами; ушёл из зала или погиб — провал;
// captive — пленник под стражей: перебить стражу и подойти — благодарность и награда;
// thief — пепельный вор с добычей: вбегает в зал и удирает; догнать и убить — награда.
// Логика без графики; бой и добыча — через api из sim.js (без кругового импорта). Числа — config3d.js → dungeons.roomEvents.
export const ROOM_EVENTS = ['ambush', 'trial', 'captive', 'thief'];

// раскладка: залы главного пути — не первый, не боссы, не костёр, не ключевые; rooms — залы по номерам клеток
export function placeRoomEvents(cfg, def0, L, rooms, bossCells, fireN, rnd, props, spawns) {
  const R = cfg.dungeons.roomEvents; if (!R || !R.on) return [];
  const want = def0.raid ? R.raid : R.dungeon, out = [], kinds = ROOM_EVENTS.slice();
  const cand = L.path.slice(1).filter(n => !bossCells.has(n) && n !== fireN && !rooms[n].kind).map(n => rooms[n]);
  while (out.length < want && cand.length && kinds.length) {
    const r = cand.splice(Math.floor(rnd() * cand.length), 1)[0], kind = kinds.splice(Math.floor(rnd() * kinds.length), 1)[0];
    out.push({ kind, room: r.id, x: r.x, z: r.z });
    if (kind === 'trial') props.push({ t: 'shrine', x: r.x, z: r.z, r: 1, rot: 0 });     // алтарь испытания
    if (kind === 'captive') props.push({ t: 'chain', x: r.x - 1.2, z: r.z - .6, rot: Math.PI / 2 }, { t: 'chain', x: r.x + 1.2, z: r.z - .6, rot: -Math.PI / 2 });
    if (kind === 'ambush' || kind === 'trial') for (const s of spawns) if (s.room === r.id) s.n = 0;     // зал события — без обычных врагов
  }
  return out;
}
const inRoom = (api, W, ev, x, z) => { const ri = api.roomAt(W.map, x, z); return ri >= 0 && W.map.rooms[ri].id === ev.room; };
const edgePts = (api, W, ev, n, rng) => { const ri = W.map.rooms.findIndex(r => r.id === ev.room), r = W.map.rooms[ri], out = [];
  for (let k = 0; k < n * 6 && out.length < n; k++) { const a = rng() * Math.PI * 2, x = ev.x + Math.cos(a) * (r.x1 - r.x0) * .38, z = ev.z + Math.sin(a) * (r.z1 - r.z0) * .38; if (api.roomAt(W.map, x, z) === ri && api.free(W.map, x, z)) out.push({ x, z }); }
  return out; };
const foesOf = (W, ev) => ev.foes.filter(id => W.enemies.some(e => e.id === id && !e.dead)).length;
function spawnWave(api, W, ev, n) { const R = W.cfg.dungeons.roomEvents, def = W.levels[W.lvl].def, F = (def.foes || []).map(f => (Array.isArray(f) ? f[0] : f)).filter(t => W.cfg.enemies[t]), types = F.length ? F : R.types;     // foes — [вид, вес]
  for (const p of edgePts(api, W, ev, n, W.rng)) { const e = api.spawnEnemy(W, types[Math.floor(W.rng() * types.length)], p.x, p.z); e.alert = true; ev.foes.push(e.id); } }
function done(api, W, ev, table) { ev.st = 'done'; api.rewardDrop(W, table, ev.x, ev.z + 1.2); W.ev.push({ k: 'roomEvDone', kind: ev.kind, x: ev.x, z: ev.z }); }

// шаг под землёй; api = { spawnEnemy, rewardDrop, roomAt, free }
export function roomEventsTick(W, dt, api) {
  const R = W.cfg.dungeons.roomEvents, list = W.map.events; if (!R || !list || !list.length) return;
  const p = W.player;
  for (const ev of list) {
    if (ev.st === 'done' || ev.st === 'fail') continue;
    const here = !p.dead && inRoom(api, W, ev, p.x, p.z);
    if (ev.kind === 'ambush') {
      if (ev.st === 'idle' && here) { ev.st = 'fight'; ev.wave = 1; spawnWave(api, W, ev, R.ambush.n); W.ev.push({ k: 'roomEv', kind: 'ambush', x: ev.x, z: ev.z, wave: 1, of: R.ambush.waves }); }
      else if (ev.st === 'fight' && !foesOf(W, ev)) { if (ev.wave >= R.ambush.waves) done(api, W, ev, 'ironchest'); else { ev.wave++; spawnWave(api, W, ev, R.ambush.n + ev.wave - 1); W.ev.push({ k: 'roomEv', kind: 'ambush', x: ev.x, z: ev.z, wave: ev.wave, of: R.ambush.waves }); } }
    } else if (ev.kind === 'trial') {
      if (ev.st === 'idle' && here && Math.hypot(p.x - ev.x, p.z - ev.z) < R.trial.reach) { ev.st = 'run'; ev.t = R.trial.time; ev.next = 0; W.ev.push({ k: 'roomEv', kind: 'trial', x: ev.x, z: ev.z, t: ev.t }); }
      else if (ev.st === 'run') {
        if (!here || p.dead) { ev.st = 'fail'; W.ev.push({ k: 'roomEvFail', kind: 'trial', x: ev.x, z: ev.z }); continue; }
        ev.t -= dt; ev.next -= dt; if (ev.next <= 0) { ev.next = R.trial.every; spawnWave(api, W, ev, R.trial.n); }
        if (ev.t <= 0) { for (const id of ev.foes) { const e = W.enemies.find(q => q.id === id); if (e && !e.dead) { e.dead = true; e.deadT = 0; } } done(api, W, ev, 'altar'); }
      }
    } else if (ev.kind === 'captive') {
      if (ev.st === 'idle' && Math.hypot(p.x - ev.x, p.z - ev.z) < R.captive.wake) { ev.st = 'guard'; const g = api.addGuest(W, { x: ev.x, z: ev.z, hp: 1e6, name: R.captive.name, roomEv: true, lvl: W.lvl }); ev.guest = g.id; spawnWave(api, W, ev, R.captive.n); W.ev.push({ k: 'roomEv', kind: 'captive', x: ev.x, z: ev.z }); }
      else if (ev.st === 'guard' && !foesOf(W, ev) && Math.hypot(p.x - ev.x, p.z - ev.z) < R.captive.reach) { const i = W.allies.findIndex(a => a.id === ev.guest); if (i >= 0) W.allies.splice(i, 1); W.inv.ash += Math.round(R.captive.ash * Math.max(1, W.lv)); done(api, W, ev, 'cache'); }
    } else if (ev.kind === 'thief') {
      if (ev.st === 'idle' && here) { ev.st = 'run'; const e = api.spawnEnemy(W, 'ash_thief', ev.x, ev.z); e.alert = true; ev.foes.push(e.id); W.ev.push({ k: 'roomEv', kind: 'thief', x: ev.x, z: ev.z }); }
      else if (ev.st === 'run' && !foesOf(W, ev)) { const e = W.enemies.find(q => q.id === ev.foes[0]); done(api, W, { ...ev, x: e ? e.x : ev.x, z: e ? e.z : ev.z, st: ev.st }, 'ironchest'); ev.st = 'done'; }
      else if (ev.st === 'run' && (ev.t = (ev.t ?? R.thief.time) - dt) <= 0) { const e = W.enemies.find(q => q.id === ev.foes[0]); if (e && !e.dead) { e.dead = true; e.deadT = 0; e.gone = true; } ev.st = 'fail'; W.ev.push({ k: 'roomEvFail', kind: 'thief', x: ev.x, z: ev.z }); }     // не догнал за thief.time — вор ушёл
    }
  }
}
// строка трекера: что идёт сейчас
export function roomEventLine(W) {
  const R = W.cfg.dungeons.roomEvents, ev = (W.map.events || []).find(e => e.st === 'fight' || e.st === 'run' || e.st === 'guard'); if (!ev) return null;
  return ev.kind === 'ambush' ? `Засада: волна ${ev.wave} из ${R.ambush.waves}` : ev.kind === 'trial' ? `Испытание: продержитесь ${Math.ceil(ev.t)} с, не выходя из зала` : ev.kind === 'captive' ? 'Пленник: перебейте стражу и подойдите' : 'Пепельный вор: догоните и убейте';
}
