// Тест новых врагов 3D (шаг P4): щитоносец (щит спереди, обход, удар из переката и тяжёлый удар), тлеющий (фитиль и взрыв, задевающий и врагов),
// копейщик (прицел и рывок, от которого уходит перекат, стена останавливает), тень (появляется за спиной, не прыгает в стену), ночные виды, род в подписях элиты.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy, refreshGear, travel } from '../3d/src/sim.js';
import { eliteName } from '../3d/src/foes3d.js';
import { DROPS } from '../3d/src/data/loot.js';
import { bestiaryEntry } from '../3d/src/craft3d.js';
import { QUESTS } from '../3d/src/data/quests3d.js';
import { roomAt } from '../3d/src/map.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const clone = () => JSON.parse(JSON.stringify(CFG3));
const mk = (seed = 1, tweak) => { const c = clone(); c.enemies.count = 0; c.bosses.list = []; c.map.places = c.map.places.filter(p => !p.safe); if (tweak) tweak(c); const W = createWorld(c, mulberry32(seed)); W.player.x = 30; W.player.z = 24; return W; };     // склад рядом вырос (дома крупнее с 3.90)
const run = (W, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, typeof input === 'function' ? input(i) : input); };
const NEW = ['shield', 'bomber', 'lunger', 'shade'];
const near = (W, type, d, ang = 0) => { const p = W.player; const e = spawnEnemy(W, type, p.x + Math.sin(ang) * d, p.z + Math.cos(ang) * d); e.cd = 99; return e; };

// ---------- 1. данные: поведение, добыча, бестиарий, области, задания ----------
for (const t of NEW) {
  const C = CFG3.enemies[t];
  ok(C && C.ai && C.name, `${t}: нет поведения или имени`);
  ok(DROPS[t], `${t}: нет добычи`);
  ok(Object.values(CFG3.enemies.regions).some(r => r.some(x => x[0] === t)), `${t}: нигде не водится`);
  const b = bestiaryEntry(t, CFG3); ok(b && b.name === C.name && b.where.length, `${t}: запись бестиария`);
}
ok(QUESTS.some(q => q.enemy === 'shield') && QUESTS.some(q => q.enemy === 'bomber'), 'нет заданий на новых врагов');
// род в подписи элиты
{ const W = mk(); const e = spawnEnemy(W, 'hound', 0, 0); e.elite = true; e.aff = 'burning'; const A = CFG3.elite.affixes.burning; e.affName = CFG3.enemies.hound.g === 'f' ? A.nameF : A.name;
  ok(eliteName(W, e) === 'Пылающая Гончая', 'род: ' + eliteName(W, e));
  const W2 = mk(); let fem = null; for (let i = 0; i < 400 && !fem; i++) { const x = spawnEnemy(W2, 'hound', 50 + i, 0); if (x.elite) fem = x; }
  ok(fem && /ая |а /.test(eliteName(W2, fem)), 'элитная гончая — в женском роде: ' + (fem && eliteName(W2, fem))); }

// ---------- 2. щитоносец ----------
{
  const hitFrom = (ang, input = {}, setup) => {
    const W = mk(2); W.inv.eq.weapon = 'w_sword_steel'; refreshGear(W); W.player.inv = 99;
    const e = near(W, 'shield', 1.6, 0); e.hp = e.maxhp = 99999; e.face = Math.PI + ang; e.alert = true; W.player.face = 0; W.cfg.player.autoAim = 0;
    if (setup) setup(W, e);
    let dmg = 0; for (let i = 0; i < 30; i++) { step(W, 1 / 60, i === 0 ? { attackPress: true, ...input } : {}); for (const v of W.ev) if (v.k === 'hit' && v.id === e.id) dmg += v.dmg; W.ev.length = 0; e.face = Math.PI + ang; }
    return dmg;
  };
  const avg = (f, n = 12) => { let s = 0; for (let i = 0; i < n; i++) s += f(); return s / n; };
  const front = avg(() => hitFrom(0)), back = avg(() => hitFrom(Math.PI)), side = avg(() => hitFrom(Math.PI / 2 + .4));
  ok(front > 0 && front < back * .3, `щит спереди держит: спереди ${front.toFixed(1)}, сзади ${back.toFixed(1)}`);
  ok(side > back * .7, `сбоку щит не держит: ${side.toFixed(1)} из ${back.toFixed(1)}`);
  const roll = avg(() => hitFrom(0, {}, W => { W.player.lastRollEnd = W.t; }));
  ok(roll > back * .9, `удар из переката пробивает щит: ${roll.toFixed(1)}`);
  // поворачивается медленно: герой обежал — щит отстаёт
  const W = mk(3); const e = near(W, 'shield', 3, 0); e.alert = true; e.face = Math.PI;
  W.player.x = e.x; W.player.z = e.z + 3; step(W, 1 / 60, {});
  ok(Math.abs(Math.abs(e.face) - Math.PI) < .2, 'щитоносец разворачивается мгновенно');
}

