// Связки умений (2026-10-18, согласовано владельцем): умение a, потом b не позже cfg.combos.window с — b срабатывает
// в усиленном виде. Усиление — множители, прибавки и замены чисел умения (config3d.js → combos) и флаги особых эффектов,
// которые читают сами умения через W.cmb. Чистые функции (проверяются в Node).
export const COMBOS = {
  thorn: [
    { id: 'bladestorm', a: 'charge', b: 'whirl', name: 'Буря клинка', text: 'Вихрь шире и сильнее.' },
    { id: 'dread', a: 'cry', b: 'bash', name: 'Устрашение', text: 'Конус шире, испуганных оглушает вдвое дольше.' },
    { id: 'rift', a: 'quake', b: 'whirl', name: 'Разлом', text: 'Вихрь по врагам в корнях сильнее в 1,6 раза.' },
    { id: 'frenzy', a: 'blood', b: 'rage', name: 'Кровавое безумие', text: 'Ярость берсерка длится на 50% дольше.' }
  ],
  jay: [
    { id: 'archerdance', a: 'leap', b: 'volley', name: 'Танец лучницы', text: 'В залпе на 3 стрелы больше.' },
    { id: 'snare', a: 'trap', b: 'rain', name: 'Западня', text: 'Град падает на пойманного в корни и бьёт сильнее.' },
    { id: 'aimcold', a: 'hawk', b: 'frost', name: 'Прицельный холод', text: 'Ледяная стрела пробивает всех на линии.' },
    { id: 'icehail', a: 'frost', b: 'rain', name: 'Ледяной град', text: 'Град ещё и замедляет.' }
  ],
  vale: [
    { id: 'shadowstrike', a: 'smoke', b: 'blink', name: 'Удар из тени', text: 'Выпад всегда критический.' },
    { id: 'bloodfan', a: 'fan', b: 'bloodlet', name: 'Кровавый веер', text: 'Кровопускание по кровоточащим сильнее в 1,5 раза.' },
    { id: 'riposte', a: 'parry', b: 'execute', name: 'Ответ мастера', text: 'Смертельный удар добивает с 40% здоровья.' },
    { id: 'twindance', a: 'shadow', b: 'dance', name: 'Двойной танец', text: 'Тень-двойник танцует вместе с Вейлом.' }
  ],
  priest: [     // Жрец (Г3, 4.16)
    { id: 'blessedwave', a: 'sanctum', b: 'radiance', name: 'Святая волна', text: 'Сияние после Щита веры шире в 1,4 раза.' },
    { id: 'purge', a: 'vtouch', b: 'smite', name: 'Очищение', text: 'Кара по отмеченному тьмой бьёт в 1,4 раза сильнее.' },
    { id: 'sermon', a: 'hymn', b: 'mend', name: 'Проповедь', text: 'Исцеление после Гимна лечит на 30% больше.' },
    { id: 'judgement', a: 'penance', b: 'hallow', name: 'Суд', text: 'Освящение после Покаяния сильнее и держится дольше.' }
  ],
  warlock: [
    { id: 'verdict', a: 'hex', b: 'doom', name: 'Приговор', text: 'Рок по проклятому бьёт в 1,5 раза сильнее.' },
    { id: 'feast', a: 'terror', b: 'drain', name: 'Пир страха', text: 'Похищение жизни по испуганному лечит вдвое.' },
    { id: 'gravecall', a: 'grasp', b: 'souls', name: 'Зов могил', text: 'В рое на 3 души больше.' },
    { id: 'bloodimp', a: 'pact', b: 'summon', name: 'Кровавый бес', text: 'Бес держится в 1,5 раза дольше и бьёт сильнее.' }
  ],
  irga: [
    { id: 'detonate', a: 'cloud', b: 'fireball', name: 'Взрыв облака', text: 'Огненный шар в ядовитом облаке взрывает его: огонь по всем в облаке.' },
    { id: 'frozenstorm', a: 'blizzard', b: 'chain', name: 'Ледяная гроза', text: 'Молния прыгает на 2 раза больше и замедляет.' },
    { id: 'icearmor', a: 'shield', b: 'nova', name: 'Ледяная броня', text: 'Кольцо шире, и на 6 с +15 брони.' },
    { id: 'breach', a: 'chain', b: 'spear', name: 'Пробой', text: 'Копьё бездны по цели с «разрядом» сильнее в 1,5 раза.' }
  ]
};
export const combosOf = hero => COMBOS[hero] || [];

// связка, которую сейчас завершит умение id (или null): прошлое умение — первое в паре и окно ещё открыто
export function comboFor(W, id) {
  const L = W.lastAb; if (!L || W.t - L.t > W.cfg.combos.window) return null;
  return combosOf(W.hero).find(c => c.a === L.id && c.b === id) || null;
}
// умения, которые сейчас завершат связку (для подсветки кнопок): [{ id, combo, left }]
export function comboReady(W) {
  const L = W.lastAb; if (!L) return [];
  const left = W.cfg.combos.window - (W.t - L.t); if (left <= 0) return [];
  return combosOf(W.hero).filter(c => c.a === L.id).map(c => ({ id: c.b, combo: c, left }));
}
// числа умения A с усилением связки: mul — множители, add — прибавки, set — замена (у списков по рангам — каждого числа)
export function boosted(A, M) {
  if (!M) return A;
  const o = { ...A }, each = (v, f) => (Array.isArray(v) ? v.map(f) : f(v));
  for (const [k, x] of Object.entries(M.mul || {})) if (k in o) o[k] = each(o[k], v => v * x);
  for (const [k, x] of Object.entries(M.add || {})) if (k in o) o[k] = each(o[k], v => v + x);
  for (const [k, x] of Object.entries(M.set || {})) if (k in o) o[k] = each(o[k], () => x);
  return o;
}
// запомнить умение (для следующей связки)
export const noteAbility = (W, id) => { W.lastAb = { id, t: W.t }; };
