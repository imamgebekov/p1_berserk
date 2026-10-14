// Панель настроек ⚙: ползунки для чисел из config3d.js. Значения сохраняются в браузере; «Скопировать» отдаёт их текстом.
import { TWEAKS, getPath, setPath } from './config3d.js';

const KEY = 'berserk3d.tweaks';

export function loadTweaks(cfg, storage = globalThis.localStorage) {
  let saved = {};
  try { saved = JSON.parse(storage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  for (const t of TWEAKS) {
    const v = saved[t.path];
    if (typeof v === 'number' && Number.isFinite(v)) setPath(cfg, t.path, Math.min(t.max, Math.max(t.min, v)));
  }
}

export function createTweakPanel(doc, cfg, defaults, { onChange, onOpen, onClose, storage = globalThis.localStorage } = {}) {
  const $ = id => doc.getElementById(id);
  const panel = $('panel'), list = $('tweaks'), status = $('tweakStatus');
  const rows = new Map();

  const diff = () => { const d = {}; for (const t of TWEAKS) { const v = getPath(cfg, t.path); if (v !== getPath(defaults, t.path)) d[t.path] = v; } return d; };
  const save = () => { try { storage.setItem(KEY, JSON.stringify(diff())); } catch (e) { /* без сохранения */ } };
  const fmt = (t, v) => (Number.isInteger(t.step) ? String(Math.round(v)) : Number(v).toFixed(t.step < .1 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '')) + (t.unit || '');

  for (const t of TWEAKS) {
    const row = doc.createElement('label'); row.className = 'trow';
    const top = doc.createElement('span'); top.className = 'ttop';
    const nm = doc.createElement('span'); nm.textContent = t.label;
    const val = doc.createElement('b');
    top.append(nm, val);
    const inp = doc.createElement('input'); inp.type = 'range'; inp.min = t.min; inp.max = t.max; inp.step = t.step; inp.setAttribute('aria-label', t.label);
    row.append(top, inp); list.appendChild(row);
    inp.addEventListener('input', () => { const v = Number(inp.value); setPath(cfg, t.path, v); val.textContent = fmt(t, v); onChange && onChange(t); });
    inp.addEventListener('change', save);
    rows.set(t.path, { inp, val, t });
  }
  function refresh() { for (const { inp, val, t } of rows.values()) { const v = getPath(cfg, t.path); inp.value = v; val.textContent = fmt(t, v); } status.textContent = Object.keys(diff()).length ? 'Изменено: ' + Object.keys(diff()).length : 'Все значения по умолчанию'; }

  $('tweakReset').addEventListener('click', () => { for (const t of TWEAKS) setPath(cfg, t.path, getPath(defaults, t.path)); try { storage.removeItem(KEY); } catch (e) { /* ок */ } refresh(); onChange && onChange({ reload: true }); });
  $('tweakCopy').addEventListener('click', async () => {
    const text = JSON.stringify(diff(), null, 1) === '{}' ? 'Все значения по умолчанию' : JSON.stringify(diff());
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = false; }
    if (!ok) { const ta = doc.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0'; doc.body.appendChild(ta); ta.select(); try { ok = doc.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); }
    status.textContent = ok ? 'Скопировано: вставьте в чат' : 'Не удалось скопировать: ' + text;
  });
  const open = () => { refresh(); panel.hidden = false; onOpen && onOpen(); };
  const close = () => { panel.hidden = true; onClose && onClose(); };
  $('gear').addEventListener('click', () => (panel.hidden ? open() : close()));
  $('tweakClose').addEventListener('click', close);
  refresh();
  return { open, close, refresh, diff, isOpen: () => !panel.hidden };
}
