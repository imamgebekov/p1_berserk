// Наставник первопроходца (4.01, просьба владельца): короткие советы от жителей лагеря — что и где делается. Совет приходит,
// когда система нужна или открылась по сюжету (кузнец — после Пожирателя, наём — с уровня отряда), один за раз: две реплики
// говорящего, строка «Совет: …» в трекере, точка на карте, награда пеплом. Сделанное раньше засчитывается сразу (ветерану
// не мешает). Чистые функции; состояние — W.mentor { done: {id: 1}, cur, seen: {событие: n} }. Числа — cfg.mentor.
import { BY_ID } from './data/items.js';
import { betterThanWorn, hasGems } from './inv.js';
import { canWield } from './data/heroes3d.js';
import { unlocks } from './ashpath3d.js';
import { SPEAKERS } from './data/story3d.js';
import { wearOf } from './dur3d.js';

const surf = W => (W.levels ? W.levels.surface.map : W.map);
const npc = kind => W => { const b = surf(W).buildings.find(q => q.npc && q.npc.kind === kind); return b ? { x: b.npc.x, z: b.npc.z } : null; };
const seen = (W, k) => (W.mentor && W.mentor.seen[k]) || 0;
const bag = W => W.inv.bag.map(s => BY_ID[s.id]).filter(Boolean);
const sparkDone = W => !W.spark || W.spark.done;
const nearestNode = W => { const p = W.player; let best = null, bd = Infinity; for (const n of surf(W).nodes || []) { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = n; } } return best ? { x: best.x, z: best.z } : null; };
const gemIn = W => Object.values(W.inv.gem || {}).some(hasGems);
const worn = W => Object.keys(W.inv.eq).some(sl => W.inv.eq[sl] && wearOf(W.inv.af && W.inv.af[sl]) >= W.cfg.mentor.wearAt);     // надетое заметно износилось
const hired = W => (W.allies || []).some(a => !a.decoy && !a.guest && !a.story);
export const MENTOR_WHO = { hostess: SPEAKERS.hostess, captain: SPEAKERS.captain, merchant: { name: 'Торговец у костра', tint: '#6a5a20' }, smith: { name: 'Кузнец лагеря', tint: '#6a4a3a' }, scribe: { name: 'Книжница Агата', tint: '#2e3e6a' } };

