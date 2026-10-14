// Сохранение: localStorage, версия формата, цепочка миграций, очистка данных, резервная копия.
// Без DOM. Хранилище передаётся параметром (в тестах — подделка), по умолчанию — localStorage, если он доступен.
import { CFG } from './config.js';
import { P, W } from './state.js';
import { ITEMS_BY_ID, SLOTS } from './data/items.js';
import { SKILLS } from './data/skills.js';
import { QUESTS_BY_ID } from './data/quests.js';
import { newItem, recalc } from './inventory.js';
import { buyPrice } from './shop.js';
import { isMuted, setMuted } from './audio.js';

export const VERSION = 1;
// MIGRATIONS[n] переводит данные формата n в формат n+1 (получает копию, возвращает новый объект).
// Пример для будущего: MIGRATIONS[1] = d => ({ ...d, P: { ...d.P, newField: 0 } });
export const MIGRATIONS = {};

export function migrate(data, { version = VERSION, migrations = MIGRATIONS } = {}) {
  if (!data || typeof data !== 'object' || !Number.isInteger(data.v) || data.v < 1) throw new Error('нет версии формата');
  if (data.v > version) throw new Error('сохранение сделано более новой версией игры (v' + data.v + ')');
  let d = data;
  while (d.v < version) {
    const m = migrations[d.v];
    if (!m) throw new Error('нет миграции с v' + d.v);
    const next = m(JSON.parse(JSON.stringify(d)));
    if (!next || typeof next !== 'object') throw new Error('миграция v' + d.v + ' ничего не вернула');
    next.v = d.v + 1; d = next;
  }
  return d;
}

// ---- снимок ----
const item = it => it ? { id: it.id, up: it.up || 0 } : null;

export function snapshot() {
  return {
    v: VERSION, savedAt: Date.now(),
    P: {
      lv: P.lv, xp: Math.floor(P.xp), ash: P.ash, kills: P.kills, sp: P.sp,
      skills: { ...P.skills },
      bag: P.bag.map(item),
      eq: Object.fromEntries(SLOTS.map(s => [s, item(P.eq[s])])),
      quests: JSON.parse(JSON.stringify(P.quests))
    },
    W: { cycle: W.cycle, shop: W.shop.built ? W.shop.items.map(e => e.item.id) : null },
    settings: { muted: isMuted() }
  };
}

// ---- очистка: чужие/устаревшие/испорченные данные приводятся к допустимым ----
const int = (v, lo, hi, d = lo) => Number.isFinite(+v) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, Math.floor(+v))) : d;

function cleanItem(x, slot) {
  if (!x || typeof x !== 'object' || !ITEMS_BY_ID[x.id]) return null;
  const def = ITEMS_BY_ID[x.id];
  if (slot && def.slot !== slot) return null;
  return { id: x.id, up: def.slot === 'weapon' ? int(x.up, 0, CFG.smith.maxLevel, 0) : 0 };
}

export function sanitize(d) {
  const p = (d && d.P) || {}, w = (d && d.W) || {};
  const out = {
    lv: int(p.lv, 1, 99, 1), xp: int(p.xp, 0, 1e9, 0), ash: int(p.ash, 0, 1e9, 0), kills: int(p.kills, 0, 1e9, 0), sp: int(p.sp, 0, 99, 0),
    skills: {}, bag: [], eq: {}, quests: {},
    cycle: int(w.cycle, 0, 999, 0), shop: null, muted: !!(d && d.settings && d.settings.muted)
  };
  for (const id of Object.keys(SKILLS)) { const r = int(p.skills && p.skills[id], 0, SKILLS[id].max, 0); if (r) out.skills[id] = r; }
  if (Array.isArray(p.bag)) out.bag = p.bag.map(x => cleanItem(x)).filter(Boolean).slice(0, CFG.items.bagSize);
  for (const s of SLOTS) out.eq[s] = cleanItem(p.eq && p.eq[s], s);
  for (const id of Object.keys(QUESTS_BY_ID)) {
    const s = p.quests && p.quests[id];
    if (!s || !['active', 'done', 'claimed'].includes(s.st)) continue;
    const goal = QUESTS_BY_ID[id].goal;
    out.quests[id] = { st: s.st, n: s.st === 'active' ? int(s.n, 0, goal - 1, 0) : goal };
  }
  if (Array.isArray(w.shop)) out.shop = w.shop.filter(id => ITEMS_BY_ID[id]).slice(0, CFG.shop.size);
  return out;
}

