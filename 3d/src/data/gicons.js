// Значки game-icons.net (CC BY 3.0, авторы — 3d/ICONS-CREDITS.md): путь SVG в квадрате 512×512, белая фигура без фона.
// Данные — gicons.json (собирает tools/gicons.mjs, руками не править).
import GI0 from './gicons.json' with { type: 'json' };
import { ICON_ALIAS, ICON_SAME } from './actives3d.js';
export const GI = GI0;
for (const [id, key] of Object.entries(ICON_SAME)) if (!GI['n:' + id] && GI[key]) GI['n:' + id] = GI[key];     // Жрец (4.16): значки из уже собранных
for (const [id, to] of Object.entries(ICON_ALIAS)) if (!GI['n:' + id] && GI['n:' + to]) GI['n:' + id] = GI['n:' + to];     // умения 61–70 (4.06): запасной значок — от похожего умения