// when — пора дать совет; done — сделано; at — точка на карте; lines — две реплики говорящего; task — что сделать
export const LESSONS = [
  { id: 'gear', who: 'hostess', when: W => sparkDone(W) && bag(W).some(it => it.slot && canWield(W.hero, it) && betterThanWorn(W.inv, it)),
    lines: ['С мёртвых снимают то, что получше. Своя шкура дороже чужой гордости.', 'Стрелка вверх на вещи — значит, она лучше надетой.'],
    task: 'откройте сумку (I) и наденьте вещь со стрелкой ▲', at: () => null,
    done: W => !bag(W).some(it => it.slot && canWield(W.hero, it) && betterThanWorn(W.inv, it)) },
  { id: 'brew', who: 'hostess', when: W => sparkDone(W) && seen(W, 'gather') > 0,
    lines: ['Мох с погоста да соль пепла — уже отвар. Котёл не нужен, нужен покой вокруг.', 'Книга рецептов скажет, чего не хватает.'],
    task: 'откройте книгу рецептов (R) и сварите лечебный отвар', at: () => null,
    done: W => seen(W, 'brew') > 0 || ((W.life && W.life.prof && W.life.prof.alch) || 0) > 0 },
  { id: 'sell', who: 'merchant', when: W => sparkDone(W) && W.lv >= 2 && bag(W).some(it => it.cat === 'curio' || (it.cat === 'material' && it.pool !== 'arcane')),
    lines: ['Безделушки и лом в сумке — это пепел, который ты носишь зря.', 'Неси ко мне. Кнопка «Продать хлам» — и сумка снова пуста.'],
    task: 'продайте хлам торговцу в лагере', at: npc('merchant'), done: W => seen(W, 'sell') > 0 },
  { id: 'smith', who: 'smith', when: W => unlocks(W).smith,
    lines: ['Горн снова горит, раз Пожиратель лёг. Неси железо — сделаю острее.', 'Каждая ступень заточки — десятая доля силы вещи.'],
    task: 'улучшите вещь у кузнеца (вкладка «Улучшение»)', at: npc('smith'),
    done: W => seen(W, 'upgrade') > 0 || Object.values(W.inv.up || {}).some(v => v > 0) || W.inv.bag.some(s => s.up > 0) },
  { id: 'forge', who: 'smith', when: W => unlocks(W).smith && seen(W, 'gather') > 0,
    lines: ['Руда — ещё не железо. Три куска и уголь — будет слиток.', 'Чего не хватает, смотри в рецепте: G подскажет, где взять.'],
    task: 'выплавьте у кузнеца железный слиток (вкладка «Ковка»)', at: npc('smith'), done: W => seen(W, 'forge') > 0 },
  { id: 'gem', who: 'smith', when: W => unlocks(W).smith && (bag(W).some(it => it.cat === 'gem') || gemIn(W)),
    lines: ['Камень силы в гнезде — стихия в каждом ударе.', 'Два разных камня сплавятся: огонь и лёд дадут пар.'],
    task: 'вставьте камень силы у кузнеца (вкладка «Камни»)', at: npc('smith'), done: W => gemIn(W) || seen(W, 'socket') > 0 },
  { id: 'tome', who: 'hostess', when: W => bag(W).some(it => it.cat === 'tome'),
    lines: ['Книги не для растопки. В них — рецепты, места и звери.', 'Прочти — и кузнец сможет больше.'],
    task: 'прочитайте книгу: сумка → книга → «Прочитать»', at: () => null, done: W => seen(W, 'tome') > 0 || !bag(W).some(it => it.cat === 'tome') },
  { id: 'kit', who: 'merchant', when: W => worn(W) && !unlocks(W).smith,
    lines: ['Клинок тупится, ремни трутся. После семидесяти из ста вещь слабеет.', 'Горн у кузнеца пока холодный. Бери ремкомплект — латает в поле.'],
    task: 'купите ремкомплект у торговца и используйте его из сумки', at: npc('merchant'), done: W => seen(W, 'repair') > 0 },
  { id: 'repair', who: 'smith', when: W => worn(W) && unlocks(W).smith,
    lines: ['Покажи-ка… Зазубрины, трещины. Ещё немного — и меч станет вдвое слабее.', 'Неси всё разом: починю за пепел.'],
    task: 'почините снаряжение у кузнеца («Починить всё»)', at: npc('smith'), done: W => seen(W, 'repair') > 0 && !worn(W) },
  { id: 'squad', who: 'captain', when: W => unlocks(W).squad,
    lines: ['Одному за ограду ходят только дураки и покойники.', 'Найму тебе людей — за пепел. Одень их из своей сумки, и они проживут дольше.'],
    task: 'наймите бойца у капитана в казарме', at: npc('captain'), done: W => hired(W) || seen(W, 'hire') > 0 },
  { id: 'library', who: 'scribe', when: W => sparkDone(W) && (W.lv >= W.cfg.mentor.libraryLv || bag(W).some(it => it.slot && it.rar >= 3)),
    lines: ['Ненужную вещь не бросай в канаву. Принеси — разберу её в чародейскую пыль.', 'Пылью я впишу в вещь новое свойство.'],
    task: 'разберите ненужную вещь у книжницы в лагере', at: npc('scribe'), done: W => seen(W, 'disenchant') > 0 },
  { id: 'enchant', who: 'scribe', when: W => seen(W, 'disenchant') > 0,
    lines: ['Пыль есть. Выбери вещь: добавлю свойство, перекую слабое или подниму качество.', 'Чем чаще зачаровываешь вещь, тем дороже.'],
    task: 'зачаруйте вещь у книжницы', at: npc('scribe'), done: W => seen(W, 'enchant') > 0 }
];
export const mentorFresh = () => ({ done: {}, cur: null, seen: {} });
export function sanitizeMentor(s) {
  if (!s || typeof s !== 'object') return mentorFresh();
  const done = {}, sn = {}; for (const L of LESSONS) if (s.done && s.done[L.id]) done[L.id] = 1;
  for (const [k, v] of Object.entries(s.seen || {})) if (/^[a-z]{2,12}$/.test(k) && Number.isFinite(v)) sn[k] = Math.max(0, Math.min(9999, Math.floor(v)));
  const cur = LESSONS.some(L => L.id === s.cur) && !done[s.cur] ? s.cur : null; return { done, cur, seen: sn };
}
// событие мира → счётчик для советов
const EV = { repair: 'repair', gather: 'gather', upgrade: 'upgrade', socket: 'socket', tome: 'tome', hire: 'hire', enchant: 'enchant', disenchant: 'disenchant', sell: 'sell' };
export function mentorEvent(W, v) {
  const M = W.mentor; if (!M) return;
  let k = EV[v.k]; if (v.k === 'craft') k = String(v.id || '').startsWith('p_') ? 'brew' : W.nearNpc === 'smith' ? 'forge' : 'craft';
  if (k) M.seen[k] = (M.seen[k] || 0) + 1;
}
// раз в 0,25 с: { k: 'start', L } — новый совет; { k: 'done', L, ash } — выполнен (награда выдана); иначе null
export function mentorTick(W) {
  const M = W.mentor, C = W.cfg.mentor; if (!M || !C || !C.on) return null;
  if (M.cur) { const L = LESSONS.find(q => q.id === M.cur); if (L && L.done(W)) { M.done[L.id] = 1; M.cur = null; W.inv.ash += C.ash; return { k: 'done', L, ash: C.ash }; } return null; }
  for (const L of LESSONS) { if (M.done[L.id]) continue; if (L.done(W)) { M.done[L.id] = 1; continue; } if (L.when(W)) { M.cur = L.id; return { k: 'start', L }; } }     // сделанное раньше — без награды и без слов
  return null;
}
// строка «Совет: …» и точка
export function mentorLine(W) { const M = W.mentor; if (!M || !M.cur) return null; const L = LESSONS.find(q => q.id === M.cur); return L ? { text: `Совет: ${L.task}`, at: L.at(W) } : null; }
