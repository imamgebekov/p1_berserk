// Отдельные герои (2026-10-23, просьба владельца «как в WoW»): у каждого героя свои сумка с надетым и пеплом, место в мире,
// могила, наёмники; смена героя ставит другого героя на его место; из подземелья прежний герой уходит к месту спуска;
// сохранение хранит слоты героев; старое сохранение (без слотов) — всё текущему герою, остальным — новая сумка в лагере.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, refreshGear, switchHero, travel, restoreAllies } from '../3d/src/sim.js';
import { HEROES } from '../3d/src/data/heroes3d.js';
import { resolve } from '../3d/src/map.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const mk = (hero = 'thorn') => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.bosses.list = []; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(7)); W.hero = hero; W.inv.eq.weapon = HEROES[hero].start; refreshGear(W); W.player.hp = W.player.maxhp; return W; };
const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; }, o }; };
const goTo = (W, x, z) => { const p = W.player; p.x = x; p.z = z; resolve(W.map, p, W.cfg.player.radius); return { x: p.x, z: p.z }; };
const near = (a, b, d = .6) => !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) < d;
const start = CFG3.player.start;

const W = mk('thorn');
// ---------- 1. сумка, пепел, место ----------
const thornAt = goTo(W, 14, -9); W.inv.ash = 500; W.inv.bag.push({ id: 'w_sword_iron', n: 1 }); W.player.hp = 37;
ok(!switchHero(W, 'thorn') && !switchHero(W, 'nobody'), 'смена на того же или неизвестного героя прошла');
ok(switchHero(W, 'jay') && W.hero === 'jay', 'Сойка не выбралась');
ok(W.inv.ash === 0 && !W.inv.bag.length && W.inv.eq.weapon === HEROES.jay.start, 'новая Сойка не с пустой сумкой, без пепла или без лука');
ok(near(W.player, start, 1.5) && W.player.hp === W.player.maxhp, 'новая Сойка не в точке появления или не с полным здоровьем');
ok(W.heroes.thorn.inv.ash === 500 && W.heroes.thorn.inv.bag.some(s => s.id === 'w_sword_iron') && near(W.heroes.thorn.pos, thornAt) && W.heroes.thorn.hp === 37, 'слот Торна не хранит сумку, пепел, место или здоровье');
const jayAt = goTo(W, -16, 11); W.inv.ash = 50;
ok(switchHero(W, 'thorn') && near(W.player, thornAt) && W.inv.ash === 500 && W.player.hp === 37, 'Торн встал не на своё место или без своего пепла');
ok(switchHero(W, 'jay') && near(W.player, jayAt) && W.inv.ash === 50, 'Сойка встала не на своё место');
ok(switchHero(W, 'thorn'), 'Торн не вернулся');

// ---------- 2. могила и наёмники ----------
W.tomb = { x: thornAt.x + 3, z: thornAt.z, ash: 120, lvl: 'surface' };
restoreAllies(W, [{ type: 'c_vale', hp: 40 }]);
ok(W.allies.some(a => a.type === 'c_vale'), 'наёмник Торна не встал');
ok(switchHero(W, 'jay') && !W.tomb && !W.allies.some(a => a.type === 'c_vale'), 'Сойке достались могила или отряд Торна');
ok(switchHero(W, 'thorn') && W.tomb && W.tomb.ash === 120 && W.allies.some(a => a.type === 'c_vale'), 'Торну не вернулись могила или отряд');

// ---------- 3. подземелье: место спуска ----------
{ const D = CFG3.dungeons.list.find(d => W.levels[d.id] && W.levels[d.id].def && !W.levels[d.id].def.inst) || CFG3.dungeons.list[0];
  const down = goTo(W, thornAt.x - 4, thornAt.z + 2), e = W.levels[D.id].def.entry;
  ok(travel(W, D.id, e.x, e.z) && W.lvl === D.id && near(W.surfPos, down, .05), 'спуск в подземелье не запомнил место');
  const st = mem(); createSaver(W, st).write(true); ok(near(JSON.parse(st.o['berserk3d.save']).pos, down, .05), 'сохранение в подземелье — не место спуска');
  ok(switchHero(W, 'jay') && W.lvl === 'surface' && near(W.player, jayAt), 'смена героя в подземелье: Сойка не наверху на своём месте');
  ok(near(W.heroes.thorn.pos, down, .05), 'Торн из подземелья — не у места спуска');
  ok(switchHero(W, 'thorn') && W.lvl === 'surface' && near(W.player, down), 'Торн встал не у места спуска'); }

