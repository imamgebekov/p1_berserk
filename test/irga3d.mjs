// Тест Ирги (маг, 2026-10-18): герой и лёгкая броня, мана, посох и жезл (сфера, вспышка посоха), 8 умений, щит маны, метеор,
// облако, вьюга; добыча посохов без W.rng и витрина торговца.
import { CFG3 } from '../3d/src/config3d.js';
import { CATALOG, BY_ID } from '../3d/src/data/items.js';
import { HEROES, canWield } from '../3d/src/data/heroes3d.js';
import { ABILITIES } from '../3d/src/data/abilities3d.js';
import { createWorld, step, spawnEnemy, refreshGear, switchHero, hurtPlayer } from '../3d/src/sim.js';
import { useAbility } from '../3d/src/abilities3d.js';
import { resNow, resMax } from '../3d/src/resource3d.js';
import { equipAt, deserialize } from '../3d/src/inv.js';
import { magicDropOf } from '../3d/src/stones3d.js';
import { restock } from '../3d/src/economy3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const A = CFG3.abilities.irga, IDS = ABILITIES.irga.slice(0, 8).map(a => a.id);     // прежние 8; новые умения древа — test/actives3d.mjs
function mk(weapon = 'w_staff_iron') {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.weather.force = 'clear'; cfg.enemies.roam.on = false;
  const W = createWorld(cfg, () => .5); W.hero = 'irga'; W.lv = 30; W.player.x = 300; W.player.z = 0; W.player.face = 0; W.player.inv = 1e9;
  W.inv.eq.weapon = weapon; for (const id of IDS) W.ab[id] = 3; refreshGear(W); step(W, 1 / 60, {}); W.res = resMax(W); return W;
}
const foe = (W, dx, dz, hp = 1e5, type = 'brute') => { const p = W.player, e = spawnEnemy(W, type, p.x + dx, p.z + dz); e.hp = e.maxhp = hp; e.cd = 1e9; e.alert = false; e.imm = null; e.elite = false; e.aff = null; return e; };     // без особенностей элиты (иммунитетов)
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };
const hurt = e => e.maxhp - e.hp;
const cast = (W, id) => useAbility(W, IDS.indexOf(id));

// ---------- 1. герой, броня, оружие ----------
{ const H = HEROES.irga; ok(H && H.open && H.kinds.join() === 'staff,wand' && BY_ID[H.start] && BY_ID[H.start].kind === 'staff', 'Ирга: герой или стартовый посох');
  ok(IDS.length === 8 && IDS.every(id => A[id] && A[id].cost > 0 && A[id].cd.length === 3), 'у Ирги не 8 умений с ценой и перезарядкой');
  ok(HEROES.irga.armorBan.length >= 6 && CFG3.abilities.res.irga.name === 'Мана', 'Ирга без запрета тяжёлой брони или без маны');     // хрупкость — лёгкая броня (здоровье ×1 после баланса)
  const heavy = CATALOG.filter(i => ['helm', 'sallet', 'cuirass', 'mail', 'plate', 'greaves'].includes(i.kind) && i.slot !== 'weapon'), light = CATALOG.filter(i => ['hood', 'cap', 'robe', 'jerkin', 'shoes', 'wraps', 'cloak'].includes(i.kind));
  ok(heavy.length > 20 && heavy.every(i => !canWield('irga', i)) && light.every(i => canWield('irga', i)) && heavy.every(i => canWield('thorn', i)), 'правило лёгкой брони неверно');
  const mags = CATALOG.filter(i => i.pool === 'magic'); ok(mags.length === 16 && mags.every(i => canWield('irga', i) && !canWield('jay', i) && !canWield('thorn', i)), 'посохи и жезлы: 16 штук только для Ирги');     // 4.20: +2 багровых
  const W = mk(); W.inv.bag.push({ id: 'a_body_plate_iron', n: 1 }); const pl = CATALOG.find(i => i.slot === 'body' && i.kind === 'plate'); W.inv.bag = [{ id: pl.id, n: 1 }];
  ok(!equipAt(W.inv, 0, 'irga') && !W.inv.eq.body, 'Ирга надела латы');
  const T = mk('w_sword_iron'); T.hero = 'thorn'; T.inv.eq.body = pl.id; switchHero(T, 'irga'); ok(!T.inv.eq.body && T.heroes.thorn.inv.eq.body === pl.id, 'при смене на Иргу латы не остались у Торна');     // отдельные герои (2026-10-23)
  const d = deserialize({ bag: [], eq: { body: pl.id, weapon: 'w_staff_iron' } }, 40, 'irga', CFG3); ok(!d.eq.body && d.bag.some(s => s.id === pl.id) && d.eq.weapon === 'w_staff_iron', 'сохранение Ирги с латами'); }

