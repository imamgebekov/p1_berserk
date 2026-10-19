// Тест заданий 3D: целостность данных, выдача, прогресс по событиям, сдача и награды, повторы, лимит, сохранение.
import { CFG3 } from '../3d/src/config3d.js';
import { BY_ID } from '../3d/src/data/items.js';
import { TOME_BY_ID } from '../3d/src/data/tomes3d.js';
import { RECIPE_BY_ID } from '../3d/src/data/recipes3d.js';
import { QUESTS, QUEST_BY_ID } from '../3d/src/data/quests3d.js';
import { questState, acceptQuest, claimQuest, abandonQuest, questEvent, questMark, trackerLine, serializeQuests, sanitizeQuests, MAX_ACTIVE, progressOf } from '../3d/src/quests3d.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { craft } from '../3d/src/craft3d.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };

// ---- целостность ----
ok(QUESTS.length >= 24 && new Set(QUESTS.map(q => q.id)).size === QUESTS.length, 'заданий мало или id повторяются');
const places = new Set(CFG3.map.places.map(p => p.id)), bossTypes = new Set(CFG3.bosses.list.map(b => b.type));
for (const q of QUESTS) {
  ok(['merchant', 'smith', 'captain', 'timka', 'kord', 'irma', 'quarter'].includes(q.giver) && (!['timka', 'kord', 'irma', 'quarter'].includes(q.giver) || q.story) && q.name && q.text && q.reward, 'поля ' + q.id);
  ok((q.reward.ash || 0) + (q.reward.xp || 0) + (q.reward.items || []).length > 0, 'пустая награда ' + q.id);
  for (const [i, n] of q.reward.items || []) ok(BY_ID[i] && n >= 1, `награда ${q.id}: ${i}`);
  ok(!q.after || (QUEST_BY_ID[q.after] && q.after !== q.id), 'after ' + q.id);
  if (q.type === 'kill') ok(CFG3.enemies[q.enemy] && q.n >= 1, 'цель kill ' + q.id);
  else if (q.type === 'boss') ok(bossTypes.has(q.boss), 'цель boss ' + q.id);
  else if (q.type === 'visit') ok(places.has(q.place), 'цель visit ' + q.id);
  else if (q.type === 'bring') ok(BY_ID[q.item] && q.n >= 1, 'цель bring ' + q.id);
  else if (q.type === 'craft') ok(BY_ID[q.item] && Object.values(RECIPE_BY_ID).some(r => r.result.id === q.item), 'цель craft ' + q.id);
  else if (q.type === 'tome') ok(TOME_BY_ID[q.tome], 'цель tome ' + q.id);
  else if (q.type === 'open') ok(q.n >= 1, 'цель open ' + q.id);
  else ok(q.type === 'hire', 'тип ' + q.type);
}
// цепочки без циклов
for (const q of QUESTS) { let c = q, n = 0; while (c.after && n++ < 20) c = QUEST_BY_ID[c.after]; ok(n < 20, 'цикл after ' + q.id); }

