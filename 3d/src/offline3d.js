// Установка целиком (2026-11-13): service worker (sw.js в корне сборки) хранит код и модели на устройстве. Здесь — регистрация, состояние «скачано» и скачивание всего сразу.
// В режиме разработки (dev-сервер) и без поддержки service worker ничего не делает.
const SUPPORT = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof import.meta !== 'undefined' && !!(import.meta.env && import.meta.env.PROD);
let reg = null, hadController = false;
const listeners = new Set();
export const offlineSupported = () => SUPPORT;
export const onOfflineMessage = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export function registerOffline(onUpdate) {
  if (!SUPPORT) return Promise.resolve(null);
  hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('message', e => { for (const f of listeners) f(e.data || {}); });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && onUpdate) onUpdate(); hadController = true; });     // вышла новая версия: страница ещё старая
  return navigator.serviceWorker.register(new URL('../sw.js', location.href).href, { scope: new URL('../', location.href).href }).then(r => { reg = r; return r; }).catch(() => null);
}
const target = () => (navigator.serviceWorker.controller || (reg && (reg.active || reg.waiting || reg.installing))) || null;
export function askStatus(timeout = 4000) {
  return new Promise(res => { const t = target(); if (!t) return res(null); const off = onOfflineMessage(m => { if (m.type === 'media-status') { off(); clearTimeout(to); res(m); } }), to = setTimeout(() => { off(); res(null); }, timeout); t.postMessage({ type: 'media-status' }); });
}
export function startDownload() {
  const t = target(); if (!t) return false; t.postMessage({ type: 'media-download' });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* без запроса */ }     // просим систему не чистить скачанное
  return true;
}
export const mb = n => (n / 1048576 >= 10 ? Math.round(n / 1048576) : Math.round(n / 104857.6) / 10).toString().replace('.', ',');
