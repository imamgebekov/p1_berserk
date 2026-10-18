// Тест сетов брони: данные, счёт частей, бонусы 2 и 4, особые эффекты, именные сеты боссов.
import { canWield } from '../3d/src/data/heroes3d.js';
import { CFG3 } from '../3d/src/config3d.js';
import { BY_ID, CATALOG } from '../3d/src/data/items.js';
import { SETS, SET_SLOTS, NAMED_ARMOR, FX_TEXT } from '../3d/src/data/sets3d.js';
import { createInv, setCounts, setBonus, gearStats, SET_OF, bonusText, serialize, deserialize } from '../3d/src/inv.js';
import { createWorld, step, spawnEnemy, mulberry32, refreshGear } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };

// ---- данные ----
ok(SETS.length === 12 && new Set(SETS.map(s => s.id)).size === 12, 'сетов должно быть 12 (с двумя золотыми)');
// золотые комплекты (2026-10-18): все 4 части — золотые вещи; лёгкий годится Ирге целиком
for (const id of ['sun', 'dawn']) { const st = SETS.find(s => s.id === id); ok(st && st.pieces.length === 4 && st.pieces.every(p => BY_ID[p] && BY_ID[p].pool === 'gold'), 'золотой комплект ' + id); }
ok(SETS.find(s => s.id === 'dawn').pieces.every(p => canWield('irga', BY_ID[p])), 'Ирга не может надеть лёгкий золотой комплект');
for (const s of SETS) {
  ok(s.name && s.b2 && s.b4, 'бонусы сета ' + s.id); ok(s.ids.length >= 4, 'мало вещей в сете ' + s.id);
  for (const slot of SET_SLOTS) ok(s.ids.some(id => BY_ID[id].slot === slot), `в сете ${s.id} нет слота ${slot}`);
  for (const id of s.ids) { ok(BY_ID[id], 'нет вещи ' + id); ok(SET_OF[id] === s, 'вещь в двух сетах: ' + id); }
  for (const b of [s.b2, s.b4]) { ok(Object.keys(b.stats || {}).length || Object.keys(b.fx || {}).length, 'пустой бонус ' + s.id); for (const k of Object.keys(b.fx || {})) ok(FX_TEXT[k], 'нет текста эффекта ' + k); ok(bonusText(b).length > 3, 'нет текста бонуса'); }
  ok(Object.keys(s.b4.fx || {}).length || Object.keys(s.b4.stats).length >= 2, 'бонус за 4 должен быть заметен: ' + s.id);
}
ok(NAMED_ARMOR.length === 12 && NAMED_ARMOR.every(([id, slot, name, st]) => BY_ID[`as_${id}_${slot}`] && BY_ID[`as_${id}_${slot}`].pool === 'setunique' && BY_ID[`as_${id}_${slot}`].rar === 4), 'именные вещи');
ok(CATALOG.length <= 700, 'каталог превысил 700: ' + CATALOG.length);
ok(CATALOG.filter(i => i.slot && i.stats && i.stats.armor).every(i => i.stats.armor <= 30), 'броня вещи выше 30');

