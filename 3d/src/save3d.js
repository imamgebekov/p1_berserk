// Сохранение 3D-прототипа: сумка, надетое, пепел, убийства. Отдельно от 2D-игры и от настроек ползунков.
import { serialize, deserialize } from './inv.js';
import { sanitizeSkills } from './data/skills3d.js';
import { serializeKnown, sanitizeKnown } from './craft3d.js';
import { CFG3 } from './config3d.js';
import { serializeQuests, sanitizeQuests } from './quests3d.js';
import { HEROES, DEFAULT_HERO } from './data/heroes3d.js';
import { ABILITIES, abilityPointsAt, ranksOpenAt } from './data/abilities3d.js';
const KEY = 'berserk3d.save', VERSION = 6;
// шаг 11 аудита: две резервные копии (раз в cfg.save.bakEvery с прошлое сохранение уходит в bak1, прежняя bak1 — в bak2);
// испорченное основное откладывается в BROKEN для разбора
export const BAK = [KEY + '.bak1', KEY + '.bak2'], BROKEN = KEY + '.broken';
export const SAVE_VERSION = VERSION;
const abPoints = lv => abilityPointsAt(lv, CFG3);

export const packSeen = a => { let s = ''; for (let i = 0; i < a.length; i += 6) { let v = 0; for (let k = 0; k < 6; k++) v |= (a[i + k] ? 1 : 0) << k; s += B64[v]; } return s; };
export const unpackSeen = (s, a) => { if (typeof s !== 'string') return; for (let i = 0; i < s.length; i++) { const v = B64.indexOf(s[i]); if (v < 0) continue; for (let k = 0; k < 6; k++) if (i * 6 + k < a.length) a[i * 6 + k] = (v >> k) & 1; } };
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// туман поверхности по участкам (C1): участок SEEN_CH×SEEN_CH клеток; не открытый — не пишется, открытый целиком — '*',
// частично — 43 знака base64. Размер сохранения растёт с открытой частью карты, а не с размером мира
export const SEEN_CH = 16;
export const seenSize = cfg => Math.ceil(2 * cfg.world.radius / cfg.map.cell) + 2;
export function packSeenChunks(a, n) {
  const C = SEEN_CH, m = Math.ceil(n / C), c = {}, bits = new Uint8Array(C * C);
  for (let cj = 0; cj < m; cj++) for (let ci = 0; ci < m; ci++) {
    let any = false, all = true;
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) { const x = ci * C + i, z = cj * C + j, inside = x < n && z < n, v = inside && a[z * n + x] ? 1 : 0; bits[j * C + i] = v; if (v) any = true; else if (inside) all = false; }
    if (any) c[ci + ',' + cj] = all ? '*' : packSeen(bits);
  }
  return { n, c };
}
export function unpackSeenChunks(o, a, n) {
  if (!o || typeof o !== 'object' || o.n !== n || !o.c || typeof o.c !== 'object') return false;
  const C = SEEN_CH, bits = new Uint8Array(C * C);
  for (const [k, s] of Object.entries(o.c)) {
    const m = /^(\d+),(\d+)$/.exec(k); if (!m || typeof s !== 'string') continue;
    const ci = +m[1], cj = +m[2]; bits.fill(s === '*' ? 1 : 0); if (s !== '*') unpackSeen(s, bits);
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) { const x = ci * C + i, z = cj * C + j; if (x < n && z < n && bits[j * C + i]) a[z * n + x] = 1; }
  }
  return true;
}
// проверка при загрузке: только ключи «x,z» в пределах сетки и строки нужной длины
function sanitizeSeenChunks(o, n) {
  if (!o || typeof o !== 'object' || o.n !== n || !o.c || typeof o.c !== 'object') return null;
  const m = Math.ceil(n / SEEN_CH), c = {};
  for (const [k, s] of Object.entries(o.c)) { const r = /^(\d+),(\d+)$/.exec(k); if (r && +r[1] < m && +r[2] < m && typeof s === 'string' && (s === '*' || (s.length <= 43 && /^[A-Za-z0-9+/]+$/.test(s)))) c[k] = s; }
  return { n, c };
}

