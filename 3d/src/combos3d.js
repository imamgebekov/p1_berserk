// Связки умений (2026-10-18, согласовано владельцем): умение a, потом b не позже cfg.combos.window с — b срабатывает
// в усиленном виде. Усиление — множители, прибавки и замены чисел умения (config3d.js → combos) и флаги особых эффектов,
// которые читают сами умения через W.cmb. Чистые функции (проверяются в Node).
// школы (2026-10-22, решение владельца): у героя активна одна школа (ветка древа), поэтому у каждой школы — своя связка внутри неё;
// порядок в списке героя — школы 0, 1, 2
export const COMBOS = {
  thorn: [
    { id: 'dread', a: 'cry', b: 'th_slam', name: 'Устрашение', text: 'Удар щитом после Боевого клича шире в 1,5 раза.' },     // Страж
    { id: 'runup', a: 'charge', b: 'bash', name: 'С разбега', text: 'Сокрушающий удар после рывка бьёт в 1,4 раза сильнее.' },     // Палач
    { id: 'rift', a: 'quake', b: 'whirl', name: 'Разлом', text: 'Вихрь по врагам в корнях сильнее в 1,6 раза.' }     // Берсерк
  ],
  jay: [
    { id: 'aimcold', a: 'hawk', b: 'frost', name: 'Прицельный холод', text: 'Ледяная стрела пробивает всех на линии.' },     // Меткость
    { id: 'snaretrap', a: 'leap', b: 'trap', name: 'Западня', text: 'Капкан после отскока держит в 1,5 раза дольше.' },     // Выживание
    { id: 'poisonhail', a: 'venom', b: 'rain', name: 'Ядовитый град', text: 'Град после ядовитой стрелы бьёт в 1,3 раза сильнее.' }     // Буря стрел
  ],
  vale: [
    { id: 'riposte', a: 'fan', b: 'execute', name: 'Ответ мастера', text: 'Смертельный удар после веера ножей добивает с 40% здоровья.' },     // Клинки
    { id: 'shadowstrike', a: 'smoke', b: 'blink', name: 'Удар из тени', text: 'Выпад всегда критический.' },     // Тень
    { id: 'crimsonfan', a: 'parry', b: 'bloodlet', name: 'Кровавый веер', text: 'Кровопускание после парирования шире в 1,4 раза.' }     // Кровь
  ],
  hunter: [     // Бесогон, охотник на демонов (Г8)
    { id: 'glaivecut', a: 'felrush', b: 'chaos', name: 'Раскол', text: 'Удар хаоса после Рывка скверны бьёт в 1,4 раза сильнее.' },     // Хаос
    { id: 'firefall', a: 'djump', b: 'sigil', name: 'Падение в огонь', text: 'Печать пламени после прыжка шире в 1,4 раза.' },     // Месть
    { id: 'demonsight', a: 'meta', b: 'eyebeam', name: 'Взор демона', text: 'Огненный взор в облике демона горит в 1,5 раза дольше.' }     // Скверна
  ],
  brand: [     // Клеймёный рыцарь (Г4, 4.17)
    { id: 'brandrage', a: 'fury', b: 'cleaver', name: 'Ярость клейма', text: 'Рубка драконов в ярости бьёт в 1,4 раза сильнее.' },     // Клеймо
    { id: 'ironram', a: 'endure', b: 'rush', name: 'Железный таран', text: 'Таран после «Стерпеть» бьёт в 1,4 раза сильнее.' },     // Сталь
    { id: 'darkpain', a: 'howl', b: 'darkcut', name: 'Боль тьмы', text: 'Удар тьмы после Рёва бьёт в 1,4 раза сильнее.' }     // Тьма
  ],
  priest: [     // Жрец (Г3, 4.16)
    { id: 'sermon', a: 'hymn', b: 'mend', name: 'Проповедь', text: 'Исцеление после Гимна лечит на 30% больше.' },     // Свет
    { id: 'judgement', a: 'sanctum', b: 'penance', name: 'Суд', text: 'Покаяние после Щита веры бьёт сильнее и оглушает дольше.' },     // Щиты
    { id: 'purge', a: 'vtouch', b: 'smite', name: 'Очищение', text: 'Кара по отмеченному тьмой бьёт в 1,4 раза сильнее.' }     // Тень
  ],
  warlock: [
    { id: 'verdict', a: 'hex', b: 'doom', name: 'Приговор', text: 'Рок по проклятому бьёт в 1,5 раза сильнее.' },     // Проклятия
    { id: 'bloodfeast', a: 'pact', b: 'drain', name: 'Кровавый пир', text: 'Похищение жизни после договора лечит в 1,5 раза больше.' },     // Кровь
    { id: 'bloodimp', a: 'terror', b: 'summon', name: 'Бес ужаса', text: 'Бес после Ужаса держится в 1,5 раза дольше и бьёт сильнее.' }     // Бесы
  ],
  irga: [
    { id: 'firerain', a: 'fireball', b: 'meteor', name: 'Огненный дождь', text: 'Метеор после огненного шара шире в 1,4 раза.' },     // Огонь
    { id: 'icearmor', a: 'shield', b: 'nova', name: 'Ледяная броня', text: 'Кольцо шире, и на 6 с +15 брони.' },     // Лёд
    { id: 'breach', a: 'chain', b: 'spear', name: 'Пробой', text: 'Копьё бездны по цели с «разрядом» сильнее в 1,5 раза.' }     // Проклятия
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