// ---- применить очищенные данные к состоянию игры ----
export function applySave(c) {
  P.lv = c.lv; P.xp = c.xp; P.ash = c.ash; P.kills = c.kills; P.sp = c.sp;
  P.skills = { ...c.skills }; P.quests = JSON.parse(JSON.stringify(c.quests));
  P.bag = c.bag.map(i => ({ uid: ++W.itemSeq, id: i.id, up: i.up }));
  for (const s of SLOTS) P.eq[s] = c.eq[s] ? { uid: ++W.itemSeq, id: c.eq[s].id, up: c.eq[s].up } : null;
  W.cycle = c.cycle; W.maxT = c.cycle > 0 ? CFG.eclipse.nextTimer : CFG.eclipse.firstTimer; W.timer = W.maxT;
  W.shop = c.shop ? { built: true, items: c.shop.map(id => ({ item: newItem(id), cost: buyPrice(ITEMS_BY_ID[id]) })) } : { items: [], built: false };
  P.x = CFG.world.fire + CFG.world.startOffset; P.rage = 0; P.rageOn = 0; P.dead = false;
  recalc(); P.hp = P.maxhp;
  setMuted(c.muted);
}

function defaultStorage() {
  try { const s = globalThis.localStorage; s.setItem('__t', '1'); s.removeItem('__t'); return s; } catch (e) { return null; }
}

// Сохранялка: загрузка, запись, автосохранение, сброс
export function createSaver(storage = defaultStorage(), now = () => Date.now()) {
  const S = CFG.save;
  const st = { available: !!storage, lastAt: 0, error: null, dirty: false, acc: 0, sinceWrite: 1e9 };
  const backup = raw => { try { storage.setItem(S.backupKey, raw); } catch (e) { /* не критично */ } };

  function write() {
    if (!storage) return false;
    try { storage.setItem(S.key, JSON.stringify(snapshot())); st.lastAt = now(); st.error = null; st.dirty = false; st.sinceWrite = 0; return true; }
    catch (e) { st.error = String(e && e.message || e); return false; }
  }

  // { data, error, migrated }: data — очищенное сохранение или null
  function load() {
    if (!storage) return { data: null, error: null };
    let raw;
    try { raw = storage.getItem(S.key); } catch (e) { return { data: null, error: 'доступ к хранилищу' }; }
    if (raw == null) return { data: null, error: null };
    try {
      const parsed = JSON.parse(raw);
      const migrated = parsed && parsed.v !== VERSION;
      if (migrated) backup(raw);                 // перед миграцией сохраняем исходное
      const data = sanitize(migrate(parsed));
      return { data, error: null, migrated: !!migrated, savedAt: parsed.savedAt };
    } catch (e) {
      backup(raw);                               // повреждённое не теряем
      return { data: null, error: String(e && e.message || e) };
    }
  }

  // Краткие сведения для экрана входа, без изменения состояния
  function peek() {
    const r = load();
    return r.data ? { lv: r.data.lv, ash: r.data.ash, cycle: r.data.cycle, savedAt: r.savedAt } : null;
  }

  return {
    status: st, load, peek, write,
    request() { st.dirty = true; },
    // вызывать каждый кадр с реальным dt (сек): автосохранение по таймеру и по запросу не чаще minGap
    tick(dt) {
      if (!W.started) return;
      st.acc += dt; st.sinceWrite += dt;
      if ((st.dirty && st.sinceWrite >= S.minGap) || st.acc >= S.interval) { st.acc = 0; write(); }
    },
    reset() { try { storage && storage.removeItem(S.key); storage && storage.removeItem(S.backupKey); } catch (e) { /* ничего */ } }
  };
}
