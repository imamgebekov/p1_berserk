// Все числа 3D-прототипа — здесь. Единицы: метры (условно), секунды, градусы.
// Панель ⚙ в игре меняет часть этих чисел на лету (список — TWEAKS внизу) и умеет скопировать их текстом.

export const CFG3 = {
  view: {
    pixelScale: 3,        // размер «пикселя» в экранных пикселях: больше — грубее и быстрее
    fov: 48,              // угол обзора камеры
    camPitch: 58,         // наклон камеры вниз: 90 — строго сверху, 30 — почти горизонтально
    camDist: 19,          // расстояние камеры до героя
    camLookUp: 1.0,       // на какую высоту над землёй смотрит камера
    camYaw: 38,           // поворот камеры вокруг героя: 0 — прямо, 45 — «изометрия» как в Project Zomboid
    camFollow: 7,         // «пружинность» слежения (больше — жёстче)
    fogDensity: .022      // плотность тумана
  },

  world: {
    radius: 85,           // граница мира (круг)
    props: 150,            // число деревьев и камней
    seed: 7
  },

  // Деревня. Дом: центр (x, z), размеры w (по x) и d (по z), сторона двери door: n (−z), s (+z), e (+x), w (−x).
  // Дома задаются руками: добавьте строку — появится новый дом (стены, дверь, крыша, окна, обстановка).
  map: {
    wall: .5,             // толщина стен
    wallH: 2.8,           // высота стен
    doorW: 2.2,           // ширина дверного проёма
    containerRespawn: 240, // через сколько секунд контейнер снова наполняется
    doorReach: 2.0,       // на каком расстоянии от двери она открывается сама
    cutH: .35,            // во сколько раз стены «опускаются», когда герой внутри (вид сверху)
    buildings: [
      // деревня вокруг костра
      { x: -14, z: -6,  w: 8,  d: 6, door: 'e', kind: 'house',     chests: ['chest', 'wardrobe'] },
      { x: 13,  z: -10, w: 7,  d: 6, door: 'w', kind: 'house',     chests: ['coffer', 'crate'] },
      { x: -4,  z: -20, w: 9,  d: 6, door: 's', kind: 'house',     chests: ['ironchest', 'rack', 'barrel'] },
      { x: 20,  z: 6,   w: 6,  d: 7, door: 'w', kind: 'house',     chests: ['sack', 'chest'] },
      { x: -18, z: 14,  w: 7,  d: 7, door: 'e', kind: 'house',     chests: ['locked', 'shelf'] },
      { x: 6,   z: 24,  w: 8,  d: 6, door: 'n', kind: 'house',     chests: ['medchest', 'crate', 'barrel'] },
      { x: -8,  z: 9,   w: 7,  d: 6, door: 'e', kind: 'shop',      chests: ['crate', 'coffer'], npc: 'merchant' },
      { x: -28, z: 30,  w: 9,  d: 7, door: 'n', kind: 'smithy',    chests: ['smithchest', 'smithchest', 'rack', 'ironchest'] },
      { x: 28,  z: -26, w: 12, d: 8, door: 'w', kind: 'tavern',    chests: ['barrel', 'barrel', 'crate', 'chest'] },
      { x: -34, z: -20, w: 7,  d: 11, door: 's', kind: 'chapel',   chests: ['altar', 'shelf', 'coffer'] },
      { x: 48,  z: 8,   w: 11, d: 7, door: 'w', kind: 'barracks',  chests: ['rack', 'rack', 'armorstand', 'ironchest'] },
      { x: 30,  z: 40,  w: 10, d: 8, door: 'n', kind: 'warehouse', chests: ['crate', 'crate', 'barrel', 'locked'] },
      { x: 36,  z: -8,  w: 6,  d: 6, door: 'w', kind: 'house',     chests: ['cache', 'corpse'] },
      { x: -36, z: 2,   w: 6,  d: 6, door: 'e', kind: 'house',     chests: ['ironchest', 'armorstand'] },
      { x: 52,  z: -22, w: 5,  d: 5, door: 'w', kind: 'hut',       chests: ['sack', 'cache'] },
      { x: -52, z: 16,  w: 5,  d: 5, door: 'e', kind: 'hut',       chests: ['sack', 'corpse'] },
      { x: -18, z: -34, w: 5,  d: 5, door: 's', kind: 'hut',       chests: ['barrel', 'crate'] }
    ],
    // контейнеры под открытым небом: вид из data/loot.js, координаты
    spots: [
      { kind: 'wagon', x: 15, z: 15 }, { kind: 'corpse', x: 25, z: -42 }, { kind: 'barrel', x: -9, z: 3 }, { kind: 'crate', x: 11, z: 3 },
      { kind: 'locked', x: 62, z: 28 }, { kind: 'cache', x: -60, z: 40 }, { kind: 'corpse', x: 40, z: 56 }, { kind: 'barrel', x: -26, z: 24 },
      { kind: 'crate', x: 24, z: 2 }, { kind: 'sack', x: -20, z: 22 }
    ],
    // области: кладбище (могилы-контейнеры), ферма, рынок, руины, лагерь
    zones: [
      { type: 'graveyard', x: -52, z: -38, w: 26, d: 18 },
      { type: 'farm', x: 52, z: 40, w: 30, d: 22 },
      { type: 'market', x: 4, z: 14, r: 8 },
      { type: 'ruins', x: -56, z: 40, r: 9 },
      { type: 'camp', x: 56, z: -44, r: 7 }
    ]
  },

  shop: { buyMul: 2.2, sellMul: .5, restock: 300, reach: 3.4 },   // цена покупки = цена вещи × buyMul, продажи × sellMul; витрина обновляется раз в restock секунд
  bag: { slots: 30 },
  gear: { armorK: .035, maxSpd: 45, pickup: 1.3, dropLife: 90 },   // броня: урон /(1+брони×armorK); подбор с земли

  player: {
    hp: 100,
    speed: 5.4,           // скорость бега
    accel: 38,            // разгон/торможение
    turnSpeed: 16,        // скорость поворота
    attackDamage: 14,
    attackRange: 2.8,     // дальность удара
    attackArc: 150,       // ширина дуги удара, градусов
    attackTime: .42,      // длительность удара
    attackHitAt: .15,     // с какого момента удара наносится урон
    attackLunge: 2.2,     // рывок вперёд при ударе
    attackSlow: .45,      // доля скорости при ударе
    autoAim: 5.5,         // удар сам поворачивается к ближайшему врагу в этом радиусе
    knockback: 6,         // отбрасывание врагов
    rollSpeed: 12.5,
    rollTime: .3,
    rollCooldown: .75,
    rollInvuln: .36,      // неуязвимость переката
    hurtInvuln: .55,      // неуязвимость после получения удара
    radius: .5
  },

  enemies: {
    count: 4,             // сколько врагов держим на поле
    respawn: 2.2,         // пауза до появления нового
    ring: [14, 19],       // на каком расстоянии от героя появляются
    brutePart: .3,        // доля рогачей среди врагов
    imp:   { hp: 26, speed: 3.3, damage: 6,  range: 1.5, wind: .45, recover: .75, radius: .45, scale: 1 },
    brute: { hp: 70, speed: 2.1, damage: 14, range: 2.1, wind: .7,  recover: 1.0, radius: .8,  scale: 1.6 },
    // слух: чем громче герой, тем дальше его слышат. Услышавший идёт к герою, пока тот не уйдёт дальше `lose`
    hear: { idle: 10, run: 17, fight: 25, house: .55, lose: 32, drift: .3 },   // drift: доля скорости, с которой «бредёт» неуслышавший
    knockDecay: 9
  },

  fx: {
    hitStop: .05,
    shake: .22
  }
};

