// Дары Затмения (просьба владельца 2026-10-23): хранительница печатей в часовне лагеря продаёт 8 общих навыков за печати Затмения.
// Печати падают с боссов: подземелье — 1, рейд — 3 (Бездна — нет). Купить можно с minLv, цена — price; у героя один дар,
// свой у каждого героя (лежит в его сумке, как пепел). Новый дар вытесняет прежний — тот пропадает без возврата.
// Числа — config3d.js → relic. Урон наносится через W.fx.deal (без кольца импортов с sim.js).
const len = (x, z) => Math.hypot(x, z);
const R = W => W.cfg.relic;
const st = W => (W.rs ||= { cd: 0, n: 0, reap: 0, reapT: 0, storm: 0 });
export const perkOf = W => { const C = R(W), id = C && C.on && W.inv.perk; return id && C.perks[id] && W.lv >= C.minLv ? id : null; };
const P = (W, id) => (perkOf(W) === id ? R(W).perks[id] : null);
const base = W => W.cfg.player.attackDamage + (W.gear ? W.gear.dmg : 0);
const near = (W, x, z, r) => W.enemies.filter(o => !o.dead && len(o.x - x, o.z - z) < r);

// множитель урона героя: ярость берсерка (мало здоровья), жатва (за убийства), охотник за головами (элита и боссы)
export function relicMul(W, e) {
  const id = perkOf(W); if (!id) return 1;
  const p = W.player, K = R(W).perks[id], s = st(W);
  if (id === 'frenzy') return p.hp < p.maxhp * K.at ? 1 + K.dmg : 1;
  if (id === 'reap') return 1 + K.dmg * s.reap;
  if (id === 'bounty') return e && (e.boss || e.elite) ? 1 + K.dmg : 1;
  return 1;
}
export const relicLeech = W => { const K = P(W, 'frenzy'), p = W.player; return K && p.hp < p.maxhp * K.at ? K.leech : 0; };     // % от удара
export const relicSpd = W => { const K = P(W, 'frenzy'), p = W.player; return K && p.hp < p.maxhp * K.at ? K.spd : 0; };
export const relicRoll = W => { const K = P(W, 'ashstep'); return K ? K.rollcd : 0; };     // сколько секунд снять с перезарядки переката