// ---- счёт частей и бонусы ----
const wear = (...ids) => { const inv = createInv(); for (const id of ids) inv.eq[BY_ID[id].slot] = id; return inv; };
const MAIL = ['a_head_helm_mail', 'a_body_mail_mail', 'a_cloak_cloak_mail', 'a_boots_greaves_mail'];
{ const none = createInv(), a = gearStats(none).armor;
  const i2 = wear(MAIL[0], MAIL[1]); ok(setCounts(i2)[0].n === 2 && setBonus(i2).stats.armor === 5 && !Object.keys(setBonus(i2).fx).length, 'бонус за 2 части');
  const i3 = wear(MAIL[0], MAIL[1], MAIL[2]); ok(setBonus(i3).stats.armor === 5 && !setBonus(i3).fx.thorns, 'за 3 части бонус 4-х не должен включаться');
  const i4 = wear(...MAIL); ok(setBonus(i4).stats.armor === 8 && setBonus(i4).fx.thorns === .2, 'бонус за 4 части: ' + JSON.stringify(setBonus(i4)));
  const sum = MAIL.reduce((x, id) => x + BY_ID[id].stats.armor, 0); ok(gearStats(i4).armor === sum + 8, 'бонус не добавлен в gearStats: ' + gearStats(i4).armor);
  const mixed = wear(MAIL[0], MAIL[1], 'a_cloak_cloak_plate', 'a_boots_greaves_plate'); ok(setCounts(mixed).every(c => c.n === 2) && setBonus(mixed).stats.armor === 5 + 6 && setBonus(mixed).stats.hp === 15, 'два сета по две части: ' + JSON.stringify(setBonus(mixed)));
  ok(gearStats(wear('a_head_helm_mail')).armor === BY_ID.a_head_helm_mail.stats.armor, 'одна часть не даёт бонуса');
  ok(setCounts(wear('w_sword_iron')).length === 0, 'оружие не входит в сеты'); const r = wear(...MAIL); r.eq.head = null; ok(setCounts(r)[0].n === 3, 'снятие части'); }
// именные сеты: полный комплект сильнее обычного полного комплекта по броне
{ for (const id of ['pogost', 'eclipse', 'rust']) { const inv = wear(...SET_SLOTS.map(s => `as_${id}_${s}`)); ok(setCounts(inv)[0].n === 4 && Object.keys(setBonus(inv).fx).length, 'именной комплект ' + id); }
  const named = gearStats(wear(...SET_SLOTS.map(s => `as_rust_${s}`))).armor, plate = gearStats(wear('a_head_helm_plate', 'a_body_plate_plate', 'a_cloak_cloak_plate', 'a_boots_greaves_plate')).armor; ok(named > plate * .9, `именная броня слабее обычной: ${named} vs ${plate}`); }
// сохранение: сеты считаются по надетому
{ const inv = wear(...MAIL); const d = deserialize(JSON.parse(JSON.stringify(serialize(inv))), 30); ok(setCounts(d)[0].n === 4, 'сет не пережил сохранение'); }

