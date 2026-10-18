// Жизнь мира (этап 6): сбор (травы, руда, туши), ремёсла (кузнечное, алхимия, кожевенное — навык 0…max), ездовое животное,
// перелёты повозкой между лагерем и городами-узлами, репутация у четырёх сторон. Чистая логика без графики (Node-тесты).
// Числа — config3d.js → life. Состояние — W.life; в сохранение — serializeLife / sanitizeLife.
import { addItem } from './inv.js';
import { freeNear, relocate } from './fires3d.js';
import { nearBuilding, resolve } from './map.js';
import { zoneAt, zoneLevel } from './zones3d.js';
import { levelOfDepth, depthCurve } from './levels3d.js';
import { BY_ID } from './data/items.js';

const len = (x, z) => Math.hypot(x, z);
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const PROFS = { smith: 'Кузнечное дело', alch: 'Алхимия', leather: 'Кожевенное дело' };
export const lifeFresh = () => ({ prof: { smith: 0, alch: 0, leather: 0 }, rep: {}, mount: { owned: false, on: false }, coaches: { camp: 1 }, nodes: {} });
const L = W => W.life || (W.life = lifeFresh());
const safeNow = (W, r) => !W.enemies.some(e => !e.dead && e.alert && len(e.x - W.player.x, e.z - W.player.z) < r);

// ---------- сбор ----------
// точки сбора наверху: свой генератор (мир не сдвигается), не в домах, не у препятствий и воды, не ближе gap друг к другу
export function nodesOf(map, cfg) {
  const G = cfg.life && cfg.life.on && cfg.life.gather; if (!G) return [];
  const r = mul(cfg.world.seed * 6131 + 17), R = cfg.world.radius - 6, out = [], camp = map.camp, coreR = cfg.worldgen && cfg.worldgen.on ? Math.min(cfg.worldgen.coreR, R) : R;
  const nCore = R > coreR ? Math.min(G.core, G.n) : G.n;     // ядро — своя квота: иначе почти всё уходит в дальние пояса (их площадь больше)
  for (let k = 0; k < G.n * 30 && out.length < G.n; k++) {
    const inCore = out.length < nCore, a = r() * Math.PI * 2, d = inCore ? Math.sqrt(r()) * (coreR - 4) : coreR + Math.sqrt(r()) * (R - coreR), x = Math.sin(a) * d, z = Math.cos(a) * d;
    if (camp && len(x - camp.x, z - camp.z) < camp.r + 4) continue;
    if (out.some(q => len(q.x - x, q.z - z) < (inCore ? G.gapCore : G.gap))) continue;
    const s = freeNear(map, x, z, 3); if (!s) continue;
    const zn = zoneAt(cfg, s.x, s.z), w = G.kinds[zn && zn.ring >= 0 && zn.bio ? zn.bio : bioOf(cfg, zn)] || G.kinds.core, tot = Object.values(w).reduce((t, v) => t + v, 0);
    let pick = r() * tot, kind = Object.keys(w)[0]; for (const [kk, v] of Object.entries(w)) { if ((pick -= v) <= 0) { kind = kk; break; } }
    const lv = zoneLevel(cfg, s.x, s.z) ?? levelOfDepth(cfg, depthCurve(cfg, len(s.x, s.z)));
    out.push({ id: 'n' + out.length, kind, x: s.x, z: s.z, tier: lv < 20 ? 0 : lv < 40 ? 1 : 2 });
  }
  return out;
}
const bioOf = (cfg, zn) => { if (!zn || zn.ring < 0) return 'core'; for (const [bio, z] of Object.entries(cfg.zones.rings[zn.ring])) if (z.id === zn.id) return bio; return 'core'; };
const surf = W => (W.levels ? W.levels.surface.map : W.map);
export const nodeReady = (W, n) => !(L(W).nodes[n.id] > W.t);
export function nodeNear(W) {
  if (W.lvl && W.lvl !== 'surface') return null; const p = W.player; if (p.dead) return null;
  const G = W.cfg.life.gather; let best = null, bd = G.reach;
  for (const n of surf(W).nodes || []) { const d = len(n.x - p.x, n.z - p.z); if (d < bd && nodeReady(W, n)) { bd = d; best = n; } }
  return best;
}
// собрать точку рядом: 'ok' | 'none' | 'danger' (враги рядом) | 'full' (сумка полна — ничего не берётся)
export function gather(W, id) {
  const n = id ? (surf(W).nodes || []).find(q => q.id === id) : nodeNear(W), G = W.cfg.life.gather, p = W.player;
  if (!n || !nodeReady(W, n) || len(n.x - p.x, n.z - p.z) > G.reach || p.dead) return 'none';
  if (!safeNow(W, 6)) return 'danger';
  const got = []; for (const [item, k, ch] of G.yields[n.kind][n.tier]) if (W.rng() < ch) got.push([item, k]);
  const slots = W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0), tmp = { bag: JSON.parse(JSON.stringify(W.inv.bag)) };
  for (const [item, k] of got) if (addItem(tmp, item, k, slots) > 0) return 'full';
  W.inv.bag = tmp.bag; L(W).nodes[n.id] = W.t + G.respawn; dismount(W);
  W.ev.push({ k: 'gather', kind: n.kind, x: n.x, z: n.z, items: got });
  return 'ok';
}

