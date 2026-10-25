// Своё с устройства (2026-10-21, просьба владельца): музыка и значки игрока. Файлы лежат только в браузере игрока (IndexedDB),
// в игру и на сайт не попадают. Значки — по ключу: умение 'n:<id>' (древо и панель) или вид вещи (как в itemicons.js giKeyOf).
// Музыка — свой плейлист вместо музыки игры: по кругу вперемешку, в бою тише.
import { routeMedia } from './audio3d.js';
const DB = 'berserk-own', ST = 'files';
const icons = new Map();     // ключ → data URL (уменьшено до 128 точек)
let music = [], ver = 0, ready = null;
const listeners = new Set();
const bump = () => { ver++; for (const f of listeners) try { f(); } catch (e) { /* окно закрыто */ } };
export const onOwnChange = f => listeners.add(f);
export const ownVer = () => ver;

function db() {
  return new Promise((res, rej) => { if (typeof indexedDB === 'undefined') return rej(new Error('нет IndexedDB'));
    const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
const tx = async (mode, f) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(ST, mode), s = t.objectStore(ST), out = f(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
const all = () => tx('readonly', s => { const out = []; const c = s.openCursor(); c.onsuccess = () => { const k = c.result; if (k) { out.push([k.key, k.value]); k.continue(); } }; return out; });

// загрузить сохранённое при старте
export function loadOwn() {
  return ready || (ready = all().then(rows => { for (const [k, v] of rows) { if (k.startsWith('icon:')) icons.set(k.slice(5), v); else if (k.startsWith('music:')) music.push({ key: k, name: v.name, blob: v.blob }); } music.sort((a, b) => a.key.localeCompare(b.key)); bump(); }).catch(() => { /* без своего */ }));
}
export const ownIcon = key => icons.get(key) || null;
export const ownIconCount = () => icons.size;
export const ownMusic = () => music.map(m => m.name);

// картинка → квадрат 128 точек (data URL), чтобы не хранить большие файлы
function shrink(file) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), k = Math.min(S / im.width, S / im.height), w = im.width * k, h = im.height * k;
      g.drawImage(im, (S - w) / 2, (S - h) / 2, w, h); URL.revokeObjectURL(u); res(c.toDataURL('image/png')); };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('не картинка')); }; im.src = u; });
}
export async function setOwnIcon(key, file) { const url = await shrink(file); await tx('readwrite', s => s.put(url, 'icon:' + key)); icons.set(key, url); bump(); }
export async function clearOwnIcon(key) { await tx('readwrite', s => s.delete('icon:' + key)); icons.delete(key); bump(); }
export async function clearOwnIcons() { for (const k of [...icons.keys()]) await tx('readwrite', s => s.delete('icon:' + k)); icons.clear(); bump(); }

export async function addOwnMusic(files) {
  let n = 0; for (const f of files) { if (!/^audio\//.test(f.type) && !/\.(mp3|ogg|m4a|wav|flac|opus)$/i.test(f.name)) continue;
    const key = 'music:' + Date.now().toString(36) + '-' + (n++).toString(36); await tx('readwrite', s => s.put({ name: f.name, blob: f }, key)); music.push({ key, name: f.name, blob: f }); }
  bump(); return n;
}
export async function clearOwnMusic() { for (const m of music) await tx('readwrite', s => s.delete(m.key)); music = []; player.stop(); bump(); }

// плеер своей музыки: по кругу вперемешку; громкость — общая громкость музыки × доля боя (в бою тише)
export const player = (() => {
  let el = null, url = null, order = [], i = 0, on = false, vol = .5, gain = null;     // gain — громкость через Web Audio (routeMedia), пока его нет — el.volume
  const next = () => { if (!music.length) return stop(); if (i >= order.length) { order = music.map((_, k) => k).sort(() => Math.random() - .5); i = 0; }
    const m = music[order[i++]]; if (!m) return; if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(m.blob); el.src = url; level(); el.play().catch(() => { /* ждём жеста игрока */ }); };
  function start() { if (!music.length || typeof Audio === 'undefined') return; if (!el) { el = new Audio(); el.addEventListener('ended', next); el.addEventListener('error', next); } on = true; if (!el.src || el.ended) next(); else el.play().catch(() => {}); }
  function stop() { on = false; if (el) el.pause(); }
  function level() { if (!el) return; if (!gain) gain = routeMedia(el); if (gain) gain(vol); else el.volume = vol; }
  return { start, stop, playing: () => on && !!music.length, setVolume: v => { vol = Math.max(0, Math.min(1, v)); level(); }, pause: p => { if (!el || !on) return; if (p) el.pause(); else el.play().catch(() => {}); } };
})();
