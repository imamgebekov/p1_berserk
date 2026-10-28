// Готовый мир для сборки (2026-10-28): генерирует мир по настройкам (как в игре) и пишет 3d/src/data/world.bake.json —
// { key: отпечаток настроек, cfg: CFG3 }. Запускается перед vite build (npm run build); файл в git не кладём.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { CFG3, WORLD_KEY } = await import('../3d/src/config3d.js');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', '3d', 'src', 'data', 'world.bake.json'), s = JSON.stringify({ key: WORLD_KEY, cfg: CFG3 });
writeFileSync(out, s);
console.log(`готовый мир: ${(s.length / 1e6).toFixed(2)} МБ, ключ ${WORLD_KEY}`);
