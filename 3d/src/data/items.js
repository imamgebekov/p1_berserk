// Каталог вещей 3D-прототипа. Названия и тексты авторские; картинок нет, всё рисуется кодом.
// Каталог собирается из типов × материалов (оружие, броня), эффектов (кольца, амулеты) и рукописных таблиц (расходники,
// материалы, диковины, ключи, записки). Тест test/items3d.mjs следит за размером (300–500) и качеством данных.
//
// Статы: dmg — урон, armor — броня, hp — запас здоровья, spd — скорость бега в %, reach — дальность удара,
//        crit — шанс крита в %, leech — % нанесённого урона возвращается здоровьем, luck — лучшая добыча,
//        swing — множитель времени удара (меньше — быстрее).

export const RARITY = [
  { id: 'common', name: 'Обычный', color: '#b8ad9a' },
  { id: 'fine', name: 'Добротный', color: '#7fb069' },
  { id: 'rare', name: 'Редкий', color: '#5d9cec' },
  { id: 'epic', name: 'Великий', color: '#b388eb' },
  { id: 'brand', name: 'Клеймёный', color: '#e8643a' },
  { id: 'gold', name: 'Золотой', color: '#f5c542' }                // G3b: только у торговца, со своей механикой
];

export const SLOTS = ['weapon', 'offhand', 'head', 'body', 'cloak', 'boots', 'ring', 'amulet'];
export const SLOT_NAME = { weapon: 'Оружие', offhand: 'Вторая рука', head: 'Голова', body: 'Тело', cloak: 'Плащ', boots: 'Ноги', ring: 'Кольцо', amulet: 'Амулет' };
export const STAT_NAME = { dmg: 'урон', armor: 'броня', block: 'блок %', hp: 'здоровье', spd: 'скорость %', reach: 'дальность', crit: 'крит %', leech: 'вампиризм %', luck: 'удача', swing: 'скорость удара', arc: 'ширина удара', rollcd: 'перекат', regen: 'восстановление', stealth: 'тишина', trade: 'торговля %' };

import { NAMED_ARMOR } from './sets3d.js';
import { GOLD, GOLD_K, goldText } from './gold3d.js';
import { TOMES } from './tomes3d.js';
import { TRAITS, PERKS, MATERIAL_PERKS, ELEMENTS, ENCHANTED_KINDS, UNIQUES, weaponText } from './weapons3d.js';

const ITEMS = [];
export const HEAVY_KINDS = ['helm', 'sallet', 'cuirass', 'mail', 'plate', 'greaves'];     // тяжёлая броня (лёгкую носят все, тяжёлую — не Ирга: data/heroes3d.js → armorBan)
const add = it => { it.stack = it.stack || 1; it.value = Math.max(1, Math.round(it.value)); ITEMS.push(it); return it; };
const idOf = (...a) => a.join('_');
// прилагательное по роду: m, f, n, p (мн.)
const GI = { m: 0, f: 1, n: 2, p: 3 };
const cap = s => s[0].toUpperCase() + s.slice(1);

// ---------- оружие: тип × материал ----------
// [id, имя, род, база урона, дальность, крит %, множитель времени удара, вампиризм]
const WTYPES = [
  ['dagger', 'кинжал', 'm', 3, -.7, 6, .75],
  ['knife', 'тесак', 'm', 5, -.3, 2, .85],
  ['sickle', 'серп', 'm', 4, -.2, 5, .8],
  ['rapier', 'рапира', 'f', 4, .3, 7, .78],
  ['sword', 'меч', 'm', 6, 0, 3, 1],
  ['axe', 'топор', 'm', 7, -.1, 4, 1.05],
  ['pick', 'клевец', 'm', 6, -.2, 8, 1],
  ['mace', 'булава', 'f', 7, -.2, 1, 1.05],
  ['club', 'дубина', 'f', 5, -.1, 0, .95],
  ['spear', 'копьё', 'n', 6, .8, 2, 1],
  ['flail', 'цеп', 'm', 7, .1, 3, 1.1],
  ['scythe', 'коса', 'f', 8, .6, 4, 1.15],
  ['halberd', 'алебарда', 'f', 9, .9, 2, 1.2],
  ['war_axe', 'секира', 'f', 9, .1, 3, 1.15],
  ['hammer', 'молот', 'm', 9, -.1, 1, 1.25],
  ['greatsword', 'двуручник', 'm', 10, .6, 4, 1.25],
  ['chain_ball', 'кистень', 'm', 6, .2, 5, .95]
];
// стрелковое оружие (Сойка): [тип, имя, род, урон, —, крит, скорость удара]; дальность и полёт стрелы — в weapons3d.js (TRAITS)
const RTYPES = [
  ['bow', 'короткий лук', 'm', 6, 0, 4, .9],
  ['longbow', 'длинный лук', 'm', 9, 0, 6, 1.15],
  ['crossbow', 'арбалет', 'm', 12, 0, 2, 1.5]
];
// магическое оружие (Ирга): [тип, имя, род, урон, —, крит, скорость удара]
const MTYPES = [
  ['staff', 'посох', 'm', 8, 0, 3, 1.2],
  ['wand', 'жезл', 'm', 5, 0, 7, .85]
];
export const KIND_NAME = { ...Object.fromEntries([...WTYPES, ...RTYPES, ...MTYPES].map(t => [t[0], t[1]])), shield: 'щит' };     // «sword» → «меч»
// материал: [id, [м, ж, ср], множитель, редкость, цена]
const WMATS = [
  ['rust', ['Ржавый', 'Ржавая', 'Ржавое'], .6, 0, 4],
  ['iron', ['Железный', 'Железная', 'Железное'], 1, 0, 14],
  ['tempered', ['Закалённый', 'Закалённая', 'Закалённое'], 1.3, 1, 32],
  ['bone', ['Костяной', 'Костяная', 'Костяное'], 1.4, 1, 28],
  ['steel', ['Стальной', 'Стальная', 'Стальное'], 1.65, 2, 70],
  ['black', ['Чёрный', 'Чёрная', 'Чёрное'], 2.05, 3, 160],
  ['blood', ['Кровавый', 'Кровавая', 'Кровавое'], 2.5, 4, 380]
];
for (const [t, nm, g, base, reach, crit, swing] of WTYPES) for (const [m, adj, mult, rar, val] of WMATS) {
  const stats = { dmg: Math.round(base * mult) };
  if (reach) stats.reach = reach;
  if (crit) stats.crit = Math.round(crit * (1 + (rar > 1 ? .4 : 0)));
  if (swing !== 1) stats.swing = swing;
  if (m === 'blood') stats.leech = 4;
  if (m === 'bone') stats.spd = 2;
  const perks = MATERIAL_PERKS[m] || [];
  add({ id: idOf('w', t, m), name: `${adj[GI[g]]} ${nm}`, cat: 'weapon', slot: 'weapon', pool: 'weapon', rar, stats, value: val * (base / 5 + .6), kind: t, mat: m, perks, text: weaponText(t, perks) });
}
for (const [t, nm, g, base, , crit, swing] of RTYPES) for (const [m, adj, mult, rar, val] of WMATS) {
  const stats = { dmg: Math.round(base * mult) };
  if (crit) stats.crit = Math.round(crit * (1 + (rar > 1 ? .4 : 0)));
  if (swing !== 1) stats.swing = swing;
  if (m === 'blood') stats.leech = 4;
  if (m === 'bone') stats.spd = 2;
  const perks = MATERIAL_PERKS[m] || [];
  add({ id: idOf('w', t, m), name: `${adj[GI[g]]} ${nm}`, cat: 'weapon', slot: 'weapon', pool: 'ranged', rar, stats, value: val * (base / 5 + .6), kind: t, mat: m, perks, text: weaponText(t, perks) });
}
// посохи и жезлы — свой пул: выпадают отдельным броском (stones3d.js → magicDropOf), в таблицы добычи не входят
for (const [t, nm, g, base, , crit, swing] of MTYPES) for (const [m, adj, mult, rar, val] of WMATS) {
  const stats = { dmg: Math.round(base * mult) };
  if (crit) stats.crit = Math.round(crit * (1 + (rar > 1 ? .4 : 0)));
  if (swing !== 1) stats.swing = swing;
  if (m === 'blood') stats.leech = 4;
  if (m === 'bone') stats.spd = 2;
  const perks = MATERIAL_PERKS[m] || [];
  add({ id: idOf('w', t, m), name: `${adj[GI[g]]} ${nm}`, cat: 'weapon', slot: 'weapon', pool: 'magic', rar, stats, value: val * (base / 5 + .6), kind: t, mat: m, perks, text: weaponText(t, perks) });
}
// щиты (вторая рука Торна): [форма, имя, броня, блок %, скорость %]; блок — доля урона спереди, которую щит снимает
const SHIELDS = [['buckler', 'баклер', 3, 30, 0], ['tower', 'ростовой щит', 7, 50, -6]];
for (const [form, nm, arm, blk, spd] of SHIELDS) for (const m of ['iron', 'tempered', 'steel', 'black']) {
  const [, adj, mult, rar, val] = WMATS.find(x => x[0] === m), stats = { armor: Math.round(arm * mult), block: Math.min(70, Math.round(blk * (.85 + .15 * mult))) };
  if (spd) stats.spd = spd;
  add({ id: idOf('s', form, m), name: `${adj[0]} ${nm}`, cat: 'armor', slot: 'offhand', pool: 'shield', rar, stats, value: val * (arm / 3 + .6), kind: 'shield', form, mat: m, text: `Блок спереди: −${stats.block}% урона и меньше отброса, пока не бьёте и не катитесь.` });
}
// зачарованные: стальные клинки со стихией (меч, топор, копьё)
for (const t of ENCHANTED_KINDS) {
  const [, nm, g, base, reach, crit, swing] = WTYPES.find(x => x[0] === t), [, , mult, rar0, val] = WMATS.find(x => x[0] === 'steel');
  for (const [el, adj, perk] of ELEMENTS) {
    const stats = { dmg: Math.round(base * mult * 1.1) + 1 }; if (reach) stats.reach = reach; if (crit) stats.crit = Math.round(crit * 1.4) + 2; if (swing !== 1) stats.swing = swing;
    add({ id: idOf('w', t, 'steel', el), name: `${adj[GI[g]]} ${nm}`, cat: 'weapon', slot: 'weapon', pool: 'weapon', rar: 3, stats, value: val * (base / 5 + .6) * 2.4, kind: t, mat: 'steel', perks: [perk], text: weaponText(t, [perk]) });
  }
}
// уникальные клинки: падают с боссов, из запертых сундуков и алтарей
for (const [id, name, kind, stats, perks, value, story] of UNIQUES) {
  const st = { ...stats }; const t = TRAITS[kind];
  add({ id: 'wu_' + id, name, cat: 'weapon', slot: 'weapon', pool: 'unique', rar: 4, stats: st, value, kind, mat: 'unique', perks, text: weaponText(kind, perks) + ' ' + story });
}

