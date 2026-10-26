// Достижения (этап 6 плана «круче»): подвиги за бой, рост, сюжет, ремесло и конец игры. Счётчики — из событий шага
// (achEvents), проверка — раз в секунду (achTick). Награда: пепел, титул (виден в разговорах и журнале) или цвет плаща.
// Состояние W.ach { got: {id: время}, c: {счётчики}, title, cape } сохраняется. Чистая логика (Node-тесты).
import { BY_ID } from './data/items.js';
import { tierOf, factions } from './life3d.js';
import { affixCount } from './affix3d.js';

const C = k => W => (W.ach.c[k] || 0);
const bagAndWorn = W => [...W.inv.bag.map(s => ({ id: s.id, up: s.up || 0, af: s.af })), ...Object.keys(W.inv.eq).filter(k => W.inv.eq[k]).map(k => ({ id: W.inv.eq[k], up: W.inv.up[k] || 0, af: W.inv.af && W.inv.af[k] }))];
const maxOf = (W, f) => bagAndWorn(W).reduce((m, s) => Math.max(m, f(s)), 0);
// [id, название, условие, цель, значение(W), награда]
const raidAll = id => W => { const x = W.lockout && W.lockout[id], n = W.cfg.bosses.list.filter(b => b.level === id).length; return x && n && x.boss.length >= n ? 1 : 0; };     // все боссы рейда в откате этой недели (план подземелий, 4д)
const A = [
  ['k10', 'Первая кровь', 'Убейте 10 врагов', 10, W => W.kills, { ash: 50 }],
  ['k100', 'Сотня', 'Убейте 100 врагов', 100, W => W.kills, { ash: 200 }],
  ['k1000', 'Тысяча', 'Убейте 1000 врагов', 1000, W => W.kills, { ash: 1000, title: 'Жнец' }],
  ['k5000', 'Пепельная жатва', 'Убейте 5000 врагов', 5000, W => W.kills, { cape: ['Кровавый плащ', '#6a0e0e'] }],
  ['elite10', 'Охотник на элиту', 'Убейте 10 элитных врагов', 10, C('elite'), { ash: 300 }],
  ['elite100', 'Гроза элиты', 'Убейте 100 элитных врагов', 100, C('elite'), { title: 'Гроза' }],
  ['boss1', 'Первый босс', 'Победите босса', 1, C('boss'), { ash: 300 }],
  ['boss10', 'Убийца чудовищ', 'Победите 10 боссов', 10, C('boss'), { title: 'Убийца чудовищ' }],
  ['boss50', 'Легенда пустошей', 'Победите 50 боссов', 50, C('boss'), { cape: ['Золотой плащ', '#b8902e'] }],
  ['parry50', 'Стальная стена', 'Отразите 50 ударов', 50, C('parry'), { ash: 300 }],
  ['dodge100', 'Неуловимый', 'Уклонитесь 100 раз в последний миг', 100, C('dodge'), { title: 'Неуловимый' }],
  ['fin100', 'Добивающий', 'Сделайте 100 добиваний', 100, C('finisher'), { ash: 400 }],
  ['react100', 'Стихийник', 'Вызовите 100 реакций стихий', 100, C('react'), { ash: 400 }],
  ['thief', 'Держи вора!', 'Поймайте Пепельного вора', 1, C('thief'), { ash: 200 }],
  ['events10', 'Заступник', 'Завершите 10 случайных событий', 10, C('ev'), { title: 'Заступник' }],
  ['dead1', 'Пал и встал', 'Погибните и вернитесь', 1, C('dead'), { ash: 50 }],
  ['lv10', 'Десятый', 'Достигните 10-го уровня', 10, W => W.lv, { ash: 200 }],
  ['lv30', 'Ветеран', 'Достигните 30-го уровня', 30, W => W.lv, { title: 'Ветеран' }],
  ['lv60', 'Шестидесятый', 'Достигните 60-го уровня', 60, W => W.lv, { cape: ['Пепельно-белый плащ', '#d8d4cc'] }],
  ['prank10', 'Пепел в крови', 'Получите 10-й пепельный ранг', 10, W => W.prank || 0, { ash: 2000 }],
  ['prank50', 'Пепельный владыка', 'Получите 50-й пепельный ранг', 50, W => W.prank || 0, { title: 'Пепельный владыка' }],
  ['act1', 'Наёмник', 'Пройдите Акт I', 1, W => (W.ach.c.act || 0) >= 1 ? 1 : 0, { title: 'Наёмник' }],
  ['act2', 'Война', 'Пройдите Акт II', 1, W => (W.ach.c.act || 0) >= 2 ? 1 : 0, { ash: 1500 }],
  ['act3', 'Затмение', 'Пройдите Акт III', 1, W => (W.ach.c.act || 0) >= 3 ? 1 : 0, { ash: 2500 }],
  ['act4', 'Конец Затмения', 'Пройдите Акт IV', 1, W => (W.ach.c.act || 0) >= 4 ? 1 : 0, { cape: ['Плащ Затмения', '#17121c'], title: 'Победитель Длани' }],
  ['quests10', 'Помощник', 'Выполните 10 заданий', 10, C('quest'), { ash: 300 }],
  ['quests50', 'Надёжный', 'Выполните 50 заданий', 50, C('quest'), { title: 'Надёжный' }],
  ['quests100', 'Человек слова', 'Выполните 100 заданий', 100, C('quest'), { ash: 3000 }],
  ['open100', 'Кладоискатель', 'Вскройте 100 сундуков, ящиков и бочек', 100, C('open'), { ash: 300 }],
  ['fires10', 'Хранитель костров', 'Зажгите 10 костров', 10, W => Object.keys(W.fires || {}).length, { ash: 300 }],
  ['tome5', 'Книжник', 'Прочитайте 5 книг', 5, W => Object.keys(W.known.tomes || {}).length, { title: 'Книжник' }],
  ['craft50', 'Мастер на все руки', 'Создайте 50 вещей', 50, C('craft'), { ash: 500 }],
  ['gather100', 'Собиратель', 'Соберите 100 трав, руд и шкур', 100, C('gather'), { ash: 300 }],
  ['up5', 'Пять зарубок', 'Заточите вещь до +5', 5, W => maxOf(W, s => s.up), { ash: 500 }],
  ['gold1', 'Золото', 'Добудьте золотую вещь', 1, W => maxOf(W, s => ((BY_ID[s.id] || {}).rar === 5 ? 1 : 0)), { ash: 500 }],
  ['affix3', 'Три свойства', 'Добудьте вещь с тремя свойствами', 3, W => maxOf(W, s => affixCount(s.af)), { ash: 300 }],
  ['rep4', 'Свой среди своих', 'Получите высшую ступень репутации', 1, W => (W.life && factions(W).some(f => tierOf(W, f.id) >= 4) ? 1 : 0), { title: 'Свой' }],
  ['heroes4', 'Четыре судьбы', 'Сыграйте всеми четырьмя героями', 4, W => new Set([W.hero, ...Object.keys(W.heroes || {})]).size, { cape: ['Синий плащ', '#24426a'] }],
  ['squad4', 'Отряд', 'Соберите отряд из 4 бойцов', 4, W => W.allies.filter(a => !a.dead && !a.guest && !a.story).length, { ash: 300 }],
  ['abyss10', 'Глубинный', 'Пройдите 10-й ярус Бездны', 10, W => W.ach.c.abyss || 0, { title: 'Глубинный' }],
  ['abyss25', 'Дно Бездны', 'Пройдите 25-й ярус Бездны', 25, W => W.ach.c.abyss || 0, { cape: ['Плащ Бездны', '#3a1a5a'] }],
  ['ng1', 'Новый круг', 'Начните Новый круг', 1, W => W.ng || 0, { title: 'Вернувшийся' }],
  ['eclipse1', 'Неделя Затмения', 'Пройдите недельное Затмение', 1, C('eclipse'), { ash: 1500 }],
  // полное прохождение рейда — все боссы за одну неделю отката (план подземелий, 4д): титул и плащ
  ['raid_oak', 'Сердце рощи', 'Победите всех боссов Логова Древнего Дуба за неделю', 1, raidAll('raid_oak'), { title: 'Хранитель рощи', cape: ['Плащ из листвы', '#3a5a22'] }],
  ['raid_cathedral', 'Тишина собора', 'Победите всех боссов Затонувшего собора за неделю', 1, raidAll('raid_cathedral'), { title: 'Утопивший хор', cape: ['Плащ утопленника', '#1e4a5a'] }],
  ['raid_hand', 'Сломанная Длань', 'Победите всех боссов Врат Длани за неделю', 1, raidAll('raid_hand'), { title: 'Сломавший Длань', cape: ['Плащ Врат', '#4a1a2a'] }],
  ['raid_throne', 'Пустой Престол', 'Победите всех боссов Престола Бездны за неделю', 1, raidAll('raid_throne'), { title: 'Сидевший на Престоле', cape: ['Плащ Престола', '#2a1440'] }]
];
export const ACH = A.map(([id, name, text, n, val, reward]) => ({ id, name, text, n, val, reward }));
export const ACH_BY_ID = Object.fromEntries(ACH.map(a => [a.id, a]));
export const achFresh = () => ({ got: {}, c: {}, title: null, cape: null });
export const titlesOf = W => ACH.filter(a => W.ach.got[a.id] !== undefined && a.reward.title).map(a => a.reward.title);
export const capesOf = W => ACH.filter(a => W.ach.got[a.id] !== undefined && a.reward.cape).map(a => ({ name: a.reward.cape[0], color: a.reward.cape[1] }));
export const achProgress = (W, a) => Math.min(a.n, Math.floor(a.val(W) || 0));
const rewardText = r => [r.ash ? `+${r.ash} пепла` : '', r.title ? `титул «${r.title}»` : '', r.cape ? r.cape[0].toLowerCase() : ''].filter(Boolean).join(', ');
export { rewardText as achRewardText };

