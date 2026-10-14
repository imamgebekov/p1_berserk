// Крошечная шина событий: развязывает бой/инвентарь от заданий и сохранения.
// События: 'kill' (враг), 'eclipse' ({ survived }), 'gear' (экипировка/уровень изменились), 'save' (пора сохраниться).
const subs = new Map();
export function on(name, fn) { (subs.get(name) || subs.set(name, []).get(name)).push(fn); }
export function emit(name, data) { const l = subs.get(name); if (l) for (const fn of l) fn(data); }
export function offAll() { subs.clear(); }
