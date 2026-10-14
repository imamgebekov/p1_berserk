// Тест оружия 3D: умения типов, свойства, статусы, реакции, комбо, цепочка, рывок-удар, статусы героя, каталог.
import { CFG3 } from '../3d/src/config3d.js';
import { CATALOG, BY_ID } from '../3d/src/data/items.js';
import { TRAITS, PERKS, UNIQUES, ELEMENTS } from '../3d/src/data/weapons3d.js';
import { createWorld, step, spawnEnemy, useItem, respawnPlayer } from '../3d/src/sim.js';
import { applyStatus } from '../3d/src/status3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const near = (a, b, t = .6) => Math.abs(a - b) <= t;

// ---- каталог ----
{ const wp = CATALOG.filter(i => i.slot === 'weapon'); ok(wp.every(i => i.kind && TRAITS[i.kind] && i.text && Array.isArray(i.perks)), 'у оружия нет типа, текста или свойств');
  ok(wp.every(i => i.perks.every(p => PERKS[p])), 'неизвестное свойство'); ok(UNIQUES.length === 16 && wp.filter(i => i.pool === 'unique').length === 16, 'уникальных клинков должно быть 16');
  ok(wp.filter(i => i.perks.length && i.pool === 'weapon').length >= 20, 'мало оружия со свойствами'); ok(wp.filter(i => /Пламенн|Ледян|Ядовит|Грозов/.test(i.name)).length === ELEMENTS.length * 3, 'зачарованных клинков 12');
  for (const u of wp.filter(i => i.pool === 'unique')) ok(u.perks.length >= 1 && u.rar === 4 && u.value >= 400, 'уникальный клинок слабоват: ' + u.name);
  ok(CATALOG.length <= 500, 'каталог превысил 500: ' + CATALOG.length);
  ok(new Set(wp.map(i => i.kind)).size === Object.keys(TRAITS).length - 1, 'не каждому умению типа есть оружие'); }

// ---- стенд ----
function mk(weapon, R0 = .5) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.player.autoAim = 0;
  let R = R0; const W = createWorld(cfg, () => R); W.setR = v => { R = v; };
  W.inv.eq.weapon = weapon; W.player.x = 0; W.player.z = 0; W.player.face = Math.PI / 2; W.player.inv = 1e9; step(W, 1 / 60, {}); return W;
}
const foe = (W, ang = 0, d = 1.6, type = 'brute') => { const a = Math.PI / 2 + ang; const e = spawnEnemy(W, type, Math.sin(a) * d, Math.cos(a) * d); e.hp = e.maxhp = 1e6; e.alert = true; e.state = 'rec'; e.t = -1e9; e.face = Math.atan2(-Math.sin(a), -Math.cos(a)); return e; };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };
// одиночный удар: до первого события hit
function swing(W) { W.ev.length = 0; let ev = []; for (let i = 0; i < 90; i++) { step(W, 1 / 60, { attack: i < 2 }); ev = ev.concat(W.ev.filter(v => v.k === 'hit')); W.ev.length = 0; if (ev.length && i > 30) break; } return ev; }
const dmgOf = (w, setup) => { const W = mk(w); const e = foe(W); if (setup) setup(W, e); const ev = swing(W); return ev.length ? ev[0].dmg : 0; };
const base = w => CFG3.player.attackDamage + (w ? BY_ID[w].stats.dmg || 0 : 0);

// ---- умения типов ----
// дуга: враг под углом от направления удара
{ const hit = (w, deg) => { const W = mk(w); const e = foe(W, deg * Math.PI / 180); return swing(W).length > 0; };
  ok(hit('w_sword_iron', 60) && !hit('w_sword_iron', 95), 'меч: дуга 150°'); ok(hit('w_spear_iron', 20) && !hit('w_spear_iron', 45), 'копьё: узкий укол'); ok(hit('w_greatsword_iron', 120) && !hit('w_greatsword_iron', 140), 'двуручник: 260°');
  ok(hit('w_scythe_iron', 110), 'коса 230°'); ok(hit('w_sickle_iron', 95) && !hit('w_sickle_iron', 105), 'серп 200°'); ok(hit('w_chain_ball_iron', 145), 'кистень 300°'); }
