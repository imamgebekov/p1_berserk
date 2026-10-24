// Сохранение 3D-прототипа: сумка, надетое, пепел, убийства. Отдельно от 2D-игры и от настроек ползунков.
import { packLockout, sanitizeLockout } from './lockout3d.js';     // план подземелий, 1б
import { serialize, deserialize, cleanAf } from './inv.js';
import { BY_ID as BY_ID_S } from './data/items.js';
import { serializeStory, sanitizeStory } from './story3d.js';
import { serializeLife, sanitizeLife } from './life3d.js';
import { serializeAch, sanitizeAch } from './achieve3d.js';
import { sanitizeSkills } from './data/skills3d.js';
import { serializeKnown, sanitizeKnown } from './craft3d.js';
import { CFG3 } from './config3d.js';
import { serializeQuests, sanitizeQuests } from './quests3d.js';
import { HEROES, DEFAULT_HERO } from './data/heroes3d.js';
import { ABILITIES, abilityPointsAt, ranksOpenAt } from './data/abilities3d.js';
import { schoolsOf } from './school3d.js';
import { packSquad } from './squad3d.js';
import { wdist } from './geo3d.js';     // Мир 5.0
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
// мир ×2 (4.04): туман из сохранения прежнего мира (радиус world.inner) — в новую сетку со сдвигом к центру; иначе — как есть
export function growSeen(o, cfg) {
  const n = seenSize(cfg), Rin = cfg.world.inner; if (!o || !Rin || o.n === n) return o;
  const n0 = seenSize({ ...cfg, world: { ...cfg.world, radius: Rin } }), off = Math.round((cfg.world.radius - Rin) / cfg.map.cell); if (o.n !== n0) return o;
  const a0 = new Uint8Array(n0 * n0); if (!unpackSeenChunks(o, a0, n0)) return o;
  const a = new Uint8Array(n * n); for (let z = 0; z < n0; z++) for (let x = 0; x < n0; x++) if (a0[z * n0 + x]) { const X = x + off, Z = z + off; if (X < n && Z < n) a[Z * n + X] = 1; }
  return packSeenChunks(a, n);
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
function packDseen(W) { const r = {}; if (W.levels) for (const L of Object.values(W.levels)) if (L.def && !L.def.abyss && !L.def.gen && !String(L.id).startsWith('up:') && L.seen.some(v => v)) r[L.id] = L.seenN + ':' + packSeen(L.seen); return r; }     // вторые этажи (up:…) не пакуются: при загрузке sanitizeDseen их всё равно отбрасывает (2026-10-23: сотни сеток тормозили сохранение)
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
  W.lockout = { ...(saved.lockout || {}) };     // откат награды подземелий и рейдов (план подземелий, 1б)
  for (const id of saved.heroic || []) { const L = W.levels && W.levels[id]; if (L && L.def && L.def.inst && W.lv >= W.cfg.instances.heroic.lv) { L.heroic = true; L.leftT = undefined; } }     // включённый героик переживает перезагрузку (1а)
}

