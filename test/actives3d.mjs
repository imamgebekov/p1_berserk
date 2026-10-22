// Тест новых умений древа (2026-10-20): у каждого героя 30 активных — по 10 в ветке; каждое из 110 новых открывается
// по своему уровню, срабатывает и бьёт врагов (или усиливает и лечит героя); прицел по точке бьёт туда, куда смотрит мышь;
// состояния (горение, яд, кровь, контроль) ложатся на врага; у каждого — описание по рангам и значок.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear } from '../3d/src/sim.js';
import { ABILITIES, rankLvs, abilityPointsAt } from '../3d/src/data/abilities3d.js';
import { NEW_ACTIVES } from '../3d/src/data/actives3d.js';
import { abilityPoints, upgradeAbility, useAbility, setBar, abilityAim, heroAbilities } from '../3d/src/abilities3d.js';
import { treeOf } from '../3d/src/tree3d.js';
import { GI } from '../3d/src/data/gicons.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const HEROES = Object.keys(NEW_ACTIVES);
const mk = (hero, lv = CFG3.level.max, seed = 1) => {     // 4.06: на пределе — открыты и умения 61–70
  const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = []; c.events.on = false; c.wanderer.on = false; c.ambient.on = false;
  for (const R of Object.values(c.abilities.res)) Object.assign(R, { max: 1e9, start: 1e9, decay: 0 });
  const W = createWorld(c, mulberry32(seed)); W.hero = hero; W.lv = lv; W.ap = 999; W.inv.eq.weapon = hero === 'jay' ? 'w_bow_black' : 'w_sword_iron'; refreshGear(W);
  Object.assign(W.player, { x: 40, z: 40, face: 0, inv: 0 }); W.player.hp = W.player.maxhp; return W;
};
const foe = (W, dx, dz) => { const e = spawnEnemy(W, 'brute', W.player.x + dx, W.player.z + dz); e.hp = e.maxhp = 1e4; e.cd = 99; return e; };
const still = W => { for (const e of W.enemies) { e.state = 'rec'; e.t = -1e9; e.vx = e.vz = 0; } };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) { still(W); step(W, 1 / 60, inp); } };

// ---------- 1. данные: 30 умений, по 10 в ветке, описания, значки ----------
for (const h of HEROES) {
  const L = ABILITIES[h], c = CFG3;
  ok(L.length === 36 && new Set(L.map(a => a.id)).size === 36, `${h}: умений ${L.length}, не 36 разных`);     // 4.06: +6 умений 61–70
  const T = treeOf(h, c); ok(T.length === 3 && T.every(b => b.nodes.length === 40 && b.nodes.filter(n => n.kind === 'active').length === 12), `${h}: в ветках не по 40 узлов и 12 активных`);
  ok(T.every(b => Math.min(...b.nodes.filter(n => n.kind === 'active').map(n => n.row)) === 1 && b.nodes.filter(n => n.row === 1)[0].kind === 'active'), `${h}: ветка начинается не с активного умения`);
  for (const b of T) for (const n of b.nodes) ok(GI[n.icon], `${h}: у узла ${n.key} нет значка`);
  L.forEach((a, i) => { const lv = rankLvs(c, i, a); ok(lv.length >= 3 && lv[0] >= 3 && lv.every((x, k) => x <= c.level.max && (!k || x >= lv[k - 1])), `${h}/${a.id}: уровни рангов ${lv}`); });
  const W = mk(h); for (const a of L.filter(x => x.kind)) for (const r of [0, 1, 2]) { const s = a.text(W.cfg.abilities.gen[a.kind] ? { ...W.cfg.abilities.gen[a.kind], ...a.p, st: a.st, amt: (W.cfg.abilities.gen.buff.amt || {})[a.p.stat] } : {}, r); ok(typeof s === 'string' && !/undefined|NaN/.test(s), `${h}/${a.id}: описание ранга ${r + 1}: ${s}`); }
}
ok(abilityPointsAt(60, CFG3) === 58 + CFG3.abilities.mastery.lv.length, `очков умений на 60-м: ${abilityPointsAt(60, CFG3)}`);
ok(abilityPoints(3, CFG3) === 1, 'на 3-м уровне не одно очко умений');