// миграции старых версий: MIGRATIONS[n] переводит сохранение из версии n в n+1. Пока версия одна; сюда добавляются шаги.
const MIGRATIONS = {
  1: d => { d.keys = []; d.unlocked = {}; },         // 1 → 2: связка ключей подземелий и отпертые двери
  2: d => { d.hero = DEFAULT_HERO; },                 // 2 → 3: герой; все прежние сохранения — Торн
  3: d => { const pr = d.prog || (d.prog = {}); pr.ab = {}; pr.ap = abPoints(Number.isFinite(pr.lv) ? Math.floor(pr.lv) : 1); },    // 3 → 4: очки умений по уровню
  4: d => {                                                                                // 4 → 5: туман по участкам, позиция, номер мира
    const n = seenSize(CFG3), a = new Uint8Array(n * n); if (typeof d.seen === 'string') unpackSeen(d.seen, a);
    d.seen = packSeenChunks(a, n); d.pos = null; d.gen = CFG3.world.gen;
  },
  5: d => { d.fires = []; }                                                               // 5 → 6: открытые костры (C3d)
};
export function migrate(d) { while (Number.isInteger(d.v) && d.v < VERSION && MIGRATIONS[d.v]) { MIGRATIONS[d.v](d); d.v++; } return d; }

// перенос сохранения между устройствами: текст «B3D1:» + base64 от JSON; при вставке проходит те же проверки, что и обычная загрузка
const PREFIX = 'B3D1:';
export function exportSave(storage = globalThis.localStorage) {
  try { const raw = storage.getItem(KEY); if (!raw) return ''; return PREFIX + btoa(unescape(encodeURIComponent(raw))); } catch (e) { return ''; }
}
export function importSave(text, slots, storage = globalThis.localStorage) {
  try {
    const t = String(text || '').trim(); if (!t.startsWith(PREFIX) || t.length > 600000) return 'bad';
    const raw = decodeURIComponent(escape(atob(t.slice(PREFIX.length))));
    const probe = { getItem: () => raw }; if (!loadSave(slots, probe)) return 'bad';
    storage.setItem(KEY, raw); return 'ok';
  } catch (e) { return 'bad'; }
}

// уровни: поверхность или подземелье из конфига; туман подземелий хранится строками по id
const levelId = v => (typeof v === 'string' && CFG3.dungeons.list.some(d => d.id === v) ? v : 'surface');
// строка тумана подземелья: «размер сетки:биты»; если сетка не совпала (подземелье перестроили, старый формат) — туман не переносится
function sanitizeDseen(o) { const r = {}; if (o && typeof o === 'object') for (const d of CFG3.dungeons.list) if (typeof o[d.id] === 'string' && o[d.id].length < CFG3.dungeons.seenMax && /^\d+:/.test(o[d.id])) r[d.id] = o[d.id]; return r; }
function packDseen(W) { const r = {}; if (W.levels) for (const L of Object.values(W.levels)) if (L.def && L.seen.some(v => v)) r[L.id] = L.seenN + ':' + packSeen(L.seen); return r; }
export function applyDseen(W, dseen) {
  for (const [id, s] of Object.entries(dseen || {})) { const L = W.levels[id], k = s.indexOf(':'); if (L && Number(s.slice(0, k)) === L.seenN) unpackSeen(s.slice(k + 1), L.seen); }
}