// ---------- броня: слот × тип × материал ----------
// [id, имя, род, база брони, добавка]
const ATYPES = {
  head: [['helm', 'шлем', 'm', 3, {}], ['hood', 'капюшон', 'm', 1.5, { crit: 3 }], ['cap', 'шапка', 'f', 1.2, { hp: 4 }], ['mask', 'маска', 'f', 2, { crit: 2, luck: 2 }], ['sallet', 'шишак', 'm', 3.4, { spd: -1 }], ['crown', 'венец', 'm', 2.2, { luck: 4 }]],
  body: [['cuirass', 'кираса', 'f', 7, { spd: -3 }], ['mail', 'кольчуга', 'f', 6, { spd: -1 }], ['jerkin', 'куртка', 'f', 4, { spd: 1 }], ['robe', 'роба', 'f', 2.5, { hp: 10 }], ['gambeson', 'гамбезон', 'm', 5, {}], ['plate', 'панцирь', 'm', 8, { spd: -4 }]],
  cloak: [['cloak', 'плащ', 'm', 1.5, { spd: 2 }], ['cape', 'накидка', 'f', 1, { spd: 3 }], ['pelt', 'шкура', 'f', 2.5, { hp: 6 }], ['shroud', 'саван', 'm', 1.2, { luck: 3, leech: 1 }]],
  boots: [['boots', 'сапоги', 'p', 2, { spd: 3 }], ['greaves', 'поножи', 'p', 3, { spd: -1 }], ['shoes', 'башмаки', 'p', 1.5, { spd: 4 }], ['wraps', 'онучи', 'p', 1, { spd: 2, hp: 3 }]]
};
const AMATS = [
  ['rag', ['Тряпичный', 'Тряпичная', 'Тряпичное', 'Тряпичные'], .45, 0, 3],
  ['leather', ['Кожаный', 'Кожаная', 'Кожаное', 'Кожаные'], .85, 0, 12],
  ['studded', ['Клёпаный', 'Клёпаная', 'Клёпаное', 'Клёпаные'], 1.2, 1, 28],
  ['mail', ['Кольчужный', 'Кольчужная', 'Кольчужное', 'Кольчужные'], 1.55, 2, 60],
  ['plate', ['Пластинчатый', 'Пластинчатая', 'Пластинчатое', 'Пластинчатые'], 1.95, 3, 130],
  ['black', ['Чернёный', 'Чернёная', 'Чернёное', 'Чернёные'], 2.35, 3, 190],
  ['ash', ['Пепельный', 'Пепельная', 'Пепельное', 'Пепельные'], 2.9, 4, 420]
];
for (const slot of Object.keys(ATYPES)) for (const [t, nm, g, base, extra] of ATYPES[slot]) for (const [m, adj, mult, rar, val] of AMATS) {
  const stats = { armor: Math.max(1, Math.round(base * mult)) };
  for (const k of Object.keys(extra)) { const v = extra[k]; stats[k] = k === 'hp' ? Math.round(v * mult) : v; }
  if (m === 'rag' && stats.spd < 0) stats.spd = 0;
  if (m === 'ash') stats.hp = (stats.hp || 0) + 12;
  if (!Object.values(stats).some(v => v)) continue;
  add({ id: idOf('a', slot, t, m), name: `${adj[GI[g]]} ${nm}`, cat: 'armor', slot, pool: slot, rar, stats, value: val * (base / 3 + .5), kind: t, mat: m });
}

// именные вещи сетов боссов (пул setunique: выпадают с боссов)
for (const [set, slot, name, stats] of NAMED_ARMOR) add({ id: `as_${set}_${slot}`, name, cat: 'armor', slot, pool: 'setunique', rar: 4, stats: { ...stats }, value: 480 + (stats.armor || 0) * 14, kind: 'set', mat: 'set_' + set });