// ---------- 2. каждое новое умение срабатывает ----------
const near = (W, id) => W.enemies.filter(e => !e.dead).reduce((s, e) => s + (e.maxhp - e.hp), 0);
for (const h of HEROES) for (const d of NEW_ACTIVES[h]) {
  const W = mk(h); while (upgradeAbility(W, d.id) === 'ok');
  ok((W.ab[d.id] || 0) === 3, `${h}/${d.id}: не вкачать до 3-го ранга (ранг ${W.ab[d.id] || 0})`);
  const es = [foe(W, 0, 2.2), foe(W, 1.2, 2.6), foe(W, -1.4, 3)]; still(W);
  const i = heroAbilities(W).findIndex(a => a.id === d.id), hp0 = W.player.hp; W.player.hp = W.player.maxhp * .5;
  if (d.kind === 'zone' || d.kind === 'field' || d.kind === 'cloud') W.aimPt = { x: W.player.x, z: W.player.z + 2.6 };
  const res = useAbility(W, i);
  ok(res === 'ok', `${h}/${d.id} (${d.kind}): не сработало — ${res}`);
  run(W, d.kind === 'mark' ? 3.5 : d.kind === 'field' || d.kind === 'cloud' ? 2 : .8, W.aimPt ? { aimPt: W.aimPt } : {});
  const dmg = near(W);
  if (d.kind === 'buff') ok(W.buffs.some(b => b.src === 'gen:' + d.p.stat), `${h}/${d.id}: нет усиления ${d.p.stat}`);
  else if (d.kind === 'heal') ok(W.player.hp > W.player.maxhp * .5 + 1, `${h}/${d.id}: не лечит`);
  else if (d.kind === 'gheal') ok(W.player.hp > W.player.maxhp * .5 + 1, `${h}/${d.id}: не лечит`);     // 4.16: лечение отряда (Жрец)
  else if (d.kind === 'ward') ok(W.player.ward > 0, `${h}/${d.id}: нет оберега`);
  else ok(dmg > 0, `${h}/${d.id} (${d.kind}): никого не задело`);
  if (d.st && !['buff', 'heal', 'field', 'cloud'].includes(d.kind) && d.kind !== 'mark') ok(es.some(e => e.st && Object.keys(e.st).length) || d.st === 'stun' && d.kind === 'dash', `${h}/${d.id}: состояние ${d.st} не легло`);
  ok((W.acd[d.id] || 0) > 0 || d.kind === 'mark', `${h}/${d.id}: нет перезарядки`);
  ok(hp0 > 0 && !W.player.dead, `${h}/${d.id}: герой погиб`);
}

// ---------- 3. прицел по точке: кружок есть только у умений по площади, удар — в точку под мышью ----------
{
  const W = mk('irga'); for (const id of ['ir_pillar', 'ir_ring']) while (upgradeAbility(W, id) === 'ok');
  setBar(W, 0, 'ir_pillar'); setBar(W, 1, 'ir_ring');
  const A = abilityAim(W, 0); ok(A && A.r > 0 && A.range > A.r && A.el === 'fire', 'у «Столпа пламени» нет кружка прицела');
  ok(!abilityAim(W, 1), 'у «Кольца огня» (вокруг героя) лишний прицел');
  const far = foe(W, 8, 0), close = foe(W, 0, 2); W.aimPt = { x: far.x, z: far.z };
  ok(useAbility(W, heroAbilities(W).findIndex(a => a.id === 'ir_pillar')) === 'ok' && far.hp < far.maxhp && close.hp === close.maxhp, 'столп упал не в точку под мышью');
  const J = mk('jay'); while (upgradeAbility(J, 'rain') === 'ok'); setBar(J, 0, 'rain'); ok(abilityAim(J, 0), 'у «Града стрел» нет прицела');
}

// ---------- 4. рисованные значки (Painterly Spell Icons) и треки оркестра: у магии — картинка, файлы на месте ----------
{ const { ART } = await import('../3d/src/data/spellart3d.js'), { existsSync } = await import('node:fs');
  const n = Object.keys(ART).length; ok(n >= 120, `рисованных значков мало: ${n}`);
  for (const f of new Set(Object.values(ART))) ok(existsSync(new URL(`../3d/src/art/spell/${f}.webp`, import.meta.url)), `нет файла значка ${f}`);
  ok(!ART['n:charge'] && ART['n:fireball'] && ART['n:ir_flame'], 'удар оружием получил картинку или магия — нет');
  const T = CFG3.audio.tracks; for (const t of [T.intro, T.boss, ...T.roam]) ok(existsSync(new URL(`../3d/music/${t}.mp3`, import.meta.url)), `нет трека ${t}`); }

if (fails.length) { console.log('ПРОВАЛ (' + fails.length + '):\n' + fails.slice(0, 40).join('\n')); process.exit(1); }
console.log('новые умения древа: 140 умений, по 12 активных в ветке — ок');