// ---- процесс ----
const mk = (seed = 1) => { const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.bosses.list = []; return createWorld(cfg, mulberry32(seed)); };
const near = (W, kind) => { const b = W.map.buildings.find(x => x.npc && x.npc.kind === kind); W.player.x = b.npc.x + 1; W.player.z = b.npc.z; step(W, 1 / 60, {}); };
{ const W = mk(); W.inv.ash = 0;
  ok(acceptQuest(W, 'm_imps') === 'far', 'взять издалека'); near(W, 'merchant');
  ok(questState(W, QUEST_BY_ID.m_hounds) === 'locked' && acceptQuest(W, 'm_hounds') === 'locked', 'закрыто по after');
  ok(questMark(W, 'merchant') === 'available' && questMark(W, 'smith') === 'available', 'метка «есть задания»');
  ok(acceptQuest(W, 'm_imps') === 'ok' && questState(W, QUEST_BY_ID.m_imps) === 'active' && acceptQuest(W, 'm_imps') === 'active', 'взять и повторно');
  ok(trackerLine(W).includes('Беспокойные пустоши') && trackerLine(W).includes('0/5'), 'трекер: ' + trackerLine(W));
  for (let i = 0; i < 4; i++) questEvent(W, 'kill', { enemy: 'imp' }); questEvent(W, 'kill', { enemy: 'hound' }); ok(progressOf(W, QUEST_BY_ID.m_imps)[0] === 4, 'чужой вид не считается');
  ok(claimQuest(W, 'm_imps') === 'notready', 'сдать рано'); questEvent(W, 'kill', { enemy: 'imp' }); questEvent(W, 'kill', { enemy: 'imp' });
  ok(progressOf(W, QUEST_BY_ID.m_imps)[0] === 5 && W.ev.filter(v => v.k === 'questready').length === 1, 'готово один раз');
  ok(questMark(W, 'merchant') === 'ready', 'метка «сдать»'); const xp0 = W.xp;
  ok(claimQuest(W, 'm_imps') === 'ok' && W.inv.ash === 60 && W.xp > xp0 && questState(W, QUEST_BY_ID.m_imps) === 'done', 'награда за бесов');
  ok(claimQuest(W, 'm_imps') === 'notready' && acceptQuest(W, 'm_imps') === 'done', 'второй раз нельзя'); ok(questState(W, QUEST_BY_ID.m_hounds) === 'available', 'цепочка открылась'); }
{ // принести: расходует предметы и работает издалека только у выдавшего
  const W = mk(2); near(W, 'merchant'); acceptQuest(W, 'm_food'); W.inv.bag.push({ id: 'f_rye', n: 3 }); ok(questState(W, QUEST_BY_ID.m_food) === 'active', '3 из 4');
  W.inv.bag.push({ id: 'f_rye', n: 2 }); ok(questState(W, QUEST_BY_ID.m_food) === 'ready', 'хлеба хватает'); near(W, 'smith'); ok(claimQuest(W, 'm_food') === 'far', 'сдать не тому');
  near(W, 'merchant'); ok(claimQuest(W, 'm_food') === 'ok', 'сдача'); ok(W.inv.bag.reduce((a, s) => a + (s.id === 'f_rye' ? s.n : 0), 0) === 1, 'остаток хлеба 1'); }
{ // место, книга, ковка, найм, контейнеры, босс
  const W = mk(3); W.known.places.polya = 1; near(W, 'merchant'); acceptQuest(W, 'm_polya'); ok(questState(W, QUEST_BY_ID.m_polya) === 'ready', 'место посещено до принятия');
  acceptQuest(W, 'm_open'); for (let i = 0; i < 8; i++) questEvent(W, 'open', { kind: 'crate' }); ok(questState(W, QUEST_BY_ID.m_open) === 'ready', 'контейнеры');
  near(W, 'smith'); acceptQuest(W, 's_ingot'); W.inv.bag.push({ id: 'm_ore', n: 3 }, { id: 'm_coal', n: 1 }); W.inv.ash = 50; ok(craft(W, 'ingot') === 'ok' && questState(W, QUEST_BY_ID.s_ingot) === 'ready', 'ковка закрыла задание');
  acceptQuest(W, 's_tome'); questEvent(W, 'tome', { tome: 'alloy' }); ok(questState(W, QUEST_BY_ID.s_tome) === 'ready', 'книга');
  near(W, 'captain'); acceptQuest(W, 'c_devourer'); questEvent(W, 'boss', { boss: 'devourer' }); ok(questState(W, QUEST_BY_ID.c_devourer) === 'ready', 'босс'); acceptQuest(W, 'c_hire'); questEvent(W, 'hire'); ok(questState(W, QUEST_BY_ID.c_hire) === 'ready', 'найм');
  W.inv.ash = 0; claimQuest(W, 'c_hire'); ok(W.inv.ash === 100, 'награда найма'); }
{ // награда не помещается: лишнее на землю, не пропадает
  const W = mk(5); near(W, 'merchant'); W.known.places.polya = 1; acceptQuest(W, 'm_polya'); for (let i = W.inv.bag.length; i < W.cfg.bag.slots; i++) W.inv.bag.push({ id: 'w_sword_rust', n: 1 });
  const drops = W.drops.length; ok(claimQuest(W, 'm_polya') === 'ok' && W.drops.length === drops + 1 && W.drops.at(-1).id === 'tome_leather', 'награда при полной сумке падает на землю'); }
{ // повторяемый заказ: ждёт cooldown
  const W = mk(6); W.quests.m_imps = { s: 'done', n: 0, ok: false, t: 0 }; near(W, 'merchant'); acceptQuest(W, 'm_b_imps'); for (let i = 0; i < 10; i++) questEvent(W, 'kill', { enemy: 'imp' }); claimQuest(W, 'm_b_imps');
  ok(questState(W, QUEST_BY_ID.m_b_imps) === 'cooldown' && acceptQuest(W, 'm_b_imps') === 'cooldown', 'заказ на паузе'); W.t += 901; ok(questState(W, QUEST_BY_ID.m_b_imps) === 'available' && acceptQuest(W, 'm_b_imps') === 'ok', 'заказ снова доступен'); }
{ // лимит активных и отказ
  const W = mk(7); for (const q of QUESTS.slice(0, MAX_ACTIVE)) W.quests[q.id] = { s: 'active', n: 0, ok: false, t: 0 }; near(W, 'captain');
  const free = QUESTS.find(q => q.giver === 'captain' && !q.after && !W.quests[q.id]); ok(acceptQuest(W, free.id) === 'full', 'лимит заданий');
  const id = QUESTS[0].id; ok(abandonQuest(W, id) && !W.quests[id] && !abandonQuest(W, id), 'бросить задание'); }

// ---- сохранение ----
{ const q = { m_imps: { s: 'done', n: 0, ok: false, t: 12 }, m_open: { s: 'active', n: 3, ok: false, t: 0 }, bad: { s: 'done' }, m_food: { s: 'x' }, m_coins: { s: 'active', n: 9999, ok: 'yes', t: 'z' } };
  const s = sanitizeQuests(q); ok(s.m_imps.s === 'done' && s.m_open.n === 3 && !s.bad && !s.m_food && s.m_coins.n === 3 && s.m_coins.ok === false && s.m_coins.t === 0, 'санитайзер: ' + JSON.stringify(s)); ok(Object.keys(sanitizeQuests(null)).length === 0 && Object.keys(sanitizeQuests('x')).length === 0, 'мусор');
  const W = mk(8); W.quests = s; const r = JSON.parse(JSON.stringify(serializeQuests(W.quests))); ok(r.m_open.n === 3 && r.m_imps.t === 12, 'сериализация'); }
{ const store = {}, st = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const W = mk(9); W.quests = { m_imps: { s: 'done', n: 0, ok: false, t: 5 }, m_open: { s: 'active', n: 4, ok: false, t: 0 } }; W.t = 321; createSaver(W, st).write(true);
  const d = loadSave(30, st); ok(d && d.quests.m_open.n === 4 && d.quests.m_imps.s === 'done' && d.t === 321, 'сохранение заданий и времени: ' + JSON.stringify(d && d.quests)); }

if (fails.length) { console.error('quests3d FAIL\n' + fails.join('\n')); process.exit(1); }
console.log('quests3d OK, заданий:', QUESTS.length);
