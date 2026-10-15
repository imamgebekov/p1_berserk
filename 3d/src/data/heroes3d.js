// Герои: кто чем бьётся и как выглядит. Множители силы (здоровье, скорость) — в config3d.js → heroes.
// kinds — разрешённые виды оружия (WTYPES из items.js); кулаки разрешены всем. open: false — карточка видна, но выбрать нельзя.
export const HEROES = {
  thorn: {
    name: 'Торн', role: 'Тяжёлый мечник',
    text: 'Крепкий и неспешный. Рубит тяжёлым железом, держит удар. Позже — щит во второй руке.',
    kinds: ['sword', 'axe', 'war_axe', 'greatsword', 'mace', 'club', 'hammer', 'pick', 'flail', 'chain_ball', 'scythe', 'halberd', 'spear'],
    look: { cloth: '#6a5148', cape: '#7a1e26', hair: '#3a2c28', legs: '#4a3a35', shoulder: true, hood: false, quiver: false, capeLen: 1 },
    open: true
  },
  vale: {
    name: 'Вейл', role: 'Дуэлянт',
    text: 'Быстрый и хрупкий. Лёгкие клинки, точные удары, чаще крит. Позже — второй клинок.',
    kinds: ['dagger', 'knife', 'sickle', 'rapier', 'sword'],
    look: { cloth: '#d8d0c0', cape: '#3a4a7a', hair: '#e8e0c8', legs: '#2a2a34', shoulder: false, hood: false, quiver: false, capeLen: .7 },
    open: true
  },
  jay: {
    name: 'Сойка', role: 'Лучница-разведчица',
    text: 'Бьёт издалека и не подпускает. Луки и арбалеты.',
    kinds: [],
    look: { cloth: '#4a5a3a', cape: '#3a4a2a', hair: '#5a3a22', legs: '#3a3428', shoulder: false, hood: true, quiver: true, capeLen: .8 },
    open: false, soon: 'Откроется со следующим шагом: луки и арбалеты.'
  }
};
export const HERO_IDS = Object.keys(HEROES);
export const DEFAULT_HERO = 'thorn';
export const heroOf = id => HEROES[id] || HEROES[DEFAULT_HERO];
// можно ли герою держать вещь: ограничено только оружие
export const canWield = (hero, it) => !it || it.slot !== 'weapon' || heroOf(hero).kinds.includes(it.kind);
// названия видов оружия героя для карточки («меч, топор, …»)
export const NOT_FOR = { thorn: 'Не для Торна', vale: 'Не для Вейла', jay: 'Не для Сойки' };