// ---- особые эффекты ----
function mk(ids, R = .5) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.bosses.list = []; cfg.player.autoAim = 0; cfg.player.hp = 100000;
  let r = R; const W = createWorld(cfg, () => r); W.setR = v => { r = v; };
  for (const id of ids) W.inv.eq[BY_ID[id].slot] = id; W.player.x = 30; W.player.z = 30; W.player.face = Math.PI / 2; step(W, 1 / 60, {}); return W;
}
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };
const hitMe = (W, type = 'imp', dmgBase) => { const e = spawnEnemy(W, type, W.player.x + 1.2, W.player.z); e.alert = true; e.hp = e.maxhp = 1e6; e.state = 'wind'; e.t = W.cfg.enemies[type].wind - .01; W.player.inv = 0; W.ev.length = 0; run(W, .1); const h = W.ev.find(v => v.k === 'hurt'); return { e, dmg: h ? h.dmg : 0 }; };
{ // кольчужный: шипы
  const W = mk(MAIL); const { e, dmg } = hitMe(W); ok(dmg > 0 && e.hp < e.maxhp && Math.abs((e.maxhp - e.hp) - Math.round(dmg * .2)) <= 1, `шипы: получено ${dmg}, отражено ${e.maxhp - e.hp}`); }
{ // пластинчатый: ниже 40% урон меньше
  const PL = ['a_head_helm_plate', 'a_body_plate_plate', 'a_cloak_cloak_plate', 'a_boots_greaves_plate'];
  const dmgAt = frac => { const W = mk(PL); W.player.hp = W.player.maxhp * frac; return hitMe(W, 'brute').dmg; }; const hi = dmgAt(.9), lo = dmgAt(.3); ok(lo < hi * .95 && lo > hi * .7, `последний рубеж: ${hi} → ${lo}`); }
{ // чернёный: взрыв при перекате
  const BL = ['a_head_helm_black', 'a_body_plate_black', 'a_cloak_cloak_black', 'a_boots_greaves_black']; const W = mk(BL); const e = spawnEnemy(W, 'brute', W.player.x + 2, W.player.z); e.hp = e.maxhp = 1e6; e.state = 'rec'; e.t = -1e9; const h = e.hp; step(W, 1 / 60, { mx: -1, roll: true }); ok(h - e.hp >= 40, 'взрыв при перекате: ' + (h - e.hp)); }
{ // пепельный: покров поджигает ближних (R=0: шанс срабатывает)
  const AS = ['a_head_helm_ash', 'a_body_plate_ash', 'a_cloak_cloak_ash', 'a_boots_greaves_ash']; const W = mk(AS, 0); const o = spawnEnemy(W, 'brute', W.player.x - 2, W.player.z); o.hp = o.maxhp = 1e6; o.state = 'rec'; o.t = -1e9; hitMe(W); ok(o.st && o.st.burn && o.hp < o.maxhp, 'пепельный покров не поджёг ближнего'); }
{ // клёпаный: лечение за убийство
  const ST = ['a_head_helm_studded', 'a_body_mail_studded', 'a_cloak_cloak_studded', 'a_boots_greaves_studded']; const W = mk(ST); W.player.hp = 50; const e = spawnEnemy(W, 'imp', W.player.x + 1.6, W.player.z); e.hp = e.maxhp = 1; e.alert = true; e.state = 'rec'; e.t = -1e9; W.inv.eq.weapon = 'w_sword_iron'; const h = W.player.hp; run(W, .8, { attack: true }); ok(e.dead && W.player.hp >= h + 3.5, 'клёпаный: убийство не лечит: ' + (W.player.hp - h)); }
{ // Погост: яд атакующему
  const W = mk(SET_SLOTS.map(s => `as_pogost_${s}`)); const { e } = hitMe(W); ok(e.st && e.st.poison, 'сет Погоста не отравил напавшего'); }
{ // Затмение: крит поджигает (R=0: крит всегда, шанс срабатывает)
  const W = mk(SET_SLOTS.map(s => `as_eclipse_${s}`), 0); W.inv.eq.weapon = 'w_sword_iron'; const e = spawnEnemy(W, 'brute', W.player.x + 1.6, W.player.z); e.hp = e.maxhp = 1e6; e.alert = true; e.state = 'rec'; e.t = -1e9; run(W, .6, { attack: true }); ok(e.st && e.st.burn, 'сет Затмения: крит не поджёг'); }
{ // Ржавые: ярость ниже 40% здоровья усиливает удар
  const dmg = frac => { const W = mk(SET_SLOTS.map(s => `as_rust_${s}`)); W.inv.eq.weapon = 'w_sword_iron'; W.player.hp = W.player.maxhp * frac; const e = spawnEnemy(W, 'brute', W.player.x + 1.6, W.player.z); e.hp = e.maxhp = 1e6; e.alert = true; e.state = 'rec'; e.t = -1e9; run(W, .5, { attack: true }); return e.maxhp - e.hp; };
  ok(dmg(.2) > dmg(.9) * 1.15, 'ярость Ржавых не усиливает удар'); }
// именные части сетов больше не падают с боссов готовыми: только трофей и книга (сами вещи делаются в кузне)
{ const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.player.autoAim = 0; const W = createWorld(cfg, mulberry32(3));
  const e = W.enemies.find(x => x.boss && x.type === 'devourer'); W.player.x = e.x + 3; W.player.z = e.z; W.player.hp = W.player.maxhp = 1e5; e.alert = true; e.hp = 1; W.inv.eq.weapon = 'w_sword_iron'; W.player.face = Math.atan2(e.x - W.player.x, e.z - W.player.z); run(W, 1.2, { attack: true });
  const got = W.drops.map(d => d.id).concat(W.inv.bag.map(s => s.id)); ok(!got.some(id => id.startsWith('as_') || id.startsWith('wu_')), 'именная вещь выпала готовой: ' + got); ok(got.includes('m_devourer_heart'), 'нет трофея Пожирателя'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Сеты 3D: OK');
