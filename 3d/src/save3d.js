// Сохранение 3D-прототипа: сумка, надетое, пепел, убийства. Отдельно от 2D-игры и от настроек ползунков.
import { serialize, deserialize } from './inv.js';
import { sanitizeSkills } from './data/skills3d.js';
const KEY = 'berserk3d.save', VERSION = 1;

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
    return { inv: deserialize(d.inv, slots), kills: Number.isFinite(d.kills) ? d.kills : 0, prog };
  } catch (e) { return null; }
}
export function createSaver(W, storage = globalThis.localStorage) {
  let last = '';
  const snap = () => JSON.stringify({ v: VERSION, inv: serialize(W.inv), kills: W.kills, prog: { lv: W.lv, xp: W.xp, sp: W.sp, skills: W.skills } });
  return {
    write(force) { const s = snap(); if (!force && s === last) return false; try { storage.setItem(KEY, s); last = s; return true; } catch (e) { return false; } },
    reset() { try { storage.removeItem(KEY); } catch (e) { /* ок */ } last = ''; }
  };
}