// слева и справа симметрично
{ const W = mk('w_spear_iron'); foe(W, .3, 1.6, 'imp'); foe(W, -.3, 1.6, 'imp'); ok(swing(W).length >= 2, 'копьё слева/справа'); }
// удар в спину: кинжал ×2,2 по незаметившему и отвернувшемуся
{ const norm = dmgOf('w_dagger_iron'), unaware = dmgOf('w_dagger_iron', (W, e) => { e.alert = false; }), away = dmgOf('w_dagger_iron', (W, e) => { e.face = Math.PI / 2; });
  ok(unaware > norm * 1.9 && away > norm * 1.9, `кинжал в спину: ${norm} → ${unaware}/${away}`); const s = dmgOf('w_sword_iron', (W, e) => { e.alert = false; }); ok(near(s, dmgOf('w_sword_iron'), 1), 'меч не должен бить в спину сильнее'); }
// крит: клевец ×2,6, рапира ×2,2 против меча ×1,7 (R=0: крит всегда, множитель урона .9)
{ const crit = w => { const W = mk(w, 0); foe(W); return swing(W)[0].dmg; };
  const sw = crit('w_sword_iron'), pk = crit('w_pick_iron'), rp = crit('w_rapier_iron');
  ok(near(sw / (base('w_sword_iron') * .9), 1.7, .12) && near(pk / (base('w_pick_iron') * .9), 2.6, .15) && near(rp / (base('w_rapier_iron') * .9), 2.2, .15), `множители крита: ${sw} ${pk} ${rp}`); }
// оглушение булавой (R=0): оглушённый не двигается и не бьёт; проходит
{ const W = mk('w_mace_iron', 0); const e = foe(W, 0, 1.6, 'imp'); e.state = 'chase'; e.cd = 0; e.hp = e.maxhp = 1e6; swing(W); ok(e.st && e.st.stun, 'булава не оглушила'); const x0 = e.x; e.state = 'chase'; run(W, .5, {}); ok(near(e.x, x0, .5) && e.state === 'chase', 'оглушённый двигается: ' + (e.x - x0)); run(W, 1.5); ok(!e.st || !e.st.stun, 'оглушение не прошло'); }
// кровотечение ножом: урон со временем и конец
{ const W = mk('w_knife_iron', 0); const e = foe(W); swing(W); ok(e.st && e.st.bleed, 'нет кровотечения'); const h0 = e.hp; run(W, 2); const lost = h0 - e.hp; ok(near(lost, 5, 1.2), 'кровотечение 2,5/с за 2 с: ' + lost); run(W, 3); ok(!e.st, 'кровотечение не закончилось'); }
// молот: по площади
{ const W = mk('w_hammer_iron'); const a = foe(W), b = foe(W, 0, 3.3); const h0 = b.hp; swing(W); ok(h0 - b.hp > base('w_hammer_iron') * .4, 'молот не задел соседа: ' + (h0 - b.hp)); const W2 = mk('w_sword_iron'); foe(W2); const c = foe(W2, 0, 3.8); const h1 = c.hp; swing(W2); ok(h1 === c.hp, 'меч задел дальнего'); }
// дубина: отбрасывает дальше
{ const kb = w => { const W = mk(w); const e = foe(W); swing(W); return Math.hypot(e.vx, e.vz); }; ok(kb('w_club_iron') > kb('w_sword_iron') * 1.8, 'дубина не отбрасывает сильнее'); }
// цеп: два удара подряд
{ const W = mk('w_flail_iron'); foe(W); W.ev.length = 0; let hits = 0; for (let i = 0; i < 70; i++) { step(W, 1 / 60, { attack: i < 2 }); hits += W.ev.filter(v => v.k === 'hit').length; W.ev.length = 0; } ok(hits === 2, 'цеп должен бить дважды: ' + hits); }
// рапира/меч: удар после уклона сильнее
{ const plain = dmgOf('w_sword_iron'), rip = dmgOf('w_sword_iron', W => { W.player.riposteT = .5; }); ok(near(rip / plain, 1.5, .12), 'контрудар меча: ' + rip + '/' + plain); }
// цепочка: третий удар сильнее и оглушает, пауза сбрасывает
{ const W = mk('w_sword_iron'); const e = foe(W); W.setR(.5); const out = []; for (let n = 0; n < 4; n++) { const ev = swing(W); out.push(ev[0].dmg); run(W, .1); }
  ok(out[2] > out[0] * 1.35 && out[2] > out[1] * 1.2, 'третий удар цепочки не сильнее: ' + out); 
  const W2 = mk('w_sword_iron'); foe(W2); const a = swing(W2)[0].dmg; run(W2, 2.5); const b = swing(W2)[0].dmg; ok(near(a, b, a * .45), 'после паузы цепочка не сбросилась'); }
