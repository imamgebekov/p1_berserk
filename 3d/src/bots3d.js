// Боты-«игроки» (план «живой мир», этап 5, владелец 2026-10-28 «живут сами»): бродят по местам своего уровня, бьют врагов, лутают свои тела,
// отдыхают, растут в уровне и меняют место, иногда помогают герою и говорят фразы. Список W.bots — не отряд: нет в сохранении и в окне отряда.
// Рядом с героем (bots.near) бот — в W.allies как гость: враги его видят и бьют (угроза, удары); дальше — дешёвый режим по таймерам.
// Свой поток случайных чисел (W.brng): бой героя и тесты не сдвигаются. Включаются в игре (main.js → initBots), в createWorld их нет.
import { len, clamp, TAU } from './util3d.js';
import { resolve, slide, insideOf, lineBlocked } from './map.js';
import { mulberry32, botKill } from './sim.js';
import { onSurface, levelAt, depthAt } from './levels3d.js';
import { addThreat } from './threat3d.js';
import { HERO_IDS, heroOf, heavyFor } from './data/heroes3d.js';
import { BY_ID } from './data/items.js';

const R = .45, SLOTS = ['head', 'body', 'boots', 'cloak'];
const rnd = (W, a, b) => a + W.brng() * (b - a);
const pickOf = (W, a) => a[Math.floor(W.brng() * a.length)];
const lvOf = (W, x, z) => clamp(Math.round(levelAt(W, x, z)), 1, 60);
// сколько снимает обычный удар врага в этом месте — по той же формуле, что у spawnEnemy (без опасности места и ночи)
function foeHit(W, x, z) {
  const E = W.cfg.enemies, C = W.cfg.bots, L = W.cfg.level, lv = levelAt(W, x, z), depth = Math.min(1, depthAt(W, x, z));
  const avg = C.ref.reduce((s, t) => s + E[t].damage, 0) / C.ref.length;
  return avg * (1 + E.depthDmg * depth) * (1 + Math.max(0, lv - L.core) * L.grow) * (W.dif ? W.dif.dmg : 1);
}
// вещи по уровню: редкость растёт с уровнем; оружие — из видов героя, броня — что герою по силам
let POOL = null;
function gearFor(W, a) {
  if (!POOL) { POOL = {}; for (const it of Object.values(BY_ID)) if (it.slot && it.rar) (POOL[it.slot] || (POOL[it.slot] = [])).push(it); }
  const top = clamp(1 + Math.floor(a.lv / 12), 1, 5), H = heroOf(a.hero), fit = l => l.filter(it => it.rar <= top && it.rar >= top - 1);
  a.eq = { weapon: null, offhand: null, head: null, body: null, cloak: null, boots: null, ring: null, amulet: null }; a.up = {}; a.il = {}; a.af = {}; a.gem = {};
  const w = fit((POOL.weapon || []).filter(it => H.kinds.includes(it.kind))); if (w.length) a.eq.weapon = pickOf(W, w).id;
  for (const s of SLOTS) { if (W.brng() > .35 + a.lv / 90) continue; const l = fit((POOL[s] || []).filter(it => !heavyFor(a.hero, it))); if (l.length) a.eq[s] = pickOf(W, l).id; }
}
function say(W, a, kind, force) {
  const C = W.cfg.bots; if (!a.near || a.dead || (!force && W.brng() < .5)) return;
  if (a.sayT > W.t || (W.botSayT || 0) > W.t) return;
  a.sayT = W.t + C.sayCd; W.botSayT = W.t + C.sayGap;
  W.ev.push({ k: 'allySay', x: a.x, z: a.z, text: pickOf(W, C.say[kind]), kind, bot: a.name });
}
// дома ботов: сёла и опасные места большого мира (без замков, городов и лагерей врагов)
function homesOf(W) {
  return (W.map.cfg.places || []).filter(p => p.type === 'hamlet' || (p.type === 'danger' && !p.castle && !p.city && !p.fort)).map(p => ({ x: p.x, z: p.z, r: p.r || 12, lv: lvOf(W, p.x, p.z) }));
}
// бот — только снаружи: стоит в доме — выходит за дверь
function outside(W, a) {
  const i = insideOf(W.map, a.x, a.z); if (i < 0) return;
  const b = W.map.buildings[i], o = b && b.door && b.door.out; if (o) { a.x = o.x; a.z = o.z; } resolve(W.map, a, R);
}
function newHome(W, a) {
  const H = W.botHomes, best = H.filter(h => Math.abs(h.lv - a.lv) <= 2); return best.length ? pickOf(W, best) : H.reduce((b, h) => (Math.abs(h.lv - a.lv) < Math.abs(b.lv - a.lv) ? h : b), H[0]);
}
function statsOf(W, a) {
  const C = W.cfg.bots, K = C.classes[a.hero], frac = a.maxhp ? a.hp / a.maxhp : 1;
  a.maxhp = Math.max(20, Math.round(C.hits * K.hp * foeHit(W, a.x, a.z))); a.hp = Math.max(1, Math.round(a.maxhp * frac));
}
export function initBots(W) {
  const C = W.cfg.bots; W.bots = []; if (!C || !C.on) return;
  W.brng = mulberry32((W.cfg.world.seed * 9157 + 17) | 0);
  const H = W.botHomes = homesOf(W); if (!H.length) return;
  const start = H.slice().sort((u, v) => u.lv - v.lv).slice(0, C.start), names = [...C.names];     // у начала — места самого малого уровня
  for (let i = 0; i < C.n && names.length; i++) {
    const h = i < C.start && start.length ? pickOf(W, start) : pickOf(W, H), hero = pickOf(W, HERO_IDS), lv = clamp(h.lv + Math.floor(rnd(W, -1, 3)), 1, 60);
    const name = names.splice(Math.floor(W.brng() * names.length), 1)[0], ang = rnd(W, 0, TAU), rr = rnd(W, 0, h.r);
    const b = { id: 100000 + i, bot: true, guest: true, type: 'bot', name, hero, T: { hero, ...C.classes[hero] }, lv, home: h, x: h.x + Math.sin(ang) * rr, z: h.z + Math.cos(ang) * rr,
      vx: 0, vz: 0, face: ang, hp: 1, maxhp: 0, state: 'idle', t: 0, cd: 0, dead: false, deadT: 0, flash: 0, moving: false, mode: 'roam', goal: null, idleT: 0, huntT: rnd(W, ...C.farKill), kills: 0, sayT: 0 };
    outside(W, b); gearFor(W, b); statsOf(W, b); b.hp = b.maxhp; W.bots.push(b);
  }
}
// уровень растёт от убийств; ушёл выше места на move — ищет место по силам
function gotKill(W, a) {
  const C = W.cfg.bots; a.kills++;
  if (a.kills % C.lvKills === 0 && a.lv < 60) { a.lv++; say(W, a, 'lvl', true); if (a.lv % 12 === 0) gearFor(W, a); if (a.lv > a.home.lv + C.move) { a.home = newHome(W, a); a.goal = null; } }
}
function wanderGoal(W, a) {
  const C = W.cfg.bots, h = a.home; let g = null;
  for (let k = 0; k < 6; k++) { const ang = rnd(W, 0, TAU), r = rnd(W, C.wander[0], h.r + C.wander[1]); g = { x: h.x + Math.sin(ang) * r, z: h.z + Math.cos(ang) * r }; if (insideOf(W.map, g.x, g.z) < 0) break; }     // не в дом
  return g;
}
// дешёвый режим вдали: идёт к цели напрямик, «убийства» — по таймеру, здоровье — полное
function farTick(W, a, dt) {
  const C = W.cfg.bots;
  if (a.dead) { if ((a.deadT += dt) > C.respawn) { a.dead = false; a.deadT = 0; a.x = a.home.x; a.z = a.home.z; a.hp = a.maxhp; a.mode = 'roam'; a.goal = null; } return; }
  a.hp = a.maxhp; a.state = 'idle'; a.loot = null;
  if (a.mode === 'rest') a.mode = 'roam';
  if (!a.goal) a.goal = wanderGoal(W, a);
  const dx = a.goal.x - a.x, dz = a.goal.z - a.z, d = len(dx, dz), s = C.speed * dt;
  if (d <= s) { a.x = a.goal.x; a.z = a.goal.z; a.goal = null; } else { a.x += dx / d * s; a.z += dz / d * s; a.face = Math.atan2(dx, dz); }
  if ((a.huntT -= dt) <= 0) { a.huntT = rnd(W, ...C.farKill); gotKill(W, a); }
}
function moveTo(W, a, tx, tz, dt, k = 1) {
  const dx = tx - a.x, dz = tz - a.z, d = len(dx, dz); if (d < .05) return d;
  const s = Math.min(d, W.cfg.bots.speed * k * dt), x0 = a.x, z0 = a.z; slide(W.map, a, dx / d * s, dz / d * s, R); a.face = Math.atan2(dx, dz); a.moving = true;
  if (len(a.x - x0, a.z - z0) < s * .25) { if ((a.stuck = (a.stuck || 0) + dt) > 1.5) { a.stuck = 0; a.goal = null; a.tgt = 0; a.loot = null; } } else a.stuck = 0;
  return d;
}
// враг для бота: помощь герою — первой (враг в бою рядом с героем), иначе ближний по силам
function pickFoe(W, a) {
  const C = W.cfg.bots, p = W.player, dp = len(p.x - a.x, p.z - a.z), help = !p.dead && dp < C.help && W.inside < 0;
  let best = null, bs = Infinity, helping = false;
  for (const e of W.enemies) {
    if (e.dead || e.boss || e.storyFoe || e.duel || (e.lvl || 1) > a.lv + C.gap || insideOf(W.map, e.x, e.z) !== -1) continue;
    const d = len(e.x - a.x, e.z - a.z), hp = help && e.alert && len(e.x - p.x, e.z - p.z) < 9;
    if (d > (hp ? C.help : C.sight)) continue;
    const s = d - (hp ? 20 : 0) - (e.tgt === a.id ? 6 : 0); if (s < bs) { bs = s; best = e; helping = hp; }
  }
  if (best && helping && !a.helped) { a.helped = true; say(W, a, 'help', true); }
  if (!best) a.helped = false;
  return best;
}
function botHit(W, a, e, dmg) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = .12; e.alert = true; e.botT = W.t + W.cfg.bots.hold; addThreat(W, e, a.id, dmg);
  const d = len(e.x - a.x, e.z - a.z) || 1, k = a.T.ranged ? .8 : 2.4; e.vx += (e.x - a.x) / d * k; e.vz += (e.z - a.z) / d * k;
  W.ev.push({ k: 'hit', x: e.x, z: e.z, dmg, crit: false, id: e.id, ally: true });
  if (e.hp <= 0) { botKill(W, e, a); gotKill(W, a); say(W, a, 'kill'); a.loot = { id: 'c' + e.id, x: e.x, z: e.z, t: 0 }; }
}
function strike(W, a, e) {
  const C = W.cfg.bots, dmg = Math.max(1, Math.round(e.maxhp * C.hit * a.T.dmg * rnd(W, .85, 1.15)));
  if (a.T.ranged) { const dx = e.x - a.x, dz = e.z - a.z, d = len(dx, dz) || 1;
    W.proj.push({ friendly: true, ally: a.id, bot: true, tgt: e.id, kind: a.T.role === 'heal' ? 'orb' : 'arrow', x: a.x + dx / d * .6, z: a.z + dz / d * .6, vx: dx / d * C.shot, vz: dz / d * C.shot, dmg, life: (a.T.range + 3) / C.shot, hit: [] });
    W.ev.push({ k: 'allyshoot', x: a.x, z: a.z, heal: a.T.role === 'heal' }); return; }
  if (len(e.x - a.x, e.z - a.z) <= a.T.range + W.cfg.enemies[e.type].radius + .6) botHit(W, a, e, dmg);
}
// стрелы и искры ботов: летят до первого врага (свои стрелы отряда — в squad3d.js)
function botShots(W, dt) {
  for (let i = W.proj.length - 1; i >= 0; i--) {
    const q = W.proj[i]; if (!q.bot) continue;
    q.life -= dt; const ox = q.x, oz = q.z; q.x += q.vx * dt; q.z += q.vz * dt;
    let end = q.life <= 0 || lineBlocked(W.map, ox, oz, q.x, q.z);
    if (!end) for (const e of W.enemies) { if (e.dead || len(e.x - q.x, e.z - q.z) > W.cfg.enemies[e.type].radius + .4) continue; const a = W.bots.find(b => b.id === q.ally); if (a) botHit(W, a, e, q.dmg); end = true; break; }
    if (end) { W.ev.push({ k: 'projend', x: q.x, z: q.z, friendly: true }); W.proj.splice(i, 1); }
  }
}
// лекарь лечит себя, других ботов рядом и героя в беде
function tryHeal(W, a) {
  const H = a.T.heal; if (!H || (a.hcd = (a.hcd || 0)) > 0) return false;
  const p = W.player, list = [...W.bots.filter(b => b.near && !b.dead), ...(p.dead ? [] : [p])];
  const t = list.filter(o => len(o.x - a.x, o.z - a.z) < 10 && o.hp < o.maxhp * .6).sort((u, v) => u.hp / u.maxhp - v.hp / v.maxhp)[0]; if (!t) return false;
  t.hp = Math.min(t.maxhp, t.hp + Math.round(t.maxhp * H[0])); a.hcd = H[1]; W.ev.push({ k: 'heal', x: t.x, z: t.z, amt: Math.round(t.maxhp * H[0]), ally: true });
  if (t === p) say(W, a, 'help');
  return true;
}
// полный режим рядом с героем
function nearTick(W, a, dt) {
  const C = W.cfg.bots; a.moving = false; a.flash = Math.max(0, a.flash - dt); a.cd -= dt; a.hcd = (a.hcd || 0) - dt;
  if (a.dead) { a.deadT += dt; return; }
  if (a.vx || a.vz) { slide(W.map, a, a.vx * dt, a.vz * dt, R); const k = Math.exp(-8 * dt); a.vx *= k; a.vz *= k; if (Math.abs(a.vx) + Math.abs(a.vz) < .05) a.vx = a.vz = 0; }
  if (a.state === 'wind' || a.state === 'rec') {
    const e = W.enemies.find(o => o.id === a.tgt && !o.dead); if (e) a.face = Math.atan2(e.x - a.x, e.z - a.z);
    a.t += dt;
    if (a.state === 'wind' && a.t >= a.T.wind) { a.state = 'rec'; a.t = 0; if (e) strike(W, a, e); }
    else if (a.state === 'rec' && a.t >= a.T.recover) { a.state = 'idle'; a.t = 0; a.cd = rnd(W, .1, .4); }
    return;
  }
  if (tryHeal(W, a)) return;
  if (a.mode !== 'rest' && a.hp < a.maxhp * C.low) { a.mode = 'rest'; a.tgt = 0; a.goal = null; say(W, a, 'low', true); }
  if (a.mode === 'rest') {
    const d = moveTo(W, a, a.home.x, a.home.z, dt);
    if (d < Math.max(3, a.home.r * .5)) { a.moving = false; a.hp = Math.min(a.maxhp, a.hp + a.maxhp * C.regen * dt); if (!a.rested) { a.rested = true; say(W, a, 'rest'); } }
    if (a.hp >= a.maxhp) { a.mode = 'roam'; a.rested = false; }
    return;
  }
  const e = pickFoe(W, a);
  if (e) {
    a.tgt = e.id; a.goal = null;
    const d = len(e.x - a.x, e.z - a.z), reach = a.T.range + W.cfg.enemies[e.type].radius;
    if (d > reach || (a.T.ranged && lineBlocked(W.map, a.x, a.z, e.x, e.z))) moveTo(W, a, e.x, e.z, dt);
    else { a.face = Math.atan2(e.x - a.x, e.z - a.z); if (a.cd <= 0) { a.state = 'wind'; a.t = 0; } }
    return;
  }
  a.tgt = 0;
  if (a.loot) {
    const L = a.loot, d = moveTo(W, a, L.x, L.z, dt);
    if ((L.w = (L.w || 0) + dt) > 10) a.loot = null;     // не дошёл — бросает
    else if (d < 1.4) { a.moving = false; if ((L.t += dt) > C.lootT) { lootCorpse(W, L.id); say(W, a, 'loot'); a.loot = null; } }
    return;
  }
  if (a.idleT > 0) { a.idleT -= dt; return; }
  if (!a.goal) a.goal = wanderGoal(W, a);
  if (moveTo(W, a, a.goal.x, a.goal.z, dt, .55) < .6) { a.goal = null; a.idleT = rnd(W, ...C.idle); }
}
// бот забирает своё: вещи из тела убитого им врага и само тело
function lootCorpse(W, id) {
  W.drops = W.drops.filter(q => q.corpse !== id);
  if (W.corpses) { const i = W.corpses.findIndex(c => c.id === id); if (i >= 0) W.corpses.splice(i, 1); }
}
// шаг: кто рядом — в бою (в W.allies как гость), кто далеко — по таймерам; вне большого мира ботов рядом нет
export function updateBots(W, dt) {
  const C = W.cfg.bots, on = onSurface(W);
  if (!W.bots) { if (W.wantBots && on) initBots(W); return; }     // мир с ботами — только в игре (main.js), и создаётся на поверхности: там уровни мест
  if (!W.bots.length) return;
  const p = W.player, inA = new Set(W.allies.filter(a => a.bot)); let n = 0;
  const order = W.bots.map(a => [len(a.x - p.x, a.z - p.z), a]).sort((u, v) => u[0] - v[0]);
  for (const [d, a] of order) {
    const keep = on && (!a.dead || a.deadT < C.rot) && d < C.near && n < C.cap;
    if (keep) { n++; if (!inA.has(a)) { outside(W, a); resolve(W.map, a, R); statsOf(W, a); W.allies.push(a); if (!a.greeted && d < 14) { a.greeted = true; a.near = true; say(W, a, 'hi'); } } }
    else if (inA.has(a)) { W.allies.splice(W.allies.indexOf(a), 1); if (a.dead) a.deadT = Math.max(a.deadT, C.rot); }
    a.near = keep;
    if (keep) { nearTick(W, a, dt); if (!a.greeted && d < 14) { a.greeted = true; say(W, a, 'hi'); } }
    else farTick(W, a, dt);
  }
  botShots(W, dt);
}
