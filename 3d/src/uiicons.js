// Иконки интерфейса (шаг 10 аудита): однотонные силуэты на встроенном SVG — чёткие на любом экране, цвет берётся от текста
// (currentColor), без файлов и эмодзи. icon(name) — разметка, setIconText(el, name, text) — иконка и подпись в кнопке.
import { GI } from './data/gicons.js';     // значки game-icons.net вместо самодельных, где нашёлся подходящий

// круг радиуса r в точке (x, y) как часть пути (для дыр — с правилом evenodd)
const circ = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
// звезда или шестерня: n лучей, внешний радиус R, внутренний r
const star = (n, R, r, cx = 12, cy = 12, rot = -Math.PI / 2) => {
  let d = ''; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * q).toFixed(2) + ' ' + (cy + Math.sin(a) * q).toFixed(2); }
  return d + 'z';
};
const gear = () => { let d = ''; const n = 8; for (let i = 0; i < n * 4; i++) { const a = -Math.PI / 2 + i * Math.PI / (n * 2) - Math.PI / (n * 4), q = (i % 4 < 2) ? 10 : 7.6; d += (i ? 'L' : 'M') + (12 + Math.cos(a) * q).toFixed(2) + ' ' + (12 + Math.sin(a) * q).toFixed(2); } return d + 'z' + circ(12, 12, 3.2); };
const rays = () => { let d = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a), px = -s * .9, py = c * .9; d += `M${(12 + c * 7 + px).toFixed(2)} ${(12 + s * 7 + py).toFixed(2)}L${(12 + c * 10 + px * .6).toFixed(2)} ${(12 + s * 10 + py * .6).toFixed(2)}L${(12 + c * 10 - px * .6).toFixed(2)} ${(12 + s * 10 - py * .6).toFixed(2)}L${(12 + c * 7 - px).toFixed(2)} ${(12 + s * 7 - py).toFixed(2)}z`; } return d; };
const MOON = 'M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z';

