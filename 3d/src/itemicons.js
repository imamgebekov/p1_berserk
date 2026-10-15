// Значки вещей: пиксельные картинки 16×16 из шаблонов (никаких внешних файлов). Шаблон — 16 строк по 16 знаков:
// '.' — пусто, b — контур, a — основной цвет (материал), d — блик, e — тень основного, c — дерево/кожа, r — цвет редкости (камни, акценты), w — бумага/белое.
// iconGrid — чистые данные (тестируется в Node); iconURL рисует на холсте и кэширует (только браузер).
import { RARITY } from './data/items.js';

export const TEMPLATES = {
  sword: [
    '..............bb', '.............bdb', '............bdab', '...........bdab.', '..........bdab..', '.........bdab...', '........bdab....', '.......bdab.....',
    '..bb..bdab......', '..brbbdab.......', '...brdab........', '...bcbb.........', '..bcbrb.........', '.bcb.bb.........', 'bcb.............', 'bb..............'],
  dagger: [
    '................', '................', '................', '................', '..........bbb...', '.........bdab...', '........bdab....', '.......bdab.....',
    '......bdab......', '..bb.bdab.......', '..brbdab........', '...brab.........', '...bcbb.........', '..bcb.rb........', '.bcb..bb........', '.bb.............'],
  greatsword: [
    '.............bbb', '............bdab', '...........bddab', '..........bddab.', '.........bddab..', '........bddab...', '.......bddab....', '......bddab.....',
    '.bb..bddab......', '.brbbddab.......', '..brddab........', '..bcbeb.........', '.bcbbrrb........', 'bcb...bb........', 'bb..............', '................'],
  axe: [
    '.....bbbbb......', '....bdaaaab.....', '...bdaaaaaeb....', '...baaaacbeb....', '....beebcbb.....', '.....bbcb.......', '......bcb.......', '.....bcb........',
    '....bcb.........', '....bcb.........', '...bcb..........', '...bcb..........', '..bcb...........', '..bcb...........', '.brb............', '.bb.............'],
  polearm: [
    '.............bb.', '............bdab', '...........bdab.', '..........bdab..', '.........bcbb...', '........bcb.....', '.......bcb......', '......bcb.......',
    '.....bcb........', '....bcb.........', '...bcb..........', '..bcb...........', '.bcb............', 'bcb.............', 'bb..............', '................'],
  hammer: [
    '.....bbbbbbb....', '....bdaaaaaeb...', '....baaaaaaeb...', '....baaaaaaeb...', '....beeeeeeeb...', '.....bbbcbbb....', '........bcb.....', '.......bcb......',
    '.......bcb......', '......bcb.......', '......bcb.......', '.....bcb........', '.....bcb........', '....bcb.........', '....brb.........', '....bb..........'],
  mace: [
    '.........b.b....', '........bdabab..', '.......bbdaaab..', '........baaaeb..', '.......bbaaebb..', '........bebeb...', '.......bcb.b....', '......bcb.......',
    '......bcb.......', '.....bcb........', '.....bcb........', '....bcb.........', '....bcb.........', '...bcb..........', '...brb..........', '...bb...........'],
  scythe: [
    '...bbbbbbbb.....', '..bdaaaaaaab....', '.beb.....bab....', '.bb.......bcb...', '..........bcb...', '..........bcb...', '.........bcb....', '.........bcb....',
    '........bcb.....', '........bcb.....', '.......bcb......', '.......bcb......', '......bcb.......', '......bcb.......', '.....brb........', '.....bb.........'],
  flail: [
    '..........bbb...', '.........bdaab..', '........bdaaaeb.', '........baaaaeb.', '........beaaeeb.', '.........beeeb..', '........b.bbb...', '.......b........',
    '......b.........', '.....bb.........', '....bcb.........', '...bcb..........', '...bcb..........', '..bcb...........', '..brb...........', '..bb............'],
  fists: [
    '................', '................', '....bbbbbbb.....', '...bdcdcdcdb....', '...bccccccccb...', '...bccccccccb...', '...bbbbbbbccb...', '....bccccccb....',
    '....bccccccb....', '.....bbbbbb.....', '................', '................', '................', '................', '................', '................'],
  head: [
    '................', '.....bbbbbb.....', '....bddaaaab....', '...bdaaaaaaeb...', '...baaaaaaaeb...', '...baaarraaeb...', '...baabbbbaeb...', '...bab....beb...',
    '...bab....beb...', '...beb....bbb...', '...bbb..........', '................', '................', '................', '................', '................'],
  body: [
    '................', '..bbb......bbb..', '.bdaab....baaeb.', '.baaaabbbbaaaeb.', '.bbaaaaaaaaaebb.', '..baaaarraaaeb..', '..baaaaaaaaaeb..', '..baaaaaaaaaeb..',
    '..beaaaaaaaaeb..', '..bbccccccccbb..', '..baaaaaaaaaeb..', '..beaaaaaaaeeb..', '...bbbbbbbbbb...', '................', '................', '................'],
  cloak: [
    '......bbbb......', '.....baaaab.....', '....baarraab....', '....baaaaaab....', '...bdaaaaaaeb...', '...baaaaaaaeb...', '..bdaaaaaaaaeb..', '..baaaaaaaaaeb..',
    '..baaaaaaaaaeb..', '.bdaaaaaaaaaaeb.', '.baaaaaaaaaaaeb.', '.baeaeaeaeaeaeb.', '.bbbbbbbbbbbbbb.', '................', '................', '................'],
  boots: [
    '................', '................', '...bbbb..bbbb...', '...bdab..bdab...', '...baab..baab...', '...baab..baab...', '...baab..baab...', '...barb..barb...',
    '...baab..baab...', '..bdaab.bdaab...', '.bdaaab.baaaab..', '.baaaab.baaaaab.', '.beeeeb.beeeeeb.', '.bbbbbb.bbbbbbb.', '................', '................'],
  ring: [
    '................', '................', '.......bb.......', '......brrb......', '......brrb......', '.....bbbbbb.....', '....bdaaaaeb....', '...bdb....beb...',
    '...bab....beb...', '...bab....beb...', '...bdb....beb...', '....baaaaaeb....', '.....bbbbbb.....', '................', '................', '................'],
  amulet: [
    '..b..........b..', '...b........b...', '....b......b....', '.....b....b.....', '......b..b......', '.......bb.......', '......bddb......', '.....bdrrab.....',
    '....bdrrrraeb...', '....brrrrrreb...', '....berrrreb....', '.....berreb.....', '......beeb......', '.......bb.......', '................', '................'],
  potion: [
    '................', '......bbbb......', '......bccb......', '.......bb.......', '......bwwb......', '.....bwrrwb.....', '....bwrrrrrb....', '...bwrrrrrrrb...',
    '...brrrrrrrrb...', '...brrrrrrrrb...', '...berrrrrrrb...', '...beerrrrreb...', '....beeeeeeb....', '.....bbbbbb.....', '................', '................'],
  food: [
    '................', '................', '.....bbbbbb.....', '....bcccccdb....', '...bcccccccdb...', '..bccdcccdccb...', '..bcccccccccb...', '..bcdccccdccb...',
    '..bccccccccceb..', '..beccccccceeb..', '...beeeeeeeeb...', '....bbbbbbbb....', '................', '................', '................', '................'],
  medic: [
    '................', '................', '..bbbbbbbbbbbb..', '..bwwwwwwwwwwb..', '..bwwwwrrwwwwb..', '..bwwwwrrwwwwb..', '..bwwrrrrrrwwb..', '..bwwrrrrrrwwb..',
    '..bwwwwrrwwwwb..', '..bwwwwrrwwwwb..', '..bwwwwwwwwwwb..', '..bbbbbbbbbbbb..', '................', '................', '................', '................'],
  coin: [
    '................', '................', '.....bbbbbb.....', '....bddaaaab....', '...bdaabbaaeb...', '...bdabaaabaeb..', '...baabaaaaaeb..', '...baabaaabaeb..',
    '...baaabbbaaeb..', '...beaaaaaaeb...', '....beeeeeeb....', '.....bbbbbb.....', '................', '................', '................', '................'],
  ingot: [
    '................', '................', '................', '................', '.....bbbbbbbb...', '....bddddddab...', '...bdaaaaaaaab..', '..bbbbbbbbbbaeb.',
    '..bdaaaaaaaabeb.', '..baaaaaaaaaeb..', '..beeeeeeeeeb...', '..bbbbbbbbbbb...', '................', '................', '................', '................'],
  hide: [
    '................', '..bb........bb..', '.bcb........bcb.', '.bccbbbbbbbbccb.', '..bccccccccccb..', '..bcdcccccccceb.', '..bccccrcccccb..', '..bccccccccccb..',
    '..bcccccccccdb..', '..bccccccccccb..', '.bccbbbbbbbbccb.', '.bcb........bcb.', '..bb........bb..', '................', '................', '................'],
  skull: [
    '................', '.....bbbbbb.....', '....bwwwwwwb....', '...bwwwwwwwwb...', '...bwwwwwwwwb...', '...bwbbwwbbwb...', '...bwbrwwbrwb...', '...bwwwbbwwwb...',
    '....bwwwwwwb....', '....bwbwbwwb....', '.....bbbbbb.....', '................', '................', '................', '................', '................'],
  book: [
    '................', '...bbbbbbbbbb...', '..baaaaaaaaab...', '..badddddddab...', '..baaaarraaab...', '..baaarrrraab...', '..baaaarraaab...', '..baaaaaaaaab...',
    '..baaaaaaaaab...', '..beeeeeeeeeb...', '..bwwwwwwwwwwb..', '..bbbbbbbbbbbb..', '................', '................', '................', '................'],
  gem: [
    '................', '................', '......bbbb......', '.....bddrrb.....', '....bdrrrrrb....', '...bbbbbbbbbb...', '...bdrrrrrrrb...', '....brrrrrreb...',
    '.....brrrreb....', '......brreb.....', '.......bb.......', '................', '................', '................', '................', '................'],
  key: [
    '................', '................', '..bbbb..........', '.bdaaab.........', '.bab.bab........', '.bab.bab........', '.baaaaabbbbbbbb.', '..beeebaaaaaaaab',
    '......bbbbbabab.', '..........b.b.b.', '................', '................', '................', '................', '................', '................']
};
export const TEMPLATE_CHARS = '.badecrw';

