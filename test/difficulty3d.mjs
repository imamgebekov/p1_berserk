// Тест сложности 3D: данные, множители, штраф за смерть и «могила», железный режим, сохранение, лестница выживаемости.
import { CORE3 as CFG3 } from '../3d/src/config3d.js';     // ручное ядро: баланс меряется на нём (большой мир — отдельно)
CFG3.terrain.on = false;      // эталон боя — плоское поле без реки (C2): цифры сравнимы с прошлыми версиями
import { createWorld, step, mulberry32, spawnEnemy, setDifficulty, buyPrice, gainXp, aliveEnemies, xpNeed } from '../3d/src/sim.js';
import { BY_ID } from '../3d/src/data/items.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';
import { telegraphDodge } from './botsense.mjs';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const IDS = ['wanderer', 'berserk', 'ashen', 'eclipse'], L = CFG3.difficulty.levels;
const mk = (dif, seed = 1, f) => { const cfg = JSON.parse(JSON.stringify(CFG3)); if (process.env.BAL_BUF) cfg.player.heavy.buffer = Number(process.env.BAL_BUF); cfg.enemies.count = 0; cfg.ach.on = false; cfg.map.places = []; cfg.player.autoAim = 0; if (f) f(cfg); const W = createWorld(cfg, mulberry32(seed)); setDifficulty(W, dif); return W; };
const run = (W, sec, inp = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, inp); };

// данные
ok(CFG3.difficulty.default === 'berserk' && IDS.every(i => L[i]), 'уровни сложности');
{ const b = L.berserk; for (const k of ['hp', 'dmg', 'hear', 'xp', 'buy', 'boss']) ok(b[k] === 1, 'Берсерк должен быть базой (множитель ' + k + ')'); ok(b.count === 0 && b.luck === 0, 'Берсерк: count и luck'); }
for (let i = 1; i < IDS.length; i++) { const a = L[IDS[i - 1]], b = L[IDS[i]]; ok(b.hp > a.hp && b.dmg > a.dmg && b.count >= a.count && b.hear >= a.hear && b.death.ash >= a.death.ash && b.boss <= a.boss, 'лестница сложности на ' + IDS[i]); }
for (const i of IDS) ok(L[i].name && L[i].text && /[а-яё]/i.test(L[i].name), 'название ' + i);
ok(L.wanderer.death.ash === 0 && !L.wanderer.death.tomb && L.eclipse.death.gear, 'штрафы смерти по уровням');
ok(!setDifficulty(mk('berserk'), 'нет'), 'неизвестный уровень принят');

// множители
{ const hp = d => { const W = mk(d); const e = spawnEnemy(W, 'brute', 10, 10); return [e.maxhp, e.dmgMul]; };
  const base = hp('berserk'); for (const d of IDS) { const v = hp(d); ok(Math.abs(v[0] / base[0] - L[d].hp) < .01 && Math.abs(v[1] / base[1] - L[d].dmg) < .01, `множители врага ${d}: ${v} против ${base}`); } }
{ const bh = d => { const W = mk(d, 2, c => { c.bosses.list = c.bosses.list.filter(b => b.type === 'chief'); }); const e = W.enemies.find(x => x.boss); return [e.maxhp, e.dmgMul]; }; const a = bh('berserk'), c = bh('eclipse'); ok(Math.abs(c[0] / a[0] - 1.7) < .01 && Math.abs(c[1] - 1.7) < .01, 'множители босса: ' + c + ' / ' + a); }
{ const xp = d => { const W = mk(d); gainXp(W, 100); return W.xp + (W.lv - 1) * 1e4; }; ok(xp('wanderer') > xp('berserk') && xp('eclipse') > xp('ashen'), 'опыт по сложности'); }
{ const price = d => { const W = mk(d); return buyPrice(BY_ID.p_heal2, W.cfg, W.dif.buy); }; ok(price('wanderer') < price('berserk') && price('eclipse') > price('ashen'), 'цены по сложности'); }
{ const n = d => { const W = mk(d, 3, c => { c.enemies.count = 4; c.enemies.respawn = .3; c.enemies.ring = [5, 12]; }); W.player.x = -75; W.player.z = 10; W.player.inv = 1e9; let mx = 0; for (let i = 0; i < 60 * 25; i++) { step(W, 1 / 60, {}); mx = Math.max(mx, aliveEnemies(W).filter(e => !e.boss).length); } return mx; };
  ok(n('wanderer') === 3 && n('berserk') === 4 && n('ashen') === 6 && n('eclipse') === 8, `число врагов по сложности: ${IDS.map(n)}`); }
{ const heard = (d, dist) => { const W = mk(d); W.player.x = -75; W.player.z = 10; W.player.inv = 1e9; const e = spawnEnemy(W, 'imp', -75, 10 + dist); e.cd = 99; for (let i = 0; i < 5; i++) step(W, 1 / 60, { mx: 1 }); return !!e.alert; }; const r = CFG3.enemies.hear.run;
  ok(!heard('wanderer', r * .9) && heard('berserk', r * .9) && heard('eclipse', r * 1.2), 'слух по сложности'); }
{ const luck = d => mk(d).gear.luck; ok(luck('wanderer') === 6 && luck('berserk') === 0 && luck('eclipse') === 10, 'удача по сложности'); }
{ const t = d => { const W = mk(d); W.bossDead.x = 1; const e = W.enemies.find(b => b.boss && b.type === 'chief'); e.hp = 1; W.player.x = e.x + 3; W.player.z = e.z; W.player.hp = W.player.maxhp = 1e6; W.player.face = Math.atan2(e.x - W.player.x, e.z - W.player.z); W.inv.eq.weapon = 'w_sword_iron'; W.cfg.player.hp = 1e6; e.alert = true; run(W, 1.5, { attack: true }); return W.bossDead.chief; }; ok(t('wanderer') > t('berserk') && t('berserk') > t('eclipse'), 'возрождение босса по сложности: ' + IDS.map(t)); }

