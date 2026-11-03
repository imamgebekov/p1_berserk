// Разговор с ботом 3D (шаг 2, 2026-11-03): бот рядом находится; товар по уровню бота, не больше stock; покупка списывает пепел и кладёт вещь;
// позвать в отряд: пепел, место в отряде, боец-герой не свой; бот уходит из W.bots в отряд со своими вещами; издали нельзя.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { nearBot, stockOf, buyFrom, recruit, recruitBlock, recruitCost, squadTypeOf } from '../3d/src/botsocial3d.js';
import { liveAllies } from '../3d/src/squad3d.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); }, T = CFG3.bots.talk;
const W = createWorld(CFG3, mulberry32(5)), p = W.player; W.wantBots = true; p.maxhp = p.hp = 1e9; step(W, 1 / 30, {});
const a = W.bots.find(b => b.hero !== W.hero && squadTypeOf(W, b)); ok(!!a, 'нет бота с отрядным типом');
p.x = a.x + 12; p.z = a.z; ok(nearBot(W) === null, 'бот издали найден'); ok(recruitBlock(W, a) === 'far' && buyFrom(W, a, 0) === 'far', 'издали можно говорить');
p.x = a.x + 1.5; p.z = a.z; W.enemies.length = 0; ok(nearBot(W) === a, 'бот рядом не найден');
const st = stockOf(W, a); ok(st.length >= 1 && st.length <= T.stock && st.every(s => BY_ID[s.id].slot && s.price > 0), 'товар бота неверен'); ok(stockOf(W, a) === st, 'товар не запоминается');
W.inv.ash = 0; ok(buyFrom(W, a, 0) === 'ash', 'купил без пепла');
{ const s0 = st[0], n0 = st.length; W.inv.ash = s0.price + 3; const bag0 = W.inv.bag.length; ok(buyFrom(W, a, 0) === 'ok' && W.inv.ash === 3 && W.inv.bag.length === bag0 + 1 && st.length === n0 - 1, 'покупка не списала пепел или не дала вещь'); }
const need = recruitCost(W, a); ok(need === Math.round(T.hire.base + T.hire.perLv * a.lv), 'цена приглашения');
W.lv = 45; W.inv.ash = need - 1; ok(recruitBlock(W, a) === 'ash' && recruit(W, a) === 'ash', 'позвал без пепла');
W.inv.ash = need + 5; const n0 = W.bots.length, l0 = liveAllies(W).length, eq = { ...a.eq };
ok(recruit(W, a) === 'ok' && W.inv.ash === 5, 'приглашение не прошло'); ok(W.bots.length === n0 - 1 && !W.bots.includes(a) && !W.allies.includes(a), 'бот остался в мире ботов'); ok(liveAllies(W).length === l0 + 1, 'в отряде не прибавилось');
{ const ally = liveAllies(W).find(x => x.nick === a.name); ok(ally && ally.eq && ally.eq.weapon === eq.weapon, 'бот не взял свои вещи'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Разговор с ботом 3D: OK');
