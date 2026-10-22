// Отряд: найм, бой, следование и лечение союзников.
import { len, clamp, rr } from './util3d.js';
import { pathGoal } from './path3d.js';
import { questEvent } from './quests3d.js';
import { insideOf, resolve, slide, pathStep, roomHops, insideCamp, campGates, lineBlocked } from './map.js';
import { killEnemy } from './sim.js';
import { hitsWall } from './foes3d.js';
import { addThreat, taunt } from './threat3d.js';
import { gearStats } from './inv.js';
import { BY_ID } from './data/items.js';

// снаряжение бойцов (2026-10-20, просьба владельца): нанятый — без вещей и слабее (cfg.squad.gear.naked); вещи из сумки
// надеваются на бойца так же, как на героя (хранятся в a.eq/up/il/af/gem, сумка общая). Правила вещей — героя по роли.
const SLOTS_A = ['weapon', 'offhand', 'head', 'body', 'cloak', 'boots', 'ring', 'amulet'];
export const allyGearOn = W => !!(W.cfg.squad.gear && W.cfg.squad.gear.on);
export const allyHeroOf = T => T.hero || (T.role === 'heal' ? 'irga' : T.ranged || T.role === 'ranged' ? 'jay' : 'thorn');     // чьи правила вещей у бойца
export function allyKit(a) { if (!a.eq) { a.eq = Object.fromEntries(SLOTS_A.map(s => [s, null])); a.up = {}; a.il = {}; a.af = {}; a.gem = {}; } return a; }
// «сумка» бойца для функций inv.js: его надетое, общая сумка героя
export const allyInv = (W, a) => { allyKit(a); return { bag: W.inv.bag, eq: a.eq, up: a.up, il: a.il, af: a.af, gem: a.gem, get ash() { return W.inv.ash; }, set ash(v) { W.inv.ash = v; } }; };
export function allyStats(W, a) { allyKit(a); return gearStats({ eq: a.eq, up: a.up, il: a.il, af: a.af, gem: a.gem }, [], W.cfg.smith.bonus); }
// пересчёт силы бойца после смены вещей: запас здоровья и урон
export function refreshAlly(W, a) {
  const T = W.cfg.squad.types[a.type]; if (!T || a.guest || a.story || a.decoy) return;
  const on = allyGearOn(W), g = on ? allyStats(W, a) : null; a.ghp = g ? g.hp : 0; a.gdmg = g ? g.dmg : 0; a.garmor = g ? g.armor : 0;
  const mh = allyMaxHpOf(W, a), frac = a.maxhp ? a.hp / a.maxhp : 1;
  a.maxhp = mh; a.hp = Math.max(1, Math.min(mh, Math.round(mh * frac)));
}
// запас здоровья бойца: по уровню героя, без вещей — меньше, плюс здоровье вещей
export const allyMaxHpOf = (W, a) => { const T = W.cfg.squad.types[a.type]; return allyGearOn(W) && !a.story && !a.guest && !a.lfg ? Math.max(1, Math.round(allyHp(W, T) * W.cfg.squad.gear.naked.hp + (a.ghp || 0))) : allyHp(W, T); };     // наёмник подземелья (4.07) — в полную силу
export const allyDmgOf = (W, a) => { const T = W.cfg.squad.types[a.type], G = W.cfg.squad.gear; return allyGearOn(W) && !a.story && !a.guest && !a.lfg ? allyDmg(W, T) * G.naked.dmg + (a.gdmg || 0) * G.dmgK : allyDmg(W, T); };
// вещи павшего или уволенного бойца — на землю
export function dropAllyGear(W, a) {
  if (!a.eq) return;
  for (const s of SLOTS_A) { const id = a.eq[s]; if (!id) continue; const ang = SLOTS_A.indexOf(s) * .79; W.drops.push({ id, n: 1, x: a.x + Math.sin(ang) * .8, z: a.z + Math.cos(ang) * .8, t: 0, cd: 0, mine: true, ...(a.up[s] ? { up: a.up[s] } : {}), ...(a.il[s] ? { il: a.il[s] } : {}), ...(a.af[s] ? { af: a.af[s] } : {}) }); a.eq[s] = null; }
}