// ---------- 3. тлеющий ----------
{
  const W = mk(4); W.player.hp = W.player.maxhp = 9999;
  const b = near(W, 'bomber', 6, 0); b.alert = true; const other = near(W, 'imp', 2.2, .3); other.hp = other.maxhp = 999; other.alert = false;
  let fuseAt = -1; for (let i = 0; i < 180 && fuseAt < 0; i++) { step(W, 1 / 60, {}); if (b.state === 'fuse') fuseAt = i; }
  ok(fuseAt >= 0 && Math.hypot(b.x - W.player.x, b.z - W.player.z) < CFG3.enemies.bomber.fuse.at + .3, 'тлеющий подбежал и поджёг фитиль');
  const hp0 = W.player.hp, ohp = other.hp;
  run(W, CFG3.enemies.bomber.fuse.t + .1);
  ok(b.dead, 'после взрыва тлеющий гибнет');
  ok(W.player.hp < hp0, 'взрыв ранит героя рядом');
  ok(other.hp < ohp || other.dead, 'взрыв задевает и других врагов');
  // убит до фитиля — взрыва нет
  const W2 = mk(5); W2.cfg.enemies.bomber.fuse.at = 1;      // фитиль только вплотную: успеваем ударить раньше
  const b2 = near(W2, 'bomber', 2.3, 0); b2.hp = 1; W2.player.face = 0;
  run(W2, .3, i => ({ attackPress: i === 0 }));
  ok(b2.dead && !W2.haz.some(h => h.bomber), 'убитый до фитиля не взрывается');
  // убежал за радиус — не задело
  const W3 = mk(6); const b3 = near(W3, 'bomber', 5, 0); b3.alert = true; for (let i = 0; i < 180 && b3.state !== 'fuse'; i++) step(W3, 1 / 60, {});
  const h3 = W3.player.hp; run(W3, CFG3.enemies.bomber.fuse.t + .1, { mz: -1 });
  ok(W3.player.hp >= h3, 'отбежавший герой цел');      // может подлечиться, но не пострадать
}

// ---------- 4. копейщик ----------
{
  const L = CFG3.enemies.lunger.lunge;
  const W = mk(7); W.player.hp = W.player.maxhp = 9999; const e = near(W, 'lunger', 6.5, 0); e.alert = true;
  let aimAt = -1; for (let i = 0; i < 60 && aimAt < 0; i++) { step(W, 1 / 60, {}); if (e.state === 'aim') aimAt = i; }
  ok(aimAt >= 0 && e.tele, 'копейщик целится (полоса на земле)');
  const hp0 = W.player.hp; run(W, L.aim + L.len / L.speed + .2);
  ok(W.player.hp < hp0, 'рывок попадает в стоящего');
  // перекат вбок во время прицела спасает
  const W2 = mk(7); const e2 = near(W2, 'lunger', 6.5, 0); e2.alert = true;
  for (let i = 0; i < 60 && e2.state !== 'aim'; i++) step(W2, 1 / 60, {});
  const h2 = W2.player.hp; step(W2, 1 / 60, { roll: true, mx: 1 }); run(W2, L.aim + L.len / L.speed + .2, { mx: 1 });
  ok(W2.player.hp === h2, 'перекат вбок спасает от рывка');
  ok(e2.state === 'rec' || e2.state === 'chase', 'после рывка — восстановление');
  // стена: в погребе рывок упирается в стену и не выходит из комнат
  const W3 = mk(8, c => { for (const d of c.dungeons.list) d.spawns = []; }); const D = W3.cfg.dungeons.list[0];
  travel(W3, D.id, D.entry.x, D.entry.z); W3.player.hp = W3.player.maxhp = 9999;
  const e3 = spawnEnemy(W3, 'lunger', D.entry.x + 5, D.entry.z); e3.alert = true; e3.cd = 99; e3.state = 'aim'; e3.t = L.aim; e3.face = -Math.PI / 2 - .9; e3.tele = { len: L.len, w: L.w, aim: L.aim };
  run(W3, 1);
  ok(roomAt(W3.map, e3.x, e3.z) >= 0, 'рывок вывел копейщика за стены');
}

// ---------- 5. тень ----------
{
  const W = mk(9); W.player.hp = W.player.maxhp = 9999; W.player.face = 0; const e = near(W, 'shade', 8, 0); e.alert = true;
  let moved = false; for (let i = 0; i < 30 && !moved; i++) { step(W, 1 / 60, {}); if (W.ev.some(v => v.k === 'blink')) moved = true; }
  const p = W.player, behind = Math.hypot(e.x - (p.x - Math.sin(p.face) * CFG3.enemies.shade.blink.behind), e.z - (p.z - Math.cos(p.face) * CFG3.enemies.shade.blink.behind));
  ok(moved && behind < .8, `тень появилась за спиной (${behind.toFixed(2)} м)`);
  ok(e.state === 'wind' && e.t < .05, 'после появления — длинный замах');
  // в погребе у стены: за спиной стена — не прыгает в неё
  const W2 = mk(10, c => { for (const d of c.dungeons.list) d.spawns = []; }); const D = W2.cfg.dungeons.list[0];
  travel(W2, D.id, -4, 0); W2.player.face = Math.PI / 2;     // спиной к западной стене
  const e2 = spawnEnemy(W2, 'shade', 3.5, 0); e2.alert = true; e2.cd = 99;
  run(W2, .5);
  ok(roomAt(W2.map, e2.x, e2.z) >= 0, 'тень прыгнула в стену');
}

// ---------- 6. ночные виды ----------
{
  const count = night => { let shades = 0; for (let s = 0; s < 3; s++) { const W = mk(20 + s, c => { c.enemies.count = 8; c.enemies.roam.on = false; }); W.player.x = -50; W.player.z = -35; if (night) W.t = 200; run(W, 25, { mx: Math.sin(s) * .2 }); shades += W.enemies.filter(e => e.type === 'shade').length + (W.known.bestiary.shade ? 0 : 0); } return shades; };
  ok(count(false) === 0, 'тень появилась днём');
  ok(count(true) > 0, 'ночью на кладбище теней нет');
}

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Новые враги 3D: OK');
