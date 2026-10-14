// Сохранение 3D-прототипа: сумка, надетое, пепел, убийства. Отдельно от 2D-игры и от настроек ползунков.
import { serialize, deserialize } from './inv.js';
import { sanitizeSkills } from './data/skills3d.js';
const KEY = 'berserk3d.save', VERSION = 1;

export const packSeen = a => { let s = ''; for (let i = 0; i < a.length; i += 6) { let v = 0; for (let k = 0; k < 6; k++) v |= (a[i + k] ? 1 : 0) << k; s += B64[v]; } return s; };
export const unpackSeen = (s, a) => { if (typeof s !== 'string') return; for (let i = 0; i < s.length; i++) { const v = B64.indexOf(s[i]); if (v < 0) continue; for (let k = 0; k < 6; k++) if (i * 6 + k < a.length) a[i * 6 + k] = (v >> k) & 1; } };
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function loadSave(slots, storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY); if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== VERSION) return null;
    const pr = d.prog || {}, num = (v, a, b, def) => (Number.isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : def);
    const prog = { lv: num(pr.lv, 1, 99, 1), xp: num(pr.xp, 0, 1e9, 0), sp: num(pr.sp, 0, 999, 0), skills: sanitizeSkills(pr.skills) };
    // очков не может быть больше, чем уровней: иначе сбрасываем распределение (защита от испорченного сохранения)
    const spent = Object.values(prog.skills).reduce((a, b) => a + b, 0);
    if (spent + prog.sp > prog.lv - 1) { prog.skills = {}; prog.sp = prog.lv - 1; }
    return { inv: deserialize(d.inv, slots), kills: Number.isFinite(d.kills) ? d.kills : 0, prog, seen: typeof d.seen === 'string' && d.seen.length < 4000 ? d.seen : '', squad: Array.isArray(d.squad) ? d.squad.slice(0, 8).map(a => ({ type: a && a.type, hp: a && a.hp })) : [] };
  } catch (e) { return null; }
}
export function createSaver(W, storage = globalThis.localStorage) {
  let last = '';
  const snap = () => JSON.stringify({ v: VERSION, inv: serialize(W.inv), kills: W.kills, prog: { lv: W.lv, xp: W.xp, sp: W.sp, skills: W.skills }, seen: packSeen(W.seen), squad: W.allies.filter(a => !a.dead).map(a => ({ type: a.type, hp: Math.round(a.hp) })) });
  return {
    write(force) { const s = snap(); if (!force && s === last) return false; try { storage.setItem(KEY, s); last = s; return true; } catch (e) { return false; } },
    reset() { try { storage.removeItem(KEY); } catch (e) { /* ок */ } last = ''; }
  };
}
