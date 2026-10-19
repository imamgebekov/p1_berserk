// Сеты брони: комплект из четырёх вещей (голова, тело, плащ, ноги). Бонус за 2 и за 4 вещи.
// Сеты по материалам используют существующие вещи (тот же материал во всех слотах). Именные сеты боссов — отдельные вещи.
// Бонус: stats (числа в gearStats) и fx (особый эффект, id → сила; обрабатывает sim.js).
export const SET_SLOTS = ['head', 'body', 'cloak', 'boots'];

export const FX_TEXT = {
  thorns: f => `шипы: враг получает ${Math.round(f * 100)}% нанесённого вам урона`,
  lastStand: f => `последний рубеж: при здоровье ниже 40% урон по вам −${Math.round(f * 100)}%`,
  rollBlast: d => `перекат оставляет взрыв (${d} урона рядом)`,
  ashCloak: f => `пепельный покров: ${Math.round(f * 100)}% при ударе по вам поджечь врагов вокруг`,
  killHeal: n => `убийство возвращает ${n} здоровья`,
  plague: n => `враг, ударивший вас, отравлен (${n} с)`,
  ignite: f => `крит поджигает врага (${Math.round(f * 100)}%)`,
  rage: f => `ярость: при здоровье ниже 40% урон +${Math.round(f * 100)}%`
};

export const SETS = [
  { id: 'rag', name: 'Лохмотья странника', mat: 'rag', b2: { stats: { luck: 6 } }, b4: { stats: { luck: 10, hp: 20 } } },
  { id: 'leather', name: 'Охотник', mat: 'leather', b2: { stats: { spd: 6 } }, b4: { stats: { crit: 10, spd: 4 } } },
  { id: 'studded', name: 'Страж дороги', mat: 'studded', b2: { stats: { armor: 3, hp: 10 } }, b4: { stats: { armor: 3 }, fx: { killHeal: 4 } } },
  { id: 'mail', name: 'Рыцарь', mat: 'mail', b2: { stats: { armor: 5 } }, b4: { stats: { armor: 3 }, fx: { thorns: .2 } } },
  { id: 'plate', name: 'Бастион', mat: 'plate', b2: { stats: { armor: 6, hp: 15 } }, b4: { stats: { armor: 4 }, fx: { lastStand: .15 } } },
  { id: 'black', name: 'Чернёный мрак', mat: 'black', b2: { stats: { dmg: 4, crit: 4 } }, b4: { stats: { dmg: 3 }, fx: { rollBlast: 40 } } },
  { id: 'ash', name: 'Пепельный', mat: 'ash', b2: { stats: { hp: 20, armor: 4 } }, b4: { stats: { hp: 20 }, fx: { ashCloak: .35 } } },
  // именные: вещи ниже, пул setunique (падают с боссов)
  { id: 'pogost', name: 'Саван Погоста', pieces: ['as_pogost_head', 'as_pogost_body', 'as_pogost_cloak', 'as_pogost_boots'], b2: { stats: { armor: 6, hp: 20 } }, b4: { stats: { luck: 8, leech: 3 }, fx: { plague: 6 } } },
  { id: 'eclipse', name: 'Регалии Затмения', pieces: ['as_eclipse_head', 'as_eclipse_body', 'as_eclipse_cloak', 'as_eclipse_boots'], b2: { stats: { dmg: 6, crit: 5 } }, b4: { stats: { dmg: 4, spd: 5 }, fx: { ignite: .5 } } },
  // золотые комплекты (2026-10-18): тяжёлый — из золотых вещей торговца, лёгкий — для всех героев (и для Ирги)
  { id: 'sun', name: 'Солнечный доспех', pieces: ['g_nooncrown', 'g_sunplate', 'g_dawncloak', 'g_galeboots'], b2: { stats: { armor: 8, hp: 25 } }, b4: { stats: { hp: 40, dmg: 6 }, fx: { ignite: .3 } } },
  { id: 'dawn', name: 'Облачение Зари', pieces: ['g_dawnhood', 'g_dawnrobe', 'g_dawnmantle', 'g_dawnsteps'], b2: { stats: { crit: 5, spd: 4 } }, b4: { stats: { dmg: 6, hp: 30 }, fx: { killHeal: 6 } } },
  // рейд «Врата Длани» (этап 8): падает со всех боссов рейда
  { id: 'hand', name: 'Доспех Затмения', pieces: ['rs_hand_head', 'rs_hand_body', 'rs_hand_cloak', 'rs_hand_boots'], b2: { stats: { dmg: 6, hp: 30 } }, b4: { stats: { armor: 6, hp: 40 }, fx: { killHeal: 10, lastStand: .2 } } },
  { id: 'rust', name: 'Доспех Ржавых', pieces: ['as_rust_head', 'as_rust_body', 'as_rust_cloak', 'as_rust_boots'], b2: { stats: { armor: 6, dmg: 4 } }, b4: { stats: { hp: 30 }, fx: { killHeal: 8, rage: .25 } } }
];

// именные вещи: [id набора, слот, название, статы]
export const NAMED_ARMOR = [
  ['pogost', 'head', 'Венец могильщика', { armor: 12, hp: 12, luck: 4 }], ['pogost', 'body', 'Кираса Пожирателя', { armor: 18, hp: 24 }],
  ['pogost', 'cloak', 'Саван Погоста', { armor: 7, hp: 14, leech: 2 }], ['pogost', 'boots', 'Поступь упыря', { armor: 9, spd: 3, hp: 10 }],
  ['eclipse', 'head', 'Корона Затмения', { armor: 11, crit: 5, dmg: 3 }], ['eclipse', 'body', 'Мантия Слуги', { armor: 15, dmg: 4, hp: 16 }],
  ['eclipse', 'cloak', 'Плащ тёмного круга', { armor: 6, crit: 4, spd: 3 }], ['eclipse', 'boots', 'Сапоги угля', { armor: 8, spd: 5, dmg: 2 }],
  ['rust', 'head', 'Шлем вожака', { armor: 13, hp: 14, dmg: 2 }], ['rust', 'body', 'Панцирь Ржавых', { armor: 20, hp: 22 }],
  ['rust', 'cloak', 'Шкура вожака', { armor: 8, hp: 18, leech: 2 }], ['rust', 'boots', 'Поножи лагеря', { armor: 10, hp: 10, spd: 2 }]
];
// рейд (этап 8): вещи «Доспеха Затмения» — [слот, название, статы]; создаются в items.js после золотых
export const RAID_ARMOR = [
  ['head', 'Венец Врат', { armor: 14, hp: 22, crit: 4 }], ['body', 'Латы Длани', { armor: 26, hp: 32, dmg: 3 }],
  ['cloak', 'Плащ без тени', { armor: 9, hp: 24, spd: 3 }], ['boots', 'Шаг сквозь тьму', { armor: 11, spd: 4, hp: 16 }]
];