// рывок-удар после переката
{ const W = mk('w_sword_iron'); foe(W); const plain = swing(W)[0].dmg; run(W, 3); W.combo.n = 0; step(W, 1 / 60, { mx: 0, mz: -1, roll: true }); run(W, .45); W.player.face = Math.PI / 2; W.player.x = 0; W.player.z = 0; const ev = swing(W); ok(ev.length && ev[0].dmg > plain * 1.25, 'рывок-удар не усилен'); }
// комбо: растёт с попаданиями, ограничено, спадает
{ const W = mk('w_sword_iron'); foe(W); for (let i = 0; i < 12; i++) { swing(W); run(W, .5); } ok(W.combo.n >= 6, 'счётчик комбо не растёт: ' + W.combo.n); const d1 = swing(W)[0].dmg; ok(d1 > base('w_sword_iron') * 1.2, 'комбо не усиливает урон'); run(W, 2.6); ok(W.combo.n === 0, 'комбо не спало'); }

// ---- свойства ----
const withPerk = (perk, w = 'w_sword_iron') => { const W = mk(w, 0); W.inv.eq.weapon = w; BY_ID[w].perks = [perk]; return W; };
{ const saved = {}; for (const id of ['w_sword_iron']) saved[id] = BY_ID[id].perks;
  const cleanup = () => { BY_ID.w_sword_iron.perks = saved.w_sword_iron; };
  // огонь: горит и наносит урон
  { const W = withPerk('fire'); const e = foe(W); swing(W); ok(e.st && e.st.burn, 'огонь не поджёг'); const h = e.hp; run(W, 2); ok(h - e.hp > 6, 'горение не жжёт: ' + (h - e.hp)); }
  // мороз: замедление и раскол по замёрзшему
  { const W = withPerk('frost'); const e = foe(W, 0, 1.6, 'imp'); e.state = 'chase'; e.cd = 99; swing(W); ok(e.st && e.st.freeze, 'мороз не заморозил'); const x0 = Math.hypot(e.x, e.z); e.state = 'chase'; e.cd = 99; e.alert = true; run(W, 1, {}); const moved = x0 - Math.hypot(e.x, e.z); ok(moved < CFG3.enemies.imp.speed * .7, 'замёрзший не замедлен: ' + moved); }
  // яд: стакается до 5
  { const W = withPerk('venom'); const e = foe(W); for (let i = 0; i < 7; i++) { swing(W); run(W, .5); } ok(e.st && e.st.poison && e.st.poison.n === 5, 'яд не накопился до 5: ' + JSON.stringify(e.st)); }
  // гроза: перескакивает на соседа
  { const W = withPerk('storm'); const a = foe(W), b = foe(W, 0, 3.4); const h = b.hp; swing(W); ok(h > b.hp, 'молния не перескочила'); }
  // добивание: по раненому сильнее
  { const full = dmgOf('w_sword_iron'); const W = withPerk('execute'); const e = foe(W); e.hp = e.maxhp * .2; const d = swing(W)[0].dmg; ok(near(d / (base('w_sword_iron') * .9 * 1.7), 1.5, .2), 'добивание: ' + d); }
  // жатва: лечит за убийство
  { const W = withPerk('siphon'); W.player.hp = 40; const e = foe(W); e.hp = e.maxhp = 1; swing(W); ok(W.player.hp >= 40 + 5.9, 'жатва не лечит: ' + W.player.hp); }
  // эхо: повторный удар
  { const W = withPerk('echo'); W.setR(0); foe(W); W.ev.length = 0; let hits = 0; for (let i = 0; i < 60; i++) { step(W, 1 / 60, { attack: i < 2 }); hits += W.ev.filter(v => v.k === 'hit').length; W.ev.length = 0; } ok(hits >= 2, 'эхо не повторило удар: ' + hits); }
  // раскат: крит взрывается по площади
  { const W = withPerk('thunder'); const a = foe(W), b = foe(W, 0, 3.3); const h = b.hp; swing(W); ok(h > b.hp, 'раскат не задел соседа'); }
  // жнец: растёт с убийствами, потом спадает
  { const W = withPerk('reaper'); W.setR(.5); for (let i = 0; i < 4; i++) { const e = foe(W); e.hp = e.maxhp = 1; swing(W); run(W, .3); } ok(W.reap.n >= 3, 'жнец не набирает стаки: ' + W.reap.n); run(W, 9); ok(W.reap.n === 0, 'жнец не сбросился'); }
  // раскол: по замороженным сильнее
  { const plain = dmgOf('w_sword_iron'); const W = withPerk('shatter'); W.setR(.5); const e = foe(W); applyStatus(W, e, 'freeze', 0, 3); ok(near(swing(W)[0].dmg / plain, 1.4, .2), 'раскол'); }
  // оплот: броня за удары
  { const W = withPerk('bulwark'); foe(W); step(W, 1 / 60, {}); const a0 = W.gear.armor; for (let i = 0; i < 3; i++) { swing(W); run(W, .4); } step(W, 1 / 60, {}); ok(W.gear.armor >= a0 + 6, 'оплот не даёт брони: ' + W.gear.armor); run(W, 5); ok(W.gear.armor === a0, 'оплот не сбросился'); }
  cleanup(); }

