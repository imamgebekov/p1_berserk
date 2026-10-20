// Герои: кто чем бьётся и как выглядит. Множители силы (здоровье, скорость) — в config3d.js → heroes.
// kinds — разрешённые виды оружия (WTYPES и RTYPES из items.js); кулаки разрешены всем; start — оружие в руке при новой игре;
// off — что можно во вторую руку: щит (Торн) или второй клинок (Вейл).
// open: false — карточка видна, но выбрать нельзя (soon — почему).
export const HEROES = {
  thorn: {
    name: 'Торн', role: 'Тяжёлый мечник',
    text: 'Крепкий и неспешный. Рубит тяжёлым железом, держит удар; во второй руке — щит.',
    kinds: ['sword', 'axe', 'war_axe', 'greatsword', 'mace', 'club', 'hammer', 'pick', 'flail', 'chain_ball', 'scythe', 'halberd', 'spear'], off: ['shield'], start: 'w_sword_rust',     // шаг 12: не с кулаками
    look: { cloth: '#6a5148', cape: '#7a1e26', hair: '#3a2c28', legs: '#4a3a35', shoulder: true, hood: false, quiver: false, capeLen: 1 },
    open: true
  },
  vale: {
    name: 'Вейл', role: 'Дуэлянт',
    text: 'Быстрый и хрупкий. Лёгкие клинки, точные удары, чаще крит; во второй руке — ещё один клинок.',
    kinds: ['dagger', 'knife', 'sickle', 'rapier', 'sword'], off: ['dagger', 'knife', 'sickle', 'rapier', 'sword'], start: 'w_dagger_rust',
    look: { cloth: '#d8d0c0', cape: '#3a4a7a', hair: '#e8e0c8', legs: '#2a2a34', shoulder: false, hood: false, quiver: false, capeLen: .7 },
    open: true
  },
  jay: {
    name: 'Сойка', role: 'Лучница-разведчица',
    text: 'Бьёт издалека и не подпускает. Луки и арбалеты.',
    kinds: ['bow', 'longbow', 'crossbow'], off: [], start: 'w_bow_rust',
    look: { cloth: '#4a5a3a', cape: '#3a4a2a', hair: '#5a3a22', legs: '#3a3428', shoulder: false, hood: true, quiver: true, capeLen: .8 },
    open: true
  },
  irga: {
    name: 'Ирга', role: 'Ведунья',
    text: 'Носит только лёгкую броню, зато владеет стихиями: огонь, лёд, молния и яд по площади, одно мощное копьё по одной цели. Посохи и жезлы.',
    kinds: ['staff', 'wand'], off: [], start: 'w_staff_rust', armorBan: ['helm', 'sallet', 'cuirass', 'mail', 'plate', 'greaves'],     // лёгкая броня: без шлемов, кирас, кольчуг, лат и поножей
    look: { cloth: '#3e2e5e', cape: '#2a1e48', hair: '#d8d0c0', legs: '#3e2e5e', shoulder: false, hood: true, quiver: false, capeLen: 1.15, robe: true },     // robe — мантия до пят (объёмный вид)
    open: true
  },
  warlock: {     // Чернокнижник (2026-10-20): порча, похищение жизни, бес-призыв; ресурс — души
    name: 'Морок', role: 'Чернокнижник',
    text: 'Платит своей кровью за силу. Порча и рок, похищение жизни, бес у ног. Косы, серпы и жезлы; без лат и поножей.',
    kinds: ['scythe', 'sickle', 'wand'], off: [], start: 'w_sickle_rust', armorBan: ['plate', 'greaves'],
    look: { cloth: '#2a1a24', cape: '#4a0e2a', hair: '#1a1414', legs: '#1e1418', shoulder: false, hood: true, quiver: false, capeLen: 1.1, robe: true },
    open: true
  }
};
export const HERO_IDS = Object.keys(HEROES);
export const DEFAULT_HERO = 'thorn';
export const heroOf = id => HEROES[id] || HEROES[DEFAULT_HERO];
// можно ли герою держать вещь: ограничены оружие и вторая рука (щит)
export const canWield = (hero, it) => !it || (it.slot === 'weapon' ? heroOf(hero).kinds.includes(it.kind) : it.slot === 'offhand' ? heroOf(hero).off.includes(it.kind) : !(heroOf(hero).armorBan || []).includes(it.kind));
// тяжёлая броня, которую герою нельзя (для подсказки в сумке)
export const heavyFor = (hero, it) => !!it && !!it.slot && it.slot !== 'weapon' && it.slot !== 'offhand' && (heroOf(hero).armorBan || []).includes(it.kind);
// можно ли положить во вторую руку: щит — тому, кому он разрешён; клинок — дуэлянту (off — виды второго клинка)
export const canOff = (hero, it) => !!it && (it.slot === 'offhand' || it.slot === 'weapon') && heroOf(hero).off.includes(it.kind);
export const dualOf = hero => heroOf(hero).off.some(k => k !== 'shield');
// названия видов оружия героя для карточки («меч, топор, …»)
export const NOT_FOR = { thorn: 'Не для Торна', vale: 'Не для Вейла', jay: 'Не для Сойки', irga: 'Не для Ирги', warlock: 'Не для Морока' };
