// Тест советов первопроходцу (4.01): совет приходит по поводу (сбор → отвар, кузнец — после Пожирателя, наём — с уровня),
// один за раз, засчитывается по событию или состоянию, награда один раз; сделанное раньше — без слов и награды; сохранение чистится.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { LESSONS, mentorFresh, mentorEvent, mentorTick, mentorLine, sanitizeMentor } from '../3d/src/mentor3d.js';
import { pathFresh } from '../3d/src/ashpath3d.js';
import { sellJunk } from '../3d/src/economy3d.js';
import { BY_ID } from '../3d/src/data/items.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(2)); W.spark = { done: true }; W.mentor = mentorFresh(); W.path = pathFresh(W); W.inv.bag.length = 0; W.lv = 1; return W; };
const tick = W => { for (let i = 0; i < 20; i++) { const r = mentorTick(W); if (r) return r; } return null; };

ok(LESSONS.every(L => L.lines.length === 2 && L.task && typeof L.when === 'function' && typeof L.done === 'function'), 'совет без реплик или задачи');
// пусто — молчит
{ const W = mk(); ok(tick(W) === null && !mentorLine(W), 'совет без повода'); }
// сбор → отвар: старт, строка, засчёт, награда один раз
{
  const W = mk(); mentorEvent(W, { k: 'gather' }); const r = tick(W);
  ok(r && r.k === 'start' && r.L.id === 'brew' && /отвар/.test(mentorLine(W).text), 'после сбора нет совета про отвар: ' + JSON.stringify(r && r.L.id));
  ok(tick(W) === null, 'совет засчитан без дела');
  const ash0 = W.inv.ash; mentorEvent(W, { k: 'craft', id: 'p_heal1' }); const d = mentorTick(W);
  ok(d && d.k === 'done' && W.inv.ash === ash0 + CFG3.mentor.ash && W.mentor.done.brew, 'отвар не засчитан');
  ok(!mentorLine(W) && mentorTick(W) === null && W.inv.ash === ash0 + CFG3.mentor.ash, 'награда дважды или совет остался');
}
// кузнец — только после первой победы над боссом; ковка — у кузнеца
{
  const W = mk(); W.inv.bag.push({ id: 'm_ore', n: 3 }); mentorEvent(W, { k: 'gather' }); W.mentor.done.brew = 1;
  ok(!['smith', 'forge'].includes(W.mentor.cur) && (tick(W) || {}).L?.id !== 'smith', 'совет кузнеца до Пожирателя');
  W.mentor.cur = null; W.path.slain.devourer = true; let r = tick(W); while (r && r.L.id !== 'smith') { W.mentor.done[r.L.id] = 1; W.mentor.cur = null; r = tick(W); }
  ok(r && r.L.id === 'smith' && mentorLine(W).at, 'нет совета кузнеца после Пожирателя или нет точки');
  mentorEvent(W, { k: 'upgrade' }); ok(mentorTick(W).k === 'done', 'улучшение не засчитано');
  r = tick(W); ok(r && r.L.id === 'forge', 'нет совета про слиток: ' + (r && r.L.id));
  W.nearNpc = 'merchant'; mentorEvent(W, { k: 'craft', id: 'm_ingot' }); ok(mentorTick(W) === null, 'ковка не у кузнеца засчитана');
  W.nearNpc = 'smith'; mentorEvent(W, { k: 'craft', id: 'm_ingot' }); ok((mentorTick(W) || {}).k === 'done', 'слиток у кузнеца не засчитан');
}
// продажа хлама — по настоящему событию продажи
{
  const W = mk(); W.lv = 2; const curio = Object.values(BY_ID).find(i => i.cat === 'curio'); W.inv.bag.push({ id: curio.id, n: 2 });
  const r = tick(W); ok(r && r.L.id === 'sell', 'нет совета про хлам: ' + (r && r.L.id));
  W.nearMerchant = true; W.night = false; sellJunk(W); for (const v of W.ev) mentorEvent(W, v); ok((mentorTick(W) || {}).k === 'done', 'продажа хлама не засчитана');
}
// библиотека: с уровня; разбор → зачарование
{
  const W = mk(); W.lv = CFG3.mentor.libraryLv; const r = tick(W); ok(r && r.L.id === 'library' && mentorLine(W).at, 'нет совета книжницы: ' + (r && r.L.id));
  mentorEvent(W, { k: 'disenchant' }); ok(mentorTick(W).k === 'done', 'разбор не засчитан'); const r2 = tick(W); ok(r2 && r2.L.id === 'enchant', 'нет совета про зачарование');
}
// ветеран: уже сделанное засчитывается молча, без награды
{
  const W = mk(); W.inv.up.weapon = 2; W.path.slain.devourer = true; const ash0 = W.inv.ash; tick(W);
  ok(W.mentor.done.smith && W.mentor.cur !== 'smith' && W.inv.ash === ash0, 'ветерану совет кузнеца или награда за старое');
}
// сохранение
{
  const s = sanitizeMentor({ done: { brew: 1, nope: 1 }, cur: 'brew', seen: { gather: 3, 'x y': 2, sell: -4 } });
  ok(s.done.brew && !s.done.nope && s.cur === null && s.seen.gather === 3 && !('x y' in s.seen) && s.seen.sell === 0, 'мусор не почищен: ' + JSON.stringify(s));
  ok(sanitizeMentor(null).cur === null, 'пустое состояние');
  const W = mk(); W.cfg.mentor.on = false; mentorEvent(W, { k: 'gather' }); ok(mentorTick(W) === null, 'mentor.on=false — советы есть');
}

// советы про новые системы (2026-11-05): почта приходит по письму и считается по открытию окна; зверь, арена, гильдия — по состоянию
{ const ids = LESSONS.map(l => l.id); ok(['mail', 'mount', 'arena', 'guild'].every(i => ids.includes(i)), 'нет уроков про новые системы');
  const W = mk(); W.mentor.done = Object.fromEntries(ids.filter(i => i !== 'mail').map(i => [i, 1])); W.mail = { box: [] }; ok(!tick(W), 'совет про почту без писем');
  W.mail.box.push({ id: 1 }); const r = tick(W); ok(r && r.k === 'start' && r.L.id === 'mail', 'совет про почту не пришёл при письме');
  mentorEvent(W, { k: 'mail' }); const r2 = tick(W); ok(r2 && r2.k === 'done' && r2.L.id === 'mail', 'совет про почту не засчитался после открытия окна');
  const G = mk(); G.mentor.done = Object.fromEntries(ids.filter(i => i !== 'guild').map(i => [i, 1])); G.lv = 6; G.bots = [{}]; G.mail = { box: [], g: { in: false } }; const g1 = tick(G); ok(g1 && g1.L.id === 'guild', 'совет про гильдию не пришёл'); G.mail.g.in = true; const g2 = tick(G); ok(g2 && g2.k === 'done', 'вступление в гильдию не засчитано'); }

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Советы первопроходцу 3D: OK');