// ---- отряд ----
export const squadMax = W => Math.min(W.cfg.squad.cap, W.cfg.squad.baseMax + Math.floor(W.lv / W.cfg.squad.perLevels));
export const liveAllies = W => W.allies.filter(a => !a.dead && !a.guest && !a.story);     // герои сюжета — не отряд     // подопечные событий (путник, обоз) — не отряд
export function pickAlly(W, e, dPlayer) {
  let best = null, bd = 8;
  for (const a of W.allies) { if (a.dead) continue; const d = len(a.x - e.x, a.z - e.z); if (d < bd && d < dPlayer + 1.5 && insideOf(W.map, a.x, a.z) === insideOf(W.map, e.x, e.z)) { bd = d; best = a; } }
  return best;
}
export function hurtAlly(W, a, dmg, e) {
  if (a.dead) return;
  { const L = liveOf(W); if (L && a.wallT > 0) dmg *= L.tank.wall.k; if (a.ward > 0) { const g = Math.min(a.ward, dmg); a.ward -= g; dmg -= g; } }     // Г7: стена щитов, оберег
  a.hp -= dmg * (a.taken ?? 1) / (1 + Math.max(0, a.garmor || 0) * W.cfg.gear.armorK); a.flash = .12; a.calm = 3;
  { const L = liveOf(W); if (L && a.hp > 0 && a.hp < a.maxhp * L.say.low) say(W, a, 'low'); }     // подопечные событий получают меньше (taken); броня бойца — как у героя
  const d = len(a.x - e.x, a.z - e.z) || 1; a.vx += (a.x - e.x) / d * 3; a.vz += (a.z - e.z) / d * 3;
  W.ev.push({ k: 'allyhurt', x: a.x, z: a.z, dmg });
  if (a.story && a.hp < 1) a.hp = 1;     // герои сюжета не гибнут: держатся на ногах
  if (a.hp <= 0) { a.hp = 0; a.dead = true; a.deadT = 0; if (!a.guest) W.ev.push({ k: 'allydead', x: a.x, z: a.z, name: W.cfg.squad.types[a.type].name }); }
}
// Г7 «Живые спутники» (4.13): навык бота — от номера и зерна мира, без генератора боя (бой и тесты не сдвигаются)
const liveOf = W => { const L = W.cfg.squad.live; return L && L.on ? L : null; };
const roleOfT = T => (T.role === 'tank' ? 'tank' : T.role === 'heal' ? 'heal' : T.ranged || T.role === 'ranged' ? 'ranged' : 'melee');
const hash = (a, k) => Math.abs(Math.sin((a + 1) * 12.9898 + k * 78.233) * 43758.5453) % 1;
export function skillOf(W, a) { const L = liveOf(W); if (!L) return 1; if (a.skill == null) a.skill = L.skill[0] + (L.skill[1] - L.skill[0]) * hash(a.id, W.cfg.world.seed % 997); return a.skill; }
const reactOf = (W, a) => { const L = liveOf(W), k = skillOf(W, a); return L ? L.react[0] + (L.react[1] - L.react[0]) * (k - L.skill[0]) / Math.max(.01, L.skill[1] - L.skill[0]) : 0; };
function say(W, a, kind) {
  const L = liveOf(W); if (!L || a.story || a.guest) return; const Q = L.say; W.sayT = W.sayT || 0;
  if ((a.sayCd || 0) > 0 || W.t < W.sayT) return; const lines = Q.lines[kind]; if (!lines) return;
  a.sayN = (a.sayN || 0) + 1; a.sayCd = Q.cd; W.sayT = W.t + Q.gcd;
  W.ev.push({ k: 'allySay', x: a.x, z: a.z, text: lines[Math.floor(hash(a.id + a.sayN * 31, 7) * lines.length)], kind });
}
// рост с уровнем героя (этап 4): бойцы не отстают от мира 1–60
export const allyHp = (W, T) => Math.round(T.hp * (1 + W.cfg.squad.lvHp * (W.lv - 1)));
export const allyDmg = (W, T) => T.dmg * (1 + W.cfg.squad.lvDmg * (W.lv - 1));
export function spawnAlly(W, type, hp) {
  const T = W.cfg.squad.types[type], p = W.player, ang = p.face + Math.PI + rr(W, -.8, .8), mh = allyHp(W, T);
  const a = { id: W.aid++, type, x: p.x + Math.sin(ang) * 1.8, z: p.z + Math.cos(ang) * 1.8, vx: 0, vz: 0, face: p.face, hp: hp || mh, maxhp: mh, state: 'idle', t: 0, cd: 0, dead: false, deadT: 0, flash: 0, calm: 0, tgt: 0, moving: false, hcd: 0, tcd: 0 };
  if (T.taken) a.taken = T.taken;
  if (!T.story && !T.decoy) { allyKit(a); refreshAlly(W, a); a.hp = hp ? Math.max(1, Math.min(a.maxhp, hp)) : a.maxhp; }     // без вещей — слабее (gear.naked); сохранённое здоровье — не выше запаса
  resolve(W.map, a, .45); W.allies.push(a); return a;
}
export const hireable = (W, id) => { const T = W.cfg.squad.types[id]; return !!T && !T.story && T.hero !== W.hero && !(T.hero && W.allies.some(a => !a.dead && a.type === id)); };     // спутник-герой — один, и не тот, кем играете
export function hireAlly(W, type) {
  const T = W.cfg.squad.types[type]; if (!T || T.story) return 'none';
  if (!hireable(W, type)) return 'taken';
  if (W.nearNpc !== 'captain') return 'far';
  if (liveAllies(W).length >= squadMax(W)) return 'full';
  if (W.inv.ash < T.cost) return 'ash';
  W.inv.ash -= T.cost; spawnAlly(W, type); questEvent(W, 'hire'); W.ev.push({ k: 'hire', name: T.name }); return 'ok';
}
export function dismissAlly(W, id) { const i = W.allies.findIndex(a => a.id === id); if (i < 0) return false; dropAllyGear(W, W.allies[i]); W.allies.splice(i, 1); return true; }     // вещи уволенного — на землю
export function restoreAllies(W, list) {
  W.allies.length = 0;
  for (const s of Array.isArray(list) ? list : []) { if (liveAllies(W).length >= squadMax(W)) break; const T = s && W.cfg.squad.types[s.type]; if (T && hireable(W, s.type)) { const mh = allyHp(W, T), a = spawnAlly(W, s.type, clamp(Number.isFinite(s.hp) ? Math.floor(s.hp) : mh, 1, mh)); if (s.kit) { Object.assign(allyKit(a), { eq: { ...a.eq, ...s.kit.eq }, up: { ...s.kit.up }, il: { ...s.kit.il }, af: { ...s.kit.af } }); refreshAlly(W, a); a.hp = clamp(Number.isFinite(s.hp) ? Math.floor(s.hp) : a.maxhp, 1, a.maxhp); } } }     // снаряжение бойца — из сохранения
}
// дом на пути: боец в другом доме, чем герой (или снаружи, когда герой внутри), — идёт через дверь, как враги
function doorGoal(W, a, p) {
  const ia = insideOf(W.map, a.x, a.z), ip = insideOf(W.map, p.x, p.z); if (ia === ip) return null;
  const near = (u, v) => len(u.x - v.x, u.z - v.z) < 1.2;
  if (ia >= 0) { const dr = W.map.buildings[ia].door; return near(a, dr.in) ? dr.out : dr.in; }
  const dr = W.map.buildings[ip].door; return near(a, dr.out) ? dr.in : dr.out;
}
// шаг с обходом: упёрся (продвинулся меньше трети шага) — пробует свернуть на 45° и 90°, сначала в ту же сторону, что в прошлый раз
function steer(W, a, ux, uz, dist) {
  const x0 = a.x, z0 = a.z;
  slide(W.map, a, ux * dist, uz * dist, .45);
  if (len(a.x - x0, a.z - z0) >= dist * .35 || dist < 1e-4) return;
  const side = a.side || 1;
  for (const k of [side * .8, -side * .8, side * 1.6, -side * 1.6]) {
    a.x = x0; a.z = z0; const c = Math.cos(k), s = Math.sin(k);
    slide(W.map, a, (ux * c + uz * s) * dist, (-ux * s + uz * c) * dist, .45);
    if (len(a.x - x0, a.z - z0) >= dist * .5) { a.side = Math.sign(k); return; }
  }
}
// частокол лагеря: боец и герой по разные стороны — через удобные ворота (сначала к точке перед проёмом, потом за него)
function campGoal(W, a, p) {
  const C = W.map.camp; if (!C) return null;
  const ia = insideCamp(C, a.x, a.z), ip = insideCamp(C, p.x, p.z); if (ia === ip) return null;
  const g = campGates(C).reduce((b, q) => (len(q.x - a.x, q.z - a.z) + len(q.x - p.x, q.z - p.z) < len(b.x - a.x, b.z - a.z) + len(b.x - p.x, b.z - p.z) ? q : b));
  const nx = (g.x - C.x) / C.r, nz = (g.z - C.z) / C.r, s = ia ? 1 : -1, before = { x: g.x - nx * 2 * s, z: g.z - nz * 2 * s }, past = { x: g.x + nx * 2.5 * s, z: g.z + nz * 2.5 * s };
  const along = Math.abs((a.x - g.x) * -nz + (a.z - g.z) * nx);          // насколько боец в стороне от оси ворот
  return along < C.gateW / 2 - .6 && len(a.x - g.x, a.z - g.z) < 3 ? past : before;
}
// ---- команды отряда (этап 4): «за мной», «держать», «моя цель» ----
export const partyOf = W => W.party || (W.party = { cmd: 'follow', hx: 0, hz: 0, mark: 0, last: 0 });
// цель для «моей цели»: кого герой бил последним, иначе ближайший встревоженный, иначе ближайший рядом
export function markTarget(W) {
  const P = partyOf(W), p = W.player, R = W.cfg.squad.cmd.pick, ip = insideOf(W.map, p.x, p.z);
  const ok = e => e && !e.dead && len(e.x - p.x, e.z - p.z) < R && insideOf(W.map, e.x, e.z) === ip;
  const last = W.enemies.find(e => e.id === P.last); if (ok(last)) return last;
  let best = null, bs = Infinity;
  for (const e of W.enemies) { if (!ok(e)) continue; const s = len(e.x - p.x, e.z - p.z) - (e.alert ? 4 : 0); if (s < bs) { bs = s; best = e; } }
  return best;
}
export function squadCommand(W, cmd) {
  const P = partyOf(W), p = W.player;
  if (!liveAllies(W).length) return 'empty';
  if (cmd === 'hold') Object.assign(P, { cmd: 'hold', hx: p.x, hz: p.z, mark: 0 });
  else if (cmd === 'assist') { const e = markTarget(W); if (!e) return 'none'; Object.assign(P, { cmd: 'assist', mark: e.id }); }
  else Object.assign(P, { cmd: 'follow', mark: 0 });
  W.ev.push({ k: 'squadCmd', cmd: P.cmd, x: p.x, z: p.z }); return 'ok';
}
// удар спутника: урон, угроза, толчок, прерывание замаха; ranged — толчок слабее
function allyHit(W, T, id, e, dmg, from, push = 1) {
  e.hp -= dmg; e.flash = .12; e.alert = true;
  addThreat(W, e, id, dmg * (T.threat || 1)); if (e.b && T.role === 'tank') e.b.kick = true;     // защитник сбивает чтение босса (этап 5)
  const d = len(e.x - from.x, e.z - from.z) || 1, C = W.cfg.enemies[e.type], k = 3 * push / (C.scale > 1.2 ? 2.2 : 1); e.vx += (e.x - from.x) / d * k; e.vz += (e.z - from.z) / d * k;
  if (e.state === 'wind' && push >= 1) { e.state = 'chase'; e.t = 0; e.cd = .3; }
  W.ev.push({ k: 'hit', x: e.x, z: e.z, dmg, crit: false, id: e.id, ally: true });
  if (e.hp <= 0) killEnemy(W, e, W.cfg.squad.xpShare);
}
function allyShot(W, a, T, e, k = 1) {
  const S = W.cfg.squad.shot, dx = e.x - a.x, dz = e.z - a.z, d = len(dx, dz) || 1;
  W.proj.push({ friendly: true, ally: a.id, type: a.type, kind: T.role === 'heal' ? 'orb' : 'arrow', x: a.x + dx / d * .6, z: a.z + dz / d * .6, vx: dx / d * S.speed, vz: dz / d * S.speed,
    dmg: Math.round(allyDmgOf(W, a) * k * rr(W, .9, 1.1)), life: (T.range + 3) / S.speed, hit: [] });
  W.ev.push({ k: 'allyshoot', x: a.x, z: a.z, heal: T.role === 'heal' });
}
// стрелы и искры спутников (свои стрелы героя летят в sim.js)
function updateShots(W, dt) {
  const S = W.cfg.squad.shot;
  for (let i = W.proj.length - 1; i >= 0; i--) {
    const q = W.proj[i]; if (!q.ally) continue;
    q.life -= dt; const ox = q.x, oz = q.z; q.x += q.vx * dt; q.z += q.vz * dt;
    let end = q.life <= 0 || hitsWall(W.map, q.x, q.z) || lineBlocked(W.map, ox, oz, q.x, q.z);
    if (!end) for (const e of W.enemies) { if (e.dead || len(e.x - q.x, e.z - q.z) > W.cfg.enemies[e.type].radius + S.hitR) continue; allyHit(W, W.cfg.squad.types[q.type], q.ally, e, q.dmg, { x: ox, z: oz }, .4); end = true; break; }
    if (end) { W.ev.push({ k: 'projend', x: q.x, z: q.z, friendly: true }); W.proj.splice(i, 1); }
  }
}
// лекарь: самого раненого (ниже below) рядом — героя или бойца; враги рядом с вылеченным злятся на лекаря
function tryHeal(W, a, T) {
  const H = T.heal, p = W.player; if (a.hcd > 0) return false;
  let best = null, br = H.below;
  for (const u of [...(p.dead ? [] : [p]), ...liveAllies(W)]) { const r = u.hp / u.maxhp; if (r < br && len(u.x - a.x, u.z - a.z) < H.r) { br = r; best = u; } }
  if (!best) return false;
  const got = Math.min(Math.round(H.amt * (1 + W.cfg.squad.lvHp * (W.lv - 1))), best.maxhp - best.hp); best.hp += got; a.hcd = H.cd;
  if (best !== a) a.face = Math.atan2(best.x - a.x, best.z - a.z);
  W.ev.push({ k: 'allyheal', x: best.x, z: best.z, amt: Math.round(got), fx: a.x, fz: a.z, me: best === p });
  const C = W.cfg.squad.threat, foes = W.enemies.filter(e => !e.dead && e.alert && len(e.x - best.x, e.z - best.z) < C.healR);
  for (const e of foes) addThreat(W, e, a.id, got * C.heal / foes.length);
  return true;
}
// защитник: вызов — враги рядом, что бьют не его, на время переключаются на него
function tryTaunt(W, a, T) {
  const U = T.taunt; if (a.tcd > 0) return;
  const ia = insideOf(W.map, a.x, a.z), near = e => !e.dead && e.alert && len(e.x - a.x, e.z - a.z) < U.r && insideOf(W.map, e.x, e.z) === ia;
  if (!W.enemies.some(e => near(e) && e.tgt !== a.id)) return;
  for (const e of W.enemies) if (near(e)) taunt(W, e, a, U.t);
  a.tcd = U.cd; W.ev.push({ k: 'taunt', x: a.x, z: a.z, r: U.r, name: T.name });
}
// опасность под ногами (этап 5): лужа босса или луч (горит или вот-вот загорится) — куда уходить, иначе null
function dangerAway(W, a) {
  if (liveOf(W)) { const r = reactOf(W, a); for (const h of W.haz) { if (h.t >= h.delay || h.t < r) continue; const ux = a.x - h.x, uz = a.z - h.z, d = len(ux, uz); if (d < h.r + .6) { say(W, a, 'dodge'); return d > 1e-3 ? { x: ux / d, z: uz / d } : { x: 1, z: 0 }; } } }     // Г7: круг атаки — прочь, когда заметил
  for (const z of W.bzones || []) { if (z.lvl !== W.lvl) continue; const ux = a.x - z.x, uz = a.z - z.z, d = len(ux, uz); if (d < z.r + .6) return d > 1e-3 ? { x: ux / d, z: uz / d } : { x: 1, z: 0 }; }
  for (const e of W.enemies) {     // 4.18б: при «Укрытии» — в зелёный круг, при «Скачке» — прочь с метки
    const B = e.boss && !e.dead && e.b, A = B && B.state === 'wind' && B.atk; if (!A || (A.kind !== 'safe' && A.kind !== 'blink')) continue;
    const ux = A.x - a.x, uz = A.z - a.z, d = len(ux, uz);
    if (A.kind === 'safe' && d > A.r * .6) return { x: ux / d, z: uz / d };
    if (A.kind === 'blink' && d < A.r + .6) return d > 1e-3 ? { x: -ux / d, z: -uz / d } : { x: 1, z: 0 };
  }
  for (const e of W.enemies) {
    const B = e.boss && !e.dead && e.b; if (!B || !B.atk || B.atk.kind !== 'beam' || (B.state !== 'beam' && B.state !== 'wind')) continue;
    const A = B.atk, ahead = (a.x - e.x) * A.dx + (a.z - e.z) * A.dz, side = (a.x - e.x) * A.dz - (a.z - e.z) * A.dx;
    if (ahead > 0 && ahead < A.len + 1 && Math.abs(side) < A.width / 2 + .8) { const s = side >= 0 ? 1 : -1; return { x: A.dz * s, z: -A.dx * s }; }
  }
  return null;
}
// цель спутника: «моя цель» — метка; «держать» — враги у точки; иначе ближайший рядом с ним и с героем. Защитник снимает врагов с других
function pickTarget(W, a, T, P, enemies) {
  const S = W.cfg.squad, p = W.player, ia = insideOf(W.map, a.x, a.z);
  if (P.cmd === 'assist') { const m = enemies.find(e => e.id === P.mark); if (m && insideOf(W.map, m.x, m.z) === ia) return m; }
  const hold = P.cmd === 'hold', reach = S.cmd.hold + (T.ranged ? T.range : 0);
  let tgt = null, bs = Infinity;
  for (const e of enemies) {
    const d = len(e.x - a.x, e.z - a.z);
    if (hold ? len(e.x - P.hx, e.z - P.hz) > reach : (d >= S.sight || len(e.x - p.x, e.z - p.z) >= S.sight + 8)) continue;
    if (insideOf(W.map, e.x, e.z) !== ia || roomHops(W.map, a.x, a.z, e.x, e.z) > 1) continue;   // в подземелье — враги своей и соседней комнаты
    const s = d - (T.role === 'tank' && e.alert && e.tgt !== a.id ? 5 : 0);
    if (s < bs) { bs = s; tgt = e; }
  }
  return tgt;
}
// Г7: место у цели — бойцы расходятся веером со стороны отряда, защитник встаёт против остальных (враг отворачивается от группы)
function slotDir(W, a, T, tgt, idx, live, L) {
  let cx = W.player.x, cz = W.player.z; for (const b of live) { cx += b.x; cz += b.z; } cx /= live.length + 1; cz /= live.length + 1;
  let ux = cx - tgt.x, uz = cz - tgt.z, u = len(ux, uz) || 1; ux /= u; uz /= u;
  if (T.role === 'tank') return { x: -ux, z: -uz };
  const k = (idx % 5 - 2) * L.spread + (skillOf(W, a) - .8) * .4, c = Math.cos(k), s = Math.sin(k); return { x: ux * c - uz * s, z: ux * s + uz * c };
}
// Г7: умения бойцов по роли (k1, k2 — перезарядки): защитник — стена щитов; боец — круговой удар и мощный по сильной цели; стрелок — залп и прицельный
function roleSkills(W, a, T, tgt, enemies) {
  const L = liveOf(W); if (!L || a.story) return false; const R = roleOfT(T), C = W.cfg.enemies[tgt.type], d = len(tgt.x - a.x, tgt.z - a.z), big = tgt.boss || tgt.elite, dmg = allyDmgOf(W, a);
  if (R === 'tank') { const Q = L.tank.wall; if (!(a.k1 > 0) && a.hp < a.maxhp * Q.below) { a.wallT = Q.t; a.k1 = Q.cd; W.ev.push({ k: 'allySkill', x: a.x, z: a.z, s: 'wall' }); } return false; }
  if (R === 'melee') {
    if (d > T.range + C.radius + .3) return false;
    const Q = L.melee.cleave, near = enemies.filter(e => len(e.x - a.x, e.z - a.z) < Q.r + W.cfg.enemies[e.type].radius);
    if (!(a.k1 > 0) && near.length >= Q.min) { for (const e of near) allyHit(W, T, a.id, e, Math.round(dmg * Q.k), a); a.k1 = Q.cd; a.state = 'rec'; a.t = 0; W.ev.push({ k: 'allySkill', x: a.x, z: a.z, s: 'cleave', r: Q.r }); return true; }
    const B = L.melee.burst; if (!(a.k2 > 0) && big) { allyHit(W, T, a.id, tgt, Math.round(dmg * B.k), a, 1.5); a.k2 = B.cd; a.state = 'rec'; a.t = 0; W.ev.push({ k: 'allySkill', x: tgt.x, z: tgt.z, s: 'burst' }); return true; }
    return false;
  }
  if (R === 'ranged') {
    if (d > T.range || lineBlocked(W.map, a.x, a.z, tgt.x, tgt.z)) return false;
    const Q = L.ranged.volley, near = enemies.filter(e => len(e.x - tgt.x, e.z - tgt.z) < 4);
    if (!(a.k1 > 0) && near.length >= Q.min) { const base = Math.atan2(tgt.x - a.x, tgt.z - a.z); for (let i = 0; i < Q.n; i++) { const g = base + (i - (Q.n - 1) / 2) * Q.fan; allyShot(W, a, T, { x: a.x + Math.sin(g) * 10, z: a.z + Math.cos(g) * 10 }); } a.k1 = Q.cd; a.state = 'rec'; a.t = 0; return true; }
    const B = L.ranged.aimed; if (!(a.k2 > 0) && big) { allyShot(W, a, T, tgt, B.k); a.k2 = B.cd; a.state = 'rec'; a.t = 0; return true; }
  }
  return false;
}
// Г7: лекарь — общее лечение, когда ранены двое и больше; оберег на защитника (поглощает урон)
function healSkills(W, a, T) {
  const L = liveOf(W); if (!L || a.story) return false; const p = W.player, H = T.heal, G = L.heal.group, all = [...(p.dead ? [] : [p]), ...liveAllies(W)].filter(u => len(u.x - a.x, u.z - a.z) < H.r);
  const hurt = all.filter(u => u.hp < u.maxhp * G.below);
  if (!(a.k1 > 0) && hurt.length >= G.min) { const amt = Math.round(H.amt * G.k * (1 + W.cfg.squad.lvHp * (W.lv - 1))); for (const u of hurt) { const got = Math.min(amt, u.maxhp - u.hp); u.hp += got; W.ev.push({ k: 'allyheal', x: u.x, z: u.z, amt: got, fx: a.x, fz: a.z, me: u === p }); } a.k1 = G.cd; say(W, a, 'gheal'); return true; }
  const tank = liveAllies(W).find(u => u !== a && W.cfg.squad.types[u.type].role === 'tank' && u.calm > 0 && !(u.ward > 0));
  if (!(a.k2 > 0) && tank && len(tank.x - a.x, tank.z - a.z) < H.r) { tank.ward = Math.round(tank.maxhp * L.heal.ward.amt); a.k2 = L.heal.ward.cd; W.ev.push({ k: 'allySkill', x: tank.x, z: tank.z, s: 'ward' }); return true; }
  return false;
}
export function updateAllies(W, dt) {
  const S = W.cfg.squad, p = W.player, P = partyOf(W), live = W.allies.filter(a => !a.dead && !a.guest), enemies = W.enemies.filter(e => !e.dead);     // в бою и строю — и герои сюжета (этап 7: раньше они стояли)
  for (let i = W.allies.length - 1; i >= 0; i--) { const a = W.allies[i]; if (a.dead) { a.deadT += dt; if (a.deadT > 1.4) { dropAllyGear(W, a); W.allies.splice(i, 1); } } }     // вещи павшего — на землю
  const back = () => { P.cmd = 'follow'; P.mark = 0; W.ev.push({ k: 'squadCmd', cmd: 'follow', auto: true }); };
  if (P.cmd === 'assist' && !enemies.some(e => e.id === P.mark)) back();                 // метка пала — снова за героем
  else if (P.cmd === 'hold' && (!liveAllies(W).length || len(p.x - P.hx, p.z - P.hz) > S.cmd.far)) back();     // герой ушёл далеко — догоняют
  updateShots(W, dt);
  live.forEach((a, idx) => {
    const T = S.types[a.type];
    { const mh = allyMaxHpOf(W, a); if (mh !== a.maxhp) { a.hp = Math.max(1, a.hp + mh - a.maxhp); a.maxhp = mh; } }     // уровень героя вырос — боец крепче
    if (a.flash > 0) a.flash -= dt; if (a.calm > 0) a.calm -= dt; if (a.hcd > 0) a.hcd -= dt; if (a.tcd > 0) a.tcd -= dt;
    if (a.sayCd > 0) a.sayCd -= dt; if (a.wallT > 0) a.wallT -= dt; if (a.k1 > 0) a.k1 -= dt; if (a.k2 > 0) a.k2 -= dt;     // Г7: реплики, стена щитов, два умения роли
    const px = a.x, pz = a.z;
    slide(W.map, a, a.vx * dt, a.vz * dt, .45); const kd = Math.exp(-8 * dt); a.vx *= kd; a.vz *= kd;
    { const v = a.state !== 'wind' && dangerAway(W, a); if (v) { a.state = 'idle'; a.face = Math.atan2(v.x, v.z); steer(W, a, v.x, v.z, T.speed * 1.2 * dt); a.moving = true; return; } }     // этап 5: из луж и с линии луча — прочь
    if (T.heal && a.state === 'idle' && healSkills(W, a, T)) { a.moving = false; return; }
    if (T.heal && a.state === 'idle' && tryHeal(W, a, T)) { a.moving = false; return; }
    if (T.taunt) tryTaunt(W, a, T);
    const tgt = pickTarget(W, a, T, P, enemies);
    if (tgt && a.state === 'idle' && roleSkills(W, a, T, tgt, enemies)) { a.moving = false; return; }
    if (tgt && tgt.boss && T.role === 'tank' && a.btg !== tgt.id) { a.btg = tgt.id; say(W, a, 'pull'); }
    if (a.btg && !tgt) { const b = W.enemies.find(e => e.id === a.btg); if (!b || b.dead) say(W, a, 'win'); a.btg = 0; }
    if (a.state === 'wind') {
      a.t += dt; if (a.tg && !a.tg.dead) a.face = Math.atan2(a.tg.x - a.x, a.tg.z - a.z);
      if (a.t >= T.wind) {
        a.state = 'rec'; a.t = 0;
        const e = a.tg;
        if (e && !e.dead && T.ranged) { if (len(e.x - a.x, e.z - a.z) <= T.range + 2) allyShot(W, a, T, e); }
        else if (e && !e.dead && len(e.x - a.x, e.z - a.z) <= T.range + W.cfg.enemies[e.type].radius + .5) allyHit(W, T, a.id, e, Math.round(allyDmgOf(W, a) * rr(W, .9, 1.1)), a);
      }
    } else if (a.state === 'rec') { a.t += dt; if (a.t >= T.recover) { a.state = 'idle'; a.t = 0; } }
    else if (tgt) {
      const C = W.cfg.enemies[tgt.type], dx = tgt.x - a.x, dz = tgt.z - a.z, d = len(dx, dz) || 1e-6;
      const wp = pathStep(W.map, a.x, a.z, tgt.x, tgt.z);       // цель в соседней комнате: через проход
      if (wp) { const wx = wp.x - a.x, wz = wp.z - a.z, wd = len(wx, wz) || 1e-6; a.face = Math.atan2(wx, wz); steer(W, a, wx / wd, wz / wd, T.speed * dt); }
      else if (T.ranged) {
        a.face = Math.atan2(dx, dz);
        if (d >= T.kite + 1) a.kt = 0;
        if (d > T.range * .9 || lineBlocked(W.map, a.x, a.z, tgt.x, tgt.z)) steer(W, a, dx / d, dz / d, T.speed * dt);
        else if (d < T.kite && (a.kt || 0) < 1.2) { a.kt = (a.kt || 0) + dt; steer(W, a, -dx / d, -dz / d, T.speed * dt); }     // враг близко — отходит, но не дольше 1,2 с подряд
        else { a.state = 'wind'; a.t = 0; a.tg = tgt; }
      } else {
        a.face = Math.atan2(dx, dz);
        const L = liveOf(W), sl = L && d > T.range + C.radius + 1.2 && d < T.range + C.radius + 4 ? slotDir(W, a, T, tgt, idx, live, L) : null;     // Г7: подходят к своему месту, а не все в одну точку
        if (sl && d > T.range + C.radius * .5) { const ox = tgt.x + sl.x * (T.range + C.radius * .5) * .75 - a.x, oz = tgt.z + sl.z * (T.range + C.radius * .5) * .75 - a.z, od = len(ox, oz) || 1e-6; steer(W, a, ox / od, oz / od, T.speed * dt); }
        else if (d > T.range + C.radius * .5) steer(W, a, dx / d, dz / d, T.speed * dt);
        else { a.state = 'wind'; a.t = 0; a.tg = tgt; }
      }
    } else {
      // строй: за героем позади него; «держать» — кольцом у точки; стрелки и лекари — чуть дальше
      const n = live.length, hold = P.cmd === 'hold';
      const ang = hold ? idx / n * Math.PI * 2 : p.face + Math.PI + (idx - (n - 1) / 2) * .95, r = (hold ? 1.6 : S.follow + (idx % 2) * .8) + (T.ranged ? 1.5 : 0);
      const cx = hold ? P.hx : p.x, cz = hold ? P.hz : p.z, sx = cx + Math.sin(ang) * r, sz = cz + Math.cos(ang) * r, dx = sx - a.x, dz = sz - a.z, d = len(dx, dz);
      const inHouse = insideOf(W.map, a.x, a.z) >= 0;
      const wp = hold ? pathStep(W.map, a.x, a.z, cx, cz) : pathStep(W.map, a.x, a.z, p.x, p.z) || (inHouse && doorGoal(W, a, p)) || campGoal(W, a, p) || doorGoal(W, a, p) || (!W.map.adj && pathGoal(W.map, a, p.x, p.z, dt));     // за рекой — через мост     // подземелье — проходы; наверху — выйти из дома, ворота лагеря, дверь дома героя
      if (!hold && len(p.x - a.x, p.z - a.z) > S.leash) { a.x = sx; a.z = sz; resolve(W.map, a, .45); }
      else if (wp) { const wx = wp.x - a.x, wz = wp.z - a.z, wd = len(wx, wz) || 1e-6; a.face = Math.atan2(wx, wz); steer(W, a, wx / wd, wz / wd, T.speed * 1.5 * dt); }
      else if (d > .9) { const sp = T.speed * (d > 6 ? 1.5 : 1); a.face = Math.atan2(dx, dz); steer(W, a, dx / d, dz / d, sp * dt); }
      // восстановление: вне боя понемногу, у костра быстро
      if (a.calm <= 0 && a.hp < a.maxhp) a.hp = Math.min(a.maxhp, a.hp + (W.lvl === 'surface' && len(a.x, a.z) < W.cfg.player.fire.radius ? S.fireRegen : S.regen) * dt);
    }
    a.moving = len(a.x - px, a.z - pz) > .4 * dt * 3;
    { const L = liveOf(W); if (L && !tgt && P.cmd !== 'hold') { if (len(p.x - a.x, p.z - a.z) > L.stuck[1] && len(a.x - px, a.z - pz) < .3 * dt) a.stk = (a.stk || 0) + dt; else a.stk = 0;     // Г7: застрял в нише — к герою
      if (a.stk > L.stuck[0]) { const g = p.face + Math.PI + (idx % 3 - 1) * .7; a.x = p.x + Math.sin(g) * 1.8; a.z = p.z + Math.cos(g) * 1.8; resolve(W.map, a, .45); a.stk = 0; } } }
  });
}