// ключи подземелий и отпертые двери: только известные id; номера дверей проверяются при применении к миру
const keyIds = () => Object.keys(CFG3.dungeons.keys || {});
function sanitizeKeys(a) { return Array.isArray(a) ? [...new Set(a.filter(k => keyIds().includes(k)))] : []; }
function sanitizeUnlocked(o) { const r = {}; if (o && typeof o === 'object') for (const d of CFG3.dungeons.list) if (Array.isArray(o[d.id])) r[d.id] = o[d.id].filter(n => Number.isInteger(n) && n >= 0 && n < 64); return r; }
function packUnlocked(W) { const r = {}; if (W.levels) for (const L of Object.values(W.levels)) if (L.def) { const ids = (L.map.doors || []).filter(d => d.lock && !d.locked).map(d => d.id); if (ids.length) r[L.id] = ids; } return r; }
export function applyDungeonState(W, saved) {
  for (const k of saved.keys || []) W.keys[k] = true;
  for (const [id, ids] of Object.entries(saved.unlocked || {})) { const L = W.levels && W.levels[id]; if (L) for (const n of ids) { const d = L.map.doors[n]; if (d && d.lock) d.locked = false; } }
}

// позиция героя на поверхности: числа в пределах мира
const sanePos = p => (p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.hypot(p.x, p.z) < CFG3.world.radius ? { x: p.x, z: p.z } : null);
export function loadSave(slots, storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY); if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    migrate(d); if (d.v !== VERSION) return null;       // более новое сохранение (из будущей версии) не трогаем
    const pr = d.prog || {}, num = (v, a, b, def) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : def);
    const prog = { lv: num(pr.lv, 1, 99, 1), xp: num(pr.xp, 0, 1e9, 0), sp: num(pr.sp, 0, 999, 0), skills: sanitizeSkills(pr.skills) };
    // очков не может быть больше, чем уровней: иначе сбрасываем распределение (защита от испорченного сохранения)
    const spent = Object.values(prog.skills).reduce((a, b) => a + b, 0);
    if (spent + prog.sp > prog.lv - 1) { prog.skills = {}; prog.sp = prog.lv - 1; }
    const hero = HEROES[d.hero] && HEROES[d.hero].open ? d.hero : DEFAULT_HERO;      // неизвестный или ещё закрытый герой — Торн
    // умения: только свои id; ранг не выше открытого к уровню героя (лишнее — срезается); очки умений = данные уровнем − вложенные
    { const ids = (ABILITIES[hero] || []).map(x => x.id), ab = {}, src = pr.ab && typeof pr.ab === 'object' ? pr.ab : {};
      ids.forEach((id, i) => { const r = src[id]; if (Number.isInteger(r) && r > 0) { const m = Math.min(r, ranksOpenAt(prog.lv, CFG3, i)); if (m > 0) ab[id] = m; } });
      const ap = Math.max(0, abPoints(prog.lv) - Object.values(ab).reduce((a, b) => a + b, 0));
      prog.ab = ab; prog.ap = ap; }
    const sameWorld = d.gen === CFG3.world.gen;        // другой мир (номер world.gen) — туман, позиция и таймеры боссов не переносятся
    return { hero, inv: deserialize(d.inv, slots, hero), kills: Number.isFinite(d.kills) ? d.kills : 0, prog, seen: sameWorld ? sanitizeSeenChunks(d.seen, seenSize(CFG3)) : null, pos: sameWorld ? sanePos(d.pos) : null, gen: d.gen, bosses: sameWorld && d.bosses && typeof d.bosses === 'object' ? d.bosses : {}, difficulty: typeof d.difficulty === 'string' ? d.difficulty : null, iron: d.iron === true, tomb: d.tomb && Number.isFinite(d.tomb.x) && Number.isFinite(d.tomb.z) && Number.isFinite(d.tomb.ash) && d.tomb.ash > 0 ? { x: d.tomb.x, z: d.tomb.z, ash: Math.floor(d.tomb.ash), lvl: levelId(d.tomb.lvl) } : null, dseen: sanitizeDseen(d.dseen), keys: sanitizeKeys(d.keys), unlocked: sanitizeUnlocked(d.unlocked), known: sanitizeKnown(d.known, CFG3), quests: sanitizeQuests(d.quests), t: Number.isFinite(d.t) && d.t > 0 ? d.t : 0, squad: Array.isArray(d.squad) ? d.squad.slice(0, 8).map(a => ({ type: a && a.type, hp: a && a.hp })) : [], fires: sameWorld && Array.isArray(d.fires) ? d.fires.filter(x => typeof x === 'string').slice(0, 200) : [], shrines: sameWorld && d.shrines && typeof d.shrines === 'object' ? Object.fromEntries(Object.entries(d.shrines).filter(([k, v]) => /^p\d+$/.test(k) && Number.isFinite(v)).slice(0, 300)) : {} };
  } catch (e) { return null; }
}
// загрузка с откатом на резервные копии: { save, from: 'main' | 'bak1' | 'bak2' } или null; из копии — она же становится основной
export function loadSaveAny(slots, storage = globalThis.localStorage) {
  let main = null; try { main = storage.getItem(KEY); } catch (e) { return null; }
  const s = loadSave(slots, storage); if (s || !main) return s ? { save: s, from: 'main' } : null;
  for (let i = 0; i < BAK.length; i++) {
    let raw = null; try { raw = storage.getItem(BAK[i]); } catch (e) { /* нет копии */ }
    const b = raw && loadSave(slots, { getItem: () => raw }); if (!b) continue;
    try { storage.setItem(BROKEN, main); storage.setItem(KEY, raw); } catch (e) { /* хотя бы загрузимся */ }
    return { save: b, from: 'bak' + (i + 1) };
  }
  return null;
}
// имя файла сохранения: berserk3d-save-ГГГГ-ММ-ДД.txt
export const saveFileName = (d = new Date()) => `berserk3d-save-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.txt`;
// onFail(err) — запись не удалась (кончилось место и т. п.); now — часы в мс (для тестов)
export function createSaver(W, storage = globalThis.localStorage, { onFail = null, now = () => Date.now(), bakEvery = (CFG3.save ? CFG3.save.bakEvery : 300) * 1000 } = {}) {
  let last = '', lastBak = now();
  const snap = () => JSON.stringify({ v: VERSION, hero: W.hero, inv: serialize(W.inv), kills: W.kills, prog: { lv: W.lv, xp: W.xp, sp: W.sp, skills: W.skills, ap: W.ap, ab: W.ab }, seen: W.levels ? packSeenChunks(W.levels.surface.seen, W.levels.surface.seenN) : packSeenChunks(W.seen, W.seenN), pos: W.lvl === 'surface' && !W.player.dead ? { x: Math.round(W.player.x * 100) / 100, z: Math.round(W.player.z * 100) / 100 } : null, gen: W.cfg.world.gen, dseen: packDseen(W), keys: Object.keys(W.keys || {}).filter(k => W.keys[k]), unlocked: packUnlocked(W), bosses: { ...W.bossDead }, difficulty: W.difficulty, iron: W.iron, tomb: W.tomb, known: serializeKnown(W.known), quests: serializeQuests(W.quests), t: Math.round(W.t), squad: W.allies.filter(a => !a.dead && !a.guest).map(a => ({ type: a.type, hp: Math.round(a.hp) })), fires: Object.keys(W.fires || {}), shrines: Object.fromEntries(Object.entries(W.shrines || {}).filter(([, v]) => v > W.t).map(([k, v]) => [k, Math.round(v)])) });
  return {
    write(force) {
      if (W.ironDead) return false; const s = snap(); if (!force && s === last) return false;
      try {
        if (now() - lastBak >= bakEvery) { const prev = storage.getItem(KEY); if (prev && prev !== s) { const b1 = storage.getItem(BAK[0]); if (b1) storage.setItem(BAK[1], b1); storage.setItem(BAK[0], prev); } lastBak = now(); }
        storage.setItem(KEY, s); last = s; return true;
      } catch (e) { if (onFail) onFail(e); return false; }
    },
    reset() { try { storage.removeItem(KEY); for (const k of BAK) storage.removeItem(k); } catch (e) { /* ок */ } last = ''; }
  };
}
