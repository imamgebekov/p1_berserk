// Тест фильтра ASCII 3D (шаг E1): наборы символов (только печатные ASCII, пробел первым), ступени по «чернилам»,
// набор по цвету (зелень — трава, синее — вода, остальное — общий), штрих контура по направлению перепада,
// формулы в JS и в шейдере совпадают, настройка «Вид» хранится и чистится, числа в конфиге разумные.
import { readFileSync } from 'node:fs';
import { CFG3 } from '../3d/src/config3d.js';
import { GLYPHS, SETS, EDGE, setOf, levelsOf, edgeOf } from '../3d/src/ascii3d.js';
import { DEFAULT_PREFS, sanitizePrefs } from '../3d/src/prefs3d.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const A = CFG3.view.ascii;

// ---------- 1. символы ----------
for (const k of SETS) {
  const g = [...GLYPHS[k]];
  ok(g[0] === ' ' && g.every(ch => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) && new Set(g).size === g.length, `набор ${k}: не ASCII, повтор или первый не пробел`);
}
ok(EDGE.join('') === '|\\-/', 'штрихи контура не те');
{ const ink = [0, .3, .1, .2], L = levelsOf(' abc', ink, 7);
  ok(L.length === 7 && L[0] === ' ' && L[6] === 'a', 'ступени: ' + L.join(''));
  const order = L.map(ch => ink[' abc'.indexOf(ch)]); ok(order.every((v, i) => !i || v >= order[i - 1]), 'ступени не по возрастанию чернил: ' + L.join('')); }
{ const L = levelsOf(GLYPHS.base, [...GLYPHS.base].map((_, i) => i), A.levels); ok(L.length === A.levels && L[0] === ' ' && L[A.levels - 1] === '@', 'общая лестница: ' + L.join('')); }

// ---------- 2. набор по цвету ----------
const S = (r, g, b) => setOf(r, g, b, A);
ok(S(.2, .5, .2) === 1 && S(.25, .3, .1) === 1, 'зелень не трава');
ok(S(.15, .3, .5) === 2 && S(.16, .28, .35) === 2, 'синее не вода');
for (const c of [[.5, .2, .1], [.3, .3, .3], [.12, .09, .07], [.02, .05, .02], [.6, .6, .1], [.7, .3, .7]]) ok(S(...c) === 0, 'не общий набор: ' + c);

// ---------- 3. штрих контура ----------
ok(edgeOf(1, 0) === '|' && edgeOf(-1, 0) === '|', 'перепад по x — не вертикальный штрих');
ok(edgeOf(0, 1) === '-' && edgeOf(0, -1) === '-', 'перепад по y — не горизонтальный штрих');
ok(edgeOf(1, 1) === '\\' && edgeOf(-1, -1) === '\\', 'перепад вверх-вправо — не «\\»');
ok(edgeOf(1, -1) === '/' && edgeOf(-1, 1) === '/', 'перепад вниз-вправо — не «/»');

// ---------- 4. JS и шейдер считают одинаково ----------
{ const src = readFileSync(new URL('../3d/src/ascii3d.js', import.meta.url), 'utf8');
  ok(src.includes('(c.g > c.r * kG && c.g > c.b && c.g > .06) ? 1. : (c.b > c.r * kW && c.b >= c.g * .9 && c.b > .06) ? 2. : 0.'), 'набор по цвету в шейдере не как setOf');
  ok(src.includes('if (g > r * A.grass && g > b && g > .06) return 1;') && src.includes('if (b > r * A.water && b >= g * .9 && b > .06) return 2;'), 'setOf изменён без шейдера');
  ok(src.includes('mod(floor(a / 3.14159265 * 4. + .5), 4.)') && src.includes('Math.floor(Math.atan2(gy, gx) / Math.PI * 4 + .5)'), 'формула штриха в шейдере и JS разошлась');
  ok(src.includes('(3. - s + lc.y) / 4.') && src.includes('c.height = ch * (SETS.length + 1)'), 'строки атласа и выборка в шейдере не совпадают'); }

// ---------- 5. настройка «Вид» и конфиг ----------
ok(DEFAULT_PREFS().ascii === false, 'ASCII включён по умолчанию');
ok(sanitizePrefs({ ascii: true }).ascii === true && sanitizePrefs({ ascii: 'да' }).ascii === false && sanitizePrefs(null).ascii === false, 'настройка ASCII не чистится');
ok(A.cell.every(v => Number.isInteger(v) && v >= 6 && v <= 24) && A.levels >= 8 && A.sub >= 1 && A.lo >= 0 && A.lo < .5 && A.edge > 0, 'числа фильтра вне разумного: ' + JSON.stringify(A));
ok(/^#[0-9a-f]{6}$/i.test(A.bg) && A.lamp.length === 2, 'фон или свет героя заданы неверно');

if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Фильтр ASCII 3D: OK');