// путь в квадрате 24×24; e — правило evenodd (дыры); s — штрих вместо заливки
export const ICONS = {
  bag: { d: 'M8 8V6.5a4 4 0 0 1 8 0V8h2.2a1.3 1.3 0 0 1 1.3 1.4l-.9 10.1A1.7 1.7 0 0 1 16.9 21H7.1a1.7 1.7 0 0 1-1.7-1.5L4.5 9.4A1.3 1.3 0 0 1 5.8 8H8zm1.8 0h4.4V6.5a2.2 2.2 0 0 0-4.4 0V8zM9 12h6v1.6H9z', e: 1 },
  skills: { d: star(4, 10, 3) + star(4, 3.6, 1.2, 19, 5) },
  gear: { d: gear(), e: 1 },
  scroll: { d: 'M7 3h10.5A2.5 2.5 0 0 1 20 5.5V7h-2.5v11.5A2.5 2.5 0 0 1 15 21H6a2.5 2.5 0 0 1-2.5-2.5V17H6V5.5A2.5 2.5 0 0 1 7 3zm2 5v1.6h6V8H9zm0 3.6v1.6h6v-1.6H9z', e: 1 },
  book: { d: 'M3.5 5C6.5 3.8 9.4 4 12 5.6 14.6 4 17.5 3.8 20.5 5v14.2c-3-1.1-5.9-.9-8.5.7-2.6-1.6-5.5-1.8-8.5-.7V5zm7.7 1.8v11.3h1.6V6.8h-1.6z', e: 1 },
  fire: { d: 'M12 2c.6 3.6 6 5.6 6 11.2a6 6 0 0 1-12 0c0-2.8 1.4-4.4 2.6-5.8.2 2 1.1 3.2 2.2 3.8C10.4 8.6 10.8 5.2 12 2zm0 11.2c-1.4 1.6-2.4 2.6-2.4 4a2.4 2.4 0 0 0 4.8 0c0-1.4-1-2.4-2.4-4z', e: 1 },
  moon: { d: MOON },
  sun: { d: circ(12, 12, 4.4) + rays() },
  sleep: { d: MOON + 'M14.5 3h5.5v1.5l-3.4 3.8H20V9.8h-5.6V8.3l3.4-3.8h-3.3z' },
  ash: { d: 'M12 2.5l6.8 9.5L12 21.5 5.2 12zM12 6.4L8.1 12l3.9 5.6z', e: 1 },
  gem: { d: 'M7 4h10l4 5-9 11L3 9zm2.6 5L12 16.5 14.4 9z', e: 1 },
  key: { d: circ(7.5, 12, 4.5) + circ(7.5, 12, 1.8) + 'M11.5 11h9.5v2.6h-2v3h-2.4v-3H11.5z', e: 1 },
  horn: { d: 'M3 9.5h3.5L16 4.5v15l-9.5-5H5.5l1 4.5H4.3L3 14.5zM18 9h3v1.6h-3zm0 4.4h3V15h-3z' },
  rain: { d: 'M7 15.5a4 4 0 0 1 .3-8A5.6 5.6 0 0 1 18 8.6a3.5 3.5 0 0 1-.3 6.9zM8 17.5h1.6L8.4 21H6.8zm4.2 0h1.6L12.6 21H11zm4.2 0H18L16.8 21h-1.6z' },
  shop: { d: 'M3 9.5L5 4h14l2 5.5c0 1.4-1.1 2.5-2.5 2.5S16 10.9 16 9.5c0 1.4-1.1 2.5-2.5 2.5h-3C9.1 12 8 10.9 8 9.5 8 10.9 6.9 12 5.5 12S3 10.9 3 9.5zM5 13.2h14V21h-4.5v-5h-5v5H5z' },
  sparkle: { d: star(4, 9, 2.4, 10, 13) + star(4, 4.4, 1.2, 18.5, 5.5) },
  bell: { d: 'M12 3a6 6 0 0 1 6 6v4.2l1.8 3.1H4.2L6 13.2V9a6 6 0 0 1 6-6zm-2.3 14.6h4.6a2.3 2.3 0 0 1-4.6 0z' },
  warn: { d: 'M12 2.8l10 17.4H2zM11 9v6h2V9zm0 7.4v2h2v-2z', e: 1 },
  hint: { d: 'M12 2.5a6.8 6.8 0 0 1 4 12.3V17H8v-2.2a6.8 6.8 0 0 1 4-12.3zM8.6 18.4h6.8v1.3a1.8 1.8 0 0 1-1.8 1.8h-3.2a1.8 1.8 0 0 1-1.8-1.8z' },
  sound: { d: 'M3.5 9h4L13 4.5v15L7.5 15h-4zM15.5 8.4a5 5 0 0 1 0 7.2l-1.2-1.2a3.3 3.3 0 0 0 0-4.8zm2.4-2.4a8.4 8.4 0 0 1 0 12l-1.2-1.2a6.7 6.7 0 0 0 0-9.6z' },
  mute: { d: 'M3.5 9h4L13 4.5v15L7.5 15h-4zM15.2 9.3l1.2-1.2 2.2 2.2 2.2-2.2 1.2 1.2-2.2 2.2 2.2 2.2-1.2 1.2-2.2-2.2-2.2 2.2-1.2-1.2 2.2-2.2z' },
  swap: { d: 'M7 3.5l4 4H8v6H6v-6H3zM17 20.5l-4-4h3v-6h2v6h3z' },
  phone: { d: 'M7.5 2.5h9A1.5 1.5 0 0 1 18 4v16a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4a1.5 1.5 0 0 1 1.5-1.5zM8 4.5v13.5h8V4.5zM2 8h2v8H2zm18 0h2v8h-2z', e: 1 },
  timer: { d: circ(12, 13.5, 8) + circ(12, 13.5, 6.3) + 'M10 2h4v2h-4zM11.2 9h1.6v5h-1.6z', e: 1 },
  eye: { d: 'M12 5.5c5.5 0 9.5 6.5 9.5 6.5s-4 6.5-9.5 6.5S2.5 12 2.5 12 6.5 5.5 12 5.5z' + circ(12, 12, 3.4) + circ(12, 12, 1.4), e: 1 },
  pixels: { d: 'M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z' },
  lv: { d: 'M12 2.5l3 5.5 6 1-4.3 4.4 1 6.1L12 16.6l-5.7 2.9 1-6.1L3 9l6-1z' },
  question: { d: circ(12, 12, 9.5) + 'M9 9.2a3 3 0 1 1 4.2 2.7c-.8.4-1.2.9-1.2 1.8v.6H10.4v-.7c0-1.6.8-2.5 1.9-3.1a1.3 1.3 0 1 0-1.7-1.3zm1.4 7.1H12v1.8h-1.6z', e: 1 }
};
const svg = name => { const g = GI['ui:' + name]; if (g) return `<svg class="ic" viewBox="0 0 512 512" aria-hidden="true" data-ic="${name}"><path d="${g}"/></svg>`;     // game-icons.net (CC BY 3.0)
  const I = ICONS[name]; if (!I) return ''; return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" data-ic="${name}"><path${I.e ? ' fill-rule="evenodd"' : ''} d="${I.d}"/></svg>`; };
export const icon = svg;

const tpl = new Map();
// иконка как узел (копия заготовки: разбор SVG один раз на имя)
export function iconNode(doc, name) {
  let t = tpl.get(name); if (!t) { t = doc.createElement('template'); t.innerHTML = svg(name); tpl.set(name, t); }
  return t.content.firstChild ? t.content.firstChild.cloneNode(true) : doc.createTextNode('');
}
// кнопка или строка: иконка и подпись (подпись — текстом, без разметки)
export function setIconText(el, name, text) {
  const doc = el.ownerDocument, key = name + '|' + text; if (el.dataset.ict === key) return; el.dataset.ict = key;
  el.replaceChildren(iconNode(doc, name), doc.createTextNode(text));
}
// все [data-icon] в разметке: иконка вставляется перед текстом
export function applyIcons(root) { for (const el of root.querySelectorAll('[data-icon]')) if (!el.querySelector(':scope > svg.ic')) el.prepend(iconNode(el.ownerDocument, el.dataset.icon)); }