// ---- реакции ----
{ const W = mk('w_sword_iron'); const e = foe(W); applyStatus(W, e, 'freeze', 0, 3); const h = e.hp; W.ev.length = 0; applyStatus(W, e, 'burn', 4, 4); ok(!(e.st && (e.st.freeze || e.st.burn)) && h - e.hp > 30 && W.ev.some(v => v.k === 'react' && v.name === 'Раскол'), 'раскол: огонь по замёрзшему'); }
{ const W = mk('w_sword_iron'); const e = foe(W), o = foe(W, 0, 2.5); for (let i = 0; i < 3; i++) applyStatus(W, e, 'poison', 2, 5); const h = o.hp; W.ev.length = 0; applyStatus(W, e, 'burn', 4, 4); ok(h - o.hp >= 30 && !(e.st && e.st.poison) && W.ev.some(v => v.name === 'Токсичный взрыв'), 'токсичный взрыв: ' + (h - o.hp)); }
{ const W = mk('w_sword_iron'); const e = foe(W); applyStatus(W, e, 'burn', 4, 4); applyStatus(W, e, 'freeze', 0, 2); ok(e.st.freeze && !e.st.burn, 'мороз не гасит огонь'); }
// иммунитет (на случай боссов): статус не накладывается
{ const W = mk('w_sword_iron'); W.cfg.enemies.brute.immune = ['stun', 'freeze']; const e = foe(W); ok(!applyStatus(W, e, 'stun', 0, 2) && !applyStatus(W, e, 'freeze', 0, 2) && applyStatus(W, e, 'burn', 3, 3), 'иммунитет к статусам'); delete W.cfg.enemies.brute.immune; }
// убийство от горения засчитывается (опыт, счётчик)
{ const W = mk('w_sword_iron'); const e = foe(W); e.hp = e.maxhp = 6; applyStatus(W, e, 'burn', 5, 4); run(W, 3); ok(e.dead && W.kills === 1, 'смерть от горения не засчитана'); }

// ---- статусы героя ----
{ const W = mk(null); W.player.inv = 0; W.setR(0); W.player.x = 30; W.player.z = 30; const g = spawnEnemy(W, 'ghoul', 31, 30); g.alert = true; g.state = 'wind'; g.t = CFG3.enemies.ghoul.wind - .01; g.hp = g.maxhp = 1e6; run(W, .2); ok(W.pst.poison, 'упырь не отравил героя'); W.enemies.length = 0; const h = W.player.hp; run(W, 3); ok(h - W.player.hp > 4, 'яд не жжёт героя: ' + (h - W.player.hp)); run(W, 6); ok(!W.pst.poison, 'яд героя не прошёл'); }
{ const W = mk(null); W.pst.poison = { t: 9, dps: 2, n: 2 }; W.pst.bleed = { t: 9, dps: 2 }; W.pst.burn = { t: 9, dps: 3 }; W.inv.bag.push({ id: 'p_antidote', n: 1 }, { id: 'p_clean_water', n: 1 }); ok(useItem(W, 1) && !W.pst.burn && !W.pst.bleed && W.pst.poison, 'вода не сняла горение и кровь'); ok(useItem(W, 0) && !Object.keys(W.pst).length, 'противоядие не очистило'); ok(!useItem(W, 0), 'расходник без эффекта потратился'); }
{ const W = mk(null); W.player.x = 30; W.player.z = 30; W.player.hp = 3; W.pst.poison = { t: 9, dps: 5, n: 1 }; run(W, 2); ok(W.player.dead, 'яд не убил героя'); respawnPlayer(W); ok(!Object.keys(W.pst).length && !W.player.dead, 'статусы не сброшены при возрождении'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Оружие 3D: OK');