// ---------- кольца и амулеты: тип × эффект ----------
// эффект: [id, родительный, статы, редкость, цена]
const EFFECTS = [
  ['might', 'силы', { dmg: 3 }, 1, 40], ['blood', 'крови', { hp: 14 }, 1, 40], ['haste', 'быстроты', { spd: 5 }, 1, 45],
  ['aim', 'меткости', { crit: 6 }, 2, 70], ['ward', 'стойкости', { armor: 3 }, 1, 50], ['thirst', 'жажды', { leech: 3 }, 3, 140],
  ['fortune', 'удачи', { luck: 6 }, 2, 80], ['void', 'пустоты', { dmg: 5, hp: -8 }, 3, 120]
];
const RINGS = [['ring', 'Перстень', 0], ['band', 'Кольцо', 0], ['signet', 'Печатка', 1]];
const AMUL = [['amulet', 'Амулет', 0], ['charm', 'Оберег', 1], ['talisman', 'Талисман', 1], ['pendant', 'Подвеска', 0]];
for (const [t, nm, up] of RINGS) for (const [e, gen, st, rar, val] of EFFECTS) {
  const stats = {}; for (const k of Object.keys(st)) stats[k] = Math.round(st[k] * (1 + up * .35));
  add({ id: idOf('r', t, e), name: `${nm} ${gen}`, cat: 'jewel', slot: 'ring', pool: 'ring', rar: Math.min(4, rar + up), stats, value: val * (1 + up * .5), kind: t });
}
for (const [t, nm, up] of AMUL) for (const [e, gen, st, rar, val] of EFFECTS) {
  const stats = {}; for (const k of Object.keys(st)) stats[k] = Math.round(st[k] * (1.4 + up * .4));
  add({ id: idOf('m', t, e), name: `${nm} ${gen}`, cat: 'jewel', slot: 'amulet', pool: 'amulet', rar: Math.min(4, rar + 1 + up), stats, value: val * (1.6 + up * .6), kind: t });
}

// ---------- расходники ----------
// [id, имя, лечение, баф {stat, amt, t}, редкость, цена, текст, пул]
const FOOD = [
  ['crust', 'Хлебная корка', 4, 0, 2], ['rye', 'Ржаной хлеб', 10, 0, 5], ['rusk', 'Сухарь', 7, 0, 3], ['jerky', 'Вяленое мясо', 16, 0, 9],
  ['smoked_fish', 'Копчёная рыба', 14, 0, 8], ['cheese', 'Кусок сыра', 12, 0, 7], ['turnip', 'Печёная репа', 8, 0, 4], ['crab_apple', 'Яблоко-дичка', 6, 0, 3],
  ['mush_soup', 'Грибная похлёбка', 22, 1, 14], ['boar_leg', 'Кабанья ножка', 28, 1, 20], ['honeycomb', 'Мёд в сотах', 18, 1, 12], ['onion_stew', 'Луковая похлёбка', 16, 0, 9],
  ['rabbit', 'Печёная крольчатина', 19, 1, 14], ['berries', 'Горсть лесных ягод', 5, 0, 2], ['nuts', 'Горсть орехов', 6, 0, 3], ['sausage', 'Колбаса с чесноком', 15, 0, 8],
  ['pie', 'Пирог с потрохами', 24, 1, 15], ['dried_apples', 'Сушёные яблоки', 9, 0, 5]
];
for (const [id, name, heal, rar, val] of FOOD) add({ id: 'f_' + id, name, cat: 'consumable', pool: 'food', rar, stack: 10, value: val, use: { heal }, text: `Съесть: +${heal} здоровья.` });
const POTIONS = [
  ['heal1', 'Слабое зелье лечения', { heal: 35 }, 0, 24], ['heal2', 'Зелье лечения', { heal: 60 }, 1, 50], ['heal3', 'Крепкое зелье лечения', { heal: 100 }, 2, 110], ['elixir', 'Эликсир жизни', { heal: 999 }, 3, 260],
  ['haste', 'Настой быстроты', { buff: { stat: 'spd', amt: 25, t: 40 } }, 1, 45], ['rage', 'Настой ярости', { buff: { stat: 'dmg', amt: 12, t: 40 } }, 2, 85],
  ['skin', 'Каменная кожа', { buff: { stat: 'armor', amt: 14, t: 50 } }, 2, 85], ['scent', 'Настой чутья', { buff: { stat: 'luck', amt: 20, t: 120 } }, 2, 70],
  ['thirst', 'Тёмный отвар', { buff: { stat: 'leech', amt: 8, t: 40 } }, 3, 130], ['bitter', 'Горькая настойка', { heal: 25, buff: { stat: 'crit', amt: 10, t: 30 } }, 1, 40],
  ['smoke', 'Дымный порошок', { buff: { stat: 'spd', amt: 12, t: 20 } }, 0, 20], ['ember', 'Огненная капля', { buff: { stat: 'dmg', amt: 20, t: 15 } }, 3, 120]
];
for (const [id, name, use, rar, val] of POTIONS) {
  const txt = [use.heal ? (use.heal >= 900 ? 'Полностью лечит.' : `Лечит на ${use.heal}.`) : '', use.buff ? `${cap(STAT_NAME[use.buff.stat])} +${use.buff.amt} на ${use.buff.t} с.` : ''].filter(Boolean).join(' ');
  add({ id: 'p_' + id, name, cat: 'consumable', pool: 'potion', rar, stack: 5, value: val, use, text: txt });
}
// товар сказочного торговца (пул 'fairy' — в сундуках и с врагов не выпадает)
const FAIRY = [
  ['p_fairy_elixir', 'Эликсир феи', { heal: 999, buff: { stat: 'regen', amt: 3, t: 60 } }, 3, 220, 'Полностью лечит, потом минуту затягивает раны (+3 здоровья в секунду).'],
  ['p_fairy_dust', 'Звёздная пыль', { buff: { stat: 'luck', amt: 40, t: 300 } }, 3, 260, 'Удача +40 на 5 минут: добыча заметно лучше.'],
  ['p_fairy_might', 'Сказочная сила', { buff: { stat: 'dmg', amt: 30, t: 60 } }, 4, 320, 'Урон +30 на минуту.'],
  ['u_recall', 'Свиток возврата', { recall: true }, 2, 150, 'Прочитать: мгновенно перенестись в лагерь (и из подземелья тоже).']
];
for (const [id, name, use, rar, val, text] of FAIRY) add({ id, name, cat: 'consumable', pool: 'fairy', rar, stack: 5, value: val, use, text, ...(use.recall ? { icon: 'book' } : {}) });
const MEDIC = [
  ['rag_bandage', 'Тряпичный бинт', 12, 0, 6], ['linen_bandage', 'Льняная перевязка', 22, 1, 14], ['salve', 'Мазь из пепла', 40, 2, 38], ['poultice', 'Припарка', 18, 0, 9], ['stitch', 'Набор для шитья ран', 55, 2, 60]
];
for (const [id, name, heal, rar, val] of MEDIC) add({ id: 'h_' + id, name, cat: 'consumable', pool: 'medic', rar, stack: 10, value: val, use: { heal }, text: `Перевязать: +${heal} здоровья.` });
const CLEANSE = [['antidote', 'Противоядие', 'Снимает яд, кровотечение и горение.', 1, 30], ['clean_water', 'Фляга чистой воды', 'Тушит горение и промывает раны: снимает горение и кровотечение.', 0, 12]];
for (const [id, name, text, rar, val] of CLEANSE) add({ id: 'p_' + id, name, cat: 'consumable', pool: 'medic', rar, stack: 5, value: val, use: { cleanse: id === 'antidote' ? ['poison', 'bleed', 'burn'] : ['burn', 'bleed'] }, text });
const POUCH = [['small', 'Мешочек пепла', [6, 12], 0, 8], ['big', 'Туго набитый мешочек пепла', [20, 40], 2, 30]];
for (const [id, name, ash, rar, val] of POUCH) add({ id: 'u_pouch_' + id, name, cat: 'consumable', pool: 'coin', rar, stack: 10, value: val, use: { ash }, text: `Высыпать: +${ash[0]}–${ash[1]} пепла.` });