// события → счётчики; все события списка (и из окон между шагами: сдача задания, ремесло, сюжет), каждое — один раз
export function achEvents(W) {
  if (!W.ach) return; const c = W.ach.c, add = (k, n = 1) => { c[k] = (c[k] || 0) + n; };
  for (const v of W.ev) {
    if (v.achSeen) continue; v.achSeen = 1;
    if (v.k === 'die') { if (v.boss) add('boss'); else if (v.elite) add('elite'); }
    else if (v.k === 'parry' || v.k === 'dodge' || v.k === 'finisher' || v.k === 'react' || v.k === 'open' || v.k === 'gather') add(v.k);
    else if (v.k === 'craft') add('craft');
    else if (v.k === 'questdone') add('quest');
    else if (v.k === 'evDone') { add('ev'); if (v.kind === 'thief') add('thief'); }
    else if (v.k === 'playerDead') add('dead');
    else if (v.k === 'storyDone' && v.end) c.act = Math.max(c.act || 0, v.act || 0);
    else if (v.k === 'abyssTier' && !v.eclipse) c.abyss = Math.max(c.abyss || 0, v.tier || 0);
    else if (v.k === 'eclipseDone') add('eclipse');
  }
}
// раз в секунду: новые достижения и награды
export function achTick(W, dt) {
  const K = W.cfg.ach; if (!W.ach || !K || !K.on) return;
  if ((W.achT = (W.achT || 0) - dt) > 0) return; W.achT = 1;
  for (const a of ACH) {
    if (W.ach.got[a.id] !== undefined || a.val(W) < a.n) continue;
    W.ach.got[a.id] = Math.round(W.t); const r = a.reward;
    if (r.ash) W.inv.ash += r.ash;
    if (r.title && !W.ach.title) W.ach.title = r.title;     // первый титул надевается сам
    W.ev.push({ k: 'ach', id: a.id, name: a.name, reward: rewardText(r) });
  }
}
// ---- сохранение ----
export const serializeAch = A0 => (A0 ? { got: { ...A0.got }, c: { ...A0.c }, title: A0.title, cape: A0.cape } : null);
export function sanitizeAch(d) {
  const o = achFresh(); if (!d || typeof d !== 'object') return o;
  for (const [k, v] of Object.entries(d.got || {})) if (ACH_BY_ID[k] && Number.isFinite(v)) o.got[k] = v;
  for (const [k, v] of Object.entries(d.c || {})) if (/^[a-z]{1,12}$/.test(k) && Number.isFinite(v) && v >= 0) o.c[k] = Math.floor(v);
  const tl = ACH.filter(a => o.got[a.id] !== undefined && a.reward.title).map(a => a.reward.title), cp = ACH.filter(a => o.got[a.id] !== undefined && a.reward.cape).map(a => a.reward.cape[1]);
  o.title = tl.includes(d.title) ? d.title : null; o.cape = cp.includes(d.cape) ? d.cape : null;     // только заработанные
  return o;
}
