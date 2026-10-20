// Облик героя по надетому (2026-10-20, просьба владельца): цвет одежды — по материалу брони, наплечники у лат и кольчуги,
// мантия у робы, капюшон у капюшона и маски, накидка — цвет и длина плаща, сапоги — цвет ног. Без брони — облик героя.
// Только вид: в мире (render.js) и в сумке (bagview3d.js). Чистая функция.
import { BY_ID } from './data/items.js';
const MATC = { rag: '#7a6a52', leather: '#7a5434', studded: '#6a5440', mail: '#8e8e88', plate: '#a8a498', black: '#34303a', ash: '#5a5250',
  set_pogost: '#4a5a48', set_eclipse: '#3a2a50', set_rust: '#7a3a22', set_hand: '#4a2030', wings: '#5a4a3a', gold: '#c8a040' };
const SLOTS = ['body', 'cloak', 'head', 'boots'];
export function dressedLook(base, inv, cape) {
  const L = { ...base }, eq = (inv && inv.eq) || {}, it = s => eq[s] && BY_ID[eq[s]], col = i => i && (i.tint || MATC[i.mat]);
  const body = it('body'), cloak = it('cloak'), head = it('head'), boots = it('boots');
  if (body) { const c = col(body); if (c) L.cloth = c; if (['plate', 'mail', 'cuirass'].includes(body.kind)) L.shoulder = true; if (body.kind === 'robe') L.robe = true; }
  if (cloak) { const c = col(cloak); if (c) L.cape = c; L.capeLen = cloak.kind === 'cape' ? .75 : cloak.kind === 'shroud' ? 1.2 : cloak.kind === 'pelt' ? .9 : 1; }
  if (head) { L.hood = ['hood', 'mask'].includes(head.kind); L.helm = !L.hood; }     // helm — шлем или шляпа у готовых моделей
  if (boots) { const c = col(boots); if (c) L.legs = c; }
  if (cape) L.cape = cape;     // цвет плаща — награда подвига
  return L;
}
export const lookKey = (hero, inv, cape) => [hero, cape || '', ...SLOTS.map(s => (inv && inv.eq && inv.eq[s]) || '')].join('|');