// ---------- материалы ----------
const MATERIALS = [
  ['ore', 'Кусок руды', 0, 4], ['ingot', 'Железный слиток', 1, 14], ['steel_ingot', 'Стальной слиток', 2, 36], ['leather', 'Сырая кожа', 0, 5], ['sinew', 'Жила', 0, 3],
  ['bone', 'Крепкая кость', 0, 3], ['imp_fang', 'Клык беса', 1, 12], ['horn', 'Рог рогача', 2, 28], ['rotten_cloth', 'Гнилая ткань', 0, 2], ['ash_salt', 'Пепельная соль', 1, 9],
  ['sulfur', 'Комок серы', 1, 10], ['tar', 'Смола', 0, 4], ['coal', 'Уголь', 0, 3], ['amber', 'Кусок янтаря', 2, 30], ['nails', 'Ржавые гвозди', 0, 2],
  ['mail_scrap', 'Обрывок кольчуги', 0, 6], ['web', 'Клок паутины', 0, 3], ['wolf_claw', 'Коготь мёртвого волка', 1, 14], ['soot', 'Сажа', 0, 2], ['dark_glass', 'Осколок тёмного стекла', 2, 22],
  ['bone_dust', 'Костяная пыль', 1, 8], ['silver_thread', 'Серебряная нить', 2, 26], ['copper_wire', 'Медная проволока', 0, 5], ['eclipse_shard', 'Осколок затмения', 4, 220], ['grave_moss', 'Могильный мох', 1, 9],
  ['raven_feather', 'Вороново перо', 0, 3], ['tallow', 'Сало', 0, 3], ['flint', 'Кремень', 0, 3], ['black_resin', 'Чёрная смола', 3, 70], ['brand_ember', 'Клеймёный уголёк', 4, 190]
];
for (const [id, name, rar, val] of MATERIALS) add({ id: 'm_' + id, name, cat: 'material', pool: 'material', rar, stack: 20, value: val, text: 'Материал: пригодится для ковки и торговли.' });

// материалы крафта: трофеи боссов (только с боссов), сплав (только крафтом), монстровые материалы (с врагов)
add({ id: 'm_devourer_heart', name: 'Сердце Пожирателя', cat: 'material', pool: 'trophy', rar: 4, stack: 20, value: 240, text: 'Всё ещё тёплое. Трофей Пожирателя Погоста: нужен для именных вещей.' });
add({ id: 'm_eclipse_cloak', name: 'Лоскут Затмения', cat: 'material', pool: 'trophy', rar: 4, stack: 20, value: 240, text: 'Ткань тьмы, что не пропускает свет. Трофей Слуги Затмения.' });
add({ id: 'm_chief_fang', name: 'Клык Вожака', cat: 'material', pool: 'trophy', rar: 4, stack: 20, value: 240, text: 'Желтоват и тяжёл. Трофей Вожака Ржавых.' });
add({ id: 'm_castellan_seal', name: 'Печать Кастеляна', cat: 'material', pool: 'trophy', rar: 4, stack: 20, value: 320, text: 'Тяжёлый перстень с гербом сгоревшей крепости. Трофей Пепельной Твердыни.' });
add({ id: 'm_ashking_crown', name: 'Венец Пепельного Короля', cat: 'material', pool: 'trophy', rar: 4, stack: 20, value: 420, text: 'Корона из спёкшегося пепла, ещё тёплая. Трофей павшего города.' });
add({ id: 'm_tyrant_skull', name: 'Череп Тирана', cat: 'material', pool: 'trophy', rar: 4, stack: 20, value: 400, text: 'Череп в трещинах, в глазницах тлеет. Трофей павшего города.' });
add({ id: 'a_cloak_wings', name: 'Плащ Пепельных Крыльев', cat: 'armor', slot: 'cloak', kind: 'cloak', mat: 'wings', tint: '#6a625c', pool: 'story', rar: 3, stats: { armor: 9, hp: 22, spd: 3 }, value: 420, text: 'Серый плащ с выжженным крылом. Награда отряда тем, кто держал брод.' });     // награда Акта I
add({ id: 'm_queen_veil', name: 'Вуаль Королевы', cat: 'material', pool: 'trophy', rar: 4, stack: 20, value: 360, text: 'Ткань из пыли, что не оседает. Трофей Чертога Пустоши.' });
add({ id: 'm_apostle_heart', name: 'Сердце Отступника', cat: 'material', pool: 'trophy', rar: 4, stack: 20, value: 400, text: 'Тёплое, будто ещё бьётся. Кузнец Гедеон знает, что из него сделать.' });     // Акт IV (этап 7)
add({ id: 'm_ash_alloy', name: 'Пепельный сплав', cat: 'material', pool: 'craftmat', rar: 3, stack: 20, value: 150, text: 'Сталь, пепел и огонь. Делается в кузне, рецепт в книге.' });
add({ id: 'm_tempered_sinew', name: 'Жила упыря', cat: 'material', pool: 'monstermat', rar: 2, stack: 20, value: 26, text: 'Крепкая закалённая жила: нужна для закалки оружия.' });
add({ id: 'm_beast_hide', name: 'Звериная шкура', cat: 'material', pool: 'monstermat', rar: 1, stack: 20, value: 12, text: 'Шкура гончей. Нужна для кожи и чёрной брони.' });

// ---------- камни силы (2026-10-18): 7 стихий × 3 ранга; вставляются в оружие у кузнеца ----------
const GEM_GEN = { fire: 'огня', ice: 'льда', water: 'воды', storm: 'молнии', venom: 'яда', blood: 'крови', earth: 'земли' };
const GEM_TINT = { fire: '#e2683a', ice: '#8fd0ec', water: '#3f8fd0', storm: '#e9d24a', venom: '#7cc35a', blood: '#c43a4a', earth: '#b08a5c' };
for (const el of Object.keys(GEM_GEN)) for (const rank of [1, 2, 3]) add({ id: `gem_${el}_${rank}`, name: `${['Осколок', 'Камень', 'Сердце'][rank - 1]} ${GEM_GEN[el]}`, cat: 'gem', pool: 'gem', rar: rank + 1, stack: 20, value: [18, 60, 200][rank - 1], gem: el, rank, tint: GEM_TINT[el],
  text: `Камень силы. У кузнеца вставляется в оружие с гнездом и даёт удару стихию; две стихии сплавляются. ${rank < 3 ? 'Три одинаковых кузнец сплавит в ранг выше.' : 'Высший ранг.'}` });

