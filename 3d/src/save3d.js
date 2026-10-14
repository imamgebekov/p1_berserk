// Сохранение 3D-прототипа: сумка, надетое, пепел, убийства. Отдельно от 2D-игры и от настроек ползунков.
import { serialize, deserialize } from './inv.js';
import { sanitizeSkills } from './data/skills3d.js';
import { serializeKnown, sanitizeKnown } from './craft3d.js';
import { CFG3 } from './config3d.js';
import { serializeQuests, sanitizeQuests } from './quests3d.js';
const KEY = 'berserk3d.save', VERSION = 1;

export const packSeen = a => { let s = ''; for (let i = 0; i < a.length; i += 6) { let v = 0; for (let k = 0; k < 6; k++) v |= (a[i + k] ? 1 : 0) << k; s += B64[v]; } return s; };
export const unpackSeen = (s, a) => { if (typeof s !== 'string') return; for (let i = 0; i < s.length; i++) { const v = B64.indexOf(s[i]); if (v < 0) continue; for (let k = 0; k < 6; k++) if (i * 6 + k < a.length) a[i * 6 + k] = (v >> k) & 1; } };
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// миграции старых версий: MIGRATIONS[n] переводит сохранение из версии n в n+1. Пока версия одна; сюда добавляются шаги.
const MIGRATIONS = {};
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
    return { inv: deserialize(d.inv, slots), kills: Number.isFinite(d.kills) ? d.kills : 0, prog, seen: typeof d.seen === 'string' && d.seen.length < 4000 ? d.seen : '', bosses: d.bosses && typeof d.bosses === 'object' ? d.bosses : {}, difficulty: typeof d.difficulty === 'string' ? d.difficulty : null, iron: d.iron === true, tomb: d.tomb && Number.isFinite(d.tomb.x) && Number.isFinite(d.tomb.z) && Number.isFinite(d.tomb.ash) && d.tomb.ash > 0 ? { x: d.tomb.x, z: d.tomb.z, ash: Math.floor(d.tomb.ash), lvl: levelId(d.tomb.lvl) } : null, dseen: sanitizeDseen(d.dseen), known: sanitizeKnown(d.known, CFG3), quests: sanitizeQuests(d.quests), t: Number.isFinite(d.t) && d.t > 0 ? d.t : 0, squad: Array.isArray(d.squad) ? d.squad.slice(0, 8).map(a => ({ type: a && a.type, hp: a && a.hp })) : [] };
  } catch (e) { return null; }
}
export function createSaver(W, storage = globalThis.localStorage) {
  let last = '';
  const snap = () => JSON.stringify({ v: VERSION, inv: serialize(W.inv), kills: W.kills, prog: { lv: W.lv, xp: W.xp, sp: W.sp, skills: W.skills }, seen: packSeen(W.levels ? W.levels.surface.seen : W.seen), dseen: packDseen(W), bosses: { ...W.bossDead }, difficulty: W.difficulty, iron: W.iron, tomb: W.tomb, known: serializeKnown(W.known), quests: serializeQuests(W.quests), t: Math.round(W.t), squad: W.allies.filter(a => !a.dead).map(a => ({ type: a.type, hp: Math.round(a.hp) })) });
  return {
    write(force) { if (W.ironDead) return false; const s = snap(); if (!force && s === last) return false; try { storage.setItem(KEY, s); last = s; return true; } catch (e) { return false; } },
    reset() { try { storage.removeItem(KEY); } catch (e) { /* ок */ } last = ''; }
  };
}