// ---------- 4. мёртвый герой не меняется ----------
W.player.dead = true; ok(!switchHero(W, 'jay') && W.hero === 'thorn', 'мёртвый герой сменился'); W.player.dead = false;

// ---------- 5. сохранение и загрузка слотов ----------
{ ok(switchHero(W, 'jay'), 'Сойка не выбралась перед сохранением');
  const st = mem(); createSaver(W, st).write(true); const sv = loadSave(40, st), t = sv && sv.heroes.thorn;
  ok(sv && sv.hero === 'jay' && sv.inv.ash === 50, 'загрузка: не Сойка или не её пепел');
  ok(t && t.inv && t.inv.ash === 500 && t.inv.bag.some(s => s.id === 'w_sword_iron') && t.inv.eq.weapon === HEROES.thorn.start, 'загрузка: сумка Торна потерялась');
  ok(t && near(t.pos, W.heroes.thorn.pos, .05) && t.tomb && t.tomb.ash === 120 && t.squad.some(q => q.type === 'c_vale') && t.hp > 0, 'загрузка: место, могила, отряд или здоровье Торна потерялись');
  const bad = JSON.parse(st.o['berserk3d.save']); bad.heroes.thorn.pos = { x: 1e9, z: 0 }; bad.heroes.thorn.tomb = { x: 'a' }; bad.heroes.thorn.squad = 'x'; bad.heroes.thorn.hp = -5; st.setItem('berserk3d.save', JSON.stringify(bad));
  const sb = loadSave(40, st); ok(sb && sb.heroes.thorn.pos === null && sb.heroes.thorn.tomb === null && Array.isArray(sb.heroes.thorn.squad) && sb.heroes.thorn.hp === null, 'испорченный слот героя принят'); }

// ---------- 6. старое сохранение (до отдельных героев): всё — текущему, остальным — новая сумка ----------
{ const O = mk('thorn'); goTo(O, 14, -9); O.inv.ash = 900; O.inv.bag.push({ id: 'w_sword_iron', n: 1 }); O.lv = 12; restoreAllies(O, [{ type: 'c_vale', hp: 40 }]);
  const st = mem(); createSaver(O, st).write(true);
  const d = JSON.parse(st.o['berserk3d.save']); d.heroes = { jay: { lv: 9, xp: 0, sp: 8, skills: {}, ap: 0, ab: {}, bar: [], school: 0, sch: {} } }; st.setItem('berserk3d.save', JSON.stringify(d));     // так писала прежняя версия: у отложенного героя — только уровень и умения
  const sv = loadSave(40, st); ok(sv && sv.inv.ash === 900 && sv.inv.bag.some(s => s.id === 'w_sword_iron') && sv.squad.length === 1 && sv.heroes.jay && sv.heroes.jay.lv === 9 && sv.heroes.jay.inv === null, 'старое сохранение: вещи текущего героя или уровень Сойки потерялись');
  const N = mk('thorn'); N.inv = sv.inv; N.heroes = sv.heroes; Object.assign(N, sv.prog); goTo(N, sv.pos.x, sv.pos.z); restoreAllies(N, sv.squad); refreshGear(N);     // как main.js
  ok(switchHero(N, 'jay') && N.lv === 9 && N.inv.ash === 0 && N.inv.eq.weapon === HEROES.jay.start && !N.inv.bag.length && near(N.player, start, 1.5), 'старое сохранение: Сойка не со своим уровнем, не с новой сумкой или не в лагере');
  ok(N.heroes.thorn.inv.ash === 900 && N.heroes.thorn.squad.length === 1, 'старое сохранение: Торн потерял пепел или отряд при смене'); }

if (fails.length) { console.log('Отдельные герои 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('Отдельные герои 3D: OK (сумка, пепел, место, могила, отряд, подземелье, сохранение, старое сохранение)');
