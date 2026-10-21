// Рисованные значки умений в браузере (2026-10-21): адрес картинки по ключу древа 'n:<id>' (data/spellart3d.js — какая картинка у какого умения).
// Только для браузера (import.meta.glob собирает Vite); в Node-тестах не подключается.
import { ART } from './data/spellart3d.js';
let URLS = {}; try { URLS = import.meta.glob('./art/spell/*.webp', { query: '?url', import: 'default', eager: true }); } catch (e) { /* Node-тесты: без картинок */ }
export const artURL = key => { const f = ART[key]; return f ? URLS[`./art/spell/${f}.webp`] || null : null; };
