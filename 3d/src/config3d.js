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
      { x: -28, z: 30,  w: 9,  d: 7, door: 'n', kind: 'smithy',    chests: ['smithchest', 'smithchest', 'rack', 'ironchest'], npc: 'smith' },
      { x: 28,  z: -26, w: 12, d: 8, door: 'w', kind: 'tavern',    chests: ['barrel', 'barrel', 'crate', 'chest'] },
      { x: -34, z: -20, w: 7,  d: 11, door: 's', kind: 'chapel',   chests: ['altar', 'shelf', 'coffer'] },
      { x: 48,  z: 8,   w: 11, d: 7, door: 'w', kind: 'barracks',  chests: ['rack', 'rack', 'armorstand', 'ironchest'], npc: 'captain' },
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
    // названные места. safe — безопасная зона (враги не рождаются, а услышавшие теряют след); danger 1–3 — опасная зона:
    // враги крепче, их больше, добыча лучше, опыта больше
    cell: 5, reveal: 14,  // шаг сетки «тумана войны» и радиус открытия карты вокруг героя, м
    places: [
      { id: 'brod', name: 'Пепельный Брод', type: 'town', x: 0, z: 6, r: 30, safe: true },
      { id: 'sloboda', name: 'Кузнечная слобода', type: 'hamlet', x: -28, z: 30, r: 13, safe: true },
      { id: 'taverna', name: 'Таверна «Последний свет»', type: 'hamlet', x: 28, z: -26, r: 12, safe: true },
      { id: 'zastava', name: 'Застава', type: 'hamlet', x: 48, z: 8, r: 12, safe: true },
      { id: 'vdov', name: 'Хутор Вдов', type: 'hamlet', x: -52, z: 16, r: 9, safe: true },
      { id: 'uglej', name: 'Хутор Углей', type: 'hamlet', x: 52, z: -22, r: 9, safe: true },
      { id: 'pogost', name: 'Погост', type: 'danger', x: -46, z: -30, r: 24, danger: 2 },
      { id: 'polya', name: 'Сухие Поля', type: 'danger', x: 48, z: 40, r: 22, danger: 1 },
      { id: 'ruiny', name: 'Руины Скорби', type: 'danger', x: -56, z: 40, r: 14, danger: 2 },
      { id: 'lager', name: 'Лагерь Ржавых', type: 'danger', x: 56, z: -44, r: 12, danger: 3 }
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
  // отряд: наёмники из Заставы. Идут за героем, бьют врагов, умирают насовсем. Мест в отряде: baseMax + 1 за каждые perLevels уровней, но не больше cap
  // боссы: логово (x, z), атаки с предупреждением, фазы по здоровью. attacks: kind slam (круг), charge (рывок по линии), nova (кольцо огня), summon (подмога);
  // wind — время предупреждения, mul — множитель урона, cd — перезарядка, range — с какого расстояния применяется. phases: at — доля здоровья
  bosses: {
    homeHeal: .12,        // доля здоровья в секунду, которую босс лечит, вернувшись в логово (и пока герой в подземелье)
    respawn: 600, aggro: 28, leash: 70, enrageSpeed: 1.25, enrageCd: .7, enrageDmg: 1.2, minionCap: 6,
    list: [
      { type: 'devourer', set: 'pogost', x: -44, z: -36,
        attacks: [{ kind: 'slam', wind: 1.0, r: 4.2, mul: 1, cd: 3, range: 5 }, { kind: 'slam', wind: 1.5, r: 7, mul: 1.5, cd: 10, range: 99 }],
        phases: [{ at: .66, summon: { type: 'ghoul', n: 2 } }, { at: .33, summon: { type: 'ghoul', n: 3 } }, { at: .3, enrage: true }] },
      { type: 'lord', set: 'eclipse', x: -60, z: 44,
        attacks: [{ kind: 'charge', wind: .9, len: 13, width: 2.6, mul: 1.1, cd: 5, range: 16 }, { kind: 'nova', wind: 1.1, r: 8, inner: 2.6, mul: .9, cd: 8, range: 99 }, { kind: 'slam', wind: .7, r: 3.2, mul: .9, cd: 2.5, range: 3.6 }],
        phases: [{ at: .3, enrage: true }] },
      { type: 'chief', set: 'rust', x: 56, z: -52,
        attacks: [{ kind: 'charge', wind: 1.0, len: 11, width: 3, mul: 1.2, cd: 6, range: 14 }, { kind: 'slam', wind: .9, r: 4.6, mul: 1.1, cd: 3, range: 5 }],
        phases: [{ at: .66, summon: { type: 'hound', n: 3 } }, { at: .33, summon: { type: 'hound', n: 4 } }, { at: .3, enrage: true }] }
    ]
  },
  // подземелья и погреба: отдельные уровни со своей картой, врагами и туманом. at — люк на поверхности; rooms — комнаты (центр x, z и размеры w, d)
  // в локальных координатах уровня; back — где герой встаёт наверху, выйдя из погреба; entry — где появляется герой; exit — лестница наверх; depth 0–1 — «глубина» для добычи и силы врагов
  // подземелья и погреба: отдельные уровни со своей картой, врагами и туманом. at — люк на поверхности; back — где герой встаёт наверху, выйдя наружу;
  // rooms — комнаты и коридоры: прямоугольники пола (центр x, z и размеры w, d) в локальных координатах уровня; где прямоугольники касаются — проход;
  // doors — двери в проходах между комнатами a и b; entry — где появляется герой; exit — лестница наверх; depth 0–1 — «глубина» для добычи и силы врагов;
  // hidden — вход наверху пока не показывается (подземелье ещё не наполнено)
  dungeons: {
    reach: 1.8,           // на каком расстоянии от люка или лестницы появляется кнопка
    wall: .6, wallH: 1.4, // толщина и высота стен (низкие: камера смотрит сверху)
    fade: .4,             // затемнение при переходе, с (при prefers-reduced-motion — без него)
    seed: 9001,           // зерно случайных чисел подземелий в тестах (у каждого своё: seed + номер); в игре — Math.random
    cell: 1.5, reveal: 6, // клетка тумана войны и радиус открытия карты внизу, м (коридоры узкие, клетка мельче, чем наверху)
    corridorMax: 2.5,     // прямоугольник уже этого — коридор (без факелов)
    doorMax: 3,           // самый широкий проход, в который можно поставить дверь, м
    seenMax: 1200,        // предел длины строки тумана одного подземелья в сохранении
    path: { before: 1, past: 1.2, slack: .5 },   // путь через проход: точка до него и за ним, м; slack — запас к краю проёма
    hearRooms: 2,         // враг слышит героя, только если между ними не больше стольких проходов (иначе сбегается всё подземелье)
    respawnAway: 300,     // через сколько секунд отсутствия подземелье снова наполняется врагами
    spawnPad: 1.2, spawnSafe: 5,   // враги появляются не ближе spawnPad к стенам и не ближе spawnSafe ко входу, м
    list: [
      { id: 'cellar_cooper', name: 'Погреб Бондаря', at: { x: -19.5, z: 19.6 }, back: { x: -17.2, z: 19.6 }, depth: .25, danger: 1,
        rooms: [{ id: 'main', x: 0, z: 0, w: 9, d: 7 }, { id: 'pass', x: 5.5, z: 0, w: 2, d: 2 }, { id: 'store', x: 9, z: 0, w: 5, d: 5 }],
        doors: [{ a: 'pass', b: 'store' }],
        foes: [['hound', 2], ['ghoul', 1]], spawns: [{ room: 'store', n: 2 }, { room: 'main', n: 1, type: 'hound' }],
        entry: { x: -1.5, z: 0 }, exit: { x: -3.6, z: 0 },
        chests: [{ kind: 'barrel', x: 3.4, z: -2.4 }, { kind: 'crate', x: 10.2, z: 1.5 }, { kind: 'sack', x: 10.2, z: -1.5 }] },
      { id: 'crypt_pogost', name: 'Склеп Погоста', hidden: true, at: { x: -30, z: -12 }, back: { x: -28, z: -12 }, depth: .7, danger: 2,
        rooms: [
          { id: 'hall', x: 0, z: 0, w: 8, d: 6 },
          { id: 'c1', x: 8, z: 0, w: 8, d: 2 }, { id: 'nave', x: 17, z: 0, w: 10, d: 10 },
          { id: 'c2', x: 17, z: -9, w: 2, d: 8 }, { id: 'tombs', x: 17, z: -17, w: 10, d: 8 },
          { id: 'c3', x: 17, z: 8, w: 2, d: 6 }, { id: 'ossuary', x: 17, z: 14, w: 8, d: 6 },
          { id: 'c4', x: 25, z: -17, w: 6, d: 2 }, { id: 'vault', x: 32, z: -17, w: 8, d: 8 }
        ],
        doors: [{ a: 'c2', b: 'tombs' }, { a: 'c4', b: 'vault' }],
        foes: [['ghoul', 4], ['witch', 1], ['imp', 1]],
        spawns: [{ room: 'c1', n: 1 }, { room: 'nave', n: 3 }, { room: 'tombs', n: 3 }, { room: 'ossuary', n: 2 }, { room: 'vault', n: 2 }],
        entry: { x: -.5, z: 0 }, exit: { x: -3, z: 0 },
        chests: [{ kind: 'grave', x: 13.5, z: -19.5 }, { kind: 'grave', x: 15, z: 15.5 }, { kind: 'corpse', x: 19.5, z: 12.5 }, { kind: 'altar', x: 34.5, z: -17 }, { kind: 'coffer', x: 32, z: -19.8 }] }
    ]
  },
  squad: {
    baseMax: 1, perLevels: 8, cap: 4, follow: 2.8, leash: 30, sight: 13, regen: 1.2, fireRegen: 7, xpShare: .5,
    types: {
      guard:   { name: 'Стражник', hp: 130, dmg: 18,  speed: 4.8, range: 1.9, wind: .32, recover: .5,  cost: 140, tint: '#4a5a78', text: 'Быстрый и недорогой. Копьё.' },
      soldier: { name: 'Ратник',   hp: 240, dmg: 28, speed: 4.5, range: 2.1, wind: .36, recover: .55, cost: 380, tint: '#7a3a30', text: 'Меч и щит. Держит удар.' },
      veteran: { name: 'Ветеран',  hp: 400, dmg: 42, speed: 4.5, range: 2.5, wind: .4,  recover: .6,  cost: 950, tint: '#2e2e34', text: 'Двуручный меч. Дорог, но страшен.' }
    }
  },
  smith: { max: 5, base: 10, costK: .45, pow: 1.35, bonus: .1, reach: 3.4 },   // улучшение +1…+5: цена = base + цена вещи × costK × (ур+1)^pow, каждый уровень даёт +bonus к статам
  level: { max: 30, base: 28, pow: 1.3, hpPer: 4, dmgPer: .4, healOnUp: .3 },   // опыт до следующего уровня = base × ур^pow; за уровень: +hpPer здоровья, +dmgPer урона, +1 очко навыка
  // сложность. hp/dmg — множители врагов (и боссов), count — добавка к числу врагов, hear — слух врагов, luck — к удаче,
  // xp — опыт, buy — цены торговца, boss — множитель времени возрождения боссов, death — штраф: ash — доля теряемого пепла (остаётся «могила»), gear — теряется уровень улучшения у надетого
  // элитные враги: шанс = chance + глубина × depthK + опасность × dangerK (+ nightK ночью). hp/dmg/xp — множители, luck и lootRolls — добыча.
  elite: {
    chance: .04, depthK: .03, dangerK: .03, nightK: .03, hp: 1.9, dmg: 1.2, xp: 3, scale: 1.2, luck: 10, lootRolls: 2,
    affixes: {
      swift:     { name: 'Быстрый',       speed: 1.45, color: '#7ad0ff' },
      armored:   { name: 'Бронированный', hp: 1.6, color: '#c8c8d8' },
      vampiric:  { name: 'Кровопийца',    heal: .6, color: '#d03060' },
      explosive: { name: 'Взрывной',      r: 3.2, delay: .9, dmg: 38, color: '#ff9a30' },
      burning:   { name: 'Пылающий',      on: ['burn', .8, 3, 5], immune: ['burn'], color: '#ff6a20' }
    }
  },
  // сутки: len — секунд на полный круг; start — на какой фазе начинается игра (0.3 — полдень, 0.0 — рассвет);
  // contrast — резкость смены; nightBelow — при каком свете считаем ночью. night — что меняется ночью.
  daynight: {
    len: 480, start: .22, contrast: .75, nightBelow: .22,
    night: { count: 2, dmg: 1.15, xp: 1.25, luck: 8 },         // врагов больше и злее, опыта и удачи больше; торговец спит
    sky: {
      day:   { fog: '#3a2820', hemiSky: '#c8a890', hemiGround: '#3a2a22', hemiI: 2.8, sun: '#ffc890', sunI: 2.0, dome: '#ffffff' },
      night: { fog: '#0a0608', hemiSky: '#5a5a8a', hemiGround: '#140c14', hemiI: 1.4, sun: '#7a8ac8', sunI: .55, dome: '#38384a' }
    }
  },
  audio: { volume: .7 },
  difficulty: {
    default: 'berserk',
    levels: {
      wanderer: { name: 'Странник', text: 'Враги слабее, потерь при смерти нет. Для знакомства с миром.', hp: .7, dmg: .7, count: -1, hear: .8, luck: 6, xp: 1.25, buy: .9, boss: 1.5, death: { ash: 0, tomb: false, gear: false } },
      berserk:  { name: 'Берсерк', text: 'Как задумано. При смерти теряется четверть пепла, он лежит на месте гибели.', hp: 1, dmg: 1, count: 0, hear: 1, luck: 0, xp: 1, buy: 1, boss: 1, death: { ash: .25, tomb: true, gear: false } },
      ashen:    { name: 'Пепельный', text: 'Враги крепче и злее, слышат дальше. Теряется половина пепла.', hp: 1.3, dmg: 1.3, count: 2, hear: 1.15, luck: 4, xp: 1.3, buy: 1.15, boss: .8, death: { ash: .5, tomb: true, gear: false } },
      eclipse:  { name: 'Затмение', text: 'Беспощадно. Теряется 75% пепла, а у надетого сгорает по уровню улучшения.', hp: 1.7, dmg: 1.7, count: 4, hear: 1.3, luck: 10, xp: 1.6, buy: 1.3, boss: .6, death: { ash: .75, tomb: true, gear: true } }
    }
  },
  respecBase: 40,       // сброс навыков стоит respecBase × уровень пепла
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
    radius: .5,
    fire: { radius: 5, perSec: 7, calm: 3 }   // у костра лечит, если последние calm секунд не дрались и не получали урон
  },

  enemies: {
    count: 6,             // сколько врагов держим на поле
    respawn: 1.6,         // пауза до появления нового
    ring: [14, 19],       // на каком расстоянии от героя появляются
    brutePart: .3,        // доля рогачей среди врагов
    imp:   { name: 'Бес', xp: 14, hp: 126, speed: 3.4, damage: 11,  range: 1.5, wind: .45, recover: .75, radius: .45, scale: 1 },
    brute: { name: 'Рогач', xp: 45, hp: 390, speed: 2.2, damage: 28, range: 2.1, wind: .7,  recover: 1.0, radius: .8,  scale: 1.6 },
    hound: { name: 'Гончая', on: ['bleed', .6, 2.5, 4], xp: 10, hp: 90, speed: 5.6, damage: 10,  range: 1.3, wind: .28, recover: .55, radius: .4,  scale: .85 },   // быстрая, хрупкая; рыщет у руин и лагеря
    ghoul: { name: 'Упырь', on: ['poison', .7, 2, 6], xp: 33, hp: 270, speed: 2.8, damage: 20, range: 1.8, wind: .55, recover: .9,  radius: .55, scale: 1.2 },   // упырь: у кладбища и в часовне
    // дальний бой: ranged.keep — на каком расстоянии держится от героя; стрела летит со speed, колдовство накрывает пятно r через delay секунд
    archer: { name: 'Лучник Ржавых', xp: 22, hp: 150, speed: 3.2, damage: 14, range: 13, wind: .9, recover: 1.3, radius: .45, scale: 1, ranged: { kind: 'arrow', speed: 14, keep: [6, 10] } },
    witch: { name: 'Колдун Затмения', xp: 38, hp: 200, speed: 2.8, damage: 26, range: 14, wind: 1.1, recover: 2.4, radius: .5, scale: 1.05, on: ['burn', .5, 3, 5], ranged: { kind: 'hex', r: 2.4, delay: 1.0, keep: [7, 11] } },
    // кто водится в области (по ближайшей зоне карты); остальное — бесы и рогачи по brutePart
    regions: {
      graveyard: [['ghoul', 6], ['imp', 2], ['brute', 1], ['witch', 1]],
      ruins: [['hound', 4], ['brute', 3], ['imp', 2], ['witch', 2]],
      camp: [['hound', 3], ['brute', 4], ['imp', 2], ['archer', 4]],
      farm: [['hound', 3], ['imp', 4], ['ghoul', 1], ['archer', 2]]
    },
    depthHp: 1.6,          // враги вдали от костра крепче: здоровье × (1 + depthHp × глубина), глубина 0 у костра, 1 у границы
    depthDmg: 1.0,         // и бьют сильнее: урон × (1 + depthDmg × глубина)
    dangerHp: .35,        // опасная зона: здоровье × (1 + dangerHp × уровень опасности)
    dangerDmg: .25,       // урон ×(1 + dangerDmg × уровень)
    dangerCount: 1.2,     // в опасной зоне держим на (уровень × dangerCount) врагов больше
    dangerXp: .25,        // опыт ×(1 + dangerXp × уровень)
    dangerLoot: .6,       // качество добычи контейнеров в зоне: + уровень × dangerLoot
    // боссы: свои типы врагов (в bosses лежат логово, атаки, фазы). heavy: не сбиваются ударом, отбрасываются слабо
    devourer: { boss: true, name: 'Пожиратель Погоста', xp: 700,  hp: 6500, speed: 2.7, damage: 44, range: 3.2, wind: .6, recover: .9, radius: 1.5, scale: 2.5, heavy: true, immune: ['stun'], on: ['poison', .8, 3, 6] },
    lord:     { boss: true, name: 'Слуга Затмения',     xp: 1000, hp: 8500, speed: 4.4, damage: 52, range: 2.8, wind: .6, recover: .8, radius: 1.2, scale: 2.1, heavy: true, immune: ['stun', 'freeze'], on: ['burn', .6, 4, 4] },
    chief:    { boss: true, name: 'Вожак Ржавых',       xp: 1400, hp: 11500, speed: 3.2, damage: 62, range: 3.4, wind: .7, recover: .9, radius: 1.7, scale: 2.7, heavy: true, immune: ['stun'], on: ['bleed', .8, 4, 5] },
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
  { path: 'enemies.brute.hp', label: 'Здоровье рогача', min: 10, max: 300, step: 5 },
  { path: 'audio.volume', label: 'Громкость', min: 0, max: 1, step: .05 },
  { path: 'daynight.len', label: 'Длина суток', min: 120, max: 1200, step: 30, unit: ' с' }
];

export const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
export const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