// ---------- ремёсла ----------
export const profCap = W => Math.min(W.cfg.life.trades.max, W.cfg.life.trades.base + W.lv * W.cfg.life.trades.perLv);
export const profSkill = (W, prof) => L(W).prof[prof] || 0;
// цвет рецепта по разнице «навык − требование»: orange (растёт наверняка), yellow, green, grey (не растёт), red (рано)
export function recipeColor(W, r) {
  const s = profSkill(W, r.prof), d = s - (r.skill || 0); if (d < 0) return 'red';
  const c = W.cfg.life.trades.chance; return d < c[0][0] ? 'orange' : d < c[1][0] ? 'yellow' : d < c[2][0] ? 'green' : 'grey';
}
// после изготовления: навык растёт с шансом по цвету рецепта, не выше предела по уровню
export function tradeUp(W, r) {
  const P = L(W).prof, s = P[r.prof] || 0; if (s >= profCap(W)) return 0;
  const d = s - (r.skill || 0), q = W.cfg.life.trades.chance.find(([lim]) => d < lim), ch = q ? q[1] : 0;
  if (!(ch > 0) || W.rng() >= ch) return 0;
  P[r.prof] = s + 1; W.ev.push({ k: 'profUp', prof: r.prof, name: PROFS[r.prof], lv: s + 1 }); return 1;
}
// где можно ремеслом заняться: кузнечное — у кузнеца; алхимия и кожевенное — где угодно, если рядом нет врагов
export function tradeBlock(W, r) {
  if (r.prof === 'smith') return W.nearNpc === 'smith' ? null : 'far';
  return safeNow(W, W.cfg.life.trades.safeR) ? null : 'danger';
}

// ---------- ездовое животное ----------
export function mountToggle(W) {
  const M = L(W).mount, p = W.player;
  if (!M.owned) return 'none';
  if (M.on) { dismount(W); return 'off'; }
  if (p.dead) return 'dead';
  if ((W.lvl && W.lvl !== 'surface') || W.inside >= 0) return 'place';
  if (!safeNow(W, W.cfg.life.mount.safeR)) return 'danger';
  M.on = true; W.ev.push({ k: 'mount', on: true, x: p.x, z: p.z }); return 'on';
}
export function dismount(W) { const M = L(W).mount; if (!M.on) return false; M.on = false; W.ev.push({ k: 'mount', on: false, x: W.player.x, z: W.player.z }); return true; }
export const mountMul = W => (W.life && W.life.mount.on ? W.cfg.life.mount.speed : 1);
// удар, перекат или умение верхом — сначала спешиться (зовёт sim.js перед шагом героя)
export function mountInput(W, input) {
  if (!W.life || !W.life.mount.on) return;
  if (input.attackPress || input.attack || input.roll || input.abilQ || input.wskill || (W.lvl && W.lvl !== 'surface') || W.inside >= 0) dismount(W);
}

// ---------- повозки ----------
export function coachesOf(map, cfg) {
  if (!cfg.life || !cfg.life.on) return [];
  const out = [], camp = map.camp;
  if (camp) { const s = campSpot(map, camp.x + 5, camp.z + camp.r - 8); if (s) out.push({ id: 'camp', name: 'Лагерь', x: s.x, z: s.z }); }
  for (const p of cfg.map.places || []) if (p.hub) { const s = freeNear(map, p.x + 5, p.z + 4, 10); if (s) out.push({ id: p.id, name: p.name, x: s.x, z: s.z }); }
  return out;
}
// место внутри лагеря (у ворот): не у домов, не у препятствий, не в стене — по спирали до 8 м
function campSpot(map, x, z) {
  for (let r = 0; r <= 8; r += 1) for (let k = 0, n = Math.max(1, r * 3); k < n; k++) { const a = k / n * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
    if (!nearBuilding(map, px, pz, 2.5) && map.solids.every(q => len(q.x - px, q.z - pz) > q.r + 1.8) && !resolve(map, { x: px, z: pz }, 1.6) && len(px - map.camp.x, pz - map.camp.z) < map.camp.r - 3) return { x: px, z: pz }; }
  return null;
}
export const coachList = W => surf(W).coaches || [];
export function coachNear(W) {
  if ((W.lvl && W.lvl !== 'surface') || W.player.dead) return null; const p = W.player;
  return coachList(W).find(c => len(c.x - p.x, c.z - p.z) < W.cfg.life.coach.reach) || null;
}
export function discoverCoaches(W) {
  if (W.lvl && W.lvl !== 'surface') return; const p = W.player, C = L(W).coaches;
  for (const c of coachList(W)) if (!C[c.id] && len(c.x - p.x, c.z - p.z) < W.cfg.life.coach.open) { C[c.id] = 1; W.ev.push({ k: 'coachFound', name: c.name, x: c.x, z: c.z }); }
}
export const flightCost = (W, a, b) => Math.round(W.cfg.life.coach.base + len(a.x - b.x, a.z - b.z) * W.cfg.life.coach.perM);
// перелёт к открытой повозке id: 'ok' | 'far' | 'unknown' | 'same' | 'danger' | 'ash'
export function fly(W, id) {
  const from = coachNear(W), to = coachList(W).find(c => c.id === id);
  if (!from) return 'far'; if (!to || !L(W).coaches[id]) return 'unknown'; if (to.id === from.id) return 'same';
  if (!safeNow(W, W.cfg.life.coach.safeR)) return 'danger';
  const cost = flightCost(W, from, to); if (W.inv.ash < cost) return 'ash';
  W.inv.ash -= cost; dismount(W); relocate(W, to.x, to.z);
  W.ev.push({ k: 'travel', to: 'surface', up: false, coach: id, name: to.name, ash: cost });
  return 'ok';
}