const WEAPON_T = { sword: 'sword', rapier: 'sword', knife: 'dagger', dagger: 'dagger', greatsword: 'greatsword', axe: 'axe', war_axe: 'axe', sickle: 'scythe', scythe: 'scythe',
  spear: 'polearm', halberd: 'polearm', hammer: 'hammer', club: 'mace', mace: 'mace', pick: 'hammer', flail: 'flail', chain_ball: 'flail', fists: 'fists' };
const CAT_T = { food: 'food', potion: 'potion', fairy: 'potion', medic: 'medic', coin: 'coin', material: 'ingot', craftmat: 'ingot', monstermat: 'hide', trophy: 'skull', tome: 'book', bosstome: 'book', book: 'book', curio: 'gem', key: 'key' };
export function templateOf(it) {
  if (!it) return 'gem';
  if (it.slot === 'weapon') return WEAPON_T[it.kind] || 'sword';
  if (it.slot) return it.slot;
  if (it.icon) return it.icon;
  return CAT_T[it.pool] || CAT_T[it.cat] || 'gem';
}

// цвета: основной — по материалу (металл, кожа, кость…) или виду расходника; r — редкость (у зелий — цвет зелья)
const MAT = { rust: '#8a5a3a', iron: '#9a9890', tempered: '#b8b4a8', bone: '#d8ccb0', steel: '#cfc9bb', black: '#4a4652', blood: '#9a2428', unique: '#e2c27a',
  rag: '#8a7a62', leather: '#8a6038', studded: '#7a6448', mail: '#a8a8a0', plate: '#c0bcb0', ash: '#6a6260', set_pogost: '#5a6a58', set_eclipse: '#4a3460', set_rust: '#8a4a2a' };