// Что можно крутить на телефоне: путь в CFG3, подпись, диапазон
export const TWEAKS = [
  { path: 'view.camPitch', label: 'Наклон камеры', min: 25, max: 88, step: 1, unit: '°' },
  { path: 'view.camYaw', label: 'Поворот камеры', min: 0, max: 90, step: 1, unit: '°' },
  { path: 'view.camDist', label: 'Расстояние камеры', min: 6, max: 30, step: .5 },
  { path: 'view.fov', label: 'Угол обзора', min: 25, max: 80, step: 1, unit: '°' },
  { path: 'view.pixelScale', label: 'Размер «пикселя»', min: 1, max: 6, step: 1, reload: true },
  { path: 'view.fogDensity', label: 'Туман', min: 0, max: .08, step: .002 },
  { path: 'player.speed', label: 'Скорость героя', min: 2, max: 10, step: .1 },
  { path: 'player.attackRange', label: 'Дальность удара', min: 1, max: 5, step: .1 },
  { path: 'player.attackArc', label: 'Ширина удара', min: 40, max: 360, step: 5, unit: '°' },
  { path: 'player.attackDamage', label: 'Урон героя', min: 2, max: 60, step: 1 },
  { path: 'player.rollCooldown', label: 'Перезарядка переката', min: .2, max: 2, step: .05, unit: ' с' },
  { path: 'enemies.count', label: 'Врагов на поле', min: 0, max: 12, step: 1 },
  { path: 'enemies.brutePart', label: 'Доля рогачей', min: 0, max: 1, step: .05 },
  { path: 'enemies.imp.speed', label: 'Скорость бесов', min: 1, max: 7, step: .1 },
  { path: 'enemies.brute.hp', label: 'Здоровье рогача', min: 10, max: 300, step: 5 }
];

export const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
export const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