// ---------- книги знаний ----------
for (const t of TOMES) add({ id: 'tome_' + t.id, name: t.name, cat: 'tome', pool: /^(set|blades)_/.test(t.id) ? 'bosstome' : 'tome', rar: t.rar, stack: 1, value: t.value, tome: t.id, text: t.text });

// ---------- диковины и деньги ----------
const COINS = [['grosh', 'Медный грош', 0, 2], ['round', 'Серебряный кругляш', 1, 9], ['ducat', 'Золотой червонец', 2, 35], ['holey', 'Старая монета с дыркой', 0, 3], ['black_coin', 'Чёрная монета Затмения', 3, 90]];
for (const [id, name, rar, val] of COINS) add({ id: 'c_' + id, name, cat: 'curio', pool: 'coin', rar, stack: 50, value: val, text: 'Деньги. Можно продать или разменять на пепел.' });
const CURIOS = [
  ['brooch', 'Бронзовая брошь', 0, 8], ['earring', 'Серебряная серьга', 1, 18], ['comb', 'Костяной гребень', 0, 6], ['beads', 'Нить стеклянных бус', 0, 7], ['goblet', 'Позолоченный кубок', 2, 45],
  ['mug', 'Оловянная кружка', 0, 4], ['doll', 'Глиняная кукла', 0, 5], ['top', 'Деревянный волчок', 0, 3], ['cards', 'Потёртая колода карт', 0, 8], ['dice', 'Игральные кости', 0, 5],
  ['shoe', 'Детский башмачок', 0, 2], ['candle', 'Свечной огарок', 0, 1], ['lens', 'Треснувшая линза', 1, 12], ['bell', 'Ржавый колокольчик', 0, 4], ['portrait', 'Пожелтевший портрет', 1, 16],
  ['tooth', 'Зуб святого в оправе', 2, 55], ['ash_bowl', 'Пепельная чаша', 2, 60], ['pearl', 'Чёрная жемчужина', 3, 120], ['idol', 'Идол Безликого', 3, 100], ['seal', 'Печать Слуги', 3, 110],
  ['medallion', 'Клеймёный медальон', 4, 240], ['pipe', 'Трубка из вишнёвого корня', 0, 9], ['spoon', 'Серебряная ложка', 1, 14], ['mirror', 'Карманное зеркальце', 1, 15], ['thimble', 'Напёрсток', 0, 2],
  ['ink', 'Пузырёк чернил', 0, 4], ['quill', 'Гусиное перо', 0, 2], ['hourglass', 'Песочные часы', 2, 40], ['compass', 'Сломанный компас', 1, 20], ['locket', 'Медальон с прядью волос', 1, 22],
  ['rosary', 'Чётки из костей', 1, 17], ['crown_toy', 'Игрушечная корона', 0, 4], ['horn_cup', 'Рог для питья', 1, 13], ['skull_cup', 'Чаша из черепа', 2, 48], ['icon', 'Закопчённая иконка', 1, 19],
  ['weights', 'Весы-безмен', 1, 11], ['lantern', 'Погасший фонарь', 0, 7], ['rattle', 'Погремушка', 0, 3], ['flute', 'Костяная флейта', 1, 16], ['mask_toy', 'Ярмарочная маска', 0, 5]
];
for (const [id, name, rar, val] of CURIOS) add({ id: 'k_' + id, name, cat: 'curio', pool: 'curio', rar, stack: 5, value: val, text: 'Безделушка. Чья-то память, которую можно продать.' });

// ---------- ключи ----------
const KEYS = [['rust', 'Ржавый ключ', 1, 0, 6], ['iron', 'Железный ключ', 2, 1, 20], ['bone', 'Костяной ключ', 2, 2, 34], ['black', 'Чёрный ключ', 3, 3, 90]];
for (const [id, name, tier, rar, val] of KEYS) add({ id: 'key_' + id, name, cat: 'key', pool: 'key', rar, stack: 5, value: val, keyTier: tier, text: `Открывает запертые сундуки (уровень замка до ${tier}).` });

// ---------- записки и книги (текст пока читается в карточке) ----------
const BOOKS = [
  ['note_trader', 'Записка торговца', 'Три воза встали у старой мельницы. Рогачи не трогают тех, кто стоит неподвижно. Проверено дважды, вернее — один раз.'],
  ['diary_scrap', 'Обрывок дневника', 'День шестой. Свет в небе не уходит. Дети перестали спрашивать, почему тёмный круг не двигается.'],
  ['note_smith', 'Заметки кузнеца', 'Чёрная сталь любит пепел, а пепел любит тех, кто не боится огня. Не клади клеймёный металл в воду.'],
  ['ledger', 'Конторская книга', 'Муки — шесть мер. Масла — нет. Должен кабатчику два червонца. Должен себе больше.'],
  ['prayer', 'Молитвенник без обложки', 'Кто стоит против тьмы — не один, пока горит костёр. Кто стоит один — тот и есть костёр.'],
  ['map_scrap', 'Обрывок карты', 'Крестом отмечен погреб за часовней. Рядом приписка: «замок ржавый, но не пустой».'],
  ['sermon', 'Проповедь Безликого', 'Приди без имени, и тьма не станет искать тебя. Но ты сам не найдёшь дороги назад.'],
  ['herbal', 'Травник', 'Могильный мох унимает кровь. Горький корень будит. Грибы у воды не есть ни при каком голоде.'],
  ['song', 'Листок с песней', 'Спи, кузнечик, спи, чужак, в доме нет ни свеч, ни драк. Кто не спит — того найдут, а кто спит — того спасут.'],
  ['letter_son', 'Письмо сыну', 'Если вернёшься, не ищи нас в деревне. Мы ушли к солнечной стороне, где небо ещё помнит цвет.'],
  ['bestiary', 'Заметки о тварях', 'Бес быстр, но хрупок. Рогач медлен, но бьёт так, что доспех лишь помеха. Бей, когда замах кончился.'],
  ['recipe', 'Рецепт похлёбки', 'Лук, репа, сало, соль. Грибы не класть. Совсем не класть.'],
  ['wanted', 'Объявление о награде', 'Награда за голову Слуги Затмения: сорок червонцев. Объявление пожелтело. Награду никто не заплатил.'],
  ['guard_orders', 'Приказ стражи', 'Ворота закрыть на закате. Закат не наступил, ворота не закрыты. Выполнять по обстоятельствам.'],
  ['contract', 'Договор на дом', 'Дом переходит тому, кто в нём жив. Подпись неразборчива, печать — оттиск пальца.'],
  ['gravedigger', 'Тетрадь могильщика', 'Эти копать не надо: они сами встают. Работы меньше, радости тоже.'],
  ['star_chart', 'Звёздная карта', 'Нарисовано небо, каким оно было до Затмения. На полях: «Не так уж и плохо».'],
  ['blacksmith_song', 'Кузнечная считалка', 'Раз — удар, два — удар, три — меч на свет. Четвёртый удар не наносят: он уже сам.'],
  ['child_drawing', 'Детский рисунок', 'Человек с огромным мечом стоит перед чёрным кругом. Подпись кривыми буквами: «папа».'],
  ['lament', 'Плач по сожжённой деревне', 'Здесь жили люди. Теперь живут тени, и им не нужны дома — но они всё равно заходят в двери.']
];
for (const [id, name, text] of BOOKS) add({ id: 'b_' + id, name, cat: 'curio', pool: 'book', rar: /bestiary|sermon|star_chart|map_scrap/.test(id) ? 1 : 0, stack: 1, value: 6, text });