const CAT = { ring: '#d8b860', amulet: '#c8a050', food: '#c89050', potion: '#d0d8e0', fairy: '#e0d0ff', medic: '#e8e0d0', coin: '#e0b040', material: '#a8a090', craftmat: '#a8a090', monstermat: '#8a6a4a', trophy: '#e0d8c8', tome: '#6a3a2a', bosstome: '#3a2a4a', book: '#7a5a3a', curio: '#c0b090', key: '#c8a040' };
const POTION = { p_heal1: '#d03838', p_heal2: '#e04848', p_heal3: '#ff5a5a', p_fairy_elixir: '#ff8ad8', p_fairy_dust: '#ffe070', p_fairy_might: '#b070ff', u_recall: '#9a70e0' };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c * k))); return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map(f).map(x => x.toString(16).padStart(2, '0')).join(''); };
export function paletteOf(it) {
  const rar = RARITY[(it && it.rar) || 0].color, base = (it && (MAT[it.mat] || CAT[it.pool] || CAT[it.cat])) || '#a8a090';
  const r = it && it.cat === 'consumable' && (it.pool === 'potion' || it.pool === 'fairy') ? (POTION[it.id] || (/mana|ash/.test(it.id) ? '#4a8ad8' : '#7ad060')) : rar;
  return { b: '#140c0a', a: base, d: shade(base, 1.35), e: shade(base, .62), c: '#6a4a2a', r, w: '#e8e0d0' };
}
// сетка цветов 16×16 (null — прозрачно)
export function iconGrid(it) {
  const T = TEMPLATES[templateOf(it)], P = paletteOf(it);
  return T.map(row => [...row].map(ch => (ch === '.' ? null : P[ch])));
}

const cache = new Map();
export function iconURL(doc, it) {
  const P = paletteOf(it), key = templateOf(it) + JSON.stringify(P);
  if (cache.has(key)) return cache.get(key);
  const cv = doc.createElement('canvas'); cv.width = cv.height = 16;
  const ctx = cv.getContext('2d'), g = iconGrid(it);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (g[y][x]) { ctx.fillStyle = g[y][x]; ctx.fillRect(x, y, 1, 1); }
  const url = cv.toDataURL('image/png'); cache.set(key, url); return url;
}
// силуэт пустого слота (тёмный)
export function slotIconURL(doc, slot) {
  const key = 'slot:' + slot; if (cache.has(key)) return cache.get(key);
  const t = slot === 'weapon' ? 'sword' : slot, T = TEMPLATES[t] || TEMPLATES.gem;
  const cv = doc.createElement('canvas'); cv.width = cv.height = 16; const ctx = cv.getContext('2d'); ctx.fillStyle = '#3a2c28';
  T.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') ctx.fillRect(x, y, 1, 1); }));
  const url = cv.toDataURL('image/png'); cache.set(key, url); return url;
}
