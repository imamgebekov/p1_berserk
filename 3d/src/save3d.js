// Сохранение 3D-прототипа: сумка, надетое, пепел, убийства. Отдельно от 2D-игры и от настроек ползунков.
import { serialize, deserialize } from './inv.js';
const KEY = 'berserk3d.save', VERSION = 1;

export function loadSave(slots, storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY); if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== VERSION) return null;
    return { inv: deserialize(d.inv, slots), kills: Number.isFinite(d.kills) ? d.kills : 0 };
  } catch (e) { return null; }
}
export function createSaver(W, storage = globalThis.localStorage) {
  let last = '';
  const snap = () => JSON.stringify({ v: VERSION, inv: serialize(W.inv), kills: W.kills });
  return {
    write(force) { const s = snap(); if (!force && s === last) return false; try { storage.setItem(KEY, s); last = s; return true; } catch (e) { return false; } },
    reset() { try { storage.removeItem(KEY); } catch (e) { /* ок */ } last = ''; }
  };
}
