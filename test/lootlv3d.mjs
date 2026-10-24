// Уровень и редкость добычи (4.20, просьба владельца): уровень вещи — от уровня героя по месту и роду врага (мир −10…−5 / −5…−3 / −2…−1,
// до 10-го без минуса; подземелье −7…−5 / −4…−2 / как герой; рейд −3…−2 / +1…+3 / +3…+5), не выше 80; герой много выше врага —
// не выше уровня врага + over. Седьмая редкость «Багровый»: вещи есть, с врагов — только с 40-го и редко. Босс рейда: своя вещь
// наверняка, вторая — примерно в половине случаев.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, spawnBoss, killEnemy, lootIl } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
import { RARITY, CATALOG, BY_ID } from '../3d/src/data/items.js';
import { rarityWeights } from '../3d/src/data/loot.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const G = CFG3.lootIl;
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; c.lockout.on = false; const W = createWorld(c, mulberry32(11)); W.player.hp = W.player.maxhp = 1e6; return W; };
const range = (W, e, n = 40) => { const v = []; for (let i = 0; i < n; i++) { W.t = i * .37; v.push(lootIl(W, e, e.id + i)); } return [Math.min(...v), Math.max(...v)]; };
const inR = ([a, b], lo, hi) => a >= lo && b <= hi;

// мир
{ const W = mk(), p = W.player; W.lv = 30; const e = spawnEnemy(W, 'brute', p.x + 5, p.z); e.lvl = 30;
  const r = range(W, e); ok(inR(r, 20, 25) && r[0] < r[1], 'мир, обычный: ' + r);
  e.elite = true; ok(inR(range(W, e), 25, 27), 'мир, элита: ' + range(W, e)); e.elite = false;
  W.lv = 8; e.lvl = 8; ok(inR(range(W, e), 8, 8), 'мир до 10-го — без минуса: ' + range(W, e));
  W.lv = 50; e.lvl = 12; ok(range(W, e)[1] <= 12 + G.over, 'герой много выше врага — вещь выше врага + over: ' + range(W, e)); }
// подземелье: обычный, промежуточный и главный босс
{ const W = mk(), id = 'inst_moss', d = W.cfg.dungeons.list.find(q => q.id === id); W.lv = 30; travel(W, id, d.entry.x, d.entry.z); step(W, 1 / 60, {});
  const p = W.player, e = spawnEnemy(W, 'brute', p.x + 2, p.z); e.lvl = 30; ok(inR(range(W, e), 23, 25), 'подземелье, обычный: ' + range(W, e));
  const bs = W.enemies.filter(q => q.boss); for (const b of bs) b.lvl = 30;
  const fin = bs.find(b => b.b.def.final), mid = bs.find(b => !b.b.def.final);
  ok(fin && inR(range(W, fin), 30, 30), 'подземелье, главный босс — как герой: ' + (fin && range(W, fin)));
  ok(mid && inR(range(W, mid), 26, 28), 'подземелье, промежуточный босс: ' + (mid && range(W, mid))); }
// рейд и предел
{ const W = mk(), id = 'raid_oak', d = W.cfg.dungeons.list.find(q => q.id === id); W.lv = 21; travel(W, id, d.entry.x, d.entry.z); step(W, 1 / 60, {});
  const p = W.player, e = spawnEnemy(W, 'brute', p.x + 2, p.z); e.lvl = 21; ok(inR(range(W, e), 18, 19), 'рейд, обычный: ' + range(W, e));
  const b = W.enemies.find(q => q.boss); b.lvl = 21; ok(inR(range(W, b), 24, 26), 'рейд, босс +3…+5: ' + range(W, b));
  W.lv = 79; b.lvl = 80; ok(range(W, b)[1] === G.cap, 'нет предела 80: ' + range(W, b));
  // своя вещь рейда: одна наверняка, вторая — около половины
  let one = 0, two = 0; W.lv = 21;
  for (let k = 0; k < 120; k++) { const bd = W.enemies.find(q => q.boss && !q.dead) || null; if (!bd) break; const own = new Set(bd.b.def.loot || []); W.drops.length = 0; killEnemy(W, bd, 1);
    const n = W.drops.filter(q => own.has(q.id)).length; if (n >= 1) one++; if (n >= 2) two++; if (!W.enemies.some(q => q.boss && !q.dead)) { const def = W.cfg.bosses.list.find(q => q.level === id); delete W.bossDead[def.type]; const nb = spawnBoss(W, def); nb.lvl = 21; } }
  ok(one >= 100 && two > one * .35 && two < one * .65, `рейд: своя вещь ${one}, вторая ${two}`); }
// багровые
{ ok(RARITY[6] && RARITY[6].name === 'Багровый', 'нет седьмой редкости');
  const red = CATALOG.filter(i => i.rar === 6); ok(red.length >= 20 && red.some(i => i.slot === 'weapon') && red.some(i => i.cat === 'armor'), 'багровых вещей мало: ' + red.length);
  const blk = BY_ID.w_sword_black, rs = BY_ID.w_sword_crimson; ok(rs && rs.stats.dmg >= blk.stats.dmg * 1.4, 'багровый меч не сильнее чёрного в 1,45 раза');
  const share = lvl => { const w = rarityWeights(0, 0, 0, { lvl, L: CFG3.loot }); return (w[6] || 0) / w.reduce((a, b) => a + (b || 0), 0); };
  ok(share(30) === 0 && share(60) > 0 && share(60) < .01, `доля багровых: ур.30 ${share(30)}, ур.60 ${share(60).toFixed(4)}`); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Уровень и редкость добычи 3D: OK');
