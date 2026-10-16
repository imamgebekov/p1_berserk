// Все числа 3D-прототипа — здесь. Единицы: метры (условно), секунды, градусы.
// Панель ⚙ в игре меняет часть этих чисел на лету (список — TWEAKS внизу) и умеет скопировать их текстом.

import { expandWorld } from './worldgen3d.js';

const BASE = {
  view: {
    desk: { baseH: 760, zoomMax: 1.6 },   // компьютер: интерфейс крупнее на высоком окне (масштаб = высота / baseH, но не больше zoomMax)
    pixelScale: 3,        // размер «пикселя» в экранных пикселях: больше — грубее и быстрее
    // фильтр «ASCII» (E1): клетка символа в экранных точках, шрифт, сцена в sub×sub текселей на клетку, ступеней плотности;
    // dpr — предел плотности холста (Retina ×2), gain [ночь, день]/gamma — яркость → плотность, dither — узор Байера между ступенями (0 — нет, 1 — полный), glow — свечение ярких, flicker — доля мерцающих клеток;
    // lo — темнее этого пусто (чёрный фон), edge — перепад яркости для штриха контура, lamp — свет над героем [сила, радиус м];
    // grass/water — во сколько раз зелёный/синий сильнее красного, чтобы клетка стала травой/водой
    ascii: { cell: [6, 10], font: 9, dpr: 2, sub: 2, levels: 12, gain: [2.8, 1.8], gamma: .8, dither: .3, lo: .16, edge: .32, lamp: [14, 10], glow: .25, flicker: .012, grass: 1.03, water: 1.15, bg: '#06070b' },
    fov: 48,              // угол обзора камеры
    camPitch: 58,         // наклон камеры вниз: 90 — строго сверху, 30 — почти горизонтально
    camDist: 19,          // расстояние камеры до героя
    camLookUp: 1.0,       // на какую высоту над землёй смотрит камера
    camYaw: 38,           // поворот камеры вокруг героя: 0 — прямо, 45 — «изометрия» как в Project Zomboid
    camFollow: 7,         // «пружинность» слежения (больше — жёстче)
    fogDensity: .022      // плотность тумана
  },

  world: {
    radius: 600,          // граница мира (круг); ядро — worldgen.coreR
    props: 150,            // деревьев и камней в ядре (в большом мире генератор держит ту же плотность)
    seed: 7,
    gen: 2,               // номер мира: другой номер в сохранении — герой встаёт в лагерь, туман и таймеры боссов сбрасываются
    // глубина (опасность) от костра: точки [расстояние, глубина], между ними — прямая, дальше последней — её глубина.
    // В ядре — прямая до 1 у его границы (как раньше); в большом мире генератор дописывает [край, depthMax]
    depth: [[0, 0], [85, 1]]
  },
  // большой мир (C3b): пояс от coreR до края — пять биомов секторами (turn — поворот, wobble — волна границы, belt — ширина
  // перехода от ядра), посёлки (villages, не ближе villageGap м), опасные места (dangers, по видам биома), ориентиры
  // (landmarks), река продлевается шагом riverStep м; depthMax — глубина у края; ground — цвет земли биома; trees — плотность
  // деревьев и камней (×), доля деревьев, доля сухих деревьев
  worldgen: { on: true, coreR: 85, belt: 30, turn: .07, wobble: .035, villages: 10, villageGap: 85, dangers: 16, dangerGap: 55, landmarks: 22, riverStep: 6, depthMax: 2,
    plateaus: { n: 7, r: [14, 26], h: 3.5, rw: .2, len: 9 },
    // замки (C4): вход в кольце r м от костра, этажей floors; foes — кто живёт в залах; depth и danger — по этажам
    castles: [
      { id: 'castle_ash', name: 'Пепельная Твердыня', keyName: 'Ключ Твердыни', r: [260, 380], floors: 3, foes: [['brute', 4], ['shield', 2], ['archer', 2], ['imp', 2]], chests: ['crate', 'chest', 'rack', 'armorstand'], depth: [1.3, 1.45, 1.6], danger: [2, 3, 3] },
      { id: 'castle_waste', name: 'Чертог Пустоши', keyName: 'Ключ Чертога', r: [400, 520], floors: 3, foes: [['ghoul', 4], ['witch', 2], ['shade', 2], ['lunger', 2]], chests: ['crate', 'coffer', 'shelf', 'medchest'], depth: [1.55, 1.7, 1.85], danger: [2, 3, 3] }
    ],     // плато с обрывами в горах (C3c): радиус, высота, ширина въезда (рад), длина спуска
    dangerTypes: { forest: ['camp', 'ruins'], swamp: ['graveyard', 'graveyard', 'ruins'], mountains: ['ruins', 'camp'], waste: ['ruins', 'graveyard', 'farm'], coast: ['camp', 'farm'] },
    landmarkTypes: { forest: ['tower', 'mill'], swamp: ['tower', 'fort'], mountains: ['fort', 'tower'], waste: ['fort', 'mill'], coast: ['tower', 'mill'] },
    ground: { forest: '#2c4a20', swamp: '#38422a', mountains: '#5e5e54', waste: '#7a6640', coast: '#b8a46c' },     // цвет земли биома (sRGB)
    grass: { forest: 1.2, swamp: .9, mountains: .35, waste: .3, coast: .25 },      // доля травы по биому (×)
    trees: { forest: [2.2, .85, .05], swamp: [1.1, .8, .8], mountains: [.7, .3, .3], waste: [.45, .55, .75], coast: [.5, .6, .2] } },
  // рельеф (C2). river — русло: дуга от края до края (a1 — угол входа, da — на сколько градусов дальше выход, bend — изгиб, м;
  // n — участков ломаной, w — ширина воды, out — насколько концы за краем мира). Подобрано перебором: обходит лагерь, дома, посёлки,
  // логова, входы в подземелья и сундуки с запасом ~9 м. bridges — где мосты (доля пути по руслу), bridge — ширина и заход на берег.
  terrain: {
    on: true, river: { a1: 150, da: 60, bend: -30, n: 24, w: 4.5, out: 6 }, bridges: [.33, .67], bridge: { w: 3.2, over: 1.6, deck: .3, arch: 1.1 },     // arch — подъём дуги к середине моста (F4)
    // холмы (только вид): amp — перепад, м; scale — размер холма, м; oct — октав шума; cell — шаг сетки высот, м; blend — переход от ровного места, м;
    // bank — ширина берега, где земля уходит к руслу; bed — глубина русла под водой, м
    hills: { amp: 1.4, scale: 18, oct: 2, cell: 1, blend: 6 }, bank: 2, bed: -.8, water: -.25
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
      { x: 13,  z: -10, w: 7,  d: 6, door: 'w', kind: 'smithy',    chests: ['coffer', 'crate'], npc: 'smith' },      // кузнец переехал в лагерь
      { x: -4,  z: -20, w: 9,  d: 6, door: 's', kind: 'house',     chests: ['ironchest', 'rack', 'barrel'] },
      { x: 20,  z: 6,   w: 6,  d: 7, door: 'w', kind: 'barracks',  chests: ['sack', 'chest'], npc: 'captain' },     // и капитан
      { x: -18, z: 14,  w: 7,  d: 7, door: 'e', kind: 'house',     chests: ['locked', 'shelf'] },
      { x: 6,   z: 24,  w: 8,  d: 6, door: 'n', kind: 'house',     chests: ['medchest', 'crate', 'barrel'] },
      { x: -8,  z: 9,   w: 7,  d: 6, door: 'e', kind: 'shop',      chests: ['crate', 'coffer'], npc: 'merchant' },
      { x: -28, z: 30,  w: 9,  d: 7, door: 'n', kind: 'smithy',    chests: ['smithchest', 'smithchest', 'rack', 'ironchest'] },     // старая кузница
      { x: 28,  z: -26, w: 12, d: 8, door: 'w', kind: 'tavern',    chests: ['barrel', 'barrel', 'crate', 'chest'] },
      { x: -34, z: -20, w: 7,  d: 11, door: 's', kind: 'chapel',   chests: ['altar', 'shelf', 'coffer'] },
      { x: 48,  z: 8,   w: 11, d: 7, door: 'w', kind: 'barracks',  chests: ['rack', 'rack', 'armorstand', 'ironchest'] },     // старая застава
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

  // сказочный торговец: повозка у дороги вне лагеря. first/every — через сколько секунд появляется (от–до), stay — сколько стоит,
  // linger — не уезжает, пока герой ближе; dist — на каком расстоянии от героя; side — отступ от дороги; campPad — отступ от частокола;
  // priceMul — наценка; fairy — сколько видов сказочных товаров; gear — сколько сильных вещей (от–до); uniqueChance — шанс именной вещи;
  // retry — повторная попытка, если сейчас поставить некуда (герой в подземелье, мёртв, нет места)
  wanderer: { on: true, first: [240, 480], every: [480, 960], stay: 180, linger: 8, dist: [25, 70], side: 3, campPad: 6, r: 1.6, priceMul: 1.6, fairy: 3, gear: [2, 3], uniqueChance: .15, reach: 3.4, retry: 30 },
  // случайные события (одно за раз): first/every — когда (от–до, с); retry — повтор, если не к месту; kinds — веса видов.
  // taken — доля урона, которую получают путник и обоз.
  // rescue: путник в беде вне любых мест (dist от героя); враги появляются, когда герой ближе wake; wait/time — сколько ждёт и сколько длится бой.
  // ambush: только на дороге (road — ширина) вне лагеря и безопасных мест; враги в r м впереди и с боков; flee — убежал дальше (или в лагерь) — засада кончилась.
  // caravan: обоз ждёт за воротами, трогается, когда герой ближе start; едет, пока герой ближе follow; waves — доли пути с налётами (ahead м впереди).
  // foes: враги по видам событий: n — [основа, + за глубину]; reward — пепел (от–до × (1 + глубина)), сундук box и бафф.
  events: {
    on: true, first: [300, 540], every: [420, 780], retry: 30, kinds: { rescue: 3, ambush: 3, caravan: 2 },
    rescue: { name: 'Путник', hp: 300, taken: .4, dmg: 8, range: 1.9, cd: 1.2, dist: [30, 60], side: 4, campPad: 8, r: 1, wake: 18, wait: 240, time: 150, thanks: 4 },
    ambush: { road: 3, campPad: 10, r: [7, 11], flee: 45, time: 120 },
    caravan: { name: 'Обоз', hp: 420, taken: .6, r: 1.2, speed: 2.1, follow: 13, start: 5, arrive: 4, waves: [.3, .65], ahead: 9, wait: 300, time: 240, minLen: 14 },
    foes: {
      rescue: { n: [3, 2], types: [['imp', 3], ['hound', 3], ['brute', 1], ['ghoul', 1]] },
      ambush: { n: [3, 2], types: [['brute', 2], ['hound', 3], ['archer', 2], ['imp', 2]] },
      caravan: { n: [2, 2], types: [['hound', 3], ['imp', 2], ['brute', 2]] }
    },
    reward: {
      rescue: { ash: [30, 60], box: 'chest', buff: { stat: 'luck', amt: 15, t: 300 } },
      ambush: { ash: [20, 40], box: 'chest' },
      caravan: { ash: [60, 110], box: 'ironchest' }
    }
  },
  // мелкое оживление (только вид): villagers — жителей в лагере, walk — их скорость, pause — сколько стоят у точки (от–до), fireGap — не ближе к костру;
  // birds — ворон вне лагеря, scare — с какого расстояния взлетают, flySpeed/flyUp/flyTime — полёт, back — через сколько вернутся;
  // smokeKinds — дома с дымом из трубы (и все дома с жителем), chimneyH — высота трубы над стеной, smoke — клубов на трубу;
  // fogPeak — фаза суток самого густого тумана (рассвет), fogWidth — ширина утра в долях суток, fogAmp — насколько гуще (×(1 + fogAmp))
  ambient: { on: true, villagers: 5, walk: 1.3, pause: [3, 9], fireGap: 3.2, birds: 12, scare: 6, flySpeed: 7, flyUp: 3.5, flyTime: 4, back: 45, smokeKinds: ['house', 'tavern', 'smithy'], chimneyH: 1.4, smoke: 6, fogPeak: .04, fogWidth: .1, fogAmp: 1.4 },
  // стрельба героя (луки и арбалеты): assist — наводка на врага в конусе ±assist° перед героем; заряд (тяжёлый удар) даёт
  // дальность ×(1 + chargeRange × заряд) и скорость стрелы ×(1 + chargeSpeed × заряд); hitR — запас попадания, м; spawn — откуда вылетает
  shoot: { assist: 25, chargeRange: .5, chargeSpeed: .4, hitR: .25, spawn: .8, stun: .5 },
  // активные умения (B3): ranks[i] — уровни, на которых умение слота i получает ранги 1, 2, 3…: сначала открыть, потом качать.
  // Очко умения даётся на каждом из этих уровней (всего 21), вложить его раньше нужного уровня нельзя. Финальное умение (30-й) —
  // один ранг сразу в полную силу. respec — пепла за уровень героя при сбросе умений. Списки из 5 чисел ниже — сила рангов 1–5
  // (у финального берётся последнее). cd — перезарядка, с; mul — множитель урона удара.
  abilities: {
    ranks: [[3, 5, 7, 9, 11], [8, 10, 12, 14, 16], [15, 17, 19, 21, 23], [25, 26, 27, 28, 29], [30]], respec: 12, fearSpeed: .9,
    thorn: {
      charge: { cd: [9, 8.5, 8, 7.5, 7], dist: 6, stop: .9, time: .28, width: 1.7, mul: [1.2, 1.4, 1.6, 1.8, 2], knock: 2.4 },   // рывок с размаха (stop — останавливается в стольких м от цели)
      cry:    { cd: [22, 21, 20, 19, 18], r: 7, fear: [3, 3.5, 4, 4.5, 5], armor: [6, 8, 10, 12, 14], t: 8 },               // боевой клич
      whirl:  { cd: [12, 11, 10, 9, 8], r: 3.4, mul: [1.5, 1.8, 2.1, 2.4, 2.7], knock: 1.6 },                                  // вихрь
      iron:   { cd: [40, 38, 36, 34, 32], t: [5, 6, 7, 8, 9], taken: .5 },                                                     // несокрушимость
      rage:   { cd: [60, 57, 54, 51, 48], t: [8, 9, 10, 11, 12], dmg: [30, 40, 50, 60, 70], swing: .8, drain: 2 }              // ярость берсерка (dmg — %)
    },
    // Сойка: стрелы умений летят как из её лука (без лука — как из короткого); spread — веер, °; trap — капкан (корни, урон, живёт life с,
    // не больше max сразу, ставится ahead м впереди); venom — яд dps × t с, пробивает pierce врагов; rain — град: круг r м, t с, удар каждые tick с
    jay: {
      leap:   { cd: [8, 7.5, 7, 6.5, 6], dist: 4.5, time: .22, mul: [1.2, 1.4, 1.6, 1.8, 2], range: 12 },                         // отскок с выстрелом
      volley: { cd: [10, 9.5, 9, 8.5, 8], n: 5, spread: 60, mul: [.6, .7, .8, .9, 1] },                                           // залп веером
      trap:   { cd: [14, 13, 12, 11, 10], r: 1, root: [2, 2.5, 3, 3.5, 4], mul: [1, 1.2, 1.4, 1.6, 1.8], life: 30, max: 2, ahead: 1.5 }, // капкан
      venom:  { cd: [12, 11, 10, 9, 8], mul: [1.2, 1.4, 1.6, 1.8, 2], dps: [6, 8, 10, 12, 14], t: 6, pierce: 2 },                 // ядовитая стрела
      rain:   { cd: [40, 37, 35, 32, 30], r: 3.5, t: 3, tick: .3, mul: [.35, .45, .55, .65, .75], range: 14, ahead: 8 }         // град стрел
    },
    // Вейл: blink — к врагу в range м и конусе ±cone°, встаёт за спиной в behind м; parry — t с ловит любой удар (оглушает бьющего, ответ ×mul);
    // dance — hits ударов за t с по врагам в r м; shadow — тень-двойник t с: враги бьют её, она бьёт ближнего раз в hit с;
    // execute — удар ×mul × (1 + доля потерянного здоровья цели), не-босса ниже kill доли здоровья добивает
    vale: {
      blink:   { cd: [8, 7.5, 7, 6.5, 6], range: 8, cone: 70, behind: 1.2, mul: [1.4, 1.6, 1.8, 2, 2.2] },                       // выпад-телепорт
      parry:   { cd: [10, 9, 8.5, 8, 7], t: [.5, .6, .7, .8, .9], stun: [1, 1.25, 1.5, 1.75, 2], mul: [1, 1.25, 1.5, 1.75, 2] },  // парирование
      dance:   { cd: [14, 13, 12, 11, 10], t: 1.2, hits: 6, r: 3, mul: [.6, .7, .8, .9, 1] },                                    // танец клинков
      shadow:  { cd: [30, 28, 26, 24, 22], t: [6, 7, 8, 9, 10], hp: [120, 150, 180, 210, 240], hit: .8, r: 1.8, mul: [.4, .5, .6, .7, .8] }, // тень-двойник
      execute: { cd: [20, 19, 18, 16, 15], reach: 2.6, cone: 50, mul: [2, 2.25, 2.5, 2.75, 3], kill: [.2, .22, .25, .28, .3] }   // смертельный удар
    }
  },
  // вторая рука (B2b): block.arc — ширина щита спереди, °; block.knock — доля отброса при блоке; dual.mul — доля урона второго клинка
  // к каждому удару, dual.swing — удары с двумя клинками быстрее (×)
  block: { arc: 120, knock: .4 }, dual: { mul: .8, swing: .92 },
  // герои (B1): множители здоровья и скорости бега, прибавка к криту (%). У Торна всё как раньше — бой и баланс прежние
  heroes: { thorn: { hp: 1, speed: 1, crit: 0 }, vale: { hp: .95, speed: 1.1, crit: 6 }, jay: { hp: 1, speed: 1.05, crit: 0 } },
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
  // закрытый лагерь: частокол по кругу (центр x, z, радиус r) вокруг места place; gates — ворота (угол, град: 0 — юг +z, 90 — восток +x, 180 — север, 270 — запад).
  // Внутри не рождаются враги; ворота для врагов закрыты (полоса глубиной foeDepth), для героя и отряда открыты. Нет места place в map.places — нет и лагеря (тесты чистого боя)
  // тропы (F1): дороги за лагерем — кривые с изгибом bend м и малой волной wave, точки каждые step м; короче minLen — прямые
  paths: { on: true, bend: [2, 4.5], wave: 1.6, step: 2, minLen: 12 },
  camp: { place: 'brod', x: 0, z: 2, r: 30, wall: .7, step: .8, h: 2.4, gates: [0, 90, 180, 270], gateW: 5, foeDepth: 2.5, spawnPad: 3, roadOut: 7 },     // roadOut — на сколько дорога выходит из ворот прямо, м
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
    // ключи подземелий: лежат в сундуках (chests[].key), висят на связке (не в сумке, не теряются), открывают двери с lock
    keys: { cellar_cooper: 'Ключ Бондаря', crypt_iron: 'Железный ключ Склепа', crypt_bone: 'Костяной ключ Склепа' },
    hearRooms: 2,         // враг слышит героя, только если между ними не больше стольких проходов (иначе сбегается всё подземелье)
    respawnAway: 300,     // через сколько секунд отсутствия подземелье снова наполняется врагами
    spawnPad: 1.2, spawnSafe: 5,   // враги появляются не ближе spawnPad к стенам и не ближе spawnSafe ко входу, м
    list: [
      { id: 'cellar_cooper', name: 'Погреб Бондаря', at: { x: -19.5, z: 19.6 }, back: { x: -17.2, z: 19.6 }, depth: .25, danger: 1,
        rooms: [{ id: 'main', x: 0, z: 0, w: 9, d: 7 }, { id: 'pass', x: 5.5, z: 0, w: 2, d: 2 }, { id: 'store', x: 9, z: 0, w: 5, d: 5 }],
        doors: [{ a: 'pass', b: 'store', lock: 'cellar_cooper' }],
        foes: [['hound', 2], ['ghoul', 1]], spawns: [{ room: 'store', n: 2 }, { room: 'main', n: 1, type: 'hound' }],
        entry: { x: -1.5, z: 0 }, exit: { x: -3.6, z: 0 },
        chests: [{ kind: 'barrel', x: 3.4, z: -2.4, key: 'cellar_cooper' }, { kind: 'crate', x: 10.2, z: 1.5 }, { kind: 'sack', x: 10.2, z: -1.5 }] },
      { id: 'crypt_pogost', name: 'Склеп Погоста', hidden: true, at: { x: -30, z: -12 }, back: { x: -28, z: -12 }, depth: .7, danger: 2,
        rooms: [
          { id: 'hall', x: 0, z: 0, w: 8, d: 6 },
          { id: 'c1', x: 8, z: 0, w: 8, d: 2 }, { id: 'nave', x: 17, z: 0, w: 10, d: 10 },
          { id: 'c2', x: 17, z: -9, w: 2, d: 8 }, { id: 'tombs', x: 17, z: -17, w: 10, d: 8 },
          { id: 'c3', x: 17, z: 8, w: 2, d: 6 }, { id: 'ossuary', x: 17, z: 14, w: 8, d: 6 },
          { id: 'c4', x: 25, z: -17, w: 6, d: 2 }, { id: 'vault', x: 32, z: -17, w: 8, d: 8 }
        ],
        doors: [{ a: 'c2', b: 'tombs', lock: 'crypt_iron' }, { a: 'c4', b: 'vault', lock: 'crypt_bone' }],
        foes: [['ghoul', 4], ['witch', 1], ['imp', 1], ['lunger', 1], ['shade', 1]],
        spawns: [{ room: 'c1', n: 1 }, { room: 'nave', n: 3 }, { room: 'tombs', n: 3 }, { room: 'ossuary', n: 2 }, { room: 'vault', n: 2 }],
        entry: { x: -.5, z: 0 }, exit: { x: -3, z: 0 },
        chests: [{ kind: 'grave', x: 13.5, z: -19.5, key: 'crypt_bone' }, { kind: 'grave', x: 15, z: 15.5, key: 'crypt_iron' }, { kind: 'corpse', x: 19.5, z: 12.5 }, { kind: 'altar', x: 34.5, z: -17 }, { kind: 'coffer', x: 32, z: -19.8 }] }
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
      swift:     { name: 'Быстрый',       nameF: 'Быстрая',       speed: 1.45, color: '#7ad0ff' },
      armored:   { name: 'Бронированный', nameF: 'Бронированная', hp: 1.6, color: '#c8c8d8' },
      vampiric:  { name: 'Кровопийца',    nameF: 'Кровопийца',    heal: .6, color: '#d03060' },
      explosive: { name: 'Взрывной',      nameF: 'Взрывная',      r: 3.2, delay: .9, dmg: 38, color: '#ff9a30' },
      burning:   { name: 'Пылающий',      nameF: 'Пылающая',      on: ['burn', .8, 3, 5], immune: ['burn'], color: '#ff6a20' }
    }
  },
  // сутки: len — секунд на полный круг; start — на какой фазе начинается игра (0.3 — полдень, 0.0 — рассвет);
  // contrast — резкость смены; nightBelow — при каком свете считаем ночью. night — что меняется ночью.
  daynight: {
    len: 480, start: .22, contrast: .75, nightBelow: .22,
    night: { count: 2, dmg: 1.15, xp: 1.25, luck: 8 },         // врагов больше и злее, опыта и удачи больше; торговец спит
    sky: {
      day:   { fog: '#6c7a66', hemiSky: '#e6eedc', hemiGround: '#3e4e2c', hemiI: 3.0, sun: '#fff0d0', sunI: 2.3, dome: '#ffffff' },     // E2: светлее и зеленее
      night: { fog: '#0b1016', hemiSky: '#6a7aa8', hemiGround: '#141a16', hemiI: 1.5, sun: '#8a9ad8', sunI: .6, dome: '#3a4258' }
    }
  },
  // палитра поверхности (E2): трава вместо пепла, деревья с кронами (bare — доля сухих), камни, небо (верх и горизонт)
  look: {
    ground: ['#2c4222', '#35502a', '#4c6c34'], sand: '#a08e5e',
    trunk: ['#3a2a1c', '#4a3524'], leaf: ['#2e5a28', '#3a6a2e', '#4a7a36'], bare: .2,
    rock: ['#5e5c54', '#6c6a60'], skyTop: '#2e4a6a', skyHor: '#c8c098'
  },
  // свет сквозь облака (E2): пятна света размером size м плывут по ветру (м/с); k — сила днём и ночью; столбы света над
  // самыми яркими пятнами в r м от героя (n штук, высота h, ширина w, наклон tilt к солнцу, прозрачность op); motes — пылинок в секунду на столб
  sunlight: { on: true, size: 70, wind: [.6, .25], day: '#c8e68c', night: '#a8d0b8', dayK: .2, nightK: .12,
    shafts: { n: 4, r: 28, step: 4, min: .75, gap: 9, h: 14, w: 5, tilt: .35, op: .16 }, motes: 3 },
  // ветер (F2): сила от calm (тишь) до breeze (ветерок) меняется за period с, порывы (+gust) — в доле gustShare времени,
  // направление dirDeg ± dirWander/2; качание крон (tree), дрожь листвы (leaf), травы (grass); трава — пучки с шагом step м,
  // заполнено fill, высота h; шелест — деревья в r м, full деревьев — полная громкость
  wind: { on: true, calm: .06, breeze: .55, gust: .45, gustShare: .3, period: 40, gustPeriod: 5, dirDeg: 235, dirWander: 40,
    sway: { tree: .35, leaf: .06, grass: .3 }, grass: { on: true, step: 1.6, fill: .7, h: .7 }, rustle: { r: 14, full: 8 } },
  // костры быстрого перемещения (C3d): открываются ближе open м, у костра (reach м) — список; нет встревоженных врагов в safeR м;
  // у опасного места костёр ставится на gate м снаружи со стороны лагеря
  fires: { on: true, open: 8, reach: 3.2, safeR: 18, gate: 5 },
  // объём слоями (F4): арки над изогнутыми тропами (пролёт span, высота h), деревья с кроной над
  // тропой (ствол в off м от середины тропы, крона тянется на reach м к тропе, высота h, примерно каждые every м); сквозное окно
  // у героя: радиус r (доля полувысоты экрана), cut — сколько точек выбрасывать в центре окна
  overhead: { on: true, arch: { span: 4.2, h: 3.4 }, canopy: { off: 2.6, reach: 1.9, h: 3.3, every: 9 }, xray: { on: true, r: .16, cut: .7 } },
  // погода (F3): виды [вес, мин. длина с, макс. длина с], переход ramp с; в дождь туман гуще (+fog), земля темнее (×wet),
  // капель drops (косо по ветру, падают со скоростью fall м/с в коробке box [ширина, высота] у камеры), всплесков splash в
  // секунду, кругов на воде ripples; force — для тестов ('clear' | 'cloudy' | 'rain'). На бой погода не влияет.
  weather: { on: true, kinds: { clear: [.55, 150, 360], cloudy: [.25, 80, 200], rain: [.2, 70, 160] }, ramp: 14, fog: .6, wet: .7,
    drops: 900, fall: 16, box: [34, 18], splash: 26, ripples: 24, force: null },
  // звук: громкость всего, музыки и природы; атмосфера (D1) — журчание у реки, птицы и сова, своя музыка «лесная сказка»
  audio: {
    volume: .7, musicVol: .55, natureVol: .8, voices: 24, look: 1.2,          // предел одновременных голосов; ноты ставятся вперёд на look с
    water: { near: 2, far: 25, vol: .09, plips: 6 },                     // полная громкость у берега, тишина дальше far м; бульков в секунду
    birds: { vol: .05, gap: [2, 7], day: [.45, .75], owlGap: [9, 20], owlVol: .05 },   // пауза между трелями, рассвет→день (свет)
    combat: { r: 16, n: 2, fade: 1.5 }, rustle: { vol: .06 }, rain: { vol: .08 },     // шелест листвы (F2), шум дождя (F3)             // шелест листвы (F2)                                   // встревоженных врагов в r м: n — полный бой; музыка и птицы стихают
    music: { vol: .12, rest: [30, 60], dayBpm: 84, nightBpm: 70, nightVol: .6, phrase: 8, form: 'AABA' }
  },
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
    // тяжёлый удар: держать кнопку — заряд, отпустить — удар; быстрые нажатия — серия обычных
    // buffer — сколько помнится нажатие во время удара, с; hold — через сколько удержания начинается заряд; min/full — минимальный и полный заряд, с;
    // mul — множитель урона при полном заряде; arc, reach — прибавка к дуге (град) и дальности (м); knock — множитель отбрасывания; stun — оглушение, с;
    // slow — доля скорости во время заряда; swing — во сколько раз дольше сам удар; lunge — множитель рывка; bufReach — запомненное нажатие бьёт, только если враг ближе дальности удара + bufReach, м
    heavy: { bufReach: .4, buffer: .2, hold: .3, min: .25, full: .9, mul: 3, arc: 50, reach: .6, knock: 2.2, stun: .6, slow: .35, swing: 1.35, lunge: 1.8 },
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
    sleep: { r: 80, drop: 110 },   // дальше r от героя враг «спит» (не обновляется и не считается в числе живых вокруг), дальше drop бродячий — забывается
    brutePart: .3,        // доля рогачей среди врагов
    imp:   { name: 'Бес', xp: 14, hp: 126, speed: 3.4, damage: 11,  range: 1.5, wind: .45, recover: .75, radius: .45, scale: 1 },
    brute: { name: 'Рогач', xp: 45, hp: 390, speed: 2.2, damage: 28, range: 2.1, wind: .7,  recover: 1.0, radius: .8,  scale: 1.6 },
    hound: { name: 'Гончая', g: 'f', on: ['bleed', .6, 2.5, 4], xp: 10, hp: 90, speed: 5.6, damage: 10,  range: 1.3, wind: .28, recover: .55, radius: .4,  scale: .85 },   // быстрая, хрупкая; рыщет у руин и лагеря
    ghoul: { name: 'Упырь', on: ['poison', .7, 2, 6], xp: 33, hp: 270, speed: 2.8, damage: 20, range: 1.8, wind: .55, recover: .9,  radius: .55, scale: 1.2 },   // упырь: у кладбища и в часовне
    // дальний бой: ranged.keep — на каком расстоянии держится от героя; стрела летит со speed, колдовство накрывает пятно r через delay секунд
    archer: { name: 'Лучник Ржавых', xp: 22, hp: 150, speed: 3.2, damage: 14, range: 13, wind: .9, recover: 1.3, radius: .45, scale: 1, ranged: { kind: 'arrow', speed: 14, keep: [6, 10] } },
    witch: { name: 'Колдун Затмения', xp: 38, hp: 200, speed: 2.8, damage: 26, range: 14, wind: 1.1, recover: 2.4, radius: .5, scale: 1.05, on: ['burn', .5, 3, 5], ranged: { kind: 'hex', r: 2.4, delay: 1.0, keep: [7, 11] } },
    // особое поведение (ai, 3d/src/foes3d.js); g — род имени ('f' — женский) для подписей элиты
    // shield: щит спереди (guard.arc — ширина, град; mul — сколько урона проходит; turn — скорость поворота, рад/с); пробивают фланг, удар из переката, тяжёлый удар, оглушение
    shield: { name: 'Щитоносец Ржавых', ai: 'shield', xp: 40, hp: 300, speed: 2.4, damage: 22, range: 1.9, wind: .65, recover: .9, radius: .6, scale: 1.3, guard: { arc: 110, mul: .15, turn: 2.2, breakStun: .9 } },
    // bomber: подбегает на fuse.at и поджигает фитиль: через fuse.t взрыв радиуса fuse.r (ранит героя, отряд и других врагов), сам гибнет
    bomber: { name: 'Тлеющий', ai: 'bomber', xp: 18, hp: 70, speed: 4.6, damage: 34, range: 1.6, wind: .4, recover: .6, radius: .45, scale: .95, fuse: { at: 2.2, t: 1.2, r: 2.8 }, on: ['burn', 1, 3, 4] },
    // lunge: с min–max целится aim секунд (полоса на земле), потом рывок по прямой len м со скоростью speed; w — ширина полосы; cd — перезарядка
    lunger: { name: 'Копейщик Погоста', ai: 'lunge', xp: 30, hp: 200, speed: 2.9, damage: 30, range: 1.8, wind: .6, recover: 1.1, radius: .5, scale: 1.15, lunge: { min: 4, max: 9, aim: .8, speed: 15, len: 8, w: .9, cd: 3.5, mul: 1.3 }, on: ['bleed', .5, 3, 4] },
    // blink: с min–max исчезает и появляется за спиной героя (behind м), замах после этого дольше на extra с; cd — перезарядка
    shade: { name: 'Тень', g: 'f', ai: 'blink', xp: 26, hp: 110, speed: 3.6, damage: 24, range: 1.5, wind: .75, recover: .8, radius: .45, scale: 1.05, blink: { min: 5, max: 12, cd: 5, behind: 1.7, extra: .3 }, immune: ['bleed', 'poison'] },
    // кто водится в области (по ближайшей зоне карты); третий элемент 'night' — только ночью; остальное — бесы и рогачи по brutePart
    regions: {
      graveyard: [['ghoul', 6], ['imp', 2], ['brute', 1], ['witch', 1], ['lunger', 2], ['shade', 3, 'night'], ['ghoul', 3, null, 'patrol'], ['lunger', 1, null, 'guard']],
      ruins: [['hound', 4], ['brute', 3], ['imp', 2], ['witch', 2], ['bomber', 2], ['brute', 2, null, 'guard'], ['witch', 1, null, 'guard']],
      camp: [['hound', 3], ['brute', 4], ['imp', 2], ['archer', 4], ['shield', 3], ['archer', 3, null, 'guard'], ['shield', 2, null, 'patrol'], ['brute', 2, null, 'patrol']],
      farm: [['hound', 3], ['imp', 4], ['ghoul', 1], ['archer', 2], ['bomber', 1], ['imp', 2, null, 'patrol']]
    },
    // кто бродит по биому большого мира вне областей (C3b)
    biomes: {
      forest: [['imp', 4], ['brute', 4], ['hound', 2]],                       // как вне областей ядра (бесы и рогачи) + приправа биома;
      swamp: [['imp', 3], ['brute', 3], ['ghoul', 3], ['shade', 1, 'night']],  // сложные смеси — в опасных местах, как в ядре
      mountains: [['brute', 5], ['imp', 3], ['shield', 1]],
      waste: [['imp', 5], ['brute', 3], ['bomber', 1]],
      coast: [['imp', 4], ['brute', 3], ['archer', 1], ['hound', 1]]
    },
    outerK: .6,            // за ядром большого мира (глубина > 1) крепость и урон растут медленнее: ×outerK на каждую единицу сверх 1
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
    hear: { idle: 10, run: 17, fight: 25, house: .55, lose: 32, drift: .3 },
    // сторожа и патрули (четвёртый элемент в таблице области: 'guard' — стоит у поста, 'patrol' — ходит по маршруту; без него — бродит, как раньше).
    // Видят конусом (angle, град; range, м; стена закрывает обзор), слышат только бой (fightHear — доля слуха боя); заметив — кричат: встают соседи в alarm м.
    // Отходят от поста не дальше leash м; потеряв героя — возвращаются. modes: false — все бродят (для сравнения боя с прошлыми версиями)
    posts: { modes: true, angle: 120, range: 15, fightHear: .7, alarm: 11, leash: 28, look: .8, patrolPts: 3, patrolR: 9, patrolSpeed: .4, home: .55 },   // drift: доля скорости, с которой «бредёт» неуслышавший
    knockDecay: 9
  },

  fx: {
    hitStop: .05,
    shake: .22
  }
};
// мир = ручное ядро + пояс по зерну (C3b): генератор дописывает места, области, дома, ориентиры, связи и продолжение реки
export const CFG3 = expandWorld(BASE);
// только ручное ядро (радиус coreR, без пояса): для тестов баланса, которые меряют ядро и сверяются со старыми цифрами
export const CORE3 = (() => { const c = JSON.parse(JSON.stringify(BASE)); c.world.radius = c.worldgen.coreR; c.worldgen.on = false; return c; })();

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
  { path: 'audio.musicVol', label: 'Музыка', min: 0, max: 1, step: .05 },
  { path: 'audio.natureVol', label: 'Природа', min: 0, max: 1, step: .05 },
  { path: 'daynight.len', label: 'Длина суток', min: 120, max: 1200, step: 30, unit: ' с' }
];

export const getPath = (o, p) => p.split('.').reduce((a, k) => a[k], o);
export const setPath = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
