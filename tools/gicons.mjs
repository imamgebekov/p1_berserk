// Сборка значков game-icons.net (CC BY 3.0, часть — CC0) в модуль данных: node tools/gicons.mjs <папка icons из github.com/game-icons/icons>
// Берёт значки из tools/gicons-map.json (ключ → автор/имя), вынимает контуры фигуры (без чёрного фона 512×512) и пишет
// 3d/src/data/gicons.js ({ ключ: путь SVG }) и 3d/ICONS-CREDITS.md (кто автор каких значков). Код из набора не запускается.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), src = process.argv[2];
if (!src || !existsSync(src)) { console.log('укажите папку icons из github.com/game-icons/icons'); process.exit(1); }
const map = JSON.parse(readFileSync(join(root, 'tools', 'gicons-map.json'), 'utf8')), out = {}, by = {}, miss = [];
for (const [k, name] of Object.entries(map)) {
  const f = join(src, name + '.svg'); if (!existsSync(f)) { miss.push(k + ' → ' + name); continue; }
  const svg = readFileSync(f, 'utf8'), d = [...svg.matchAll(/<path([^>]*)\sd="([^"]+)"/g)].filter(m => !/^M0 0h512v512H0z$/.test(m[2])).map(m => m[2]).join('');
  if (!d || /[^MmLlHhVvCcSsQqTtAaZz0-9.,\s-]/.test(d)) { miss.push(k + ' (контур)'); continue; }     // только команды пути — ничего лишнего
  out[k] = d; const a = name.split('/')[0]; (by[a] = by[a] || []).push(name.split('/')[1]);
}
if (miss.length) { console.log('нет значков:\n' + miss.join('\n')); process.exit(1); }
writeFileSync(join(root, '3d', 'src', 'data', 'gicons.js'), '// Значки game-icons.net (CC BY 3.0, авторы — 3d/ICONS-CREDITS.md). Собрано tools/gicons.mjs — не править руками.\n// Путь SVG в квадрате 512×512, белая фигура без фона.\nexport const GI = ' + JSON.stringify(out, null, 0).replace(/","/g, '",\n  "') + ';\n');
writeFileSync(join(root, '3d', 'ICONS-CREDITS.md'), '# Значки\n\nЗначки — [game-icons.net](https://game-icons.net), лицензия [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (часть — CC0). Цвет и рамки изменены.\n\n' + Object.entries(by).sort().map(([a, l]) => `- **${a}**: ${[...new Set(l)].sort().join(', ')}`).join('\n') + '\n');
console.log(`значков: ${Object.keys(out).length}, авторов: ${Object.keys(by).length}`);