// позиция героя на поверхности: числа в пределах мира
const sanePos = p => (p && Number.isFinite(p.x) && Number.isFinite(p.z) && wdist(CFG3, p.x, p.z) < CFG3.world.radius ? { x: p.x, z: p.z } : null);     // от центра мира (Мир 5.0)
// снаряжение бойца отряда (2026-10-20): только существующие вещи в своих слотах, уровни и заточка в пределах, свойства — очищенные
function cleanKit(k) {
  if (!k || typeof k !== 'object' || !k.eq || typeof k.eq !== 'object') return null;
  const out = { eq: {}, up: {}, il: {}, af: {} };
  for (const s of ['weapon', 'offhand', 'head', 'body', 'cloak', 'boots', 'ring', 'amulet']) {
    const id = k.eq[s], it = typeof id === 'string' && BY_ID_S[id]; if (!it || !(it.slot === s || (s === 'offhand' && (it.slot === 'weapon' || it.slot === 'offhand')))) { out.eq[s] = null; continue; }
    out.eq[s] = id; const up = k.up && k.up[s], il = k.il && k.il[s];
    if (Number.isInteger(up) && up > 0) out.up[s] = Math.min(up, 5); if (Number.isFinite(il) && il > 0) out.il[s] = Math.min(Math.floor(il), 99);
    const af = k.af && cleanAf(k.af[s], CFG3); if (af) out.af[s] = af;
  }
  return Object.values(out.eq).some(Boolean) ? out : null;
}
// могила с пеплом и наёмники героя: числа в пределах, не больше 8 бойцов
const sanitizeTomb = t => (t && Number.isFinite(t.x) && Number.isFinite(t.z) && Number.isFinite(t.ash) && t.ash > 0 ? { x: t.x, z: t.z, ash: Math.floor(t.ash), lvl: levelId(t.lvl) } : null);
const sanitizeSquad = a => (Array.isArray(a) ? a.slice(0, 8).map(q => ({ type: q && q.type, hp: q && q.hp, kit: cleanKit(q && q.kit) })) : []);
// отложенный герой (отдельные герои, 2026-10-23): своя сумка, место, могила, наёмники и здоровье; старое сохранение — их нет (inv: null — новая сумка при смене)
function parkedOf(src, h, fresh, slots, sameWorld) {
  const q = progOf(src, h, fresh);
  return { lv: q.lv, xp: q.xp, sp: q.sp, skills: q.skills, ap: q.ap, ab: q.ab, bar: q.bar, school: q.school, sch: q.sch, inv: src.inv && typeof src.inv === 'object' ? deserialize(src.inv, slots, h, CFG3) : null, pos: sameWorld ? sanePos(src.pos) : null, tomb: sameWorld ? sanitizeTomb(src.tomb) : null, squad: sanitizeSquad(src.squad), hp: Number.isFinite(src.hp) && src.hp > 0 ? Math.floor(src.hp) : null };
}
// прогресс героя из сохранения: уровень, опыт, очки, навыки и умения в допустимых пределах
function progOf(pr, hero, fresh = false) {     // fresh — древо умений (2026-10-20): сброс умений и талантов с возвратом всех очков
    const num = (v, a, b, def) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : def);
    const prog = { lv: num(pr.lv, 1, 99, 1), xp: num(pr.xp, 0, 1e9, 0), sp: num(pr.sp, 0, 999, 0), skills: sanitizeSkills(pr.skills, hero), spark: pr.spark && typeof pr.spark === 'object' ? pr.spark : null, mentor: pr.mentor && typeof pr.mentor === 'object' ? pr.mentor : null, path: pr.path && typeof pr.path === 'object' ? pr.path : null };     // path — чистит main.js (sanitizePath)     // spark — чистит main.js (sanitizeSpark)
    prog.prank = num(pr.prank, 0, CFG3.level.ranks ? CFG3.level.ranks.cap : 0, 0); prog.pxp = num(pr.pxp, 0, 1e9, 0); prog.ng = num(pr.ng, 0, 99, 0);     // пепельные ранги (этап 3 «круче»)
    if (fresh) { prog.skills = {}; pr = { ...pr, ab: {}, bar: [] }; }
    // очков не может быть больше, чем уровней: иначе сбрасываем распределение (защита от испорченного сохранения)
    const spent = Object.values(prog.skills).reduce((a, b) => a + b, 0);
    if (spent + prog.sp > prog.lv - 1) { prog.skills = {}; prog.sp = prog.lv - 1; }
    else if (spent + prog.sp < prog.lv - 1) prog.sp = prog.lv - 1 - spent;     // этап 2: старые навыки стали талантами — пропавшие очки возвращаются
    // умения: только свои id; ранг не выше открытого к уровню героя (лишнее — срезается); очки умений = данные уровнем − вложенные
    { const ids = (ABILITIES[hero] || []).map(x => x.id), ab = {}, src = pr.ab && typeof pr.ab === 'object' ? pr.ab : {};
      ids.forEach((id, i) => { const r = src[id]; if (Number.isInteger(r) && r > 0) { const m = Math.min(r, ranksOpenAt(prog.lv, CFG3, i, ABILITIES[hero][i])); if (m > 0) ab[id] = m; } });
      const ap = Math.max(0, abPoints(prog.lv) - Object.values(ab).reduce((a, b) => a + b, 0));
      prog.ab = ab; prog.ap = ap; prog.bar = Array.isArray(pr.bar) ? pr.bar.slice(0, 6).map(id => (typeof id === 'string' && ids.includes(id) ? id : null)) : []; }     // панель умений
    return schoolsOf(hero, prog, fresh ? {} : pr, CFG3);     // школы (2026-10-22): своя школа и отложенные; старое сохранение — делится по веткам
}
export function loadSave(slots, storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY); if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    migrate(d); if (d.v !== VERSION) return null;       // более новое сохранение (из будущей версии) не трогаем
    const hero = HEROES[d.hero] && HEROES[d.hero].open ? d.hero : DEFAULT_HERO;      // неизвестный или ещё закрытый герой — Торн
    const fresh = d.tree !== 1, prog = progOf(d.prog || {}, hero, fresh); prog.treeReset = fresh && Number.isFinite(d.v);     // старое сохранение — очки возвращены (сообщение)
    const sameWorld = d.gen === CFG3.world.gen;        // другой мир (номер world.gen) — туман, позиция и таймеры боссов не переносятся
    const heroes = {};     // отложенные герои (2026-10-18): свой уровень и умения; старое сохранение — пусто (уровень у текущего)
    if (d.heroes && typeof d.heroes === 'object') for (const h of Object.keys(HEROES)) if (h !== hero && HEROES[h].open && d.heroes[h] && typeof d.heroes[h] === 'object') heroes[h] = parkedOf(d.heroes[h], h, fresh, slots, sameWorld);
    return { hero, heroes, life: (L => (sameWorld ? L : { ...L, coaches: { camp: 1 }, nodes: {} }))(sanitizeLife(d.life, CFG3)), story: sanitizeStory(d.story), ach: sanitizeAch(d.ach), inv: deserialize(d.inv, slots, hero, CFG3), kills: Number.isFinite(d.kills) ? d.kills : 0, prog, seen: sameWorld ? sanitizeSeenChunks(growSeen(d.seen, CFG3), seenSize(CFG3)) : null, pos: sameWorld ? sanePos(d.pos) : null, gen: d.gen, bosses: sameWorld && d.bosses && typeof d.bosses === 'object' ? d.bosses : {}, difficulty: typeof d.difficulty === 'string' ? d.difficulty : null, iron: d.iron === true, tomb: sameWorld ? sanitizeTomb(d.tomb) : null, dseen: sanitizeDseen(d.dseen), keys: sanitizeKeys(d.keys), unlocked: sanitizeUnlocked(d.unlocked), lockout: sanitizeLockout(d.lockout), heroic: Array.isArray(d.heroic) ? d.heroic.filter(x => typeof x === 'string') : [], known: sameWorld ? sanitizeKnown(d.known, CFG3) : { ...sanitizeKnown(d.known, CFG3), places: {} }, quests: sanitizeQuests(d.quests), qf: typeof d.qf === 'string' && d.qf.length < 40 ? d.qf : null, t: Number.isFinite(d.t) && d.t > 0 ? d.t : 0, squad: sanitizeSquad(d.squad), fires: sameWorld && Array.isArray(d.fires) ? d.fires.filter(x => typeof x === 'string').slice(0, 200) : [], shrines: sameWorld && d.shrines && typeof d.shrines === 'object' ? Object.fromEntries(Object.entries(d.shrines).filter(([k, v]) => /^o?p\d+$/.test(k) && Number.isFinite(v)).slice(0, 300)) : {} };     // Мир 5.0: другой мир (world.gen) — знакомые места, повозки, узлы сбора и могила заново (id и места генератора)
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
  let last = '', lastBak = now(), off = false;     // off — после сброса: автосохранение при уходе со страницы не вернёт старый прогресс
  const snap = () => JSON.stringify({ v: VERSION, tree: 1, hero: W.hero, heroes: Object.fromEntries(Object.entries(W.heroes || {}).map(([h, q]) => [h, { ...q, inv: q.inv ? serialize(q.inv) : undefined }])), life: W.life ? serializeLife(W) : null, story: serializeStory(W.story), ach: serializeAch(W.ach), inv: serialize(W.inv), kills: W.kills, prog: { lv: W.lv, xp: W.xp, sp: W.sp, skills: W.skills, ap: W.ap, ab: W.ab, bar: W.bar, school: W.school || 0, sch: W.sch || {}, spark: W.spark, mentor: W.mentor, path: W.path, prank: W.prank || 0, pxp: W.pxp || 0, ng: W.ng || 0 }, seen: W.levels ? packSeenChunks(W.levels.surface.seen, W.levels.surface.seenN) : packSeenChunks(W.seen, W.seenN), pos: W.player.dead ? null : W.lvl === 'surface' ? { x: Math.round(W.player.x * 100) / 100, z: Math.round(W.player.z * 100) / 100 } : W.surfPos || null, gen: W.cfg.world.gen, dseen: packDseen(W), keys: Object.keys(W.keys || {}).filter(k => W.keys[k]), unlocked: packUnlocked(W), lockout: packLockout(W), heroic: W.levels ? Object.values(W.levels).filter(L => L.heroic).map(L => L.id) : [], bosses: { ...W.bossDead }, difficulty: W.difficulty, iron: W.iron, tomb: W.tomb, known: serializeKnown(W.known), quests: serializeQuests(W.quests), qf: W.questFocus || null, t: Math.round(W.t), squad: packSquad(W), fires: Object.keys(W.fires || {}), shrines: Object.fromEntries(Object.entries(W.shrines || {}).filter(([, v]) => v > W.t).map(([k, v]) => [k, Math.round(v)])) });
  return {
    write(force) {
      if (W.ironDead || off) return false; const s = snap(); if (!force && s === last) return false;
      try {
        if (now() - lastBak >= bakEvery) { const prev = storage.getItem(KEY); if (prev && prev !== s) { const b1 = storage.getItem(BAK[0]); if (b1) storage.setItem(BAK[1], b1); storage.setItem(BAK[0], prev); } lastBak = now(); }
        storage.setItem(KEY, s); last = s; return true;
      } catch (e) { if (onFail) onFail(e); return false; }
    },
    reset() { off = true; try { storage.removeItem(KEY); for (const k of BAK) storage.removeItem(k); } catch (e) { /* ок */ } last = ''; }
  };
}
