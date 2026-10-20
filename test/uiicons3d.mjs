// Тест иконок и текста интерфейса 3D (шаг 10 аудита): у каждой иконки корректный путь; все имена иконок из разметки и кода
// есть в наборе; эмодзи в разметке, коде интерфейса и подсказках не осталось; разница рангов умений показывает только числа.
import { ICONS, icon } from '../3d/src/uiicons.js';
import { rankDiff } from '../3d/src/skillsui.js';
import { readFileSync } from 'node:fs';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const src = p => readFileSync(new URL('../3d/' + p, import.meta.url), 'utf8');

// ---------- иконки ----------
for (const [n, I] of Object.entries(ICONS)) {
  ok(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(I.d) && /^M/.test(I.d), 'путь иконки ' + n + ' не SVG');
  const nums = I.d.match(/-?\d*\.?\d+/g) || []; ok(nums.length > 4 && nums.every(v => Number.isFinite(+v)), 'числа в иконке ' + n);
  ok(/viewBox="0 0 (24 24|512 512)"/.test(icon(n)) && icon(n).includes('aria-hidden="true"'), 'иконка ' + n + ' без viewBox или aria-hidden');
}
const html = src('index.html'), main = src('src/main.js');
for (const n of new Set([...html.matchAll(/data-icon="(\w+)"/g)].map(m => m[1]).concat([...main.matchAll(/setIconText\([^,]+,\s*'(\w+)'/g)].map(m => m[1])))) ok(ICONS[n], 'нет иконки ' + n);
for (const n of ['fire', 'gem', 'key', 'warn', 'horn', 'rain', 'sun', 'moon', 'shop', 'sparkle', 'bell', 'hint', 'ash', 'sound', 'mute', 'swap', 'phone', 'timer', 'eye', 'pixels', 'sleep', 'scroll', 'question']) ok(ICONS[n], 'нет иконки ' + n);

// ---------- эмодзи не осталось ----------
const EMO = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
for (const [name, text] of [['index.html', html], ['main.js', main.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')], ['prefs3d.js', src('src/prefs3d.js')]]) {
  const m = text.match(new RegExp(EMO.source, 'gu')) || []; ok(!m.length, `эмодзи в ${name}: ${[...new Set(m)].join(' ')}`);
}

// ---------- разница рангов ----------
ok(rankDiff('Бросок до 7 м: удар ×1,4. Перезарядка 9 с.', 'Бросок до 7 м: удар ×1,6. Перезарядка 8,5 с.') === '×1,4 → ×1,6 · 9 с → 8,5 с', 'разница рангов: ' + rankDiff('Бросок до 7 м: удар ×1,4. Перезарядка 9 с.', 'Бросок до 7 м: удар ×1,6. Перезарядка 8,5 с.'));
ok(rankDiff('Урон +20% на 5 с', 'Урон +30% на 5 с') === '+20% → +30%', 'проценты в разнице рангов');
ok(rankDiff('Удар ×1,4.', 'Новое свойство: яд.') === null, 'разный текст рангов не должен сравниваться по числам');
ok(rankDiff('Удар ×1,4.', 'Удар ×1,4.') === null, 'одинаковые ранги дают разницу');

if (fails.length) { console.log('uiicons3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Иконки и текст интерфейса 3D: OK');