// золотые (G3b): статы лучшей клеймёной вещи того же места × GOLD_K
for (const [id, name, slot, kind0, perks, gold, story, extra] of GOLD) {
  const light = kind0.startsWith('light:'), kind = light ? kind0.slice(6) : kind0;     // лёгкая золотая вещь: основа — лучшая лёгкая клеймёная того же места
  const base = light ? ITEMS.filter(i => i.rar === 4 && i.slot === slot && !HEAVY_KINDS.includes(i.kind) && i.stats).sort((a, b) => b.value - a.value)[0] : ITEMS.filter(i => i.rar === 4 && i.slot === slot && (slot === 'weapon' || slot === 'offhand' ? i.kind === kind : true) && i.stats).sort((a, b) => b.value - a.value)[0]
    || ITEMS.filter(i => i.slot === slot && i.kind === kind && i.stats).sort((a, b) => b.rar - a.rar || b.value - a.value)[0];
  const stats = {}; for (const [k, v] of Object.entries(base.stats)) stats[k] = k === 'swing' || k === 'reach' ? v : v > 0 ? Math.round(v * GOLD_K + .49) : v;
  if (light && stats.spd < 0) delete stats.spd;
  for (const [k, v] of Object.entries(extra || {})) stats[k] = (stats[k] || 0) + v;
  add({ ...base, ...(light ? { kind } : {}), id: 'g_' + id, base: base.id, name, pool: 'gold', rar: 5, stats, value: base.value * 1.6, mat: 'gold', perks: perks || base.perks, gold: gold || null, text: (perks ? weaponText(kind, perks) : goldText(gold)) + ' ' + story });
}
// вещи боссов подземелий (этап 5): основа — чёрная вещь (вид, модель в руке, свойства материала), свои имя и характеристики;
// pool 'dungeon' — только с босса boss (не в таблицах добычи); добавлены после золотых, чтобы не менять их основу
const DUN = [
  ['d_spade_olm', 'w_scythe_black', 'Заступ Могильщика', 'gravekeeper', { dmg: 19, reach: .6, crit: 6, swing: 1.15, leech: 3 }, 'Им Ольм закапывал тех, кто ещё дышал. Лезвие помнит вкус.'],
  ['d_shroud_olm', 'a_cloak_pelt_black', 'Саван Ольма', 'gravekeeper', { armor: 8, hp: 30, spd: 2 }, 'Серое полотно, пропитанное землёй. Греет, как ни странно.'],
  ['d_veil_sister', 'a_head_hood_black', 'Покров Сестры', 'ashsister', { armor: 6, crit: 5, hp: 12 }, 'Капюшон, под которым плакали пеплом.'],
  ['d_wand_sister', 'w_wand_black', 'Жезл Плача', 'ashsister', { dmg: 13, crit: 12, swing: .85 }, 'Тёплый, как зола после пожара.'],
  ['d_crook_shepherd', 'w_staff_black', 'Посох Пастыря', 'boneshepherd', { dmg: 20, crit: 5, swing: 1.2, hp: 15 }, 'Пастух собирал не овец. Кость на навершии ещё шевелится.'],
  ['d_ring_shepherd', 'r_ring_blood', 'Кольцо из позвонка', 'boneshepherd', { hp: 26, leech: 2 }, 'Гладкое и тяжёлое. Лучше не думать, чьё.', '#d8ccb0'],
  ['d_bow_shepherd', 'w_longbow_black', 'Лук Костяной Жилы', 'boneshepherd', { dmg: 22, crit: 9, swing: 1.15 }, 'Тетива из жилы. Бьёт тихо.'],
  ['d_maul_moss', 'w_hammer_black', 'Мшистая Колотушка', 'mossbeast', { dmg: 23, reach: -.1, crit: 2, swing: 1.25, hp: 18 }, 'Корень, обросший камнем. Тяжела, как старый дуб.'],
  ['d_hide_moss', 'a_body_plate_black', 'Шкура Мшистого Зверя', 'mossbeast', { armor: 23, hp: 20, spd: -2 }, 'Мох на ней ещё растёт. Удары вязнут, как в болоте.'],
  ['d_staff_thorn', 'w_staff_black', 'Терновый Посох', 'thornwitch', { dmg: 22, crit: 6, swing: 1.15, leech: 2 }, 'Колючки впиваются в ладонь — и в того, по кому бьёшь.'],
  ['d_hood_thorn', 'a_head_hood_black', 'Венец Терна', 'thornwitch', { armor: 7, crit: 6, hp: 16 }, 'Сплетён из живых веток. Иногда цветёт.'],
  ['d_fangs_wolf', 'w_dagger_black', 'Клык Серого Вожака', 'greywolf', { dmg: 9, reach: -.7, crit: 12, swing: .72 }, 'Вожак отдал его не по своей воле.'],
  ['d_boots_wolf', 'a_boots_greaves_black', 'Поступь Серых', 'greywolf', { armor: 8, spd: 5 }, 'Шаг становится тише и шире.'],
  ['d_crown_oak', 'a_head_helm_black', 'Ольховая Корона', 'oakking', { armor: 10, hp: 28, crit: 3 }, 'Корона короля, которого лес короновал сам.'],
  ['d_greatsword_oak', 'w_greatsword_black', 'Меч Ольхового Короля', 'oakking', { dmg: 26, reach: .6, crit: 7, swing: 1.25 }, 'Клинок с прожилками, как у листа. Тяжёл и честен.'],
  ['d_amulet_oak', 'm_talisman_blood', 'Жёлудь Кургана', 'oakking', { hp: 34, armor: 4 }, 'Тёплый жёлудь в оправе. Говорят, из него вырастет новый лес.', '#9ab050'],
  // Акт II (этап 7)
  ['d_fuse_sapper', 'w_dagger_black', 'Фитильный нож', 'sapper', { dmg: 10, reach: -.7, crit: 12, swing: .75 }, 'Им минёр резал запалы. Пахнет порохом.'],
  ['d_apron_sapper', 'a_body_robe_black', 'Фартук минёра', 'sapper', { armor: 9, hp: 32 }, 'Кожа в подпалинах. Держит искру и осколок.'],
  ['d_veil_drowned', 'a_head_hood_black', 'Мокрый покров', 'drownedmaid', { armor: 7, crit: 6, hp: 16 }, 'Никогда не высыхает.'],
  ['d_wand_drowned', 'w_wand_black', 'Жезл Глубины', 'drownedmaid', { dmg: 14, crit: 12, swing: .85 }, 'Холодный, как вода в колодце.'],
  ['d_staff_silt', 'w_staff_black', 'Посох Ила', 'silt', { dmg: 23, crit: 5, swing: 1.2, hp: 16 }, 'Сквозь дерево сочится ил. Тяжёл и терпелив.'],
  ['d_ring_silt', 'r_ring_blood', 'Илистое кольцо', 'silt', { hp: 30, leech: 2 }, 'Тусклое, будто со дна.', '#7a8a6a'],
  ['d_bow_silt', 'w_longbow_black', 'Лук Затонувших', 'silt', { dmg: 24, crit: 9, swing: 1.15 }, 'Тетива из водорослей. Странно, но держит.'],
  ['d_plate_gate', 'a_body_plate_black', 'Латы Привратника', 'gatewarden', { armor: 26, hp: 24, spd: -3 }, 'Тяжёлые, как сами ворота.'],
  ['d_mace_gate', 'w_mace_black', 'Ключ Ворот', 'gatewarden', { dmg: 18, reach: -.2, crit: 2, swing: 1.05 }, 'Булава, которой отпирали чужие головы.'],
  ['d_cloak_gneis', 'a_cloak_pelt_black', 'Плащ коменданта', 'gneis', { armor: 9, hp: 34, spd: 2 }, 'Тёплый и ни разу не видавший боя.'],
  ['d_xbow_gneis', 'w_crossbow_black', 'Арбалет Гнейса', 'gneis', { dmg: 28, crit: 4 }, 'Гнейс берёг его для охоты. Стрелял редко.'],
  ['d_maul_borot', 'w_hammer_black', 'Синяя булава Борота', 'borot', { dmg: 27, reach: -.1, crit: 3, swing: 1.25 }, 'Честный враг — честное оружие.'],
  ['d_helm_borot', 'a_head_helm_black', 'Шлем Синих', 'borot', { armor: 12, hp: 30 }, 'Вмятина на виске — от твоего удара.'],
  ['d_amulet_borot', 'm_talisman_blood', 'Знак Синего Клинка', 'borot', { hp: 38, armor: 5 }, 'Синий камень в железе. Так метят лучших в Кадмии.', '#4a6aa8'],
  ['d_sword_armorer', 'w_sword_black', 'Клинок пробы', 'armorer', { dmg: 18, crit: 7 }, 'Этим мечом проверяли, крепка ли броня. Броня проигрывала.'],
  ['d_boots_armorer', 'a_boots_greaves_black', 'Кованые сапоги', 'armorer', { armor: 10, spd: 2 }, 'Сделаны под марш, а не под парад.'],
  ['d_core_golem', 'm_talisman_blood', 'Тлеющее ядро', 'firegolem', { hp: 30, crit: 4 }, 'Тёплое в любой мороз.', '#e86a2a'],
  ['d_staff_golem', 'w_staff_black', 'Посох Горна', 'firegolem', { dmg: 25, crit: 6, swing: 1.2 }, 'В навершии ещё тлеет угль.'],
  ['d_greatsword_smelt', 'w_greatsword_black', 'Литой двуручник', 'smelter', { dmg: 29, reach: .6, crit: 7, swing: 1.25 }, 'Отлит целиком. Ни одного шва.'],
  ['d_plate_smelt', 'a_body_plate_black', 'Литая кираса', 'smelter', { armor: 28, hp: 30, spd: -3 }, 'Тяжела, но удар по ней звенит и уходит.'],
  ['d_bow_smelt', 'w_bow_black', 'Лук из пружинной стали', 'smelter', { dmg: 17, crit: 8, swing: .9 }, 'Сталь вместо рога. Бьёт зло и быстро.'],
  // Акт III (этап 7)
  ['d_halberd_tower', 'w_halberd_black', 'Алебарда Стража Башни', 'towerwarden', { dmg: 25, reach: .9, crit: 5, swing: 1.25 }, 'Ею отгоняли от ворот тех, кто искал ответа.'],
  ['d_boots_tower', 'a_boots_greaves_black', 'Сапоги часового', 'towerwarden', { armor: 11, spd: 3 }, 'Ступени Башни стёрты именно такими.'],
  ['d_ring_keys', 'r_ring_blood', 'Кольцо Ключника', 'keymaster', { hp: 34, crit: 4 }, 'На нём висел ключ от нижней камеры.', '#a89060'],
  ['d_dagger_keys', 'w_dagger_black', 'Отмычка Ключника', 'keymaster', { dmg: 11, reach: -.7, crit: 13, swing: .72 }, 'Тонкий клинок. Им открывали не только замки.'],
  ['d_cloak_hound', 'a_cloak_pelt_black', 'Шкура Пса Башни', 'towerhound', { armor: 10, hp: 38, spd: 2 }, 'Тяжёлая и тёплая. Пахнет псиной и железом.'],
  ['d_axe_hound', 'w_axe_black', 'Топор псаря', 'towerhound', { dmg: 22, crit: 6 }, 'Им рубили цепи. И не только.'],
  ['d_bow_hound', 'w_longbow_black', 'Лук загонщика', 'towerhound', { dmg: 26, crit: 9, swing: 1.15 }, 'С ним загоняли беглецов к морю.'],
  ['d_fang_garm', 'w_sword_black', 'Клык Гарма', 'garm_beast', { dmg: 20, crit: 9, leech: 3 }, 'Он отдал за силу мать. Клык отдал даром.'],
  ['d_collar_garm', 'm_talisman_blood', 'Ошейник Чёрного Пса', 'garm_beast', { hp: 40, crit: 4 }, 'Знак Чёрных Псов. Теперь ничей.', '#3a2a2a'],
  ['d_spear_banner', 'w_spear_black', 'Копьё Кровавого знамени', 'bloodbanner', { dmg: 22, reach: .8, crit: 6 }, 'Знамя истлело. Копьё — нет.'],
  ['d_plate_banner', 'a_body_plate_black', 'Броня знаменосца', 'bloodbanner', { armor: 30, hp: 32, spd: -3 }, 'Ржавая, но её не пробил ни один из тех, кто лежит в кургане.'],
  ['d_crown_nameless', 'a_head_helm_black', 'Венец Безымянного', 'namelessking', { armor: 12, hp: 36, crit: 3 }, 'Имя короля стёрто. Корона осталась.'],
  ['d_staff_nameless', 'w_staff_black', 'Скипетр без имени', 'namelessking', { dmg: 27, crit: 6, swing: 1.2 }, 'Им правили мёртвым войском.'],
  ['d_bow_nameless', 'w_longbow_black', 'Лук королевской охоты', 'namelessking', { dmg: 28, crit: 9, swing: 1.15 }, 'Охота кончилась сотни лет назад.'],
  ['d_scythe_wight', 'w_scythe_black', 'Коса могильщика', 'gravewight', { dmg: 24, reach: .6, crit: 7, swing: 1.15, leech: 3 }, 'Ею он копал. Потом — косил.'],
  ['d_robe_wight', 'a_body_robe_black', 'Саван Отступника', 'gravewight', { armor: 10, hp: 42 }, 'Внутри холоднее, чем снаружи.'],
  ['d_ring_wight', 'r_ring_blood', 'Перстень с могильной землёй', 'gravewight', { hp: 36, leech: 3 }, 'Под камнем — щепоть земли. Чьей — лучше не знать.', '#6a5a3a'],
  // Акт IV (этап 7)
  ['d_scythe_elder', 'w_scythe_black', 'Серп старосты', 'swampelder', { dmg: 25, reach: .6, crit: 8, swing: 1.15 }, 'Им жали не хлеб.'],
  ['d_amulet_elder', 'm_talisman_blood', 'Оберег Топкой Деревни', 'swampelder', { hp: 44, armor: 5 }, 'Деревня вешала его на дверь старосты. Не помогло.', '#5a6a3a'],
  ['d_cleaver_feeder', 'w_axe_black', 'Тесак Кормильца', 'feeder', { dmg: 26, crit: 7 }, 'Тупой с одной стороны. Острый — с другой.'],
  ['d_apron_feeder', 'a_body_robe_black', 'Фартук Кормильца', 'feeder', { armor: 11, hp: 46 }, 'Лучше не спрашивать, отчего он такой тёмный.'],
  ['d_wand_swarm', 'w_wand_black', 'Жезл Роя', 'swarm', { dmg: 17, crit: 14, swing: .85 }, 'Гудит, если поднести к уху.'],
  ['d_hood_swarm', 'a_head_hood_black', 'Капюшон из крыльев', 'swarm', { armor: 9, crit: 7, hp: 22 }, 'Шуршит при каждом шаге.'],
  ['d_greataxe_nest', 'w_war_axe_black', 'Секира Хозяина Гнезда', 'nestlord', { dmg: 32, crit: 7, swing: 1.3 }, 'Тяжёлая, как вина.'],
  ['d_crown_nest', 'a_head_helm_black', 'Венец из корней', 'nestlord', { armor: 13, hp: 40, crit: 3 }, 'Корни ещё шевелятся.'],
  ['d_ring_nest', 'r_ring_blood', 'Кольцо Гнезда', 'nestlord', { hp: 40, leech: 3 }, 'Внутри — засохшая капля смолы.', '#6a5a2a'],
  ['d_staff_shriek', 'w_staff_black', 'Посох Вопля', 'abbeyshriek', { dmg: 30, crit: 7, swing: 1.2 }, 'Когда им бьют, кто-то вдалеке кричит.'],
  ['d_veil_shriek', 'a_head_hood_black', 'Покров кликуши', 'abbeyshriek', { armor: 9, crit: 8, hp: 24 }, 'Ткань глушит любой звук. Почти любой.'],
  ['d_bell_choir', 'w_mace_black', 'Немой колокол', 'choir', { dmg: 24, reach: -.2, crit: 3, swing: 1.05 }, 'Язык вырван. Бьёт всё равно гулко.'],
  ['d_robe_choir', 'a_body_robe_black', 'Ряса хора', 'choir', { armor: 12, hp: 50 }, 'Те, кто её носил, не говорили сорок лет.'],
  ['d_mace_abbot', 'w_hammer_black', 'Посох-булава Настоятеля', 'abbot', { dmg: 33, reach: -.1, crit: 4, swing: 1.25 }, 'Им благословляли. Потом — нет.'],
  ['d_plate_abbot', 'a_body_plate_black', 'Литургический доспех', 'abbot', { armor: 30, hp: 44, spd: -3 }, 'Под золотом — чёрная сталь.'],
  ['d_amulet_abbot', 'm_talisman_blood', 'Чётки Настоятеля', 'abbot', { hp: 48, crit: 5 }, 'Сорок бусин. Одна — из кости.', '#c8a860'],
  ['d_fang_serpent', 'w_rapier_black', 'Жало Змея', 'ap_serpent', { dmg: 24, crit: 15 }, 'Тонкое и злое.'],
  ['d_scale_serpent', 'a_cloak_pelt_black', 'Чешуйчатый плащ', 'ap_serpent', { armor: 12, hp: 46, spd: 3 }, 'Сбрасывает воду, как кожа змеи.'],
  ['d_tusk_boar', 'w_greatsword_black', 'Бивень Вепря', 'ap_boar', { dmg: 36, reach: .6, crit: 7, swing: 1.3 }, 'Не клинок — клык, обмотанный кожей.'],
  ['d_hide_boar', 'a_body_plate_black', 'Шкура Вепря', 'ap_boar', { armor: 30, hp: 48, spd: -3 }, 'Её не берёт ни копьё, ни огонь.'],
  ['d_wing_moth', 'w_longbow_black', 'Крыло Моли', 'ap_moth', { dmg: 34, crit: 11, swing: 1.1 }, 'Лук лёгкий, как пыльца.'],
  ['d_dust_moth', 'm_talisman_blood', 'Пыльца Моли', 'ap_moth', { hp: 42, crit: 6 }, 'Светится в темноте. Тени её не любят.', '#d8c890']
];
{ const B = ITEMS.find(i => i.id === 'r_ring_blood'); add({ ...ITEMS.find(i => i.id === 'm_talisman_blood'), id: 'm_ember_irma', name: 'Уголёк Ирмы', pool: 'story', rar: 3, stats: { hp: 48, armor: 5, crit: 3 }, value: 800, tint: '#c86a3a', text: 'Ирма носила его с первого дня в отряде. Теперь он у тебя.' }); add({ ...B, id: 'r_seal_veligrad', name: 'Перстень Велиграда', pool: 'story', rar: 3, stats: { hp: 40, crit: 4, armor: 4 }, value: 600, tint: '#d8b860', text: 'Королевский перстень графа Пепельного. Его оставили на столе, уходя.' }); }     // награда Акта II
// легендарное оружие героя (Акт IV, кузнец Гедеон): только из сюжета
for (const [id, b, name, stats, text] of [
  ['l_slab', 'w_greatsword_black', 'Глыба', { dmg: 40, reach: .8, crit: 6, swing: 1.35, leech: 3 }, 'Это не меч. Это кусок железа. Но для них — в самый раз.'],
  ['l_nightbow', 'w_longbow_black', 'Тетива Ночи', { dmg: 38, crit: 14, swing: 1.1 }, 'Стрелы из неё не видят, а находят.'],
  ['l_brandblades', 'w_rapier_black', 'Клинки Клейма', { dmg: 28, crit: 18, swing: .85, leech: 4 }, 'Клеймо на шее отзывается на каждый удар.'],
  ['l_dawnstaff', 'w_staff_black', 'Посох Рассвета', { dmg: 38, crit: 9, swing: 1.15, hp: 40 }, 'В навершии — свет, которого боятся тени.']
]) { const B = ITEMS.find(i => i.id === b); add({ ...B, id, name, pool: 'story', rar: 3, stats, value: B.value * 4, text }); }     // «Великая»: клеймёные — мерило золотых
for (const [id, b, name, boss, stats, text, tint] of DUN) { const B = ITEMS.find(i => i.id === b); add({ ...B, id, name, pool: 'dungeon', rar: 3, boss, stats, value: B.value * 2.2, text, ...(tint ? { tint } : {}) }); }     // tint — свой цвет значка у кольца и амулета
export const CATALOG = ITEMS;
export const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const item = id => BY_ID[id];
// индекс «пул → редкость → вещи» для таблиц добычи
export const BY_POOL = {};
for (const it of ITEMS) ((BY_POOL[it.pool] ||= [[], [], [], [], [], []])[it.rar]).push(it);
export const rarityColor = it => RARITY[it.rar].color;

// короткое описание статов: «+7 урон · +3% крит»
export function statLine(it) {
  const s = it.stats || {}, out = [];
  for (const k of Object.keys(s)) {
    if (k === 'swing') { out.push(s[k] < 1 ? 'быстрый удар' : 'медленный удар'); continue; }
    if (k === 'reach') { out.push(`${s[k] > 0 ? '+' : ''}${s[k]} дальность`); continue; }
    out.push(`${s[k] > 0 ? '+' : ''}${s[k]} ${STAT_NAME[k]}`);
  }
  return out.join(' · ');
}
