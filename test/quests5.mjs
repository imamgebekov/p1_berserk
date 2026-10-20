// Тест этапа 5 «круче»: новые виды заданий (охота, «выследи», оборона), срок, трекер до трёх заданий, метки на карте,
// цели заданий в мире не в домах и не в лагере; следствия выборов в сценах, реплики по флагам, сохранение флагов и шагов.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, mulberry32, killEnemy } from '../3d/src/sim.js';
import { QUESTS, QUEST_BY_ID } from '../3d/src/data/quests3d.js';
import { questSpot, trackPts, questState, trackerLines, questMarks, questTarget, serializeQuests, sanitizeQuests } from '../3d/src/quests3d.js';
import { storyTalk, storyChoice, serializeStory, sanitizeStory, ACT } from '../3d/src/story3d.js';
import { insideOf, insideCamp, placeAt } from '../3d/src/map.js';
import { levelAt } from '../3d/src/levels3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.wanderer.on = false; c.events.on = false; for (const d of c.dungeons.list) d.spawns = []; const W = createWorld(c, mulberry32(1)); W.player.hp = W.player.maxhp = 1e6; return W; };
const evs = [];
const run = (W, s) => { for (let i = 0; i < Math.round(s * 60); i++) { step(W, 1 / 60, {}); for (const v of W.ev) if (/^quest|^story/.test(v.k)) evs.push(v); W.ev.length = 0; } };
const go = (W, p) => { W.player.x = p.x; W.player.z = p.z; };
const take = (W, id) => { W.quests[id] = { s: 'active', n: 0, ok: false, t: 0 }; return QUEST_BY_ID[id]; };
const NEW = QUESTS.filter(q => ['hunt', 'track', 'defend'].includes(q.type));