// ---------- 2. посох и жезл ----------
{ const W = mk('w_staff_iron'), e = foe(W, 0, 6), o = foe(W, 1.2, 6.4); W.ev.length = 0; const ev = []; for (let i = 0; i < 90; i++) { step(W, 1 / 60, { attack: i < 2 }); ev.push(...W.ev); W.ev.length = 0; }
  ok(hurt(e) > 0 && ev.some(v => v.k === 'splash') && hurt(o) > 0, `сфера посоха не долетела или без вспышки: ${hurt(e)} ${hurt(o)}`); }
{ const W = mk('w_wand_iron'), e = foe(W, 0, 8); for (let i = 0; i < 60; i++) step(W, 1 / 60, { attack: i < 2 }); ok(hurt(e) > 0, 'жезл не стреляет'); }

// ---------- 3. умения ----------
{ const W = mk(), e = foe(W, 0, 7), o = foe(W, 1.5, 7.5); ok(cast(W, 'fireball') === 'ok', 'огненный шар не пошёл'); run(W, 1); ok(hurt(e) > 0 && o.st && o.st.burn, 'огненный шар: нет взрыва с огнём'); }
{ const W = mk(), a = foe(W, 2, 0), b = foe(W, -2.5, 1), far = foe(W, 0, 8); ok(cast(W, 'nova') === 'ok' && a.st && a.st.freeze && b.st && b.st.freeze && !far.st, 'ледяное кольцо не морозит рядом или достаёт далёких'); }
{ const W = mk(), es = [foe(W, 0, 5), foe(W, 2, 8), foe(W, 4, 11), foe(W, 6, 14)]; ok(cast(W, 'chain') === 'ok', 'цепная молния не пошла'); ok(es.every(e => hurt(e) > 0) && hurt(es[3]) < hurt(es[0]), `молния не прыгает или не слабеет: ${es.map(hurt)}`); }
{ const W = mk(); ok(cast(W, 'chain') === 'target' && W.res === resMax(W), 'цепная молния без цели тратит ману'); }
{ const W = mk(), e = foe(W, 0, 6); cast(W, 'cloud'); run(W, 2.5); ok(e.st && e.st.poison && e.st.poison.n >= 3, 'облако не копит яд: ' + (e.st && e.st.poison && e.st.poison.n)); run(W, 4); ok(!W.ezones.some(z => z.kind === 'cloud'), 'облако не рассеялось'); }
{ const W = mk(), e = foe(W, 0, 6); cast(W, 'meteor'); run(W, A.meteor.delay * .5); const h0 = hurt(e); run(W, A.meteor.delay); ok(h0 === 0 && hurt(e) > 0 && e.st && e.st.burn, `метеор не ждёт или не бьёт: ${h0} → ${hurt(e)}`); }
{ const W = mk(), e = foe(W, 0, 6); cast(W, 'blizzard'); run(W, 1.2); ok(hurt(e) > 0 && e.st && e.st.slow, 'вьюга не бьёт и не замедляет'); }
{ const W = mk(), e = foe(W, 0, 10), b0 = mk(); const r0 = (() => { const x = foe(b0, 0, 10); cast(b0, 'fireball'); run(b0, 1.2); return hurt(x); })(); cast(W, 'spear');
  ok(hurt(e) > r0 * 1.8, `копьё бездны не сильнее огненного шара по одной цели: ${hurt(e)} против ${r0}`); }
{ const W = mk(); cast(W, 'shield'); const hp = W.player.hp, m0 = resNow(W); W.player.inv = 0; hurtPlayer(W, 40, W.player.x + 1, W.player.z, null, null);
  ok(W.player.hp > hp - 40 * .9 && resNow(W) < m0, `щит маны не снимает урон с маны: здоровье ${hp} → ${W.player.hp}, мана ${m0} → ${resNow(W)}`); }
{ const W = mk(); W.res = 10; ok(cast(W, 'meteor') === 'res', 'метеор без маны'); }

// ---------- 4. добыча и витрина ----------
{ const W = mk(); let n = 0, rng = 0; const r0 = W.rng; W.rng = () => { rng++; return r0(); };
  for (let i = 0; i < 3000; i++) { W.kills = i; const id = magicDropOf(W, { id: i + 1, type: 'imp' }, .5); if (id) { n++; ok(BY_ID[id] && BY_ID[id].pool === 'magic', 'с врага выпало не магическое: ' + id); } }
  ok(rng === 0 && Math.abs(n / 3000 - CFG3.stones.magic[0]) < .015, `посохи с врагов у Ирги не по шансу: ${(n / 3000).toFixed(3)}`);
  W.hero = 'thorn'; let m = 0; for (let i = 0; i < 3000; i++) { W.kills = i; if (magicDropOf(W, { id: i + 1, type: 'imp' }, .5)) m++; } ok(m < n / 2, 'у других героев посохи падают так же часто'); }
{ const W = mk(); restock(W); ok(W.shop.stock.some(s => s.id === 'w_staff_iron') && W.shop.stock.some(s => s.id === 'w_wand_iron'), 'у торговца нет посоха и жезла для Ирги'); }

if (fails.length) { console.error('Ирга 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Ирга 3D: OK');
