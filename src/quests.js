// Задания: взять, прогресс по событиям, сдать. Подписывается на события шины (events.js).
import { CFG } from './config.js';
import { P } from './state.js';
import { QUESTS, QUESTS_BY_ID } from './data/quests.js';
import { SLOTS, ITEMS_BY_ID } from './data/items.js';
import { chat } from './chat.js';
import { sfx } from './audio.js';
import { on, emit } from './events.js';

export const stateOf = id => P.quests[id] || null;
export const activeCount = () => QUESTS.filter(q => stateOf(q.id) && stateOf(q.id).st === 'active').length;

// Доступно ли задание для взятия: не начато и выполнено «after»
export function isAvailable(q) {
  if (stateOf(q.id)) return false;
  return !q.after || (stateOf(q.after) && stateOf(q.after).st === 'claimed');
}
export const available = () => QUESTS.filter(isAvailable);
export const readyToClaim = () => QUESTS.filter(q => stateOf(q.id) && stateOf(q.id).st === 'done');
export const activeList = () => QUESTS.filter(q => stateOf(q.id) && stateOf(q.id).st === 'active');

function complete(q) {
  const s = stateOf(q.id);
  s.st = 'done'; s.n = q.goal;
  chat('', 'Задание выполнено: ' + q.title + '. Сдайте его Хранителю.', 'sys');
  sfx.level();
  emit('save');
}

// 'ok' | 'full' | 'taken' | 'locked'
export function accept(id) {
  const q = QUESTS_BY_ID[id];
  if (!q) return 'locked';
  if (stateOf(id)) return 'taken';
  if (!isAvailable(q)) return 'locked';
  if (activeCount() >= CFG.quests.maxActive) return 'full';
  P.quests[id] = { st: 'active', n: 0 };
  check();
  emit('save');
  return 'ok';
}

// Прогресс «состоятельных» заданий считается по текущему состоянию (уровень, экипировка, улучшение)
export function currentValue(q) {
  if (q.type === 'level') return P.lv;
  if (q.type === 'equip') return SLOTS.filter(s => P.eq[s]).length;
  if (q.type === 'upgrade') return Math.max(0, ...[...Object.values(P.eq), ...P.bag].filter(Boolean).map(i => i.up || 0));
  return null;
}

export function check() {
  for (const q of QUESTS) {
    const s = stateOf(q.id);
    if (!s || s.st !== 'active') continue;
    const v = currentValue(q);
    if (v === null) continue;
    s.n = Math.min(q.goal, Math.max(s.n, v));
    if (s.n >= q.goal) complete(q);
  }
}

function progress(type, pred) {
  for (const q of QUESTS) {
    const s = stateOf(q.id);
    if (!s || s.st !== 'active' || q.type !== type || !pred(q)) continue;
    s.n = Math.min(q.goal, s.n + 1);
    if (s.n >= q.goal) complete(q);
  }
}

on('kill', e => progress('kill', q => q.target === e.type));
on('dodge', () => progress('dodge', () => true));
on('eclipse', d => { if (d && d.survived) progress('eclipse', () => true); });
on('gear', check);

// Сдать задание. grant — функция выдачи награды (внешняя, чтобы не тянуть инвентарь): возвращает описание.
export function claim(id, grant) {
  const q = QUESTS_BY_ID[id], s = stateOf(id);
  if (!q || !s || s.st !== 'done') return null;
  s.st = 'claimed';
  const text = grant(q.reward);
  chat('', 'Награда за «' + q.title + '»: ' + text, 'sys');
  emit('save');
  return text;
}

// Строка для HUD: ближайшее активное/готовое задание
export function tracker() {
  const done = readyToClaim()[0];
  if (done) return { text: '✔ ' + done.title + ' — сдать Хранителю', ready: true };
  const a = activeList()[0];
  if (!a) return null;
  const s = stateOf(a.id);
  return { text: a.title + ': ' + s.n + '/' + a.goal, ready: false };
}

// Человекочитаемая награда для доски заданий
export function rewardText(r) {
  const p = [];
  if (r.ash) p.push(r.ash + ' пепла');
  if (r.xp) p.push(r.xp + ' опыта');
  if (r.sp) p.push('+' + r.sp + ' очко навыка');
  if (r.item) p.push(ITEMS_BY_ID[r.item].name);
  if (r.rarity) p.push({ rare: 'редкая вещь', cursed: 'проклятая вещь', branded: 'клеймёная вещь', common: 'вещь' }[r.rarity] || 'вещь');
  return p.join(' · ');
}