// ---------- 1. данные: виды есть, места в мире пригодны ----------
{
  const W = mk(), kinds = new Set(NEW.map(q => q.type));
  ok(kinds.size === 3 && NEW.length >= 8, `новых заданий ${NEW.length}, видов ${kinds.size}`);
  ok(QUESTS.filter(q => q.limit > 0).length >= 2, 'нет заданий на время');
  for (const q of NEW) {
    ok(W.cfg.enemies[q.enemy || q.waves[0][0]], `${q.id}: нет такого врага`);
    if (q.type === 'defend') ok(q.waves.every(([t, n]) => W.cfg.enemies[t] && n > 0), `${q.id}: волны`);
    for (const s of q.type === 'track' ? trackPts(W, q) : [questSpot(W, q)]) {
      const pl = placeAt(W.map, s.x, s.z);
      ok(insideOf(W.map, s.x, s.z) < 0 && !(W.map.camp && insideCamp(W.map.camp, s.x, s.z, -4)) && !(pl && pl.safe), `${q.id}: место (${s.x.toFixed(0)}, ${s.z.toFixed(0)}) в доме, лагере или посёлке`);
      ok(Math.hypot(s.x, s.z) < W.cfg.world.radius - 6, `${q.id}: место за краем мира`);
    }
    const sc = q.story && ACT.find(c => c.id === q.story);
    if (sc) { const L = levelAt(W, questSpot(W, q).x, questSpot(W, q).z); ok(Math.abs(L - sc.lv) <= 12, `${q.id}: уровень места ${L.toFixed(0)}, сцены ${sc.lv}`); }
  }
  const a = JSON.stringify(trackPts(W, QUEST_BY_ID.m_hounds)), b = JSON.stringify(trackPts(mk(), QUEST_BY_ID.m_hounds)); ok(a === b, 'следы разные при каждом расчёте');
}
// ---------- 2. охота: зверь появляется при подходе, убит — сдать ----------
{
  const W = mk(), q = take(W, 't_wolves'), s = questSpot(W, q);
  ok(/найдите логово/.test(trackerLines(W)[0]), 'строка охоты до встречи: ' + trackerLines(W)[0]);
  run(W, .2); ok(!W.quests.t_wolves.foes, 'зверь появился без героя');
  go(W, { x: s.x + 8, z: s.z }); run(W, .2);
  const st = W.quests.t_wolves, b = st.foes && W.enemies.find(e => e.id === st.foes[0]);
  ok(b && b.type === q.enemy && b.chief === q.beast && b.alert && st.foes.length === 1 + q.pack, 'зверь или стая не появились');
  ok(b && b.maxhp > W.cfg.enemies[q.enemy].hp * 2, 'зверь не сильнее обычного');
  const t = questTarget(W, q); ok(t && b && Math.abs(t.x - b.x) < .01, 'метка не на звере');
  killEnemy(W, W.enemies.find(e => e.id === st.foes[1]), 1); run(W, .1); ok(questState(W, q) === 'active', 'засчитана стая вместо зверя');
  killEnemy(W, b, 1); run(W, .1); ok(questState(W, q) === 'ready' && /сдать/.test(trackerLines(W)[0]), 'охота не засчитана');
}
// ---------- 3. «выследи»: следы по очереди, потом зверь; шаг сохраняется ----------
{
  const W = mk(), q = take(W, 'm_hounds'), pts = trackPts(W, q);
  go(W, pts[1]); run(W, .2); ok(W.quests.m_hounds.n === 0, 'засчитан след не по порядку');
  go(W, pts[0]); run(W, .2); ok(W.quests.m_hounds.n === 1 && /следы 2\/3/.test(trackerLines(W)[0]), 'первый след: ' + trackerLines(W)[0]);
  const t = questTarget(W, q); ok(t && Math.abs(t.x - pts[1].x) < .01, 'метка не на следующем следе');
  const back = sanitizeQuests(JSON.parse(JSON.stringify(serializeQuests(W.quests)))); ok(back.m_hounds.n === 1, 'шаг следов не сохранился');
  go(W, pts[1]); run(W, .2); go(W, pts[2]); run(W, .2);
  const st = W.quests.m_hounds, b = st.foes && W.enemies.find(e => e.id === st.foes[0]);
  ok(b && b.chief === q.beast, 'зверь в конце следов не появился');
  killEnemy(W, b, 1); run(W, .1); ok(questState(W, q) === 'ready', '«выследи» не засчитано');
}
// ---------- 4. оборона: волны по очереди; ушёл с поста — сначала ----------
{
  const W = mk(), q = take(W, 'c_brutes'), s = questSpot(W, q); W.dif = { ...W.dif, dmg: 0 };     // враги не бьют: проверяем волны, не бой
  go(W, s); run(W, 1.5); const st = W.quests.c_brutes;
  ok(st.on && st.wave === 1 && st.foes.length === q.waves[0][1], `первая волна: ${st.wave}, врагов ${st.foes && st.foes.length}`);
  go(W, { x: s.x + W.cfg.quests.defend.leave + 5, z: s.z }); run(W, .1); ok(!st.on && evs.some(v => v.k === 'questleft'), 'уход с поста не сбросил оборону');
  go(W, s); for (let k = 0; k < 8 && questState(W, q) !== 'ready'; k++) { W.player.hp = W.player.maxhp; run(W, W.cfg.quests.defend.gap + .5); for (const e of W.enemies) if (e.qid === q.id && !e.dead) killEnemy(W, e, 1); }
  ok(questState(W, q) === 'ready' && evs.filter(v => v.k === 'questwave' && v.name === q.name).length >= q.waves.length, 'оборона не засчитана');
}
// ---------- 5. срок: время вышло — провал, задание снова доступно; трекер и метки ----------
{
  const W = mk(), q = take(W, 'c_bombers'); W.quests.c_bombers.t = q.limit - 2;
  ok(/·\s*0:02/.test(trackerLines(W)[0]), 'нет обратного отсчёта: ' + trackerLines(W)[0]);
  run(W, 3); ok(!W.quests.c_bombers && evs.some(v => v.k === 'questfail' && v.why === 'time'), 'срок не сработал');
  take(W, 't_wolves'); take(W, 'm_hounds'); take(W, 'c_brutes'); take(W, 'm_food'); W.quests.c_brutes.ok = true;
  const L = trackerLines(W, 3); ok(L.length === 3 && /Рогачи.*сдать/.test(L[0]), 'трекер: ' + JSON.stringify(L));
  const M = questMarks(W); ok(M.length >= 3 && M.every(m => Number.isFinite(m.x)) && M[0].ready, 'метки: ' + JSON.stringify(M.map(m => m.name)));
}
// ---------- 6. выборы в сценах: следствие, флаг, реплика позже, сохранение ----------
{
  const W = mk(), S = W.story, chs = [];
  for (const c of ACT) for (const part of [c.intro, c.outro, ...Object.values(c.talks || {})]) for (const L of part || []) if (L && L.choose) chs.push(...L.choose);
  ok(chs.length >= 17 && chs.every(o => o[2]), `выборов ${chs.length}, без следствия ${chs.filter(o => !o[2]).length}`);
  const ash = W.inv.ash; const v = storyChoice(W, { ash: 120, flag: 'paid', note: 'x' }); ok(v && W.inv.ash === ash + 120 && S.flags.paid, 'пепел или флаг выбора');
  const n0 = W.inv.bag.length; storyChoice(W, { item: ['p_heal2', 2] }); ok(W.inv.bag.length > n0, 'вещь выбора не выдана');
  const i = ACT.findIndex(c => c.id === 'hundred'); S.i = i; S.st = 'wait';
  const withF = storyTalk(W, 'alaric').lines; delete S.flags.paid; const noF = storyTalk(W, 'alaric').lines;
  ok(withF.length === noF.length + 1 && withF.some(l => /о цене/.test(l[1])) && withF.every(Array.isArray), 'реплика по флагу');
  S.flags.vow = true; const back = sanitizeStory(JSON.parse(JSON.stringify(serializeStory(S)))); ok(back.flags.vow === true && !back.flags.paid, 'флаги не сохранились');
  ok(Object.keys(sanitizeStory({ i: 0, f: ['ok', 'BAD flag', 5] }).flags).join() === 'ok', 'мусор во флагах');
}
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.slice(0, 30).join('\n')); process.exit(1); }
console.log(`Задания и сцены этапа 5: OK (новых заданий ${NEW.length})`);