// ---------- репутация ----------
export const factions = W => W.cfg.life.rep.factions;
export const repOf = (W, f) => L(W).rep[f] || 0;
export function tierOf(W, f) { const T = W.cfg.life.rep.tiers, v = repOf(W, f); let i = 0; while (i + 1 < T.length && v >= T[i + 1][0]) i++; return i; }
export function addRep(W, f, n) {
  if (!f || !(n > 0) || !factions(W).some(q => q.id === f)) return;
  const t0 = tierOf(W, f); L(W).rep[f] = repOf(W, f) + n; const t1 = tierOf(W, f);
  if (t1 > t0) W.ev.push({ k: 'repTier', f, name: factions(W).find(q => q.id === f).name, tier: W.cfg.life.rep.tiers[t1][1] });
}
// события шага → репутация: задания по тому, кто выдал; сцены — отряду; убийства — стороне места; боссы и подземелья — своей стороне
export function repEvents(W, from) {
  const R = W.cfg.life.rep, ev = W.ev;
  for (let i = from; i < ev.length; i++) {
    const v = ev[i];
    if (v.k === 'questdone') addRep(W, R.givers[v.giver], R.quest);
    else if (v.k === 'storyDone') addRep(W, 'band', R.scene);
    else if (v.k === 'die') { const f = sideAt(W, v.x, v.z); addRep(W, f, v.elite ? R.elite : R.kill); }
    else if (v.k === 'bossdead') addRep(W, sideAt(W, v.x, v.z), R.dungeons[W.lvl] ? R.dungeon : R.boss);
  }
}
function sideAt(W, x, z) {
  const R = W.cfg.life.rep; if (W.lvl && W.lvl !== 'surface') return R.dungeons[W.lvl] || null;
  const zn = zoneAt(W.cfg, x, z); return !zn || zn.ring < 0 ? 'zastava' : 'olkh';
}
export const priceRep = W => 1 - W.cfg.life.rep.brodDiscount * tierOf(W, 'brod');
// награды стороны: можно ли взять ('ok' | 'tier' | 'ash' | 'far' | 'have' | 'full') и взять
export function rewardStatus(W, i) {
  const r = W.cfg.life.rep.rewards[i]; if (!r) return 'none';
  if (r.mount ? L(W).mount.owned : r.item && BY_ID[r.item].cat === 'tome' && (W.known.tomes[BY_ID[r.item].tome] || W.inv.bag.some(s => s.id === r.item))) return 'have';
  if (tierOf(W, r.f) < r.tier) return 'tier';
  if (!['merchant', 'smith', 'captain'].includes(W.nearNpc)) return 'far';
  if (W.inv.ash < r.ash) return 'ash';
  return 'ok';
}
export function takeReward(W, i) {
  const st = rewardStatus(W, i); if (st !== 'ok') return st; const r = W.cfg.life.rep.rewards[i];
  if (r.mount) L(W).mount.owned = true;
  else if (addItem(W.inv, r.item, 1, W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0)) > 0) return 'full';
  W.inv.ash -= r.ash; W.ev.push({ k: 'reward', name: r.mount ? r.name : BY_ID[r.item].name }); return 'ok';
}

// ---------- сохранение ----------
export const serializeLife = W => { const S = L(W); return { prof: S.prof, rep: S.rep, mount: S.mount.owned ? 1 : 0, coaches: Object.keys(S.coaches) }; };
export function sanitizeLife(d, cfg) {
  const out = lifeFresh(); if (!d || typeof d !== 'object') return out; const C = cfg.life;
  for (const k of Object.keys(out.prof)) { const v = d.prof && d.prof[k]; if (Number.isFinite(v)) out.prof[k] = Math.max(0, Math.min(C.trades.max, Math.floor(v))); }
  for (const f of C.rep.factions) { const v = d.rep && d.rep[f.id]; if (Number.isFinite(v) && v > 0) out.rep[f.id] = Math.min(1e6, Math.floor(v)); }
  out.mount.owned = d.mount === 1;
  if (Array.isArray(d.coaches)) for (const id of d.coaches) if (typeof id === 'string' && id.length < 40) out.coaches[id] = 1;
  return out;
}