// смерть: пепел и могила
const die = W => { W.player.inv = 0; W.player.hp = 1; const e = spawnEnemy(W, 'brute', W.player.x + 1, W.player.z); e.alert = true; e.state = 'wind'; e.t = W.cfg.enemies.brute.wind - .01; W.ev.length = 0; run(W, .2); return W.ev.find(v => v.k === 'playerDead'); };
for (const d of IDS) { const W = mk(d); W.player.x = 20; W.player.z = 20; W.inv.ash = 1000; const ev = die(W); ok(W.player.dead && ev, 'нет смерти ' + d); const lost = Math.floor(1000 * L[d].death.ash);
  ok(W.inv.ash === 1000 - lost && ev.lost === lost, `${d}: потеряно ${ev && ev.lost}, ожидалось ${lost}`); ok(L[d].death.tomb && lost > 0 ? (W.tomb && W.tomb.ash === lost && Math.abs(W.tomb.x - 20) < 1.5) : !W.tomb, `${d}: могила`); }
{ // могила возвращает пепел; новая смерть заменяет старую
  const W = mk('berserk'); W.player.x = 20; W.player.z = 20; W.inv.ash = 800; die(W); ok(W.tomb.ash === 200, 'могила 200'); const t = W.tomb;
  W.player.dead = false; W.player.hp = 100; W.player.x = 0; W.player.z = 0; run(W, .5); ok(W.tomb && W.inv.ash === 600, 'могила подобрана издалека');
  W.player.x = t.x; W.player.z = t.z; W.ev.length = 0; run(W, .3); ok(!W.tomb && W.inv.ash === 800 && W.ev.some(v => v.k === 'tomb'), 'могила не вернула пепел: ' + W.inv.ash);
  die(W); const first = W.tomb && W.tomb.ash; W.player.dead = false; W.player.hp = 1; W.player.x = 40; W.player.z = 40; W.inv.ash = 400; W.player.inv = 0; die(W); ok(W.tomb.ash === 100 && W.tomb.x > 30, 'новая могила не заменила старую: ' + JSON.stringify(W.tomb)); }
{ const W = mk('eclipse'); W.inv.eq.weapon = 'w_sword_steel'; W.inv.eq.body = 'a_body_mail_mail'; W.inv.up = { weapon: 3, body: 1 }; W.inv.ash = 100; const ev = die(W); ok(W.inv.up.weapon === 2 && !W.inv.up.body && ev.burned === 2, 'на «Затмении» не сгорели уровни: ' + JSON.stringify(W.inv.up)); }
{ const W = mk('berserk'); W.inv.up = { weapon: 3 }; W.inv.eq.weapon = 'w_sword_steel'; die(W); ok(W.inv.up.weapon === 3, 'уровни не должны гореть на «Берсерке»'); }
{ const W = mk('eclipse'); W.iron = true; const ev = die(W); ok(ev.iron === true, 'железный режим не помечен'); }
// сохранение
{ const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const W = mk('ashen'); W.iron = false; W.tomb = { x: 12, z: -8, ash: 90 }; createSaver(W, st).write(true); const l = loadSave(30, st); ok(l.difficulty === 'ashen' && l.iron === false && l.tomb.ash === 90 && l.tomb.x === 12, 'сложность и могила не сохранились: ' + JSON.stringify([l.difficulty, l.tomb]));
  W.iron = true; createSaver(W, st).write(true); ok(loadSave(30, st).iron === true, 'железный режим не сохранился');
  mem['berserk3d.save'] = JSON.stringify({ v: 1, inv: {}, difficulty: 5, tomb: { x: 'a', z: 1, ash: 3 }, iron: 'да' }); const g = loadSave(30, st); ok(g.difficulty === null && g.tomb === null && g.iron === false, 'мусор в сохранении: ' + JSON.stringify([g.difficulty, g.tomb, g.iron]));
  mem['berserk3d.save'] = JSON.stringify({ v: 1, inv: {}, kills: 2 }); const o = loadSave(30, st); ok(o.difficulty === null && o.tomb === null && o.iron === false, 'старое сохранение без сложности');
  const W2 = mk('berserk'); W2.ironDead = true; const sv = createSaver(W2, st); sv.write(true); ok(JSON.parse(mem['berserk3d.save']).kills === 2, 'после смерти в железном режиме сохранение перезаписано'); }