// удар по герою: зеркальный щит ловит удар целиком и возвращает его атакующему; true — удар пойман
export function relicHurt(W, dmg, att) {
  const K = P(W, 'mirror'), s = st(W); if (!K || s.cd > 0) return false;
  s.cd = K.cd; W.player.inv = Math.max(W.player.inv, W.cfg.player.hurtInvuln);
  W.ev.push({ k: 'reflect', x: W.player.x, z: W.player.z, relic: 'mirror' });
  if (att && !att.dead) W.fx.deal(att, Math.round(Math.max(dmg, base(W)) * K.mul), 'storm');
  return true;
}
// смертельный удар: второе дыхание оставляет героя живым; true — смерть отменена
export function relicSave(W) {
  const K = P(W, 'undying'), s = st(W), p = W.player; if (!K || s.cd > 0) return false;
  s.cd = K.cd; p.hp = Math.round(p.maxhp * K.hp); p.inv = K.inv;
  for (const o of near(W, p.x, p.z, K.r)) { const d = len(o.x - p.x, o.z - p.z) || 1; o.vx += (o.x - p.x) / d * K.knock; o.vz += (o.z - p.z) / d * K.knock; }
  W.ev.push({ k: 'boom', x: p.x, z: p.z, r: K.r }); W.ev.push({ k: 'relic', id: 'undying', x: p.x, z: p.z });
  return true;
}
// попадание героя: каждый every-й удар — цепная молния по ближайшим
export function relicHit(W, e, dmg) {
  const K = P(W, 'chain'); if (!K || !e) return;
  const s = st(W); if (++s.n < K.every) return; s.n = 0;
  let from = e; const hit = new Set([e]);
  for (let k = 0; k < K.n; k++) {
    let best = null, bd = K.r; for (const o of W.enemies) { if (o.dead || hit.has(o)) continue; const d = len(o.x - from.x, o.z - from.z); if (d < bd) { bd = d; best = o; } }
    if (!best) break; hit.add(best); W.ev.push({ k: 'chain', x: from.x, z: from.z, x2: best.x, z2: best.z }); W.fx.deal(best, Math.max(1, Math.round(dmg * K.mul)), 'storm'); from = best;
  }
}
// перекат: пепельный шаг взрывается под ногами
export function relicRollBlast(W) {
  const K = P(W, 'ashstep'), p = W.player; if (!K) return;
  W.ev.push({ k: 'boom', x: p.x, z: p.z, r: K.r });
  for (const o of near(W, p.x, p.z, K.r)) { W.fx.deal(o, Math.round(base(W) * K.mul), 'fire'); }
}
// убийство: жатва (лечение и заряд урона), охотник за головами (пепел с элиты и боссов), печати с боссов
export function relicKill(W, e, share) {
  const C = R(W); if (!C || !C.on) return;
  const p = W.player, s = st(W), id = perkOf(W), K = id && C.perks[id];
  if (share >= 1 && id === 'reap' && !p.dead) { p.hp = Math.min(p.maxhp, p.hp + p.maxhp * K.heal); s.reap = Math.min(K.max, s.reap + 1); s.reapT = K.t; }
  if (share >= 1 && id === 'bounty' && (e.elite || e.boss) && !p.dead) { const n = Math.round((e.boss ? K.ashBoss : K.ash) * Math.max(1, W.lv)); W.inv.ash += n; W.ev.push({ k: 'ash', x: e.x, z: e.z, n }); }
  if (e.boss) { const L = W.levels && W.levels[W.lvl], d = L && L.def; if (d && !d.abyss) { const n = d.raid ? C.drop.raid : C.drop.dungeon; W.inv.seals = (W.inv.seals || 0) + n; W.ev.push({ k: 'seal', n, x: e.x, z: e.z }); } }
}
// каждый шаг: перезарядки, заряды жатвы, пепельная буря в бою
export function relicTick(W, dt) {
  const s = st(W); if (s.cd > 0) s.cd -= dt; if (s.reap && (s.reapT -= dt) <= 0) s.reap = 0;
  const K = P(W, 'storm'), p = W.player; if (!K || p.dead) return;
  if (s.storm > 0) { s.storm -= dt; return; }
  const foes = near(W, p.x, p.z, K.r); if (!foes.some(o => o.alert)) return;
  s.storm = K.cd; W.ev.push({ k: 'boom', x: p.x, z: p.z, r: K.r }); W.ev.push({ k: 'relic', id: 'storm', x: p.x, z: p.z });
  for (const o of foes) { W.fx.deal(o, Math.round(base(W) * K.mul), 'fire'); if (!o.dead) { const d = len(o.x - p.x, o.z - p.z) || 1; o.vx += (o.x - p.x) / d * K.knock; o.vz += (o.z - p.z) / d * K.knock; } }
}
// покупка у хранительницы: 'far' — не рядом, 'lv' — мал уровень, 'seals' — мало печатей, 'have' — этот дар уже есть
export function buyPerk(W, id) {
  const C = R(W); if (!C || !C.on || !C.perks[id]) return 'none';
  if (W.nearNpc !== C.npc) return 'far';
  if (W.lv < C.minLv) return 'lv';
  if (W.inv.perk === id) return 'have';
  if ((W.inv.seals || 0) < C.price) return 'seals';
  const old = W.inv.perk || null; W.inv.seals -= C.price; W.inv.perk = id; Object.assign(st(W), { cd: 0, n: 0, reap: 0, reapT: 0, storm: 0 });
  W.ev.push({ k: 'relic', id, old, x: W.player.x, z: W.player.z });
  return 'ok';
}
