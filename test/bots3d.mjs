// Боты-«игроки» (план «живой мир», этап 5, владелец 2026-10-28 «живут сами»): ботов n, у каждого имя, класс, уровень, вещи и место;
// бот сам бьёт врага рядом и убивает его, враг бьёт бота; герою за это ни опыта, ни счёта убийств; бот лутает своё тело;
// вдали бот в дешёвом режиме (не в W.allies) и растёт по таймеру; в сохранение отряда боты не попадают; без W.wantBots ботов нет.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, spawnEnemy } from '../3d/src/sim.js';
import { packSquad } from '../3d/src/squad3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, C = CFG3.bots;
{ const W = createWorld(CFG3, mulberry32(3)); step(W, 1 / 30, {}); ok(!W.bots, 'боты появились без wantBots (тесты боя сдвинутся)'); }
const W = createWorld(CFG3, mulberry32(3)), p = W.player; W.wantBots = true; p.maxhp = p.hp = 1e9; step(W, 1 / 30, {});
ok(W.bots && W.bots.length === C.n, `ботов ${W.bots && W.bots.length}`);
ok(new Set(W.bots.map(b => b.name)).size === W.bots.length && W.bots.every(b => !/Бог/i.test(b.name)), 'имена ботов повторяются или со словом «Бог»');
ok(W.bots.every(b => b.lv >= 1 && b.lv <= 60 && C.classes[b.hero] && b.eq.weapon && b.maxhp > 0), 'у бота нет уровня, класса, оружия или здоровья');
{ const cut = W.botHomes.map(h => h.lv).sort((u, v) => u - v)[C.start - 1] + 2; ok(W.bots.filter(b => b.lv <= cut).length >= C.start, `у начала мало ботов малого уровня (до ${cut})`); }
// бой рядом с героем: бот находит врага, бьёт, враг бьёт бота; опыта и счёта убийств герою нет; бот лутает тело
const b = W.bots.slice().sort((u, v) => u.lv - v.lv)[0];
p.x = b.x + 12; p.z = b.z; W.enemies.length = 0; step(W, 1 / 30, {});
ok(W.allies.includes(b), 'бот рядом не в бою (нет в W.allies)');
const xp0 = W.xp, k0 = W.kills, e = spawnEnemy(W, 'brute', b.x + 4, b.z); e.lvl = b.lv; let minHp = b.hp, t = 0;
for (; t < 40 && !e.dead && !b.dead; t += 1 / 30) { step(W, 1 / 30, {}); minHp = Math.min(minHp, b.hp); p.x = b.x + 12; p.z = b.z; }
ok(e.dead && W.bots.some(x => x.id === e.byBot), `бот не убил врага за ${t.toFixed(0)} с (враг ${e.hp}/${e.maxhp}, бот ${b.dead ? 'погиб' : b.hp})`);
ok(minHp < b.maxhp, 'враг не бил бота');
ok(W.xp === xp0 && W.kills === k0, 'герою дали опыт или счёт за убийство ботом');
for (let i = 0; i < 15 * 30 && (W.corpses || []).some(c => c.id === 'c' + e.id); i++) { step(W, 1 / 30, {}); p.x = b.x + 12; p.z = b.z; }
ok(!(W.corpses || []).some(c => c.id === 'c' + e.id), 'бот не залутал своё тело');
ok(!packSquad(W).length, 'бот попал в сохранение отряда');
// вдали: не в W.allies, растёт по таймерам
p.x += 600; const kills0 = b.kills; for (let i = 0; i < 300; i++) step(W, .5, {});
ok(!W.allies.some(a => a.bot), 'боты вдали остались в W.allies');
ok(b.kills > kills0, 'бот вдали не растёт');
ok(W.allies.filter(a => a.bot).length <= C.cap, 'ботов в бою больше cap');
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Боты 3D: OK (ботов ${W.bots.length}, бой ${t.toFixed(1)} с, бот после боя ${Math.round(minHp)}/${b.maxhp})`);