// лестница выживаемости: бот в «железе» в середине мира (шесть прогонов, поэтому допуск на один случайный провал: .17)
{ const TIER = { weapon: 'w_sword_iron', body: 'a_body_jerkin_leather', head: 'a_head_cap_leather', boots: 'a_boots_boots_leather' };
  const surv = d => { let dead = 0, kills = 0; const N = Number(process.env.DIF_SEEDS || 6); /* DIF_SEEDS — больше прогонов для точной оценки */ for (let sd = 0; sd < N; sd++) { const W = mk(d, 50 + sd, c => { c.enemies.count = 5; c.bosses.list = []; }); Object.assign(W.inv.eq, TIER); W.player.x = -20; W.player.z = -40; const dod = mulberry32(sd);
      for (let i = 0; i < 60 * 80; i++) { const p = W.player, en = aliveEnemies(W); let t = null, bd = 1e9; for (const e of en) { const dd = Math.hypot(e.x - p.x, e.z - p.z); if (dd < bd) { bd = dd; t = e; } } const inp = { mx: 0, mz: 0, attack: false, roll: false };
        if (t && bd < 30) { const C = W.cfg.enemies[t.type], reach = W.cfg.player.attackRange + W.gear.reach + C.radius * .5; if (bd > reach * .8) { inp.mx = (t.x - p.x) / bd; inp.mz = (t.z - p.z) / bd; } inp.attackPress = bd < reach + .4; if (t.state === 'wind' && bd < C.range + 1.2 && t.t > C.wind * .6 && p.rollCd <= 0 && dod() < .5) inp.roll = true; }
        telegraphDodge(W, inp, dod);     // подсветка на земле и полоса рывка (этап 2 «круче»)
        step(W, 1 / 60, inp); if (p.dead) { dead++; break; } } kills += W.kills; } return { dead: dead / N, kills: kills / N }; };
  const r = IDS.map(surv); console.log('выживаемость по сложностям (смертей, убийств):', r.map((x, i) => `${IDS[i]} ${(x.dead * 100).toFixed(0)}% / ${x.kills.toFixed(0)}`).join(' | '));
  for (let i = 1; i < r.length; i++) ok(r[i].dead >= r[i - 1].dead - .18 && r[i].kills <= r[i - 1].kills + 3, `выживаемость не падает с ростом сложности на ${IDS[i]}`); ok(r[3].dead > r[0].dead + .3, '«Затмение» должно быть заметно смертельнее «Странника»'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Сложность 3D: OK');
