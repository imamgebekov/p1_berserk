// Все числа 3D-прототипа — здесь. Единицы: метры (условно), секунды, градусы.
// Панель ⚙ в игре меняет часть этих чисел на лету (список — TWEAKS внизу) и умеет скопировать их текстом.

import { expandBig } from './worldgen3d.js';
import { stretchCore } from './coremap3d.js';

const BASE = {
  view: {
    cine: { dist: .38, pitch: 12, follow: 2.2, ease: 3, bias: .65 },     // «кинокамера» сцен (этап 5 «круче»): наезд (доля), наклон ниже на pitch°, плавность; bias — ближе к говорящему
    desk: { baseH: 760, zoomMax: 1.6 },   // компьютер: интерфейс крупнее на высоком окне (масштаб = высота / baseH, но не больше zoomMax)
    pixelScale: 3,        // вид «Ретро»: размер «пикселя» в экранных пикселях — больше грубее и быстрее
    // гладкий вид (шаг 2 аудита, по умолчанию): полное разрешение со сглаживанием, плотность холста не выше dprMax (компьютер / телефон),
    // мягкая тональная кривая AgX с экспозицией exposure. Ретро и ASCII — без тональной кривой, как раньше
    smooth: { dprMax: { desk: 1.5, phone: 2 }, exposure: 1.1 },
    // экономия заряда (2026-10-21, iPhone греется): fps — кадров в секунду, panelFps — под открытым окном, dpr — плотность холста,
    // grass/life — доля травы и жизни вокруг; столбов света нет. По умолчанию — на телефоне
    eco: { fps: 30, panelFps: 12, dpr: 1.5, grass: .6, life: .6 },
    // пресеты качества (шаг 14 аудита): scale — доля разрешения гладкого вида, grass — доля пучков травы, shafts — столбы света,
    // shadows — тени от солнца (только на компьютере); auto — разрешение от lo до hi шагом step по p95 кадра (выше down мс — ниже,
    // ниже up мс — выше) раз в every с, после warm с от старта, кадры дольше stall мс не считаются; shadow — карта теней:
    // size точек (на телефоне phone), охват ±span м вокруг героя, радиус размытия radius, смещения bias / normalBias
    quality: {
      low: { scale: .75, grass: .5, shafts: false, shadows: false, life: .5, paint: 0 }, mid: { scale: 1, grass: 1, shafts: true, shadows: false, life: 1, paint: 1 }, high: { scale: 1, grass: 1, shafts: true, shadows: true, life: 1, paint: 1 },     // life — доля живности, paint — сила материалов
      auto: { lo: .6, hi: 1, step: .1, up: 12, down: 18, every: 2, warm: 5, stall: 100 },
      shadow: { size: 2048, span: 25, radius: 3, bias: -.0006, normalBias: .03, dist: 80 } },
    // сглаживание движения (шаг 3 аудита), скорость затухания 1/с: pose — позы героя и врагов, hit — в окне удара (резко),
    // yawHero/yawWind/yawFoe — поворот модели к направлению (yawWind — в начале замаха), turn — крен в поворот, speed — оценка
    // скорости врага, camY — высота камеры над холмами (медленно)
    blend: { pose: 18, hit: 60, yawHero: 25, yawWind: 40, yawFoe: 12, turn: 10, speed: 13, camY: 2 },
    // фильтр «ASCII» (E1): клетка символа в экранных точках, шрифт, сцена в sub×sub текселей на клетку, ступеней плотности;
    // dpr — предел плотности холста (Retina ×2), gain [ночь, день]/gamma — яркость → плотность, dither — узор Байера между ступенями (0 — нет, 1 — полный), glow — свечение ярких, flicker — доля мерцающих клеток;
    // lo — темнее этого пусто (чёрный фон), edge — перепад яркости для штриха контура, lamp — свет над героем [сила, радиус м];
    // grass/water — во сколько раз зелёный/синий сильнее красного, чтобы клетка стала травой/водой
    ascii: { cell: [4, 7], font: 6.5, dpr: 2, sub: 2, levels: 12, gain: [2.8, 1.8], gamma: .8, dither: .3, lo: .16, edge: .32, lamp: [14, 10], glow: .25, flicker: .012, grass: 1.03, water: 1.15, bg: '#06070b' },
    fov: 48,              // угол обзора камеры
    camPitch: 58,         // наклон камеры вниз: 90 — строго сверху, 30 — почти горизонтально
    camDist: 19,          // расстояние камеры до героя
    zoom: { min: .6, max: 1.4, wheel: .0012, key: 1.12, ease: 8 },     // 4.12: приближение игрока — множитель camDist (колесо, + и −, щипок); max — по замеру: ×1,6 даёт 226 вызовов отрисовки против 139
    camLookUp: 1.0,       // на какую высоту над землёй смотрит камера
    camYaw: 38,           // поворот камеры вокруг героя: 0 — прямо, 45 — «изометрия» как в Project Zomboid
    camFollow: 7,         // «пружинность» слежения (больше — жёстче)
    fogDensity: .022      // плотность тумана
  },

  world: {
    radius: 1200,         // граница мира (круг); ядро — worldgen.coreR. Мир ×2 (4.04): было 600
    inner: 600,           // до этого радиуса мир строится прежним генератором и не меняется; дальше — внешнее кольцо (worldgen.outer)
    props: 150,            // деревьев и камней в ядре (в большом мире генератор держит ту же плотность)
    seed: 7,
    gen: 2,               // номер мира: другой номер в сохранении — герой встаёт в лагерь, туман и таймеры боссов сбрасываются
    // глубина (опасность) от костра: точки [расстояние, глубина], между ними — прямая, дальше последней — её глубина.
    // В ядре — прямая до 1 у его границы (как раньше); в большом мире генератор дописывает [край, depthMax]
    depth: [[0, 0], [85, 1]],
    // лагерь крупнее (2026-10-21): ядро раздвигается от центра — до rin м в k раз, к rout м плавно к прежнему (coremap3d.js)
    stretch: { on: true, k: 1.25, rin: 48, rout: 85 },
    // за краем мира (4.05): пояс belt — от r[0] до r[1] м за краем, по предмету на per м² (в лесу и на болоте — деревья, в горах
    // и пустошах — скалы, на побережье — море); far — далёкие горы и лесистые холмы от r[0] до r[1] м, по одной на step м круга, высотой h м
    horizon: { on: true, belt: { r: [3, 46], per: 42 }, far: { r: [120, 330], step: 55, h: [30, 105] } }
  },
  // большой мир (C3b): пояс от coreR до края — пять биомов секторами (turn — поворот, wobble — волна границы, belt — ширина
  // перехода от ядра), посёлки (villages, не ближе villageGap м), опасные места (dangers, по видам биома), ориентиры
  // (landmarks), река продлевается шагом riverStep м; depthMax — глубина у края; ground — цвет земли биома; trees — плотность
  // деревьев и камней (×), доля деревьев, доля сухих деревьев
  // озёра и ручьи (2026-10-18): lakes — n озёр радиусом r м, вес по биомам bio, не ближе gap м к местам и road м к тропам;
  // неровность берега amp; пруды-точки интереса становятся озёрами радиусом pond × свой. streams — n ручьёв шириной w м от
  // from м до ближайшей воды, шаг step м, не длиннее max шагов; slow — скорость в ручье ×
  water: { lakes: { n: 12, r: [10, 24], gap: 12, road: 14, bio: { forest: 2, swamp: 4, mountains: 1, waste: .3, coast: 2 }, amp: [.12, .08], pond: .8 },
    streams: { n: 10, w: [1, 1.6], from: [40, 110], step: 5, max: 40, wobble: .45 }, slow: .85 },
  worldgen: { on: true, outer: { k: 4, seed: 9973, gap: 12, frontier: 'Передовой стан' }, coreR: 85, belt: 30, turn: .07, wobble: .035, villages: 18, villageGap: 70, dangers: 30, dangerGap: 45, landmarks: 60, riverStep: 6, depthMax: 2,     // outer — второй проход мира ×2: мест в k раз гуще, своё зерно, зазор gap м за прежним краем
    // точки интереса (G2): n штук не ближе gap м друг к другу и road м от троп; вид — по весам биома. r — занимаемый радиус, м.
    // bandits — стоянка с сундуком и гарнизоном, shrine — святилище с даром, wagon — брошенная телега, barrow — курган с гарнизоном,
    // hut — хижина, pond — пруд, stones — стоячие камни
    pois: { n: 150, gap: 24, road: 14, r: { bandits: 9, shrine: 4, wagon: 4, barrow: 6, hut: 5, pond: 6, stones: 6 },
      kinds: { forest: [['bandits', 3], ['shrine', 2], ['hut', 3], ['stones', 1], ['pond', 2], ['wagon', 2], ['barrow', 1]], swamp: [['barrow', 3], ['shrine', 2], ['hut', 2], ['pond', 3], ['stones', 1], ['wagon', 1], ['bandits', 1]],
        mountains: [['stones', 3], ['shrine', 2], ['bandits', 2], ['barrow', 2], ['wagon', 1], ['hut', 1]], waste: [['wagon', 3], ['barrow', 2], ['bandits', 2], ['stones', 2], ['shrine', 1]], coast: [['wagon', 2], ['hut', 2], ['bandits', 2], ['shrine', 1], ['pond', 1], ['stones', 1]] } },
    // рощи (G2): за ядром деревья растут пятнами — шум с шагом scale м; доля леса в пятне от lo до 1, boost — во сколько раз больше кандидатов
    groves: { scale: 70, lo: .12, boost: 1.6 },
    plateaus: { n: 7, r: [14, 26], h: 3.5, rw: .2, len: 9 },
    // вражеские лагеря и павшие города (2026-10-18): свой генератор после всего прочего — прежние места не сдвигаются.
    // forts — лагеря размером с наш: n штук, полуширина H м (квадрат частокола, двое ворот шириной gate), шатров tents; gap — до других мест
    // cities — n городов в кольце ring м: полуширина H (каменные стены, ворота на четыре стороны), домов houses, площадь plaza м у центра,
    // боссы — свои у каждого города (тип, удары, фазы); villages — посёлки крупнее: ещё домов extra (от–до) внешним кольцом ring м
    forts: { n: 5, H: 19, gate: 5, tents: 6, gap: 60 },
    cities: { n: 2, H: 34, gate: 6, ring: [300, 520], gap: 110, houses: 14, plaza: 11,
      bosses: [
        { type: 'ashking', attacks: [{ kind: 'slam', wind: .8, r: 4.8, mul: 1.15, cd: 3, range: 5 }, { kind: 'charge', wind: .9, len: 15, width: 3, mul: 1.2, cd: 6, range: 17 }, { kind: 'nova', wind: 1.2, r: 9, inner: 3, mul: 1, cd: 9, range: 99 }],
          phases: [{ at: .7, summon: { type: 'shield', n: 2 } }, { at: .45, summon: { type: 'archer', n: 3 } }, { at: .3, enrage: true }] },
        { type: 'bonetyrant', attacks: [{ kind: 'slam', wind: .6, r: 3.4, mul: 1, cd: 2.5, range: 3.8 }, { kind: 'nova', wind: 1, r: 8, inner: 2.6, mul: .95, cd: 7, range: 99 }, { kind: 'slam', wind: 1.5, r: 7.5, mul: 1.35, cd: 11, range: 99 }],
          phases: [{ at: .7, summon: { type: 'ghoul', n: 3 } }, { at: .4, summon: { type: 'shade', n: 2 } }, { at: .3, enrage: true }] }
      ] },
    villagesMore: { extra: [2, 4], ring: 16 },
    // боссы колец мира ×2 (4.06): логово — опасное место своей зоны (zone), приёмы и фазы — как у боссов городов
    ringBosses: [
      { type: 'brandlord', zone: 'brandridge', lair: 'Логово Клеймёного Владыки', attacks: [{ kind: 'charge', wind: .8, len: 16, width: 3, mul: 1.2, cd: 5, range: 18 }, { kind: 'slam', wind: .7, r: 4.6, mul: 1.15, cd: 3, range: 5 }, { kind: 'nova', wind: 1.1, r: 9, inner: 3, mul: 1, cd: 8, range: 99 }],
        phases: [{ at: .7, summon: { type: 'brandshade', n: 3 } }, { at: .45, summon: { type: 'royal_guard', n: 2 } }, { at: .3, enrage: true }] },
      { type: 'abyssking', zone: 'scorched', lair: 'Трон Короля Бездны', attacks: [{ kind: 'nova', wind: 1, r: 10, inner: 3, mul: 1.05, cd: 7, range: 99 }, { kind: 'slam', wind: .6, r: 4, mul: 1.1, cd: 2.6, range: 4.4 }, { kind: 'slam', wind: 1.4, r: 8, mul: 1.4, cd: 11, range: 99 }],
        phases: [{ at: .7, summon: { type: 'eclipse_fiend', n: 3 } }, { at: .45, summon: { type: 'shade', n: 3 } }, { at: .3, enrage: true }] }
    ],
    // замки (C4): вход в кольце r м от костра, этажей floors; foes — кто живёт в залах; depth и danger — по этажам
    castles: [
      { id: 'castle_ash', name: 'Пепельная Твердыня', keyName: 'Ключ Твердыни', r: [260, 380], floors: 3, guard: { type: 'shield', hp: 7, dmg: 1.4 },
        boss: { type: 'castellan', attacks: [{ kind: 'slam', wind: .9, r: 4.6, mul: 1.1, cd: 3, range: 5 }, { kind: 'charge', wind: 1.1, len: 13, width: 2.8, mul: 1.1, cd: 7, range: 14 }, { kind: 'slam', wind: 1.5, r: 7.5, mul: 1.3, cd: 12, range: 99 }],
          phases: [{ at: .7, summon: { type: 'shield', n: 1 } }, { at: .4, summon: { type: 'imp', n: 2 } }, { at: .3, enrage: true }] }, foes: [['brute', 4], ['shield', 2], ['archer', 2], ['imp', 2]], chests: ['crate', 'chest', 'rack', 'armorstand'], depth: [1.3, 1.45, 1.6], danger: [2, 3, 3] },
      { id: 'castle_waste', name: 'Чертог Пустоши', keyName: 'Ключ Чертога', r: [400, 520], floors: 3, guard: { type: 'lunger', hp: 8, dmg: 1.4 },
        boss: { type: 'queen', attacks: [{ kind: 'nova', wind: 1.1, r: 8.5, inner: 2.8, mul: 1, cd: 7, range: 99 }, { kind: 'charge', wind: .8, len: 15, width: 2.6, mul: 1.1, cd: 5, range: 17 }, { kind: 'slam', wind: .6, r: 3.4, mul: .9, cd: 2.5, range: 3.8 }],
          phases: [{ at: .7, summon: { type: 'shade', n: 1 } }, { at: .45, summon: { type: 'witch', n: 1 } }, { at: .3, enrage: true }] }, foes: [['ghoul', 4], ['witch', 2], ['shade', 2], ['lunger', 2]], chests: ['crate', 'coffer', 'shelf', 'medchest'], depth: [1.55, 1.7, 1.85], danger: [2, 3, 3] }
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
    on: true, river: { a1: 150, da: 60, bend: -30, n: 24, w: 4.5, out: 6 }, bridges: [.33, .67], bridge: { w: 3.2, over: 1.6, deck: .3, arch: 1.1, pier: .6 },     // arch — подъём дуги к середине моста (F4)
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
    bScale: 1.35, bGap: 2.05,     // дома крупнее (2026-10-21): во сколько раз больше по полу; не ближе bGap м к соседям (иначе растёт меньше)
    // второй этаж (2026-10-21): у домов этих видов с полом не меньше minW×minD м — уровень наверху; лестница run м длиной, width шириной, h высотой; lift — высота пола этажа над землёй; wallH — высота стен наверху (срез: видна улица); сундуки наверху
    floors: { on: true, kinds: ['house', 'tavern', 'barracks', 'shop', 'warehouse'], minW: 6, minD: 5, run: 3.4, width: 1.15, h: 2.6, lift: 2.6, wallH: .9, chests: ['wardrobe', 'chest', 'shelf', 'coffer', 'crate'] },
    buildings: [
      // деревня вокруг костра
      { x: -14, z: -6,  w: 8,  d: 6, door: 'e', kind: 'house',     chests: ['chest', 'wardrobe'] },
      { x: 13,  z: -10, w: 7,  d: 6, door: 'w', kind: 'smithy',    chests: ['coffer', 'crate'], npc: 'smith' },      // кузнец переехал в лагерь
      { x: -4,  z: -20, w: 9,  d: 6, door: 's', kind: 'house',     chests: ['ironchest', 'rack', 'barrel'] },
      { x: 20,  z: 6,   w: 6,  d: 7, door: 'w', kind: 'barracks',  chests: ['sack', 'chest'], npc: 'captain' },     // и капитан
      { x: -18, z: 14,  w: 7,  d: 7, door: 'e', kind: 'house',     chests: ['locked', 'shelf', 'shelf'], npc: 'scribe' },     // библиотека: книжница зачаровывает вещи (4.00)
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
  // priceMul — наценка; fairy — сколько видов сказочных товаров; gear — сколько сильных вещей (от–до); uniqueChance — шанс именной вещи; gold — золотых вещей всегда, gold2 — шанс ещё одной;
  // retry — повторная попытка, если сейчас поставить некуда (герой в подземелье, мёртв, нет места)
  wanderer: { on: true, first: [240, 480], every: [480, 960], stay: 180, linger: 8, dist: [25, 70], side: 3, campPad: 6, r: 1.6, priceMul: 1.6, fairy: 3, gear: [2, 3], uniqueChance: .15, gold: 1, gold2: .5, reach: 3.4, retry: 30 },
  // случайные события (одно за раз): first/every — когда (от–до, с); retry — повтор, если не к месту; kinds — веса видов.
  // taken — доля урона, которую получают путник и обоз.
  // rescue: путник в беде вне любых мест (dist от героя); враги появляются, когда герой ближе wake; wait/time — сколько ждёт и сколько длится бой.
  // ambush: только на дороге (road — ширина) вне лагеря и безопасных мест; враги в r м впереди и с боков; flee — убежал дальше (или в лагерь) — засада кончилась.
  // caravan: обоз ждёт за воротами, трогается, когда герой ближе start; едет, пока герой ближе follow; waves — доли пути с налётами (ahead м впереди).
  // foes: враги по видам событий: n — [основа, + за глубину]; reward — пепел (от–до × (1 + глубина)), сундук box и бафф.
  // сюжет (этап 3, 2026-10-19): Акт I — data/story3d.js; fordAt — брод на дороге к узлу Ольхового леса, м от лагеря
  story: { on: true, fordAt: 105 },
  events: {
    on: true, first: [300, 540], every: [420, 780], retry: 30, kinds: { rescue: 3, ambush: 3, caravan: 2, thief: 2 },
    thief: { dist: [16, 26], side: 3, campPad: 10, r: 1, time: 30, lose: 55 },     // «Пепельный вор» (этап 4 «круче»): убегает, догнать за time с; дальше lose м — ушёл
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
      caravan: { ash: [60, 110], box: 'ironchest' },
      thief: { ash: [80, 160], box: 'ironchest', epic: 1 }     // вор: пепел, сундук и великая вещь
    }
  },
  // мелкое оживление (только вид): villagers — жителей в лагере, walk — их скорость, pause — сколько стоят у точки (от–до), fireGap — не ближе к костру;
  // birds — ворон вне лагеря, scare — с какого расстояния взлетают, flySpeed/flyUp/flyTime — полёт, back — через сколько вернутся;
  // smokeKinds — дома с дымом из трубы (и все дома с жителем), chimneyH — высота трубы над стеной, smoke — клубов на трубу;
  // fogPeak — фаза суток самого густого тумана (рассвет), fogWidth — ширина утра в долях суток, fogAmp — насколько гуще (×(1 + fogAmp))
  // святилища (G2): касание (ближе reach м) даёт один дар из списка на t с; снова — через again с. Звери (G2, только вид): n вокруг
  // героя на ring м, пугаются ближе scare м и убегают со скоростью run, уйдя за away м — появляются заново вне экрана
  shrine: { reach: 2.2, again: 600, gifts: [{ stat: 'dmg', amt: 12, t: 180, name: 'Сила камня' }, { stat: 'regen', amt: 2, t: 180, name: 'Тихий родник' }, { stat: 'luck', amt: 25, t: 300, name: 'Взгляд звёзд' }, { stat: 'armor', amt: 10, t: 180, name: 'Кора дуба' }] },
  // звери (G2; биомы — 2026-10-18): kinds — кто водится в биоме [вид, вес]; ducks — утки на ближнем озере (near м), пугаются ближе
  // scare м; fish — всплеск рыбы раз в fish с на озере рядом; fly — бабочки днём, летучие мыши ночью (n штук вокруг героя)
  beasts: { on: true, n: 9, ring: [16, 34], scare: 9, run: 7.5, away: 46, walk: .6,
    kinds: { forest: [['deer', 2], ['hare', 2], ['fox', 1]], swamp: [['heron', 2], ['hare', 1]], mountains: [['goat', 2], ['hare', 1]], waste: [['fox', 1], ['hare', 2]], coast: [['deer', 1], ['hare', 2], ['heron', 1]] },
    speed: { deer: 1.15, fox: 1.25, goat: 1, heron: .8, hare: 1 },
    ducks: { n: 4, near: 70, scare: 7, swim: .5, flee: 2.2 }, fish: [2, 5], fly: { n: 10, r: 10 } },
  ambient: { on: true, villagers: 5, walk: 1.3, pause: [3, 9], fireGap: 3.2, birds: 12, scare: 6, flySpeed: 7, flyUp: 3.5, flyTime: 4, back: 45, smokeKinds: ['house', 'tavern', 'smithy'], chimneyH: 1.4, smoke: 6, fogPeak: .04, fogWidth: .1, fogAmp: 0 },     // 4.18г: утренний туман убран (пик был ровно в 07:00 — час пробуждения); туман — погода (weather.kinds.fog)
  // стрельба героя (луки и арбалеты): assist — наводка на врага в конусе ±assist° перед героем; заряд (тяжёлый удар) даёт
  // дальность ×(1 + chargeRange × заряд) и скорость стрелы ×(1 + chargeSpeed × заряд); hitR — запас попадания, м; spawn — откуда вылетает
  shoot: { assist: 25, chargeRange: .5, chargeSpeed: .4, hitR: .25, spawn: .8, stun: .5 },
  // стихии и реакции (камни силы, 2026-10-18): react=false — только «Раскол» и «Токсичный взрыв», как раньше. cd — пауза между
  // реакциями на одном враге, с; rainWet — с такой силы дождя все мокрые для молнии; bossStun — предел оглушения босса от реакции;
  // mark — длительность меток «мокрый», «разряд», «трещина», с; crack — урон по треснувшему ×; hp: [доля здоровья, база] — урон.
  // zones — области реакций: r м, t с, tick с, dps; max — предел целей у цепей и вспышек
  elements: {
    react: true, cd: .4, bossCd: 3, rainWet: .5, bossStun: .6,     // bossCd — пауза реакций на боссе: оглушение не держит его подряд
    max: 8, hpCap: 30,     // hpCap — предел урона от доли здоровья цели (боссы)
    mark: { wet: 6, shock: 1.5, crack: 6 }, crack: 1.15,
    mix: {
      shatter: { hp: [.04, 20] }, steam: { r: 3, t: 3 }, plasma: { r: 4.5, n: 3, dps: 4, t: 4 }, boil: { k: 1.5, heal: 6 },
      lava: { r: 2.2, t: 3, tick: .5, dps: 4, burn: [4, 3] }, glaze: { k: 1.6, r: 3, t: 3, slow: .6 },
      icestorm: { r: 6, n: 2, k: .35, slow: 1.5 }, shards: { r: 2.5, hp: [.03, 9] }, glacier: { r: 2.5, hp: [.03, 14], stun: .8 },
      torrent: { r: 6, k: .6, hp: [.03, 10] }, spring: { r: 2.5, t: 4, tick: .5, poison: [2, 5] }, tide: 2,
      bog: { r: 3, root: 1.5, t: 3, slow: .6 }, neuro: { per: .6, max: 2 }, thunder: { r: 3, hp: [.01, 6], stun: .35 },
      rot: { k: 1.3, slow: .8 }, spores: { r: 3, poison: [2, 5] }, thorns: { r: 2, hp: [.01, 6], root: 1 }
    }
  },
  // умение оружия (2026-10-18): у оружия редкости minRar и выше (клеймёное, золотое) — своё умение по типу, клавиша F; cd — общая
  // перезарядка, с; gold — сила у золотого (и «Солнце» в конце); mul — множитель урона героя; r — радиус, м; стихия оружия кладётся наверняка
  wskill: {
    cd: 13, minRar: 4, gold: 1.3,     // 3.98: перезарядка 18 → 13 с — умение оружия давало +0–10% урона, цель владельца +10–15%
    cleave: { r: 3.4, mul: 2.2, gap: .3, knock: .8 }, lunge: { dist: 6, time: .26, mul: 2.8, width: 1.8 },
    shatter: { r: 4, mul: 1.9, stun: .8, crack: 6 }, reap: { r: 4.4, cone: 220, mul: 2.6, knock: 2.2 },
    tempest: { r: 3.2, t: 2.5, tick: .25, mul: .28 }, elemshot: { mul: 2.6, pierce: 99, r: 3, k: .5 },
    orb: { mul: 1.2, speed: .45, r: 2.2, every: .3, k: .5 }     // сфера стихии (посох, жезл): летит медленнее (speed ×), пульс раз в every с по всем в r м
  },
  // камни силы (2026-10-18): sockets — гнёзд у оружия по редкости (обычное … золотое); drop — шанс осколка с врага (+danger за
  // уровень опасности места), elite — шанс камня с элиты; of — стихия камня у вида врага, в дождь с любого — rain; hearts — сердце
  // с босса (всегда); fuse — 3 одинаковых → 1 ранг выше за пепел ash[ранг-1]; unsocket — пепел, чтобы вынуть, по рангу
  stones: {
    sockets: [0, 0, 1, 1, 2, 2], drop: .05, danger: .02, elite: .5, rain: 'water',
    of: { imp: 'fire', brute: 'earth', hound: 'blood', ghoul: 'venom', archer: 'storm', witch: 'fire', shield: 'earth', bomber: 'fire', lunger: 'blood', shade: 'ice' },
    hearts: { brandlord: 'blood', abyssking: 'venom', lampwarden: 'fire', tidecaller: 'ice', tidewyrm: 'storm', devourer: 'venom', lord: 'fire', chief: 'blood', castellan: 'earth', queen: 'ice', ashking: 'fire', bonetyrant: 'blood', gatebeast: 'fire', hand_womb: 'venom', hand_whisper: 'storm', hand_net: 'blood', hand_lord: 'fire', swampelder: 'venom', feeder: 'venom', swarm: 'blood', nestlord: 'venom', abbeyshriek: 'fire', choir: 'storm', abbot: 'fire', ap_serpent: 'venom', ap_boar: 'earth', ap_moth: 'fire', garm_beast: 'blood', towerwarden: 'earth', keymaster: 'storm', towerhound: 'blood', bloodbanner: 'blood', namelessking: 'ice', gravewight: 'venom', sapper: 'fire', drownedmaid: 'water', silt: 'venom', gatewarden: 'earth', gneis: 'storm', borot: 'blood', armorer: 'earth', firegolem: 'fire', smelter: 'fire', gravekeeper: 'venom', ashsister: 'fire', boneshepherd: 'blood', mossbeast: 'earth', thornwitch: 'venom', greywolf: 'blood', oakking: 'earth' },
    fuse: { n: 3, ash: [40, 150] }, unsocket: [15, 50, 150],
    // гнёзда в броне (2026-10-18): шлем, доспех, плащ, сапоги; гнёзд по редкости sockets; камень даёт характеристику стихии по рангу (stat),
    // огонь, яд и кровь ещё ослабляют на герое горение, яд и кровотечение (res по рангу, сумма не больше resMax)
    armor: { slots: ['head', 'body', 'cloak', 'boots'], sockets: [0, 0, 1, 1, 2, 2],
      stat: { fire: ['dmg', [2, 4, 7]], ice: ['armor', [3, 6, 10]], water: ['regen', [.5, 1, 1.8]], storm: ['spd', [2, 4, 6]], venom: ['crit', [2, 4, 6]], blood: ['leech', [1, 2, 3]], earth: ['hp', [12, 25, 45]] },
      resist: { fire: 'burn', venom: 'poison', blood: 'bleed' }, res: [.25, .4, .6], resMax: .8 },
    // посохи и жезлы с врагов (Ирга): magic — шанс у Ирги и у других героев, magicElite — у элиты; материал — по опасности места
    magic: [.03, .006], magicElite: .25,
    // сплав в ударе: chance — шанс по рангу камня (тяжёлый удар и конец серии — всегда); power — сила по рангу; amp — стихия вещи
    // совпала с камнем; el — что кладёт каждая стихия при силе 1: [dps, длительность] или длительность метки; chain — молния
    // перескакивает [м, доля урона]; двойные: hellfire — Пекло, permafrost — Вечная мерзлота, flow — Поток, overload — Перегрузка
    // (прыжков), plague — Чума, thirst — Жажда (вампиризм %, лечение за убийство), seismic — Сейсмика (трещина ×, оглушение)
    chance: [.25, .35, .45], power: [1, 1.6, 2.4], amp: 1.25,
    // bonus — при срабатывании ещё удар стихией: доля урона самого удара по рангу камня (3.98: раньше камень давал +1–3% урона на 45-м уровне)
    bonus: [.12, .22, .32],
    el: { fire: [4, 4], ice: 1.5, water: 6, storm: [4.5, .3], venom: [2, 5], blood: [3, 4], earth: 6 },
    hellfire: { r: 2.5, n: 3 }, permafrost: { k: 1.5, r: 3, hp: [.05, 18] }, flow: { knock: 4 }, overload: 2,
    plague: { r: 3 }, thirst: [10, 5], seismic: { k: 1.3, stun: .6 }
  },
  // активные умения (B3): ranks[i] — уровни, на которых умение слота i получает ранги 1, 2, 3…: сначала открыть, потом качать.
  // Очко умения даётся на каждом из этих уровней (всего 21), вложить его раньше нужного уровня нельзя. Финальное умение (30-й) —
  // один ранг сразу в полную силу. respec — пепла за уровень героя при сбросе умений. Списки из 5 чисел ниже — сила рангов 1–5
  // (у финального берётся последнее). cd — перезарядка, с; mul — множитель урона удара.
  abilities: {
    // 8 умений по 3 ранга (2026-10-18): уровни, с которых открывается каждый ранг умения слота; очко умений — каждый уровень с 3-го
    ranks: [[3, 7, 11], [6, 10, 14], [9, 13, 17], [12, 16, 20], [15, 19, 23], [19, 23, 27], [24, 27, 30], [30, 30, 30]], respec: 12, fearSpeed: .9,
    mastery: { on: true, twist: true, lv: [33, 36, 39, 42, 45, 48, 51, 54] },     // twist — мастерство меняет поведение умения (false — только сила)     // 4-й ранг «Мастерство» (этап 3 «круче»): сила продолжает рост рангов
    // новые умения древа (2026-10-20): вид действия → числа; у умения в data/actives3d.js — стихия, состояние и поправки p.
    // genLv — уровень 1-го ранга j-го нового умения ветки (+номер ветки); genStep — шаг до 2-го и 3-го ранга; slots — всего умений героя
    genLv: [3, 6, 10, 15, 21, 28, 36, 45, 61, 65], genStep: 5, slots: 36,     // 4.06: два умения ветки на 61 и 65 (+ветка), всего 36
    // dps — урон в секунду от горения, яда, крови (t с); sd — длительность контроля, с; slowK — сила замедления; amt — прибавка усиления по stat
    gen: {
      nova:   { cd: [8, 7, 6], cost: 35, r: 3.8, mul: [1, 1.3, 1.6], sd: [1.5, 2, 2.5], dps: [5, 8, 11], t: 4, knock: 1 },
      cone:   { cd: [6, 5, 4], cost: 30, r: 3.6, cone: 100, mul: [1.3, 1.7, 2.1], sd: [1.2, 1.6, 2], dps: [5, 8, 11], t: 4, knock: 1.2 },
      bolt:   { cd: [5, 4.5, 4], cost: 25, mul: [1.2, 1.6, 2], n: 1, spread: 0, pierce: 0, sd: [1.5, 2, 2.5], dps: [5, 8, 11], t: 5 },
      strike: { cd: [7, 6, 5], cost: 30, range: 3.2, cone: 70, mul: [1.8, 2.3, 2.8], sd: [1, 1.3, 1.6], dps: [6, 9, 12], t: 5, knock: 1.4 },
      dash:   { cd: [6, 5, 4], cost: 25, dist: 6, time: .28, width: 1.8, stop: .9, mul: [1, 1.35, 1.7], knock: 2, sd: [.6, .8, 1], dps: [5, 8, 11], t: 4 },
      zone:   { cd: [9, 8, 7], cost: 40, r: 3.2, range: 14, ahead: 6, mul: [1.1, 1.4, 1.7], sd: [1.5, 2, 2.5], dps: [5, 8, 11], t: 5 },
      field:  { cd: [12, 11, 10], cost: 45, r: 3.5, range: 14, ahead: 6, t: 5, tick: .5, mul: [.3, .4, .5], slow: 0 },
      cloud:  { cd: [11, 10, 9], cost: 40, r: 3.5, range: 14, ahead: 6, t: 5, tick: .5, dps: [4, 5, 6] },
      pull:   { cd: [10, 9, 8], cost: 35, r: 6, mul: [.8, 1, 1.2], sd: [1, 1.3, 1.6], dps: [5, 8, 11], t: 4 },
      mark:   { cd: [10, 9, 8], cost: 30, range: 12, cone: 60, delay: 2.5, mul: [2, 2.6, 3.2] },
      buff:   { cd: [18, 16, 14], cost: 20, t: [6, 8, 10], amt: { dmg: [4, 7, 10], armor: [8, 12, 16], spd: [15, 20, 25], crit: [10, 15, 20], leech: [4, 6, 8], regen: [3, 5, 7] } },
      heal:   { cd: [20, 18, 16], cost: 30, k: [.15, .2, .25] },
      gheal:  { cd: [12, 11, 10], cost: 35, r: 10, k: [.14, .19, .24] },     // 4.16: лечение героя и отряда рядом (доля здоровья каждого)
      ward:   { cd: [16, 14, 12], cost: 30, r: 10, abs: [.12, .17, .22], t: 8 },     // 4.16: оберег героя и отряда: abs — сколько урона гасит (доля здоровья), t с
      slowK: .4
    },
    // ресурс умений (2026-10-18): max — запас, start — с чего начинает, hit — за удар оружием, hurt — за 1 урона по герою,
    // roll — за перекат, regen — в секунду всегда, decay — в секунду после idle с без ударов и урона; cost у умения — его цена,
    // cd — короткая перезарядка (около трети прежней), чтобы сильное не жали подряд; perLv — запас растёт с уровнем героя
    res: {
      thorn: { name: 'Ярость', color: '#d8402a', max: 100, start: 0, hit: 3.5, hurt: .3, roll: 0, regen: 0, decay: 6, idle: 4, perLv: 2 },
      jay: { name: 'Концентрация', color: '#e8c04a', max: 100, start: 100, hit: 4, hurt: 0, roll: 0, regen: 9, decay: 0, idle: 0, perLv: 2 },
      vale: { name: 'Концентрация', color: '#6ab0ff', max: 100, start: 0, hit: 2, hurt: 0, roll: 0, regen: 4, decay: 0, idle: 0, perLv: 2 },     // Вейл — скрытый дуэлянт: восстанавливается сама (пожелание 2026-10-18; было «Ритм» от ударов)
      irga: { name: 'Мана', color: '#7a8aff', max: 120, start: 120, hit: 2, hurt: 0, roll: 0, regen: 8, decay: 0, idle: 0, perLv: 3 },
      brand: { name: 'Клеймо', color: '#c8282a', max: 100, start: 0, hit: 3, hurt: .5, roll: 0, regen: 0, decay: 5, idle: 4, perLv: 2 },     // 4.17: клеймо копится от ударов и боли, гаснет без боя
      priest: { name: 'Вера', color: '#ffe08a', max: 120, start: 120, hit: 2, hurt: 0, roll: 0, regen: 8, decay: 0, idle: 0, perLv: 3 },     // 4.16: вера Жреца
      warlock: { name: 'Души', color: '#b04aff', max: 100, start: 60, hit: 4, hurt: 3, roll: 0, regen: 5, decay: 0, idle: 0, perLv: 2 }     // души: копятся от ударов и боли
    },
    thorn: {
      charge: { cd: [3, 3, 2.5], cost: 20, dist: 6, stop: .9, time: .28, width: 1.7, mul: [1.2, 1.6, 2], knock: 2.4 },   // рывок с размаха (stop — останавливается в стольких м от цели)
      cry:    { cd: [15.5, 14, 12.5], cost: 30, r: 7, fear: [3, 4, 5], armor: [6, 10, 14], t: 8 },               // боевой клич
      whirl:  { cd: [6, 5, 4], cost: 35, r: 3.4, mul: [1.5, 2.1, 2.7], knock: 1.6 },                                  // вихрь
      iron:   { cd: [28, 25, 22.5], cost: 45, t: [5, 7, 9], taken: .5 },                                                     // несокрушимость
      rage:   { cd: [21, 19, 17], cost: 70, t: [8, 10, 12], dmg: [30, 50, 70], swing: .8, drain: 2 },              // ярость берсерка (dmg — %)
      bash:   { cd: [4, 3.5, 3], cost: 25, r: 3, cone: 70, mul: [1.1, 1.4, 1.7], stun: [1.2, 1.6, 2], knock: 1 },     // сокрушающий удар
      quake:  { cd: [9, 8, 7], cost: 45, r: 4, mul: [1, 1.3, 1.6], root: [1.5, 2, 2.5] },     // землетрясение
      blood:  { cd: [20, 18, 16], cost: 50, t: [6, 7, 8], leech: [15, 20, 25] },     // кровавый порыв (вампиризм, %),
    },
    // Сойка: стрелы умений летят как из её лука (без лука — как из короткого); spread — веер, °; trap — капкан (корни, урон, живёт life с,
    // не больше max сразу, ставится ahead м впереди); venom — яд dps × t с, пробивает pierce врагов; rain — град: круг r м, t с, удар каждые tick с
    jay: {
      leap:   { cd: [5.5, 5, 4], cost: 20, dist: 4.5, time: .22, mul: [1.2, 1.6, 2], range: 12 },                         // отскок с выстрелом
      volley: { cd: [5, 4.5, 4], cost: 30, n: 5, spread: 60, mul: [.6, .8, 1] },                                           // залп веером
      trap:   { cd: [5, 4, 3.5], cost: 25, r: 1, root: [2, 3, 4], mul: [1, 1.4, 1.8], life: 30, max: 2, ahead: 1.5 }, // капкан
      venom:  { cd: [4, 3.5, 3], cost: 30, mul: [1.2, 1.6, 2], dps: [6, 10, 14], t: 6, pierce: 2 },                 // ядовитая стрела
      rain:   { cd: [14, 12, 10.5], cost: 60, r: 3.5, t: 3, tick: .3, mul: [.35, .55, .75], range: 14, ahead: 8 },         // град стрел
      frost:  { cd: [5, 4.5, 4], cost: 25, mul: [1, 1.25, 1.5], freeze: [1.2, 1.6, 2] },     // ледяная стрела
      firearrow: { cd: [7, 6, 5], cost: 40, mul: [1.2, 1.5, 1.8], r: 3, splash: .5, dps: [6, 9, 12], t: 3 },     // зажигательная стрела
      hawk:   { cd: [20, 18, 16], cost: 50, t: [6, 7, 8], crit: [20, 30, 40] },     // ястребиный глаз (крит, %),
    },
    // Вейл: blink — к врагу в range м и конусе ±cone°, встаёт за спиной в behind м; parry — t с ловит любой удар (оглушает бьющего, ответ ×mul);
    // dance — hits ударов за t с по врагам в r м; shadow — тень-двойник t с: враги бьют её, она бьёт ближнего раз в hit с;
    // execute — удар ×mul × (1 + доля потерянного здоровья цели), не-босса ниже kill доли здоровья добивает
    vale: {
      blink:   { cd: [5, 4, 3.5], cost: 20, range: 8, cone: 70, behind: 1.2, mul: [1.4, 1.8, 2.2] },                       // выпад-телепорт
      parry:   { cd: [8.5, 7, 6], cost: 25, t: [.5, .7, .9], stun: [1, 1.5, 2], mul: [1, 1.5, 2] },  // парирование
      dance:   { cd: [10, 8.5, 7], cost: 40, t: 1.2, hits: 6, r: 3, mul: [.6, .8, 1] },                                    // танец клинков
      shadow:  { cd: [25.5, 22, 18.5], cost: 50, t: [6, 8, 10], hp: [120, 180, 240], hit: .8, r: 1.8, mul: [.4, .6, .8] }, // тень-двойник
      execute: { cd: [17, 15.5, 13], cost: 35, reach: 2.6, cone: 50, mul: [2, 2.5, 3], kill: [.2, .25, .3] },   // смертельный удар
      fan:    { cd: [5, 4.5, 4], cost: 30, n: 5, spread: 50, mul: [.6, .75, .9], dps: [4, 6, 8], t: 3 },     // веер ножей
      smoke:  { cd: [16, 14, 12], cost: 40, r: 9, hide: 1.5, t: [3, 4, 5], spd: [20, 30, 40] },     // spd — % скорости     // дымовая завеса
      bloodlet: { cd: [9, 8, 7], cost: 45, r: 3.2, mul: [.8, 1, 1.2], dps: [6, 8, 10], t: 4 }     // кровопускание
    },
    // Ирга (2026-10-18): почти всё по площади, копьё — по одной цели. fireball — сфера, у цели огонь в r м (splash — доля урона соседям);
    // nova — кольцо льда r м; chain — молния прыгает jumps раз на hop м, каждый прыжок ×fall; cloud — облако яда r м на t с; meteor — через
    // delay с падает в круг r м и поджигает; shield — t с доля absorb урона снимается с маны; blizzard — вьюга r м t с, удар раз в tick с и
    // замедление slow; spear — копьё бездны по одной цели
    irga: {
      fireball: { cd: [4, 3.5, 3], cost: 25, mul: [1.2, 1.5, 1.8], r: 2.5, splash: .6, dps: [4, 6, 8], t: 3 },     // огненный шар
      nova:     { cd: [7, 6, 5], cost: 35, r: 4, mul: [.8, 1, 1.2], freeze: [1.2, 1.6, 2] },     // ледяное кольцо
      chain:    { cd: [5, 4.5, 4], cost: 30, range: 14, hop: 5, jumps: [3, 4, 5], mul: [1, 1.2, 1.4], fall: .85 },     // цепная молния
      cloud:    { cd: [10, 9, 8], cost: 40, r: 3.5, t: 5, tick: .5, dps: [3, 4, 5], range: 14, ahead: 6 },     // ядовитое облако
      meteor:   { cd: [14, 12, 10.5], cost: 60, r: 3.5, delay: 1, mul: [2, 2.6, 3.2], burn: [6, 4], range: 14, ahead: 6 },     // метеор
      shield:   { cd: [20, 18, 16], cost: 40, t: [6, 8, 10], absorb: [.5, .6, .7] },     // щит маны
      blizzard: { cd: [16, 14, 12], cost: 55, r: 4, t: 4, tick: .4, mul: [.3, .4, .5], slow: .6, range: 14, ahead: 6 },     // вьюга
      spear:    { cd: [18, 16, 14], cost: 50, mul: [3.5, 4.5, 5.5], range: 16, cone: 60 }     // копьё бездны
    },
    brand: {     // Клеймёный рыцарь (Г4, 4.17): свои умения — из видов действия (kind), числа здесь
      cleaver:  { kind: 'cone', el: 'steel', st: 'bleed', cd: [7, 6, 5], cost: 30, r: 3.8, cone: 140, mul: [1.7, 2.2, 2.7], knock: 1.5, sd: [1, 1.3, 1.6], dps: [5, 8, 11], t: 4 },
      cannon:   { kind: 'bolt', el: 'fire', st: 'burn', cd: [9, 8, 7], cost: 35, mul: [2, 2.6, 3.2], n: 1, spread: 0, pierce: 1, sd: [1, 1, 1], dps: [6, 9, 12], t: 4 },
      volley:   { kind: 'bolt', el: 'steel', st: null, cd: [8, 7, 6], cost: 30, mul: [.6, .8, 1], n: 5, spread: 40, pierce: 0, sd: [1, 1, 1], dps: [0, 0, 0], t: 0 },
      fury:     { kind: 'buff', stat: 'dmg', cd: [20, 18, 16], cost: 30, t: [6, 8, 10], amt: [6, 9, 12] },
      endure:   { kind: 'heal', cd: [22, 20, 18], cost: 25, k: [.18, .24, .3] },
      rush:     { kind: 'dash', el: 'steel', st: 'stun', cd: [8, 7, 6], cost: 25, dist: 7, time: .3, width: 2, stop: .9, mul: [1.2, 1.6, 2], knock: 2.2, sd: [.6, .8, 1], dps: [0, 0, 0], t: 0 },
      darkcut:  { kind: 'strike', el: 'shadow', st: 'crack', cd: [9, 8, 7], cost: 30, range: 3.2, cone: 70, mul: [1.8, 2.3, 2.8], knock: 1.2, sd: [1.5, 2, 2.5], dps: [0, 0, 0], t: 0 },
      howl:     { kind: 'nova', el: 'steel', st: 'fear', cd: [16, 14, 12], cost: 35, r: 4.5, mul: [.8, 1, 1.2], knock: 1, sd: [1.5, 2, 2.5], dps: [0, 0, 0], t: 0 }
    },
    priest: {     // Жрец (Г3, 4.16): свои умения собраны из видов действия (kind в data/abilities3d.js), числа — здесь
      smite:    { kind: 'bolt', el: 'light', st: null, cd: [5, 4.5, 4], cost: 20, mul: [1.3, 1.7, 2.1], n: 1, spread: 0, pierce: 0, sd: [1, 1.5, 2], dps: [0, 0, 0], t: 0 },
      mend:     { kind: 'gheal', cd: [8, 7, 6], cost: 30, r: 10, k: [.16, .22, .28] },
      sanctum:  { kind: 'ward', cd: [14, 12, 10], cost: 30, r: 10, abs: [.15, .2, .25], t: 8 },
      hymn:     { kind: 'buff', stat: 'dmg', cd: [18, 16, 14], cost: 20, t: [6, 8, 10], amt: [4, 7, 10] },
      radiance: { kind: 'nova', el: 'light', st: 'blind', cd: [9, 8, 7], cost: 35, r: 4, mul: [1, 1.3, 1.6], knock: 1, sd: [1.5, 2, 2.5], dps: [0, 0, 0], t: 0 },
      hallow:   { kind: 'field', el: 'light', st: null, cd: [14, 12, 10], cost: 35, r: 3.5, t: 6, tick: 1, mul: [.4, .55, .7], range: 12, ahead: 6, slow: 0 },
      vtouch:   { kind: 'mark', el: 'shadow', st: null, cd: [12, 11, 10], cost: 30, range: 14, cone: 60, delay: 3, mul: [2.5, 3.2, 4] },
      penance:  { kind: 'strike', el: 'light', st: 'stun', cd: [10, 9, 8], cost: 25, range: 3, cone: 60, mul: [1.6, 2, 2.4], knock: 1, sd: [.8, 1, 1.2], dps: [0, 0, 0], t: 0 }
    },
    warlock: {     // Морок-чернокнижник (2026-10-20)
      hex:    { cd: [6, 5, 4], cost: 20, range: 12, cone: 60, crack: [.2, .3, .4], dps: [4, 6, 8], t: 6 },     // порча: трещина (урон по цели +crack) и яд
      drain:  { cd: [7, 6, 5], cost: 25, range: 10, cone: 60, mul: [1.3, 1.7, 2.1], heal: [.25, .3, .35], cap: [.08, .1, .12] },     // похищение жизни: heal — доля нанесённого урона, не больше cap здоровья
      summon: { cd: [22, 20, 18], cost: 40, t: [10, 12, 14], hp: [80, 120, 160], mul: [.6, .8, 1], hit: .9, r: 2.4 },     // бес у ног: бьёт ближнего каждые hit с
      terror: { cd: [18, 16, 14], cost: 35, r: 5, fear: [2, 2.5, 3], slow: .4 },     // ужас: страх и замедление вокруг
      grasp:  { cd: [10, 9, 8], cost: 35, r: 3, root: [1.5, 2, 2.5], mul: [.8, 1, 1.2], range: 12, ahead: 6 },     // хватка мёртвых: удар и корни в круге
      pact:   { cd: [20, 18, 16], cost: 0, price: .15, gain: 60, t: [6, 8, 10], dmg: [8, 12, 16] },     // кровавый договор: плата здоровьем → души и урон
      souls:  { cd: [5, 4.5, 4], cost: 30, n: 5, spread: 40, mul: [.5, .65, .8] },     // рой душ: веер сфер
      doom:   { cd: [16, 14, 12], cost: 45, range: 14, cone: 60, delay: 4, mul: [3, 4, 5] }     // рок: через delay с — тяжёлый удар по цели
    }
  },
  // связки умений (2026-10-18): умение a, потом b не позже window с — b сильнее. mul — множители чисел умения, add — прибавки,
  // set — замена; прочее — числа особых эффектов (stun — множитель оглушения испуганных, k — множитель урона по условию, …)
  combos: {
    window: 3,
    bladestorm: { mul: { r: 1.4, mul: 1.3 } }, dread: { mul: { cone: 1.5 }, stun: 2 }, rift: { k: 1.6 }, frenzy: { mul: { t: 1.5 } },
    archerdance: { add: { n: 3 } }, snare: { mul: { mul: 1.4 } }, aimcold: { pierce: 99 }, icehail: { slow: .6 },
    shadowstrike: { crit: true }, bloodfan: { k: 1.5 }, riposte: { set: { kill: .4 } }, twindance: {},
    detonate: { k: 2, burn: [6, 4] }, frozenstorm: { add: { jumps: 2 }, slow: .6 }, icearmor: { mul: { r: 1.4 }, armor: 15, t: 6 }, breach: { k: 1.5 },
    verdict: { k: 1.5 }, feast: { k: 2 }, gravecall: { add: { n: 3 } }, bloodimp: { mul: { t: 1.5, mul: 1.3 } },
    blessedwave: { mul: { r: 1.4 } }, purge: { mul: { mul: 1.4 } }, sermon: { mul: { k: 1.3 } }, judgement: { mul: { mul: 1.3, t: 1.3 } },
    brandrage: { mul: { mul: 1.4 } }, powder: { mul: { mul: 1.3 } }, ironhowl: { mul: { r: 1.4 } }, darkpain: { mul: { k: 1.4 } }
  },
  // вторая рука (B2b): block.arc — ширина щита спереди, °; block.knock — доля отброса при блоке; dual.mul — доля урона второго клинка
  // к каждому удару, dual.swing — удары с двумя клинками быстрее (×)
  block: { arc: 120, knock: .4 }, dual: { mul: .8, swing: .92 },
  // герои (B1): множители здоровья и скорости бега, прибавка к криту (%). У Торна всё как раньше — бой и баланс прежние
  heroes: { thorn: { hp: 1.15, speed: 1, crit: 0, killHeal: .03, healLv: [8, 12] },     // Торн — защитник: здоровья больше; убийство рядом (до 6 м), когда вокруг ещё двое и больше, лечит на killHeal до healLv[0] ур., к healLv[1] — на нет (на «железе» гиб чаще всех)
  vale: { hp: .95, speed: 1.1, crit: 6 }, jay: { hp: 1, speed: 1.05, crit: 0 }, irga: { hp: 1, speed: 1.05, crit: 2 }, warlock: { hp: .95, speed: 1.05, crit: 3 }, priest: { hp: 1, speed: 1.05, crit: 1 }, brand: { hp: 1.1, speed: 1, crit: 2 } },
  shop: { buyMul: 2.2, sellMul: .5, restock: 300, reach: 3.4,
    // полка редкостей (G3): при каждом обновлении витрины — бросок по уровням; chance — шанс уровня, n — сколько вещей,
    // rar — редкость вещи (3 — великий, фиолетовый; 4 — клеймёный, оранжевый; 5 — золотой, только здесь), mul — наценка;
    // pools — откуда вещи (только снаряжение; у уровня может быть свой список)
    rare: { tiers: [{ name: 'Редкое', rar: 3, chance: .6, n: [1, 2], mul: 1 }, { name: 'Очень редкое', rar: 4, chance: .25, n: [1, 1], mul: 1.3 }, { name: 'Супер редкое', rar: 5, chance: .06, n: [1, 1], mul: 1.6, pools: ['gold'] }],
      pools: ['weapon', 'weapon', 'ranged', 'magic', 'shield', 'head', 'body', 'cloak', 'boots', 'ring', 'amulet'] } },   // цена покупки = цена вещи × buyMul, продажи × sellMul; витрина обновляется раз в restock секунд
  // отряд: наёмники из Заставы. Идут за героем, бьют врагов, умирают насовсем. Мест в отряде: baseMax + 1 за каждые perLevels уровней, но не больше cap
  // боссы: логово (x, z), атаки с предупреждением, фазы по здоровью. attacks: kind slam (круг), charge (рывок по линии), nova (кольцо огня), summon (подмога);
  // wind — время предупреждения, mul — множитель урона, cd — перезарядка, range — с какого расстояния применяется. phases: at — доля здоровья
  bosses: {
    homeHeal: .12,        // доля здоровья в секунду, которую босс лечит, вернувшись в логово (и пока герой в подземелье)
    respawn: 600, aggro: 28, leash: 70, enrageSpeed: 1.25, enrageCd: .7, enrageDmg: 1.2, minionCap: 6,
    // новый приём на первой фазе (этап 2 «круче»): образцы; null — выключено (база боя)
    phaseMoves: { beam: { kind: 'beam', wind: 1.3, len: 13, width: 1.6, dur: 3.5, sweep: .7, mul: .8, cd: 13, range: 99 }, pools: { kind: 'pools', wind: .9, n: 1, r: 2.2, dur: 7, mul: .4, cd: 12, range: 99 },
      nova: { kind: 'nova', wind: 1.2, r: 7, inner: 2.6, mul: .8, cd: 10, range: 99 }, charge: { kind: 'charge', wind: 1, len: 12, width: 2.4, mul: 1, cd: 7, range: 15 } },
    // механики (этап 5): tick — шаг урона луча и луж, с (дольше неуязвимости героя после удара); brk — доля здоровья босса, которую надо снять,
    // чтобы сбить чтение без тяжёлого удара; stun — сколько босс стоит, когда чтение сбито, с
    mech: { tick: .6, brk: .15, stun: 2.2, poolFirst: .5, pullHit: .6 },     // Г9: первый тик лужи — через poolFirst с, удар «Притяжения» — через pullHit с после рывка (успеть уйти)
    // Г9 «босс читает отряд» (только при отряде): веса приёмов по раскладке — clump: кучность (лужи, кольцо, метеоры), spread: разброс (притяжение),
    // tank: защитник далеко (чтение); hunt: раз в фазу рывок или скачок на дальнего лекаря или стрелка (дальше hunt м)
    smart: { on: true, clump: 2.5, spread: 2, tank: 2, hunt: 7 },
    // свои приёмы боссов (4.18б, просьба владельца): добавка к attacks по виду босса. Виды: meteor — n меток под героем и отрядом (и вокруг
    // на around м), через arm с удар радиусом r; pull — тянет всех в r м к боссу на force м, затем удар в inner; blink — скачок к цели, удар r;
    // safe — удар по всему залу, кроме зелёного круга r в safeD м от босса. drain — лечение (доля в секунду), пока жива подмога.
    // stage2 — вторая стадия: босс «умирает» и встаёт с долей hp здоровья, уроном × dmg, своими приёмами и фазами
    sig: {
      barghest: { attacks: [{ kind: 'blink', name: 'Прыжок из тени', wind: .75, r: 3.2, mul: 1.2, cd: 9, range: 24 }] },
      rootgnaw: { attacks: [{ kind: 'pull', name: 'Корни тянут', wind: 1.1, r: 12, force: 6, inner: 3.6, mul: 1.3, cd: 12, range: 12 }] },
      hagmother: { attacks: [{ kind: 'meteor', name: 'Порча с неба', wind: .6, n: 4, r: 2.4, arm: 1.6, mul: 1.2, cd: 11, range: 99, around: 6 }] },
      thornlord: { attacks: [{ kind: 'safe', name: 'Терновая буря', wind: 2.6, r: 3.2, safeD: 7, mul: 1.8, cd: 20, range: 99 }], drain: 0.02 },
      oldoak: { attacks: [{ kind: 'pull', name: 'Зов чащи', wind: 1.1, r: 14, force: 8, inner: 4, mul: 1.3, cd: 12, range: 14 }, { kind: 'meteor', name: 'Град желудей', wind: .6, n: 5, r: 2.4, arm: 1.6, mul: 1.4, cd: 13, range: 99, around: 6 }], drain: 0.015 },
      saltwarden: { attacks: [{ kind: 'blink', name: 'Соляной скачок', wind: .75, r: 3.4, mul: 1.2, cd: 9, range: 24 }] },
      drownchoir: { attacks: [{ kind: 'safe', name: 'Хорал прилива', wind: 2.6, r: 3.2, safeD: 7, mul: 2.2, cd: 20, range: 99 }] },
      abbess: { attacks: [{ kind: 'meteor', name: 'Колокольный звон', wind: .6, n: 4, r: 2.6, arm: 1.6, mul: 1.4, cd: 11, range: 99, around: 6 }] },
      cathkraken: { attacks: [{ kind: 'pull', name: 'Щупальца', wind: 1.1, r: 14, force: 8, inner: 3.6, mul: 1.3, cd: 12, range: 14 }] },
      drowngod: { attacks: [{ kind: 'safe', name: 'Прилив', wind: 2.6, r: 3, safeD: 8, mul: 2.4, cd: 22, range: 99 }, { kind: 'meteor', name: 'Капель бездны', wind: .6, n: 5, r: 2.4, arm: 1.6, mul: 1.4, cd: 12, range: 99, around: 6 }], drain: 0.015 },
      bogwarden: { attacks: [{ kind: 'pull', name: 'Трясина затягивает', wind: 1.1, r: 13, force: 7, inner: 3.6, mul: 1.3, cd: 12, range: 13 }] },
      drownqueen: { attacks: [{ kind: 'blink', name: 'Шаг из глубины', wind: .75, r: 3.2, mul: 1.2, cd: 9, range: 24 }] },
      leviathan: { attacks: [{ kind: 'meteor', name: 'Обвал свода', wind: .6, n: 5, r: 2.6, arm: 1.6, mul: 1.5, cd: 11, range: 99, around: 6 }] },
      ashgolem: { attacks: [{ kind: 'meteor', name: 'Пепельный обвал', wind: .6, n: 4, r: 2.8, arm: 1.6, mul: 1.5, cd: 11, range: 99, around: 6 }] },
      cinderpriest: { attacks: [{ kind: 'safe', name: 'Пепельная буря', wind: 2.6, r: 3.2, safeD: 7, mul: 2.2, cd: 20, range: 99 }] },
      cinderlord: { attacks: [{ kind: 'blink', name: 'Шаг пламени', wind: .75, r: 3.4, mul: 1.3, cd: 9, range: 24 }], drain: 0.02 },
      rotmaw: { attacks: [{ kind: 'pull', name: 'Пасть тянет', wind: 1.1, r: 13, force: 8, inner: 3.6, mul: 1.3, cd: 12, range: 13 }] },
      sporemother: { attacks: [{ kind: 'meteor', name: 'Споровые нарывы', wind: .6, n: 4, r: 2.6, arm: 1.6, mul: 1.1, cd: 11, range: 99, around: 6 }], drain: .004 },
      riftheart: { attacks: [{ kind: 'safe', name: 'Разлом', wind: 2.6, r: 3, safeD: 8, mul: 2.4, cd: 20, range: 99 }, { kind: 'blink', name: 'Сквозь разлом', wind: .75, r: 3.4, mul: 1.3, cd: 9, range: 24 }] },
      voidwarden: { attacks: [{ kind: 'blink', name: 'Шаг Пустоты', wind: .75, r: 3.4, mul: 1.3, cd: 9, range: 24 }] },
      twinflame: { attacks: [{ kind: 'meteor', name: 'Двойной огонь', wind: .6, n: 6, r: 2.4, arm: 1.6, mul: 1.4, cd: 10, range: 99, around: 6 }] },
      hollowqueen: { attacks: [{ kind: 'pull', name: 'Пустой зов', wind: 1.1, r: 14, force: 8, inner: 3.6, mul: 1.3, cd: 12, range: 14 }], drain: 0.02 },
      abyssmaw: { attacks: [{ kind: 'pull', name: 'Глотка Бездны', wind: 1.1, r: 15, force: 9, inner: 4, mul: 1.5, cd: 12, range: 15 }, { kind: 'meteor', name: 'Плевок Бездны', wind: .6, n: 4, r: 2.8, arm: 1.6, mul: 1.5, cd: 11, range: 99, around: 6 }] },
      voidking: { attacks: [{ kind: 'safe', name: 'Тень Пустоты', wind: 3, r: 3.4, safeD: 8, mul: 2.4, cd: 22, range: 99 }], stage2: { name: 'Истинный облик', hp: .7, dmg: 1.15, pause: 2.5, say: 'Ты убил лишь мою тень. Теперь смотри на меня.',
        attacks: [{ kind: 'slam', wind: .8, r: 4.6, mul: 1.2, cd: 3, range: 5.5 }, { kind: 'meteor', name: 'Звездопад Пустоты', wind: .6, n: 6, r: 2.6, arm: 1.5, mul: 1.5, cd: 10, range: 99, around: 7 }, { kind: 'pull', name: 'Притяжение Бездны', wind: 1.1, r: 15, force: 9, inner: 4, mul: 1.5, cd: 13, range: 15 },
          { kind: 'blink', name: 'Шаг сквозь Пустоту', wind: .75, r: 3.4, mul: 1.3, cd: 8, range: 24 }, { kind: 'beam', wind: 1, len: 16, width: 2.2, dur: 4, sweep: 1.3, mul: 1, cd: 12, range: 99 }, { kind: 'safe', name: 'Последнее слово', wind: 3, r: 3, safeD: 9, mul: 3, cd: 24, range: 99 }],
        phases: [{ at: .6, summon: { type: 'eclipse_fiend', n: 2 }, shield: true }, { at: .35, summon: { type: 'brandshade', n: 2 } }, { at: .25, enrage: true }] } },
    },
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
  // детали мира (T5, только вид): house — сколько мелочей у стен дома [от, до]; road — не ближе к тропе, м; gap — между деталями, м;
  // rug — доля коврика у двери; danger — следов боя у опасного места [от, до]; banner — доля знамени в посёлке; в подземелье —
  // доли свечей в углу комнаты (candle), цепи или решётки на стене (wall), костей на полу (floor)
  details: { on: true, house: [1, 3], road: 1.6, gap: .9, rug: .5, kbanner: .85, lamp: .4, wagon: .7,     // 4.09: знамя у важных домов, фонарь у двери обычного; 4.10: повозка у лавки
    rugColors: ['#7a2a24', '#3a4a6a', '#6a5a2a'], danger: [3, 6], banner: .6,
    bannerColors: ['#8a2a1a', '#2a3a6a', '#4a5a2a'], candle: .45, wall: .55, floor: .5 },
  dungeons: {
    // 4.15 Подземелья 2.0: раскладка подземелий группы и рейда — генератором на каждый заход (dungeongen3d.js). cell — шаг сетки, м; room, bossRoom,
    // first — размеры залов; mainShare — доля залов на главном пути; turn — доля поворотов; branch — длина ветви; loop — петли; foes — врагов
    // на 150 м² зала; chest — сундук в тупике; dungeon, raid — число залов; bossAt — где на пути боссы (последний — в конце)
    gen: { on: true, cell: 26, gapMin: 4, corr: 2.4, mainShare: .55, turn: .45, branch: 3, loop: .12, room: [10, 16], bossRoom: [16, 22], first: [10, 8],
      foes: [3, 4.5], raidMul: .8, chest: .7, dungeon: [14, 20], raid: [30, 40], bossAt: [.3, .55, .75, .9] },
    // 4.14: стили подземелий — floor, wall, cap (верх стен), bg (фон и туман), fogK (плотность тумана), hemi [небо, земля, сила] (общий свет),
    // flame (огонь факелов), mist, mistA, ember, pillar (живой фон), glow { n — гроздей на зал, kind: crystal | mushroom | lava, color }
    themes: { on: true, def: 'crypt', abyss: 'crypt',
      by: { cellar_cooper: 'crypt', crypt_pogost: 'crypt', castle_ash_1: 'forge', castle_ash_2: 'forge', castle_ash_3: 'forge', castle_waste_1: 'ice', castle_waste_2: 'ice', castle_waste_3: 'ice',
        inst_brod: 'crypt', inst_olkh: 'cave', inst_moss: 'temple', inst_pass: 'ice', inst_forge: 'forge', inst_tower: 'crypt', inst_dusk: 'temple', inst_barrow: 'cave', inst_nest: 'cave', inst_abbey: 'ice', raid_hand: 'forge', inst_drown: 'temple', inst_ash: 'forge', inst_rift: 'cave', raid_throne: 'crypt', raid_oak: 'cave', raid_cathedral: 'temple' },
      list: {
        crypt: { name: 'склеп', floor: '#2c2622', wall: '#4a4038', cap: '#141010', bg: '#070504', fogK: 1, hemi: ['#6a5a50', '#1a1210', .9], flame: '#ffb050', mist: '#5a2616', mistA: .5, ember: '#ff8a3a', pillar: '#170f0c', glow: null },
        cave: { name: 'зелёная пещера', floor: '#41603a', wall: '#557a48', cap: '#1e2e18', bg: '#1c3222', fogK: .4, hemi: ['#c4f4a8', '#2c4c26', 2.2], flame: '#d8ff9a', mist: '#6ad08a', mistA: .32, ember: '#c8ff9a', pillar: '#1a2a18', glow: { n: 3, kind: 'mushroom', color: '#8affb8' } },
        ice: { name: 'ледяной грот', floor: '#9ab4c6', wall: '#6a8aa8', cap: '#2a3a4a', bg: '#18283a', fogK: .5, hemi: ['#dcf2ff', '#3a5068', 1.9], flame: '#bfe8ff', mist: '#a8d8ff', mistA: .3, ember: '#eef8ff', pillar: '#1c2a3a', glow: { n: 2, kind: 'crystal', color: '#9ee8ff' } },
        forge: { name: 'кузня', floor: '#3a2a22', wall: '#5a3a2a', cap: '#1a0e08', bg: '#1a0904', fogK: .8, hemi: ['#ffb070', '#3a1a0a', 1.35], flame: '#ffb050', mist: '#ff6a2a', mistA: .55, ember: '#ffb050', pillar: '#241008', glow: { n: 2, kind: 'lava', color: '#ff5a10' } },
        temple: { name: 'затопленный храм', floor: '#2e4a48', wall: '#3e5c5a', cap: '#14201e', bg: '#0c1a1c', fogK: .6, hemi: ['#9ae0d8', '#1a3434', 1.55], flame: '#8affe8', mist: '#4ad0c0', mistA: .38, ember: '#b8fff0', pillar: '#0e2020', glow: { n: 2, kind: 'crystal', color: '#5affe0' } } } },
    bg: { on: true, size: 110, layers: [[-.45, 1, .07, 110], [-4, .7, .05, 170], [-10, .5, .035, 260]], mist: '#5a2616', mistA: .5, mistY: -.45, embers: 220, emberBox: 60, emberH: 9, emberUp: .5, emberS: .09, emberC: '#ff8a3a', pillar: '#170f0c', pillarMax: 300, pillarStep: 8, pillarChance: .3, depth: 7 },     // 4.13: живой фон вокруг залов (dungeonbg3d.js)
    reach: 1.8,           // на каком расстоянии от люка или лестницы появляется кнопка
    wall: .6, wallH: 1.4, // толщина и высота стен (низкие: камера смотрит сверху)
    fade: .4,             // затемнение при переходе, с (при prefers-reduced-motion — без него)
    seed: 9001,           // зерно случайных чисел подземелий в тестах (у каждого своё: seed + номер); в игре — Math.random
    cell: 1.5, reveal: 6, // клетка тумана войны и радиус открытия карты внизу, м (коридоры узкие, клетка мельче, чем наверху)
    corridorMax: 2.5,     // прямоугольник уже этого — коридор (без факелов)
    doorMax: 3,           // самый широкий проход, в который можно поставить дверь, м
    seenMax: 3000,        // предел длины строки тумана одного подземелья в сохранении (залы крупнее с 3.79)
    path: { before: 1, past: 1.2, slack: .5 },   // путь через проход: точка до него и за ним, м; slack — запас к краю проёма
    // ключи подземелий: лежат в сундуках (chests[].key), висят на связке (не в сумке, не теряются), открывают двери с lock
    keys: { cellar_cooper: 'Ключ Бондаря', crypt_iron: 'Железный ключ Склепа', crypt_bone: 'Костяной ключ Склепа' },
    hearRooms: 2,         // враг слышит героя, только если между ними не больше стольких проходов (иначе сбегается всё подземелье)
    respawnAway: 300,     // через сколько секунд отсутствия подземелье снова наполняется врагами
    spawnPad: 1.2, spawnSafe: 5,   // враги появляются не ближе spawnPad к стенам и не ближе spawnSafe ко входу, м
    // облик (2026-10-20, просьба владельца): залы крупнее в scale раз; форма зала шире shapeMin — по весам shapes (круг, восьмигранник,
    // колонны, провал с мостом-крестом); наполненность залов шире fillMin — пустой (врагов −emptyCut, без мелочей), обычный, забитый (+fullAdd, хлам у стен)
    style: { on: true, scale: 1.3, shapeMin: 12, fillMin: 9, step: .3, octCut: .3,
      shapes: { rect: 2, round: 3, oct: 2, pillars: 2, pit: 1 }, fill: { empty: 1, normal: 2, full: 2 }, fullAdd: 1, emptyCut: 1,
      pit: { pad: 1.6, bridge: 1.8 }, pillars: { r: .5, big: 17 } },
    // боссы подземелий и замков мощнее: главный (final), промежуточные (mini), страж с ключом трона (guard) — множители здоровья и урона
    might: { on: true, boss: { hp: 1.15, dmg: 1.05 }, mini: { hp: 1.12, dmg: 1.05 }, guard: { hp: 1.3, dmg: 1.1 }, castle: { hp: 1, dmg: 1 } },     // castle — босс трона: его делает сильнее сам зал 26×26 (рывки на всю длину)
    list: [
      { id: 'cellar_cooper', name: 'Погреб Бондаря', at: { x: -19.5, z: 19.6 }, back: { x: -17.2, z: 19.6 }, depth: .25, danger: 1,
        rooms: [{ id: 'main', x: 0, z: 0, w: 9, d: 7 }, { id: 'pass', x: 5.5, z: 0, w: 2, d: 2 }, { id: 'store', x: 9, z: 0, w: 5, d: 5 }],
        doors: [{ a: 'pass', b: 'store', lock: 'cellar_cooper' }],
        foes: [['hound', 2], ['ghoul', 1]], spawns: [{ room: 'store', n: 2 }, { room: 'main', n: 1, type: 'hound' }],
        entry: { x: -1.5, z: 0 }, exit: { x: -3.6, z: 0 },
        chests: [{ kind: 'barrel', x: 3.4, z: -2.4, key: 'cellar_cooper' }, { kind: 'crate', x: 10.2, z: 1.5 }, { kind: 'sack', x: 10.2, z: -1.5 }] },
      { id: 'crypt_pogost', name: 'Склеп Погоста', at: { x: -30, z: -12 }, back: { x: -28, z: -12 }, depth: .7, danger: 2,
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
  // жизнь мира (этап 6): сбор, ремёсла, ездовое животное, перелёты повозкой, репутация
  life: { on: true,
    // сбор: n точек по миру (не ближе gap м друг к другу; в ядре — core точек и gapCore), reach — дотянуться, respawn — через сколько секунд точка растёт снова;
    // kinds — вес вида точки по биому (core — ядро); yields[вид][ступень] — [вещь, сколько, шанс]; ступень по уровню места: до 20, до 40, выше
    gather: { n: 260, nOuter: 520, core: 30, gapCore: 11, gap: 22, reach: 1.9, respawn: 300,     // core — сколько из n в ядре (ниже 20 ур.)
      kinds: { core: { herb: 2, ore: 1, hide: 1 }, forest: { herb: 3, hide: 2, ore: 1 }, swamp: { herb: 3, hide: 1 }, mountains: { ore: 4, herb: 1 }, waste: { ore: 2, hide: 2 }, coast: { herb: 1, hide: 2, ore: 1 } },
      names: { herb: 'Травы', ore: 'Рудная жила', hide: 'Туша зверя' },
      yields: {
        herb: [[['m_grave_moss', 2, 1], ['m_amber', 1, .1]], [['m_grave_moss', 2, 1], ['m_ash_salt', 1, .6], ['m_amber', 1, .2]], [['m_ash_salt', 2, 1], ['m_amber', 1, .35], ['m_black_resin', 1, .2]]],
        ore: [[['m_ore', 2, 1], ['m_coal', 1, .5]], [['m_ore', 3, 1], ['m_coal', 1, 1], ['m_soot', 1, .2]], [['m_ore', 3, 1], ['m_coal', 2, 1], ['m_soot', 1, .4], ['m_black_resin', 1, .25]]],
        hide: [[['m_beast_hide', 1, 1], ['m_sinew', 1, .5], ['m_tallow', 1, .5]], [['m_beast_hide', 2, 1], ['m_sinew', 1, 1], ['m_tempered_sinew', 1, .3]], [['m_beast_hide', 2, 1], ['m_tempered_sinew', 1, .6], ['m_tallow', 1, 1]]] } },
    // ремёсла: навык 0…max; предел растёт с уровнем героя: base + perLv × ур.; рост за изготовление по разнице «навык − требование рецепта»:
    // меньше 10 — +1 наверняка, меньше 20 — с шансом .6, меньше 30 — .25, дальше — ничего. Алхимия и кожевенное — где угодно, если рядом нет врагов (safeR)
    trades: { max: 150, base: 25, perLv: 3, chance: [[10, 1], [20, .6], [30, .25]], safeR: 14 },
    // ездовое животное: скорость ×speed; сесть нельзя, если враги ближе safeR; удар, перекат, умение и урон — спешивают
    mount: { speed: 1.65, safeR: 16 },
    // повозки между узлами: в лагере и в городах-узлах зон; open — открывается, когда герой рядом; цена = base + perM × расстояние, пепел
    coach: { reach: 3, open: 14, base: 15, perM: .12, safeR: 14 },
    // репутация у четырёх сторон: пороги ступеней; за что даётся; brodDiscount — скидка у торговцев за ступень у Пепельного Брода;
    // rewards — награды за ступень (tier): вещь item или конь mount; покупаются у торговца, кузнеца или капитана
    rep: {
      factions: [{ id: 'brod', name: 'Пепельный Брод', text: 'Торговцы и ремесленники лагеря.' }, { id: 'zastava', name: 'Застава', text: 'Капитан Бруно и его стража.' },
        { id: 'band', name: 'Пепельные Крылья', text: 'Отряд Аларика.' }, { id: 'olkh', name: 'Ольховые общины', text: 'Посёлки за ядром.' }],
      tiers: [[0, 'Нейтралитет'], [500, 'Дружелюбие'], [1500, 'Уважение'], [3500, 'Почтение'], [7500, 'Восхищение']],
      quest: 250, scene: 300, kill: 2, elite: 6, boss: 150, dungeon: 200, brodDiscount: .05,
      givers: { merchant: 'brod', smith: 'brod', captain: 'zastava', irma: 'band', timka: 'band', kord: 'band', alaric: 'band', quarter: 'zastava', smuggler: 'brod', masked: 'band', widow: 'olkh', gedeon: 'brod' },
      dungeons: { inst_brod: 'zastava', inst_olkh: 'olkh' },
      rewards: [
        { f: 'zastava', tier: 1, mount: true, name: 'Конь Заставы', ash: 600, text: 'Быстрее в пути. Удар или перекат — спешиться.' },
        { f: 'zastava', tier: 2, item: 'tome_blackarm', ash: 500 }, { f: 'zastava', tier: 3, item: 'a_cloak_pelt_black', ash: 900 },
        { f: 'brod', tier: 1, item: 'tome_medic', ash: 150 }, { f: 'brod', tier: 2, item: 'p_elixir', ash: 200 }, { f: 'brod', tier: 3, item: 'tome_alloy', ash: 700 },
        { f: 'band', tier: 1, item: 'p_heal3', ash: 90 }, { f: 'band', tier: 2, item: 'tome_fine', ash: 350 }, { f: 'band', tier: 4, item: 'a_cloak_wings', ash: 1500 },
        { f: 'olkh', tier: 1, item: 'tome_leather', ash: 150 }, { f: 'olkh', tier: 2, item: 'p_skin', ash: 160 }, { f: 'olkh', tier: 3, item: 'tome_smelting', ash: 400 },
        // «Восхищение» (этап 3 «круче»): у каждой фракции — награда на высшей ступени
        { f: 'zastava', tier: 4, item: 'm_talisman_aim', ash: 1800 }, { f: 'brod', tier: 4, item: 'm_talisman_fortune', ash: 1800 }, { f: 'olkh', tier: 4, item: 'a_cloak_shroud_ash', ash: 1600 }, { f: 'band', tier: 3, item: 'r_signet_thirst', ash: 1100 }
      ] }
  },
  // клеймо (этап 7, после Затмения): ночью наверху каждые every с к герою приходят n теней type (не больше max разом), на r м; first — первая через столько с
  brand: { type: 'brandshade', every: 40, first: 12, n: [1, 2], max: 4, r: [9, 13] },
  // подземелья зон (этап 5): отдельные уровни с боссами по залам. at — вход наверху (нет — генератор ищет место в зоне zone с уровнем lv ±1);
  // level — уровень врагов внутри; base — уровень, под который настроены боссы; bosses — { type, room, attacks, phases, loot (вещи босса) }.
  // Механики атак: slam (круг), nova (кольцо), charge (рывок), beam (луч), pools (лужи «не стой в огне»), cast (чтение — сбить тяжёлым ударом или умением);
  // фазы: summon (подмога), shield (неуязвим, пока жива подмога), enrage (ярость). heroic — героическая сложность: с уровня lv героя;
  // враги и боссы — уровня lv, боссы × hp и × dmg, вещи с босса на il выше и ещё extra вещей. loot2 — шанс второй вещи босса
  instances: {
    heroic: { lv: 60, hp: 1.6, dmg: 1.3, il: 6, extra: 1 }, loot2: .35,
    list: [
      { id: 'inst_brod', name: 'Катакомбы Брода', zone: 'brod', at: { x: 4, z: -66 }, back: { x: 4, z: -63 }, level: 14, base: 14, depth: .7, danger: 2,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'ossuary', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'chapel', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'pit', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], foes: [['ghoul', 3], ['imp', 2], ['witch', 1], ['hound', 1]], spawns: [{ room: 'gallery', n: 4 }, { room: 'niches', n: 4 }, { room: 'c5', n: 1, type: 'ghoul' }],
        entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        chests: [{ kind: 'coffer', x: 21, z: 3.5 }, { kind: 'grave', x: 40, z: -25 }, { kind: 'altar', x: 69, z: -42 }, { kind: 'ironchest', x: 69, z: -36 }],
        bosses: [
          { type: 'gravekeeper', room: 'ossuary', loot: ['d_spade_olm', 'd_shroud_olm'],
            attacks: [{ kind: 'slam', wind: .9, r: 3.8, mul: 1, cd: 3, range: 4.5 }, { kind: 'pools', wind: .8, n: 3, r: 2.2, dur: 9, mul: .5, cd: 9, range: 99 }],
            phases: [{ at: .5, summon: { type: 'ghoul', n: 2 } }, { at: .25, enrage: true }] },
          { type: 'ashsister', room: 'chapel', loot: ['d_veil_sister', 'd_wand_sister'],
            attacks: [{ kind: 'cast', name: 'Пепельный плач', wind: 3, r: 99, mul: 4, cd: 11, range: 99 }, { kind: 'nova', wind: 1.1, r: 7, inner: 2.4, mul: 1, cd: 8, range: 99 }, { kind: 'charge', wind: .8, len: 12, width: 2.4, mul: 1, cd: 6, range: 14 }],
            phases: [{ at: .3, enrage: true }] },
          { type: 'boneshepherd', room: 'pit', loot: ['d_crook_shepherd', 'd_ring_shepherd', 'd_bow_shepherd'],
            attacks: [{ kind: 'beam', wind: 1.2, len: 14, width: 1.6, dur: 4, sweep: .7, mul: .9, cd: 12, range: 99 }, { kind: 'slam', wind: .8, r: 4.2, mul: 1, cd: 3, range: 4.8 }, { kind: 'pools', wind: .8, n: 2, r: 2.4, dur: 8, mul: .5, cd: 11, range: 99 }],
            phases: [{ at: .6, summon: { type: 'ghoul', n: 3 }, shield: true }, { at: .3, enrage: true }] }
        ] },
      { id: 'inst_olkh', name: 'Ольховый Курган', zone: 'olkh', lv: 22, level: 23, base: 23, depth: 1.1, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'roots', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'den', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'thicket', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'grove', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'hollow', x: 58, z: -42, w: 14, d: 14 }, { id: 'c6', x: 58, z: -31, w: 2.4, d: 8 },
          { id: 'throne', x: 58, z: -16, w: 20, d: 22 }],
        doors: [], foes: [['hound', 3], ['brute', 2], ['ghoul', 2], ['shield', 1], ['archer', 1]], spawns: [{ room: 'roots', n: 4 }, { room: 'thicket', n: 4 }, { room: 'c5', n: 2, type: 'hound' }, { room: 'c6', n: 1, type: 'brute' }],
        entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        chests: [{ kind: 'chest', x: 21, z: -3.5 }, { kind: 'coffer', x: 40, z: -17 }, { kind: 'ironchest', x: 63, z: -46 }, { kind: 'altar', x: 66, z: -8 }],
        bosses: [
          { type: 'mossbeast', room: 'den', loot: ['d_maul_moss', 'd_hide_moss'],
            attacks: [{ kind: 'charge', wind: .9, len: 13, width: 2.8, mul: 1.1, cd: 6, range: 15 }, { kind: 'slam', wind: .8, r: 4.2, mul: 1, cd: 3, range: 4.8 }, { kind: 'pools', wind: .9, n: 3, r: 2.4, dur: 7, mul: .5, cd: 11, range: 99 }],
            phases: [{ at: .3, enrage: true }] },
          { type: 'thornwitch', room: 'grove', loot: ['d_staff_thorn', 'd_hood_thorn'],
            attacks: [{ kind: 'cast', name: 'Терновая буря', wind: 2.6, r: 99, mul: 2, cd: 12, range: 99 }, { kind: 'pools', wind: .7, n: 4, r: 2.2, dur: 9, mul: .5, cd: 8, range: 99 }, { kind: 'nova', wind: 1, r: 7.5, inner: 2.5, mul: 1, cd: 9, range: 99 }],
            phases: [{ at: .5, summon: { type: 'hound', n: 3 } }, { at: .25, enrage: true }] },
          { type: 'greywolf', room: 'hollow', loot: ['d_fangs_wolf', 'd_boots_wolf'],
            attacks: [{ kind: 'charge', wind: .7, len: 14, width: 2.4, mul: 1.1, cd: 4.5, range: 16 }, { kind: 'slam', wind: .6, r: 3.4, mul: .9, cd: 2.5, range: 3.8 }],
            phases: [{ at: .6, summon: { type: 'hound', n: 4 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'oakking', room: 'throne', loot: ['d_crown_oak', 'd_greatsword_oak', 'd_amulet_oak'],
            attacks: [{ kind: 'beam', wind: 1.2, len: 16, width: 1.8, dur: 4.5, sweep: .8, mul: .9, cd: 11, range: 99 }, { kind: 'slam', wind: .9, r: 4.8, mul: 1.1, cd: 3, range: 5.2 },
              { kind: 'cast', name: 'Гнев леса', wind: 2.8, r: 99, mul: 2.2, cd: 15, range: 99 }, { kind: 'pools', wind: .8, n: 3, r: 2.6, dur: 9, mul: .5, cd: 10, range: 99 }],
            phases: [{ at: .7, summon: { type: 'brute', n: 2 }, shield: true }, { at: .4, summon: { type: 'hound', n: 3 } }, { at: .25, enrage: true }] }
        ] },
      // Акт II (этап 7): по подземелью на зону — та же раскладка залов, что у Катакомб (b1–b3 — залы боссов)
      { id: 'inst_moss', name: 'Затонувшая часовня', zone: 'moss', lv: 26, level: 26, base: 26, depth: 1.15, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['drowned', 4], ['kad_soldier', 2], ['kad_xbow', 1], ['ghoul', 1]], spawns: [{ room: 'gallery', n: 4 }, { room: 'niches', n: 4 }, { room: 'c5', n: 1, type: 'drowned' }],
        chests: [{ kind: 'coffer', x: 21, z: 3.5 }, { kind: 'grave', x: 40, z: -25 }, { kind: 'altar', x: 69, z: -42 }],
        bosses: [
          { type: 'sapper', room: 'b1', loot: ['d_fuse_sapper', 'd_apron_sapper'],
            attacks: [{ kind: 'slam', wind: .8, r: 3.8, mul: 1, cd: 3, range: 4.5 }, { kind: 'charge', wind: .8, len: 12, width: 2.6, mul: 1.1, cd: 6, range: 14 }, { kind: 'pools', wind: .8, n: 3, r: 2.4, dur: 8, mul: .55, cd: 9, range: 99 }],
            phases: [{ at: .3, enrage: true }] },
          { type: 'drownedmaid', room: 'b2', loot: ['d_veil_drowned', 'd_wand_drowned'],
            attacks: [{ kind: 'cast', name: 'Зов глубины', wind: 2.8, r: 99, mul: 3.2, cd: 12, range: 99 }, { kind: 'nova', wind: 1.1, r: 7.5, inner: 2.5, mul: 1, cd: 8, range: 99 }, { kind: 'slam', wind: .7, r: 3.4, mul: .9, cd: 3, range: 4 }],
            phases: [{ at: .5, summon: { type: 'drowned', n: 3 } }, { at: .25, enrage: true }] },
          { type: 'silt', room: 'b3', loot: ['d_staff_silt', 'd_ring_silt', 'd_bow_silt'],
            attacks: [{ kind: 'beam', wind: 1.2, len: 14, width: 1.8, dur: 4, sweep: .7, mul: .9, cd: 12, range: 99 }, { kind: 'slam', wind: .9, r: 4.5, mul: 1.1, cd: 3, range: 5 }, { kind: 'pools', wind: .8, n: 3, r: 2.5, dur: 8, mul: .5, cd: 10, range: 99 }],
            phases: [{ at: .6, summon: { type: 'drowned', n: 3 }, shield: true }, { at: .3, enrage: true }] }
        ] },
      { id: 'inst_pass', name: 'Твердыня Перевала', zone: 'foot', lv: 30, level: 30, base: 30, depth: 1.25, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['kad_soldier', 3], ['kad_xbow', 2], ['kad_spear', 2], ['kad_banner', 1]], spawns: [{ room: 'gallery', n: 4 }, { room: 'niches', n: 4 }, { room: 'c5', n: 1, type: 'kad_banner' }],
        chests: [{ kind: 'ironchest', x: 21, z: 3.5 }, { kind: 'chest', x: 40, z: -25 }, { kind: 'ironchest', x: 69, z: -42 }],
        bosses: [
          { type: 'gatewarden', room: 'b1', loot: ['d_plate_gate', 'd_mace_gate'],
            attacks: [{ kind: 'charge', wind: .9, len: 13, width: 2.8, mul: 1.1, cd: 6, range: 15 }, { kind: 'slam', wind: .8, r: 4.2, mul: 1, cd: 3, range: 4.8 }],
            phases: [{ at: .5, summon: { type: 'kad_spear', n: 2 } }, { at: .3, enrage: true }] },
          { type: 'gneis', room: 'b2', loot: ['d_cloak_gneis', 'd_xbow_gneis'],
            attacks: [{ kind: 'cast', name: 'Приказ стрелкам', wind: 2.5, r: 99, mul: 3, cd: 11, range: 99 }, { kind: 'nova', wind: 1, r: 7, inner: 2.4, mul: 1, cd: 8, range: 99 }, { kind: 'slam', wind: .6, r: 3.2, mul: .9, cd: 2.5, range: 3.6 }],
            phases: [{ at: .7, summon: { type: 'kad_xbow', n: 2 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'borot', room: 'b3', loot: ['d_maul_borot', 'd_helm_borot', 'd_amulet_borot'],
            attacks: [{ kind: 'slam', wind: .9, r: 5, mul: 1.2, cd: 3, range: 5.5 }, { kind: 'charge', wind: .9, len: 14, width: 3, mul: 1.2, cd: 6, range: 16 }, { kind: 'nova', wind: 1.2, r: 8, inner: 2.8, mul: 1, cd: 9, range: 99 }],
            phases: [{ at: .5, summon: { type: 'kad_soldier', n: 2 } }, { at: .3, enrage: true }] }
        ] },
      { id: 'inst_forge', name: 'Ржавая кузня', zone: 'rust', lv: 33, level: 33, base: 33, depth: 1.35, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['golem', 2], ['blackdog', 2], ['kad_soldier', 2], ['bomber', 2]], spawns: [{ room: 'gallery', n: 4 }, { room: 'niches', n: 4 }, { room: 'c5', n: 1, type: 'golem' }],
        chests: [{ kind: 'ironchest', x: 21, z: 3.5 }, { kind: 'coffer', x: 40, z: -25 }, { kind: 'ironchest', x: 69, z: -42 }],
        bosses: [
          { type: 'armorer', room: 'b1', loot: ['d_sword_armorer', 'd_boots_armorer'],
            attacks: [{ kind: 'slam', wind: .8, r: 4.2, mul: 1, cd: 3, range: 4.8 }, { kind: 'pools', wind: .8, n: 3, r: 2.4, dur: 8, mul: .55, cd: 9, range: 99 }, { kind: 'charge', wind: .9, len: 12, width: 2.6, mul: 1.1, cd: 7, range: 14 }],
            phases: [{ at: .3, enrage: true }] },
          { type: 'firegolem', room: 'b2', loot: ['d_core_golem', 'd_staff_golem'],
            attacks: [{ kind: 'beam', wind: 1.1, len: 14, width: 1.8, dur: 4, sweep: .9, mul: .9, cd: 11, range: 99 }, { kind: 'nova', wind: 1.1, r: 7.5, inner: 2.6, mul: 1, cd: 8, range: 99 }, { kind: 'slam', wind: .8, r: 4, mul: 1, cd: 3, range: 4.6 }],
            phases: [{ at: .5, summon: { type: 'golem', n: 1 }, shield: true }, { at: .25, enrage: true }] },
          { type: 'smelter', room: 'b3', loot: ['d_greatsword_smelt', 'd_plate_smelt', 'd_bow_smelt'],
            attacks: [{ kind: 'cast', name: 'Литьё', wind: 2.8, r: 99, mul: 3.4, cd: 13, range: 99 }, { kind: 'pools', wind: .8, n: 4, r: 2.4, dur: 8, mul: .55, cd: 9, range: 99 }, { kind: 'slam', wind: .9, r: 4.8, mul: 1.1, cd: 3, range: 5.2 }],
            phases: [{ at: .7, summon: { type: 'golem', n: 1 }, shield: true }, { at: .3, enrage: true }] }
        ] },
      // Акт III (этап 7)
      { id: 'inst_tower', name: 'Башня Велиграда', zone: 'grey', lv: 37, level: 37, base: 37, depth: 1.45, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['royal_guard', 3], ['blackdog', 2], ['archer', 1], ['shield', 1]], spawns: [{ room: 'gallery', n: 4 }, { room: 'niches', n: 4 }, { room: 'c5', n: 1, type: 'royal_guard' }],
        chests: [{ kind: 'ironchest', x: 21, z: 3.5 }, { kind: 'chest', x: 40, z: -25 }, { kind: 'ironchest', x: 69, z: -42 }],
        bosses: [
          { type: 'towerwarden', room: 'b1', loot: ['d_halberd_tower', 'd_boots_tower'],
            attacks: [{ kind: 'slam', wind: .8, r: 4.2, mul: 1, cd: 3, range: 4.8 }, { kind: 'charge', wind: .9, len: 13, width: 2.8, mul: 1.1, cd: 6, range: 15 }],
            phases: [{ at: .5, summon: { type: 'blackdog', n: 2 } }, { at: .3, enrage: true }] },
          { type: 'keymaster', room: 'b2', loot: ['d_ring_keys', 'd_dagger_keys'],
            attacks: [{ kind: 'cast', name: 'Запоры', wind: 2.6, r: 99, mul: 3.2, cd: 12, range: 99 }, { kind: 'pools', wind: .8, n: 3, r: 2.4, dur: 8, mul: .55, cd: 9, range: 99 }, { kind: 'nova', wind: 1, r: 7, inner: 2.4, mul: 1, cd: 8, range: 99 }],
            phases: [{ at: .6, summon: { type: 'blackdog', n: 2 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'towerhound', room: 'b3', loot: ['d_cloak_hound', 'd_axe_hound', 'd_bow_hound'],
            attacks: [{ kind: 'charge', wind: .7, len: 14, width: 2.6, mul: 1.1, cd: 4.5, range: 16 }, { kind: 'slam', wind: .6, r: 3.6, mul: .95, cd: 2.5, range: 4 }, { kind: 'nova', wind: 1, r: 7.5, inner: 2.5, mul: 1, cd: 9, range: 99 }],
            phases: [{ at: .5, summon: { type: 'blackdog', n: 3 } }, { at: .3, enrage: true }] }
        ] },
      { id: 'inst_dusk', name: 'Маяк Затмения', zone: 'dusk', lv: 40, level: 40, base: 40, depth: 1.6, danger: 3,     // Затмённое побережье 38–42 (2026-10-20): маяк, что светит чёрным
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['eclipse_fiend', 3], ['drowned', 2], ['shade', 2], ['blackdog', 1]], spawns: [{ room: 'gallery', n: 4 }, { room: 'niches', n: 4 }, { room: 'c5', n: 1, type: 'eclipse_fiend' }],
        chests: [{ kind: 'ironchest', x: 21, z: 3.5 }, { kind: 'chest', x: 40, z: -25 }, { kind: 'ironchest', x: 69, z: -42 }],
        bosses: [
          { type: 'lampwarden', room: 'b1', loot: ['d_hammer_lamp', 'd_helm_lamp'],
            attacks: [{ kind: 'slam', wind: .8, r: 4.2, mul: 1, cd: 3, range: 4.8 }, { kind: 'charge', wind: .9, len: 13, width: 2.8, mul: 1.1, cd: 6, range: 15 }, { kind: 'nova', wind: 1.1, r: 7.5, inner: 2.5, mul: 1, cd: 9, range: 99 }],
            phases: [{ at: .5, summon: { type: 'shade', n: 2 } }, { at: .3, enrage: true }] },
          { type: 'tidecaller', room: 'b2', loot: ['d_staff_tide', 'd_ring_tide'],
            attacks: [{ kind: 'cast', name: 'Чёрный прилив', wind: 2.6, r: 99, mul: 3.2, cd: 12, range: 99 }, { kind: 'pools', wind: .8, n: 3, r: 2.5, dur: 8, mul: .55, cd: 9, range: 99 }, { kind: 'beam', wind: 1.2, len: 14, width: 1.8, dur: 4, sweep: .7, mul: .9, cd: 12, range: 99 }],
            phases: [{ at: .6, summon: { type: 'drowned', n: 3 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'tidewyrm', room: 'b3', loot: ['d_cloak_wyrm', 'd_spear_wyrm', 'd_crossbow_wyrm'],
            attacks: [{ kind: 'charge', wind: .7, len: 14, width: 2.6, mul: 1, cd: 5, range: 16 }, { kind: 'slam', wind: .7, r: 4, mul: 1, cd: 3, range: 4.5 }, { kind: 'pools', wind: .8, n: 4, r: 2.4, dur: 8, mul: .4, cd: 10, range: 99 }, { kind: 'nova', wind: 1, r: 8, inner: 2.6, mul: 1, cd: 9, range: 99 }],
            phases: [{ at: .6, summon: { type: 'eclipse_fiend', n: 1 }, shield: true }, { at: .35, summon: { type: 'drowned', n: 2 } }, { at: .25, enrage: true }] }
        ] },
      { id: 'inst_barrow', name: 'Курганы Великой войны', zone: 'war', lv: 44, level: 44, base: 44, depth: 1.75, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['war_ghost', 3], ['lunger', 2], ['ghoul', 2], ['shade', 1]], spawns: [{ room: 'gallery', n: 4 }, { room: 'niches', n: 4 }, { room: 'c5', n: 1, type: 'war_ghost' }],
        chests: [{ kind: 'grave', x: 21, z: 3.5 }, { kind: 'coffer', x: 40, z: -25 }, { kind: 'altar', x: 69, z: -42 }],
        bosses: [
          { type: 'bloodbanner', room: 'b1', loot: ['d_spear_banner', 'd_plate_banner'],
            attacks: [{ kind: 'slam', wind: .8, r: 4.4, mul: 1, cd: 3, range: 5 }, { kind: 'nova', wind: 1.1, r: 7.5, inner: 2.6, mul: 1, cd: 8, range: 99 }],
            phases: [{ at: .6, summon: { type: 'war_ghost', n: 2 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'namelessking', room: 'b2', loot: ['d_crown_nameless', 'd_staff_nameless', 'd_bow_nameless'],
            attacks: [{ kind: 'beam', wind: 1.2, len: 15, width: 1.8, dur: 4.5, sweep: .8, mul: .9, cd: 11, range: 99 }, { kind: 'cast', name: 'Слово мёртвых', wind: 2.8, r: 99, mul: 3.4, cd: 13, range: 99 }, { kind: 'slam', wind: .8, r: 4.2, mul: 1, cd: 3, range: 4.8 }],
            phases: [{ at: .3, enrage: true }] },
          { type: 'gravewight', room: 'b3', loot: ['d_scythe_wight', 'd_robe_wight', 'd_ring_wight'],
            attacks: [{ kind: 'pools', wind: .8, n: 4, r: 2.6, dur: 8, mul: .55, cd: 9, range: 99 }, { kind: 'charge', wind: .9, len: 14, width: 3, mul: 1.2, cd: 6, range: 16 }, { kind: 'cast', name: 'Могильный зов', wind: 3, r: 99, mul: 2.6, cd: 15, range: 99 }, { kind: 'slam', wind: .9, r: 4.8, mul: 1.1, cd: 3, range: 5.2 }],
            phases: [{ at: .7, summon: { type: 'ghoul', n: 2 }, shield: true }, { at: .3, enrage: true }] }
        ] },
      // Акт IV (этап 7)
      { id: 'inst_nest', name: 'Гнездо Отступника', zone: 'rot', lv: 48, level: 48, base: 48, depth: 1.9, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['eclipse_fiend', 3], ['drowned', 2], ['shrieker', 1], ['ghoul', 2]], spawns: [{ room: 'gallery', n: 4 }, { room: 'niches', n: 4 }, { room: 'c5', n: 1, type: 'shrieker' }],
        chests: [{ kind: 'coffer', x: 21, z: 3.5 }, { kind: 'grave', x: 40, z: -25 }, { kind: 'altar', x: 69, z: -42 }],
        bosses: [
          { type: 'feeder', room: 'b1', loot: ['d_cleaver_feeder', 'd_apron_feeder'],
            attacks: [{ kind: 'slam', wind: .8, r: 4.2, mul: 1, cd: 3, range: 4.8 }, { kind: 'pools', wind: .8, n: 3, r: 2.5, dur: 8, mul: .55, cd: 9, range: 99 }],
            phases: [{ at: .5, summon: { type: 'ghoul', n: 2 } }, { at: .3, enrage: true }] },
          { type: 'swarm', room: 'b2', loot: ['d_wand_swarm', 'd_hood_swarm'],
            attacks: [{ kind: 'charge', wind: .7, len: 13, width: 2.6, mul: 1.1, cd: 5, range: 15 }, { kind: 'nova', wind: 1, r: 7, inner: 2.4, mul: 1, cd: 8, range: 99 }],
            phases: [{ at: .7, summon: { type: 'eclipse_fiend', n: 2 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'nestlord', room: 'b3', loot: ['d_greataxe_nest', 'd_crown_nest', 'd_ring_nest'],
            attacks: [{ kind: 'beam', wind: 1.2, len: 15, width: 1.8, dur: 4.5, sweep: .8, mul: .9, cd: 12, range: 99 }, { kind: 'slam', wind: .9, r: 4.8, mul: 1.1, cd: 3, range: 5.2 }, { kind: 'pools', wind: .8, n: 3, r: 2.6, dur: 8, mul: .55, cd: 10, range: 99 }],
            phases: [{ at: .6, summon: { type: 'eclipse_fiend', n: 2 }, shield: true }, { at: .3, enrage: true }] }
        ] },
      { id: 'inst_abbey', name: 'Монастырь Безмолвия', zone: 'mute', lv: 52, level: 52, base: 52, depth: 2.05, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['shrieker', 2], ['troll', 1], ['war_ghost', 2], ['lunger', 2]], spawns: [{ room: 'gallery', n: 4 }, { room: 'niches', n: 4 }, { room: 'c5', n: 1, type: 'troll' }],
        chests: [{ kind: 'altar', x: 21, z: 3.5 }, { kind: 'coffer', x: 40, z: -25 }, { kind: 'altar', x: 69, z: -42 }],
        bosses: [
          { type: 'abbeyshriek', room: 'b1', loot: ['d_staff_shriek', 'd_veil_shriek'],
            attacks: [{ kind: 'cast', name: 'Вопль', wind: 2.6, r: 99, mul: 2.8, cd: 12, range: 99 }, { kind: 'nova', wind: 1, r: 7, inner: 2.4, mul: 1, cd: 8, range: 99 }, { kind: 'slam', wind: .6, r: 3.4, mul: .9, cd: 3, range: 4 }],
            phases: [{ at: .5, summon: { type: 'shrieker', n: 1 } }, { at: .3, enrage: true }] },
          { type: 'choir', room: 'b2', loot: ['d_bell_choir', 'd_robe_choir'],
            attacks: [{ kind: 'beam', wind: 1.2, len: 15, width: 1.8, dur: 4.5, sweep: .9, mul: .9, cd: 11, range: 99 }, { kind: 'nova', wind: 1.1, r: 7.5, inner: 2.6, mul: 1, cd: 8, range: 99 }],
            phases: [{ at: .6, summon: { type: 'war_ghost', n: 2 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'abbot', room: 'b3', loot: ['d_mace_abbot', 'd_plate_abbot', 'd_amulet_abbot'],
            attacks: [{ kind: 'cast', name: 'Тишина', wind: 2.8, r: 99, mul: 1.6, cd: 16, range: 99 }, { kind: 'pools', wind: .8, n: 3, r: 2.6, dur: 8, mul: .55, cd: 10, range: 99 }, { kind: 'slam', wind: .9, r: 4.8, mul: 1.1, cd: 3, range: 5.2 }, { kind: 'charge', wind: .9, len: 14, width: 3, mul: 1.1, cd: 7, range: 16 }],
            phases: [{ at: .7, summon: { type: 'shrieker', n: 1 }, shield: true }, { at: .3, enrage: true }] }
        ] },
      // рейд (этап 8): пять залов боссов, герой и четыре бойца; добыча — «Доспех Затмения» (комплект) и своё оружие
      // рейды 20 и 40 (4.18, просьба владельца): на 10 — у входа уровень зоны
      { id: 'raid_oak', name: 'Логово Древнего Дуба', raid: true, zone: 'olkh', lv: 21, level: 21, base: 21, depth: 1.6, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }, { id: 'c6', x: 61, z: -58, w: 2.4, d: 12 },
          { id: 'b4', x: 61, z: -72, w: 16, d: 16 }, { id: 'c7', x: 72, z: -72, w: 6, d: 2.4 }, { id: 'b5', x: 89, z: -72, w: 28, d: 28 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['hound', 3], ['ghoul', 2], ['brute', 2], ['imp', 2]], spawns: [{ room: 'gallery', n: 6 }, { room: 'niches', n: 6 }],
        chests: [{ kind: 'altar', x: 21, z: 3.5 }, { kind: 'ironchest', x: 40, z: -25 }, { kind: 'altar', x: 100, z: -72 }],
        bosses: [
          { type: 'barghest', room: 'b1', loot: ['d_fang_barghest', 'd_cloak_barghest'], attacks: [{ kind: 'charge', wind: .7, len: 13, width: 2.6, mul: 1.1, cd: 5, range: 15 }, { kind: 'slam', wind: .6, r: 3.4, mul: 1, cd: 3, range: 4 }, { kind: 'nova', wind: 1, r: 7, inner: 2.4, mul: .9, cd: 9, range: 99 }], phases: [{ at: .4, summon: { type: 'hound', n: 4 } }, { at: .2, enrage: true }] },
          { type: 'rootgnaw', room: 'b2', loot: ['d_club_root', 'd_greaves_root'], attacks: [{ kind: 'slam', wind: .8, r: 4, mul: 1.1, cd: 3, range: 4.6 }, { kind: 'pools', wind: .8, n: 3, r: 2.4, dur: 8, mul: .55, cd: 9, range: 99 }], phases: [{ at: .3, enrage: true }] },
          { type: 'hagmother', room: 'b3', loot: ['d_wand_hag', 'd_hood_hag'], attacks: [{ kind: 'cast', name: 'Проклятие чащи', wind: 2.6, r: 99, mul: 3, cd: 12, range: 99 }, { kind: 'pools', wind: .8, n: 4, r: 2.4, dur: 8, mul: .55, cd: 9, range: 99 }, { kind: 'slam', wind: .7, r: 3.2, mul: .9, cd: 3, range: 3.8 }], phases: [{ at: .5, summon: { type: 'ghoul', n: 3 } }, { at: .25, enrage: true }] },
          { type: 'thornlord', room: 'b4', loot: ['d_sword_thorn', 'd_ring_thorn'], attacks: [{ kind: 'beam', wind: 1.2, len: 13, width: 1.8, dur: 3.5, sweep: .7, mul: .9, cd: 11, range: 99 }, { kind: 'slam', wind: .7, r: 3.8, mul: 1, cd: 3, range: 4.4 }, { kind: 'charge', wind: .8, len: 12, width: 2.6, mul: 1.05, cd: 7, range: 14 }], phases: [{ at: .6, summon: { type: 'brute', n: 3 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'oldoak', room: 'b5', loot: ['d_staff_oak', 'd_acorn_crown'], attacks: [{ kind: 'slam', wind: .9, r: 4.6, mul: 1.15, cd: 3, range: 5 }, { kind: 'nova', wind: 1.2, r: 8.5, inner: 3, mul: 1, cd: 9, range: 99 }, { kind: 'pools', wind: .8, n: 4, r: 2.6, dur: 8, mul: .55, cd: 10, range: 99 }, { kind: 'cast', name: 'Корни мира', wind: 2.8, r: 99, mul: 3.2, cd: 13, range: 99 }], phases: [{ at: .7, summon: { type: 'ghoul', n: 4 }, shield: true }, { at: .4, summon: { type: 'hound', n: 4 } }, { at: .2, enrage: true }] }
        ] },
      { id: 'raid_cathedral', name: 'Затонувший собор', raid: true, zone: 'dusk', lv: 40, level: 41, base: 41, depth: 2.0, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }, { id: 'c6', x: 61, z: -58, w: 2.4, d: 12 },
          { id: 'b4', x: 61, z: -72, w: 16, d: 16 }, { id: 'c7', x: 72, z: -72, w: 6, d: 2.4 }, { id: 'b5', x: 89, z: -72, w: 28, d: 28 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['drowned', 4], ['war_ghost', 2], ['ghoul', 2], ['kad_xbow', 1]], spawns: [{ room: 'gallery', n: 6 }, { room: 'niches', n: 6 }],
        chests: [{ kind: 'altar', x: 21, z: 3.5 }, { kind: 'ironchest', x: 40, z: -25 }, { kind: 'altar', x: 100, z: -72 }],
        bosses: [
          { type: 'saltwarden', room: 'b1', loot: ['d_hammer_salt', 'd_plate_salt'], attacks: [{ kind: 'slam', wind: .8, r: 4.4, mul: 1.1, cd: 3, range: 5 }, { kind: 'charge', wind: .8, len: 13, width: 2.8, mul: 1.1, cd: 6, range: 15 }], phases: [{ at: .3, enrage: true }] },
          { type: 'drownchoir', room: 'b2', loot: ['d_bell_drown', 'd_hood_choir'], attacks: [{ kind: 'cast', name: 'Песнь утопленных', wind: 2.6, r: 99, mul: 3.1, cd: 12, range: 99 }, { kind: 'nova', wind: 1.1, r: 8, inner: 2.6, mul: 1, cd: 8, range: 99 }], phases: [{ at: .5, summon: { type: 'drowned', n: 4 } }, { at: .25, enrage: true }] },
          { type: 'abbess', room: 'b3', loot: ['d_staff_abbess', 'd_veil_abbess'], attacks: [{ kind: 'beam', wind: 1.1, len: 14, width: 1.8, dur: 3.5, sweep: .8, mul: .9, cd: 11, range: 99 }, { kind: 'pools', wind: .8, n: 4, r: 2.5, dur: 8, mul: .55, cd: 9, range: 99 }, { kind: 'slam', wind: .7, r: 3.4, mul: .95, cd: 3, range: 4 }], phases: [{ at: .6, summon: { type: 'war_ghost', n: 3 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'cathkraken', room: 'b4', loot: ['d_spear_kraken', 'd_hide_kraken'], attacks: [{ kind: 'pools', wind: .8, n: 5, r: 2.6, dur: 9, mul: .6, cd: 9, range: 99 }, { kind: 'slam', wind: .8, r: 4.6, mul: 1.15, cd: 3, range: 5 }, { kind: 'charge', wind: .8, len: 14, width: 3, mul: 1.1, cd: 7, range: 16 }], phases: [{ at: .5, summon: { type: 'drowned', n: 4 } }, { at: .25, enrage: true }] },
          { type: 'drowngod', room: 'b5', loot: ['d_trident_god', 'd_amulet_god'], attacks: [{ kind: 'beam', wind: 1.2, len: 16, width: 2, dur: 4, sweep: .8, mul: 1, cd: 11, range: 99 }, { kind: 'nova', wind: 1.2, r: 9, inner: 3, mul: 1.05, cd: 9, range: 99 }, { kind: 'cast', name: 'Зов бездны вод', wind: 2.8, r: 99, mul: 3.4, cd: 13, range: 99 }, { kind: 'slam', wind: .8, r: 4.6, mul: 1.15, cd: 3, range: 5 }], phases: [{ at: .7, summon: { type: 'drowned', n: 4 }, shield: true }, { at: .4, summon: { type: 'war_ghost', n: 4 } }, { at: .2, enrage: true }] }
        ] },
      // Г5 (4.18): подземелья колец 60–70 и 70–80 (на 4) и рейд кольца 70–80 (на 10) — раскладка генератором на каждый заход
      { id: 'inst_drown', name: 'Затопленная крипта', zone: 'drown', lv: 62, level: 63, base: 63, depth: 2.8, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['drowned', 4], ['ghoul', 2], ['war_ghost', 2], ['eclipse_fiend', 1]], spawns: [{ room: 'gallery', n: 5 }, { room: 'niches', n: 5 }],
        chests: [{ kind: 'altar', x: 21, z: 3.5 }, { kind: 'ironchest', x: 40, z: -25 }, { kind: 'altar', x: 69, z: -42 }],
        bosses: [
          { type: 'bogwarden', room: 'b1', loot: ['d_maul_bog', 'd_hide_bog'], attacks: [{ kind: 'slam', wind: .8, r: 4.2, mul: 1.1, cd: 3, range: 4.8 }, { kind: 'pools', wind: .8, n: 4, r: 2.6, dur: 8, mul: .6, cd: 9, range: 99 }, { kind: 'charge', wind: .8, len: 13, width: 2.8, mul: 1.1, cd: 7, range: 15 }], phases: [{ at: .3, enrage: true }] },
          { type: 'drownqueen', room: 'b2', loot: ['d_veil_queen', 'd_wand_queen'], attacks: [{ kind: 'cast', name: 'Песнь глубин', wind: 2.6, r: 99, mul: 3.2, cd: 12, range: 99 }, { kind: 'nova', wind: 1.1, r: 8, inner: 2.6, mul: 1, cd: 8, range: 99 }, { kind: 'slam', wind: .7, r: 3.4, mul: .9, cd: 3, range: 4 }], phases: [{ at: .5, summon: { type: 'drowned', n: 4 } }, { at: .25, enrage: true }] },
          { type: 'leviathan', room: 'b3', loot: ['d_fang_leviathan', 'd_scale_leviathan'], attacks: [{ kind: 'beam', wind: 1.2, len: 15, width: 2, dur: 4, sweep: .7, mul: .95, cd: 12, range: 99 }, { kind: 'slam', wind: .9, r: 4.6, mul: 1.15, cd: 3, range: 5 }, { kind: 'pools', wind: .8, n: 4, r: 2.6, dur: 8, mul: .55, cd: 10, range: 99 }], phases: [{ at: .6, summon: { type: 'drowned', n: 4 }, shield: true }, { at: .3, enrage: true }] }
        ] },
      { id: 'inst_ash', name: 'Пепельная гробница', zone: 'ashdesert', lv: 66, level: 67, base: 67, depth: 3.0, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['demon_guard', 3], ['brandshade', 2], ['golem', 2], ['bomber', 1]], spawns: [{ room: 'gallery', n: 5 }, { room: 'niches', n: 5 }],
        chests: [{ kind: 'altar', x: 21, z: 3.5 }, { kind: 'ironchest', x: 40, z: -25 }, { kind: 'altar', x: 69, z: -42 }],
        bosses: [
          { type: 'ashgolem', room: 'b1', loot: ['d_hammer_colossus', 'd_plate_colossus'], attacks: [{ kind: 'slam', wind: .9, r: 4.8, mul: 1.2, cd: 3, range: 5.2 }, { kind: 'charge', wind: .9, len: 14, width: 3, mul: 1.2, cd: 6, range: 16 }, { kind: 'nova', wind: 1.2, r: 9, inner: 3, mul: 1, cd: 9, range: 99 }], phases: [{ at: .3, enrage: true }] },
          { type: 'cinderpriest', room: 'b2', loot: ['d_staff_cinder', 'd_robe_cinder'], attacks: [{ kind: 'cast', name: 'Пепельная молитва', wind: 2.6, r: 99, mul: 3.3, cd: 12, range: 99 }, { kind: 'pools', wind: .8, n: 4, r: 2.6, dur: 8, mul: .6, cd: 9, range: 99 }, { kind: 'beam', wind: 1.1, len: 14, width: 1.8, dur: 3.5, sweep: .8, mul: .9, cd: 11, range: 99 }], phases: [{ at: .5, summon: { type: 'brandshade', n: 3 } }, { at: .25, enrage: true }] },
          { type: 'cinderlord', room: 'b3', loot: ['d_blade_cinder', 'd_crown_cinder'], attacks: [{ kind: 'nova', wind: 1.2, r: 9, inner: 3, mul: 1.05, cd: 9, range: 99 }, { kind: 'slam', wind: .8, r: 4.6, mul: 1.2, cd: 3, range: 5 }, { kind: 'charge', wind: .8, len: 15, width: 3, mul: 1.2, cd: 7, range: 17 }], phases: [{ at: .6, summon: { type: 'brandshade', n: 3 }, shield: true }, { at: .3, enrage: true }] }
        ] },
      { id: 'inst_rift', name: 'Гнилой разлом', zone: 'rift', lv: 74, level: 75, base: 75, depth: 3.3, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['ghoul', 3], ['troll', 2], ['eclipse_fiend', 2], ['hound', 2]], spawns: [{ room: 'gallery', n: 5 }, { room: 'niches', n: 5 }],
        chests: [{ kind: 'altar', x: 21, z: 3.5 }, { kind: 'ironchest', x: 40, z: -25 }, { kind: 'altar', x: 69, z: -42 }],
        bosses: [
          { type: 'rotmaw', room: 'b1', loot: ['d_cleaver_rot', 'd_hide_rot'], attacks: [{ kind: 'slam', wind: .8, r: 4.4, mul: 1.15, cd: 3, range: 5 }, { kind: 'pools', wind: .8, n: 5, r: 2.6, dur: 9, mul: .6, cd: 9, range: 99 }, { kind: 'charge', wind: .8, len: 14, width: 3, mul: 1.15, cd: 6, range: 16 }], phases: [{ at: .3, enrage: true }] },
          { type: 'sporemother', room: 'b2', loot: ['d_wand_spore', 'd_mask_spore'], attacks: [{ kind: 'cast', name: 'Облако спор', wind: 2.6, r: 99, mul: 3.4, cd: 12, range: 99 }, { kind: 'pools', wind: .8, n: 5, r: 2.6, dur: 9, mul: .6, cd: 9, range: 99 }, { kind: 'nova', wind: 1.1, r: 8, inner: 2.6, mul: 1, cd: 8, range: 99 }], phases: [{ at: .5, summon: { type: 'ghoul', n: 4 } }, { at: .25, enrage: true }] },
          { type: 'riftheart', room: 'b3', loot: ['d_staff_rift', 'd_heart_rift'], attacks: [{ kind: 'beam', wind: 1.2, len: 16, width: 2, dur: 4, sweep: .8, mul: 1, cd: 11, range: 99 }, { kind: 'nova', wind: 1.2, r: 9, inner: 3, mul: 1.05, cd: 9, range: 99 }, { kind: 'slam', wind: .9, r: 4.8, mul: 1.2, cd: 3, range: 5.2 }], phases: [{ at: .6, summon: { type: 'ghoul', n: 3 }, shield: true }, { at: .3, enrage: true }] }
        ] },
      { id: 'raid_throne', name: 'Престол Бездны', raid: true, zone: 'scorched', lv: 78, level: 80, base: 80, depth: 3.6, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }, { id: 'c6', x: 61, z: -58, w: 2.4, d: 12 },
          { id: 'b4', x: 61, z: -72, w: 16, d: 16 }, { id: 'c7', x: 72, z: -72, w: 6, d: 2.4 }, { id: 'b5', x: 89, z: -72, w: 28, d: 28 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['demon_guard', 3], ['eclipse_fiend', 3], ['brandshade', 2], ['troll', 2]], spawns: [{ room: 'gallery', n: 6 }, { room: 'niches', n: 6 }],
        chests: [{ kind: 'altar', x: 21, z: 3.5 }, { kind: 'ironchest', x: 40, z: -25 }, { kind: 'altar', x: 100, z: -72 }],
        bosses: [
          { type: 'voidwarden', room: 'b1', loot: ['d_halberd_void', 'd_plate_void'], attacks: [{ kind: 'slam', wind: .8, r: 4.6, mul: 1.15, cd: 3, range: 5 }, { kind: 'charge', wind: .8, len: 15, width: 3, mul: 1.2, cd: 6, range: 17 }, { kind: 'nova', wind: 1.2, r: 9, inner: 3, mul: 1, cd: 9, range: 99 }], phases: [{ at: .3, enrage: true }] },
          { type: 'twinflame', room: 'b2', loot: ['d_blades_twin', 'd_ring_twin'], attacks: [{ kind: 'beam', wind: 1.1, len: 15, width: 1.8, dur: 3.5, sweep: .9, mul: .95, cd: 10, range: 99 }, { kind: 'pools', wind: .8, n: 5, r: 2.6, dur: 8, mul: .6, cd: 9, range: 99 }, { kind: 'slam', wind: .7, r: 3.6, mul: 1, cd: 3, range: 4.2 }], phases: [{ at: .5, summon: { type: 'brandshade', n: 4 } }, { at: .25, enrage: true }] },
          { type: 'hollowqueen', room: 'b3', loot: ['d_bow_hollow', 'd_veil_hollow'], attacks: [{ kind: 'cast', name: 'Пустой зов', wind: 2.6, r: 99, mul: 3.4, cd: 12, range: 99 }, { kind: 'nova', wind: 1.1, r: 8.5, inner: 2.8, mul: 1.05, cd: 8, range: 99 }, { kind: 'pools', wind: .8, n: 5, r: 2.6, dur: 9, mul: .6, cd: 10, range: 99 }], phases: [{ at: .6, summon: { type: 'eclipse_fiend', n: 4 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'abyssmaw', room: 'b4', loot: ['d_axe_maw', 'd_hide_maw'], attacks: [{ kind: 'slam', wind: .9, r: 5, mul: 1.2, cd: 3, range: 5.4 }, { kind: 'charge', wind: .9, len: 16, width: 3.2, mul: 1.25, cd: 6, range: 18 }, { kind: 'pools', wind: .8, n: 5, r: 2.8, dur: 9, mul: .6, cd: 9, range: 99 }], phases: [{ at: .5, summon: { type: 'troll', n: 2 } }, { at: .25, enrage: true }] },
          { type: 'voidking', room: 'b5', loot: ['d_sword_voidking', 'd_crown_voidking'], attacks: [{ kind: 'beam', wind: 1.2, len: 18, width: 2.2, dur: 4.5, sweep: .9, mul: 1.05, cd: 11, range: 99 }, { kind: 'nova', wind: 1.2, r: 10, inner: 3.2, mul: 1.1, cd: 9, range: 99 }, { kind: 'cast', name: 'Слово Пустоты', wind: 2.8, r: 99, mul: 3.6, cd: 13, range: 99 }, { kind: 'slam', wind: .8, r: 4.8, mul: 1.2, cd: 3, range: 5.2 }], phases: [{ at: .7, summon: { type: 'eclipse_fiend', n: 3 }, shield: true }, { at: .4, summon: { type: 'brandshade', n: 3 } }, { at: .2, enrage: true }] }
        ] },
      { id: 'raid_hand', name: 'Врата Длани', raid: true, zone: 'heart', lv: 58, level: 60, base: 60, depth: 2.4, danger: 3,
        rooms: [{ id: 'hall', x: 0, z: 0, w: 10, d: 8 }, { id: 'c1', x: 8, z: 0, w: 6, d: 2.4 }, { id: 'gallery', x: 17, z: 0, w: 12, d: 10 }, { id: 'c2', x: 26, z: 0, w: 6, d: 2.4 },
          { id: 'b1', x: 36, z: 0, w: 14, d: 14 }, { id: 'c3', x: 36, z: -11, w: 2.4, d: 8 }, { id: 'niches', x: 36, z: -21, w: 12, d: 12 }, { id: 'c4', x: 36, z: -31, w: 2.4, d: 8 },
          { id: 'b2', x: 36, z: -42, w: 14, d: 14 }, { id: 'c5', x: 47, z: -42, w: 8, d: 2.4 }, { id: 'b3', x: 61, z: -42, w: 20, d: 20 }, { id: 'c6', x: 61, z: -58, w: 2.4, d: 12 },
          { id: 'b4', x: 61, z: -72, w: 16, d: 16 }, { id: 'c7', x: 72, z: -72, w: 6, d: 2.4 }, { id: 'b5', x: 89, z: -72, w: 28, d: 28 }],
        doors: [], entry: { x: -2.5, z: 0 }, exit: { x: -4, z: 1.6 },
        foes: [['demon_guard', 3], ['eclipse_fiend', 3], ['brandshade', 2], ['troll', 1]], spawns: [{ room: 'gallery', n: 5 }, { room: 'niches', n: 5 }, { room: 'c6', n: 2, type: 'demon_guard' }],
        chests: [{ kind: 'altar', x: 21, z: 3.5 }, { kind: 'ironchest', x: 40, z: -25 }, { kind: 'altar', x: 100, z: -72 }],
        bosses: [
          { type: 'gatebeast', room: 'b1', loot: ['rs_hand_head', 'rs_hand_body', 'rs_hand_cloak', 'rs_hand_boots', 'd_axe_gate'],
            attacks: [{ kind: 'charge', wind: .8, len: 14, width: 3, mul: 1.1, cd: 6, range: 16 }, { kind: 'slam', wind: .8, r: 4.8, mul: 1.1, cd: 3, range: 5.2 }, { kind: 'nova', wind: 1.1, r: 8, inner: 2.8, mul: 1, cd: 9, range: 99 }],
            phases: [{ at: .3, enrage: true }] },
          { type: 'hand_womb', room: 'b2', loot: ['rs_hand_head', 'rs_hand_body', 'rs_hand_cloak', 'rs_hand_boots', 'd_wand_womb'],
            attacks: [{ kind: 'pools', wind: .8, n: 3, r: 2.6, dur: 7, mul: .55, cd: 11, range: 99 }, { kind: 'slam', wind: .8, r: 4.6, mul: 1.1, cd: 3, range: 5 }],
            phases: [{ at: .6, summon: { type: 'eclipse_fiend', n: 2 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'hand_whisper', room: 'b3', loot: ['rs_hand_head', 'rs_hand_body', 'rs_hand_cloak', 'rs_hand_boots', 'd_staff_whisper'],
            attacks: [{ kind: 'cast', name: 'Шёпот бездны', wind: 2.8, r: 99, mul: 2.6, cd: 13, range: 99 }, { kind: 'beam', wind: 1.1, len: 16, width: 1.8, dur: 4.5, sweep: .9, mul: .9, cd: 11, range: 99 }, { kind: 'nova', wind: 1, r: 7.5, inner: 2.6, mul: 1, cd: 8, range: 99 }],
            phases: [{ at: .3, enrage: true }] },
          { type: 'hand_net', room: 'b4', loot: ['rs_hand_head', 'rs_hand_body', 'rs_hand_cloak', 'rs_hand_boots', 'd_bow_net'],
            attacks: [{ kind: 'beam', wind: 1.1, len: 15, width: 2, dur: 4.5, sweep: 1, mul: .75, cd: 11, range: 99 }, { kind: 'charge', wind: .8, len: 14, width: 2.8, mul: 1.1, cd: 6, range: 16 }, { kind: 'slam', wind: .8, r: 4.4, mul: 1, cd: 3, range: 5 }],
            phases: [{ at: .6, summon: { type: 'brandshade', n: 2 }, shield: true }, { at: .3, enrage: true }] },
          { type: 'hand_lord', room: 'b5', loot: ['rs_hand_head', 'rs_hand_body', 'rs_hand_cloak', 'rs_hand_boots', 'd_greatsword_lord', 'd_sigil_lord'],
            attacks: [{ kind: 'slam', wind: .9, r: 5.2, mul: 1.2, cd: 3, range: 5.8 }, { kind: 'beam', wind: 1.2, len: 18, width: 2, dur: 5, sweep: .8, mul: .7, cd: 13, range: 99 }, { kind: 'pools', wind: .8, n: 3, r: 2.6, dur: 8, mul: .5, cd: 11, range: 99 },
              { kind: 'cast', name: 'Жатва', wind: 3, r: 99, mul: 2.2, cd: 16, range: 99 }],
            phases: [{ at: .7, summon: { type: 'eclipse_fiend', n: 2 }, shield: true, who: 'Пятый', say: 'Ты дошёл. Я знал, что дойдёшь.' },
              { at: .4, who: 'Пятый', say: 'Мне больше не нужна их сила. Бей, если хочешь. Меня ты уже не догонишь.' }, { at: .25, enrage: true, who: 'Пятый', say: '(уходит во тьму) До встречи, мой меч.' }] }
        ] }
    ]
  },

  // сбор группы (4.07, решение владельца): подземелье отряда — на 4, рейд — на 10; состав по ролям; heroRole — роль героя;
  // bots — какими спутниками добирать роль; roleName и names — подписи наёмников
  party: { on: true, dungeon: { tank: 1, heal: 1, melee: 1, ranged: 1 }, raid: { tank: 2, heal: 3, melee: 3, ranged: 2 },
    heroRole: { thorn: 'tank', vale: 'melee', jay: 'ranged', irga: 'ranged', warlock: 'ranged', priest: 'heal', brand: 'tank' },
    bots: { tank: ['c_thorn', 'soldier'], heal: ['c_irga'], melee: ['c_vale', 'veteran'], ranged: ['c_jay'] },
    roleName: { tank: 'защитник', heal: 'лекарь', melee: 'боец', ranged: 'стрелок' },
    names: { tank: ['Гронт', 'Борвин', 'Ульф', 'Хаген', 'Дарек'], heal: ['Велла', 'Мирна', 'Ведана', 'Агна', 'Зоряна', 'Лада'], melee: ['Кай', 'Рагнар', 'Ивар', 'Торвин', 'Ярош'], ranged: ['Эйра', 'Стрибог', 'Нежка', 'Олаф', 'Сигрун'] } },
  squad: {
    baseMax: 1, perLevels: 8, cap: 4, follow: 2.8, leash: 30, sight: 13, regen: 1.2, fireRegen: 7, xpShare: .5,
    // отряд-спутники (этап 4): бойцы растут с уровнем героя — здоровье и урон × (1 + lvHp/lvDmg × (ур − 1))
    lvHp: .06, lvDmg: .05,
    // угроза: near — очков за метр ближе reach (пока угрозы нет — решает близость), decay — за сколько секунд угроза тает в e раз,
    // stick — во сколько раз новая цель должна быть опаснее текущей, player — множитель угрозы героя, taunt — вызов: угроза защитника = лучшая × taunt,
    // heal — угроза за лечение (доля), healR — враги в этом радиусе от вылеченного злятся на лекаря, lose — дальше этого враг союзника не выбирает
    // Г7 «Живые спутники» (4.13): навык бота skill (от него реакция react — с какой задержкой замечает круг атаки, и разброс); места вокруг цели
    // spread (рад); застрявший дальше stuck[1] м дольше stuck[0] с — к герою; умения ролей (cd — перезарядка, с); реплики say (cd — свой, gcd — общий)
    live: { on: true, skill: [.55, 1], react: [.55, .12], spread: .6, stuck: [2.5, 9],
      say: { cd: 16, gcd: 5, low: .3, lines: { pull: ['Держу его!', 'На меня!', 'Ко мне, тварь!'], low: ['Прикройте!', 'Мне худо!', 'Держусь из последних!'], gheal: ['Держитесь!', 'Свет с нами!'], dodge: ['Под ногами!', 'В сторону!', 'Отходим!'], win: ['Готово!', 'Лёг!', 'Ещё один.'] } },
      tank: { wall: { cd: 16, t: 4, k: .5, below: .5 } },
      melee: { cleave: { cd: 7, r: 2.6, k: 1.1, min: 2 }, burst: { cd: 12, k: 2.2 } },
      ranged: { volley: { cd: 8, n: 3, fan: .22, min: 2 }, aimed: { cd: 10, k: 2 } },
      heal: { group: { cd: 12, k: 1.4, below: .7, min: 2 }, ward: { cd: 15, amt: .2 } },
      // Г9 «как игрок»: hire — навык нанятого не ниже; kick — сбить чтение (откат, с; защитник — свой откат); sep — не ближе к своим, м (бойцы, дальники);
      // behind — бойцы у босса заходят за спину; healR — лекарь держится в доле радиуса от раненого; pre — до тяжёлого приёма общее лечение ниже этой доли
      smart: { on: true, hire: .8, kick: { cd: 14, tank: 10 }, sep: [1.3, 2.6], behind: true, healR: .8, pre: .9 } },
    threat: { near: 1, reach: 8, decay: 8, stick: 1.1, player: 1, taunt: 1.3, heal: .5, healR: 14, lose: 16 },
    // команды: «за мной» (follow), «держать» (hold — бьют врагов не дальше hold м от точки, герой дальше far — снова «за мной»), «моя цель» (assist — все бьют метку; pick — радиус выбора цели)
    cmd: { hold: 6, far: 45, pick: 14 },
    shot: { speed: 22, hitR: .45, life: 1 },     // стрелы и искры спутников
    gear: { on: true, naked: { hp: .9, dmg: .85 }, dmgK: 1 },     // Г9: нанятый без вещей лишь чуть слабее бота сбора (было .6 / .5: отряд с нанятым гиб втрое чаще)     // снаряжение бойцов (2026-10-20): нанятый без вещей — здоровье и урон × naked; урон оружия ×dmgK
    types: {
      guard:   { name: 'Стражник', role: 'melee', hp: 130, dmg: 18,  speed: 4.8, range: 1.9, wind: .32, recover: .5,  cost: 600, tint: '#4a5a78', text: 'Быстрый и недорогой. Копьё.' },
      soldier: { name: 'Ратник',   role: 'tank', threat: 2, hp: 240, dmg: 28, speed: 4.5, range: 2.1, wind: .36, recover: .55, cost: 1500, tint: '#7a3a30', text: 'Меч и щит. Держит удар.' },
      // спутники-герои (этап 4): тот, кем играете, в найме не показывается. role: tank — держит врагов (threat — множитель угрозы, taken — доля урона,
      // taunt — вызов: перезарядка cd, радиус r, время t); heal — лечит (amt за раз, cd, радиус r, лечит ниже доли below); ranged — стреляет издали, отходит ближе kite м
      c_thorn: { name: 'Торн', hero: 'thorn', role: 'tank', threat: 3, taken: .7, taunt: { cd: 9, r: 7, t: 3 }, hp: 420, dmg: 22, speed: 4.7, range: 2.1, wind: .36, recover: .55, cost: 2800, tint: '#c85a5a', text: 'Защитник: держит врагов на себе и вызовом забирает их у вас.' },
      c_irga:  { name: 'Ирга', hero: 'irga', role: 'heal', heal: { amt: 34, cd: 2.4, r: 11, below: .85 }, ranged: true, kite: 5, hp: 220, dmg: 12, speed: 4.9, range: 9, wind: .5, recover: .7, cost: 3400, tint: '#a88ad8', text: 'Лекарь: лечит вас и отряд, издали бьёт искрой.' },
      c_jay:   { name: 'Сойка', hero: 'jay', role: 'ranged', ranged: true, kite: 4, hp: 200, dmg: 30, speed: 5.2, range: 10, wind: .45, recover: .5, cost: 2800, tint: '#9ab86a', text: 'Стрелок: бьёт из лука и держит дистанцию.' },
      c_vale:  { name: 'Вейл', hero: 'vale', role: 'melee', hp: 260, dmg: 34, speed: 5.4, range: 1.9, wind: .26, recover: .4, cost: 2800, tint: '#8aa8e8', text: 'Боец: быстрые удары, лучше всего — по вашей цели.' },
      // герои сюжета (этап 3): идут с героем по сюжету, не нанимаются (story); Аларик — модель для поединка
      irma:    { name: 'Ирма', story: true, hp: 420, dmg: 34, speed: 5, range: 2.1, wind: .32, recover: .5, cost: 0, tint: '#4a2a30', text: 'Правая рука Аларика.' },
      timka:   { name: 'Тимка', story: true, hp: 300, dmg: 26, speed: 5.4, range: 1.9, wind: .28, recover: .45, cost: 0, tint: '#4a5a34', text: 'Разведчик отряда.' },
      kord:    { name: 'Корд', story: true, hp: 600, dmg: 40, speed: 4.4, range: 2.4, wind: .42, recover: .6, cost: 0, tint: '#5a3a2a', text: 'Здоровяк с молотом.' },
      alaric:  { name: 'Аларик Белый', story: true, hp: 500, dmg: 38, speed: 5.4, range: 2.2, wind: .3, recover: .45, cost: 0, tint: '#d8d2c6', text: 'Вожак «Пепельных Крыльев».' },
      // Акт II (этап 7): облики войска Кадмии (только модель: look — вид оружия бойца), королевские латники в битвах строем, таран осады
      kad_soldier: { name: 'Латник Кадмии', story: true, look: 'soldier', hp: 300, dmg: 20, speed: 4, range: 2, wind: .4, recover: .6, cost: 0, tint: '#2c4a7a', text: '' },
      kad_xbow: { name: 'Арбалетчик Кадмии', story: true, look: 'guard', hp: 200, dmg: 15, speed: 4, range: 2, wind: .4, recover: .6, cost: 0, tint: '#3a5a8a', text: '' },
      kad_spear: { name: 'Копейщик Кадмии', story: true, look: 'guard', hp: 260, dmg: 18, speed: 4, range: 2, wind: .4, recover: .6, cost: 0, tint: '#24406a', text: '' },
      kad_banner: { name: 'Знаменосец Кадмии', story: true, look: 'veteran', hp: 400, dmg: 20, speed: 4, range: 2, wind: .4, recover: .6, cost: 0, tint: '#1c3a6a', text: '' },
      masked_k: { name: 'Человек в маске', story: true, look: 'veteran', hp: 500, dmg: 30, speed: 4, range: 2, wind: .4, recover: .6, cost: 0, tint: '#1c161a', text: '' },
      royal_guard: { name: 'Стража Велиграда', story: true, look: 'soldier', hp: 500, dmg: 30, speed: 4, range: 2, wind: .4, recover: .6, cost: 0, tint: '#7a1a1a', text: '' },
      wagon: { name: 'Повозка с Алариком', story: true, hp: 3000, dmg: 0, speed: 1.6, range: 0, wind: 1, recover: 1, cost: 0, tint: '#5a3e26', text: '' },
      kingsman: { name: 'Латник Велиграда', story: true, look: 'soldier', hp: 700, dmg: 34, speed: 4.4, range: 2.1, wind: .38, recover: .55, cost: 0, tint: '#8a6a20', text: 'Королевский солдат.' },
      ram: { name: 'Таран', story: true, hp: 2400, dmg: 0, speed: 1.6, range: 0, wind: 1, recover: 1, cost: 0, tint: '#5a3e26', text: 'Осадный таран.' },
      veteran: { name: 'Ветеран',  role: 'melee', hp: 400, dmg: 42, speed: 4.5, range: 2.5, wind: .4,  recover: .6,  cost: 3800, tint: '#2e2e34', text: 'Двуручный меч. Дорог, но страшен.' }
    }
  },
  smith: { max: 5, base: 10, costK: .45, pow: 1.35, bonus: .1, reach: 3.4 },   // улучшение +1…+5: цена = base + цена вещи × costK × (ур+1)^pow, каждый уровень даёт +bonus к статам
  // зоны по уровням (этап 1, 2026-10-19): ядро — свои уровни (как прежде по глубине); за ядром два кольца, в кольце зона = биом;
  // уровень внутри зоны растёт от lv[0] у внутренней границы кольца до lv[1] у внешней. Порядок — спиралью: по кругу, потом наружу
  zones: { core: { id: 'brod', name: 'Пепельный Брод', lv: [1, 20] }, split: 330, wobble: 14, splits: [600, 900],     // splits — границы колец за первым (мир ×2, 4.04)
    rings: [
      { forest: { id: 'olkh', name: 'Ольховый лес', lv: [20, 24] }, swamp: { id: 'moss', name: 'Мшистые топи', lv: [24, 28] }, mountains: { id: 'foot', name: 'Предгорья', lv: [28, 31] },
        waste: { id: 'rust', name: 'Ржавые пустоши', lv: [31, 35] }, coast: { id: 'grey', name: 'Серый берег', lv: [35, 38] } },
      { coast: { id: 'dusk', name: 'Затмённое побережье', lv: [38, 42] }, forest: { id: 'war', name: 'Поля Великой войны', lv: [42, 46] }, swamp: { id: 'rot', name: 'Гнилые топи', lv: [46, 50] },
        mountains: { id: 'mute', name: 'Горы Безмолвия', lv: [50, 55] }, waste: { id: 'heart', name: 'Сердце Затмения', lv: [55, 60] } },
      // мир ×2 (4.04): кольца за прежним краем — уровни 60–70 и 70–80
      { forest: { id: 'blackwood', name: 'Чернолесье', lv: [60, 62] }, swamp: { id: 'drown', name: 'Трясина Утопленников', lv: [62, 64] }, mountains: { id: 'brandridge', name: 'Хребет Клейма', lv: [64, 66] },
        waste: { id: 'ashdesert', name: 'Пепельная пустыня', lv: [66, 68] }, coast: { id: 'wrecks', name: 'Берег Кораблекрушений', lv: [68, 70] } },
      { coast: { id: 'abyssshore', name: 'Берег Бездны', lv: [70, 72] }, forest: { id: 'hanged', name: 'Лес Повешенных', lv: [72, 74] }, swamp: { id: 'rift', name: 'Гнилой Разлом', lv: [74, 76] },
        mountains: { id: 'peaks', name: 'Пики Длани', lv: [76, 78] }, waste: { id: 'scorched', name: 'Выжженный Предел', lv: [78, 80] } }
    ], hub: { npcs: ['merchant', 'smith'], names: { moss: 'Ставка короля', grey: 'Велиград', dusk: 'Приют у скал', war: 'Стан у курганов', rot: 'Топкая Деревня', mute: 'Кузня под перевалом', heart: 'Последний Стан' } }, floorStep: 2 },     // names — свои имена узлов (Акт II: Ставка в Мшистых топях)     // floorStep — этаж замка выше зоны у входа на столько уровней
  level: { max: 70, base: 28, pow: 1.3, hpPer: 6, dmgPer: .6, healOnUp: .3,
    // темп (этап 3 «круче»): 60-й уровень — к концу Акта IV. За задание — не больше fq уровня, за сцену — не больше fs (от нужного
    // на текущем уровне); обгоняешь сюжет (уровень текущей сцены) больше чем на ahead — награда меньше, до min; враг ниже героя
    // на grey и больше уровней — «серый»: опыт за него меньше на greyK за уровень, до min. on: false — как раньше
    pace: { on: true, fq: .3, fs: .5, ahead: 4, min: .1, grey: 2, greyK: .25 },
    // пепельные ранги (этап 3 «круче»): опыт на 60-м копится в ранг; ранг — k опыта 59-го уровня; каждый +per к урону и здоровью; до cap
    ranks: { on: true, k: .6, per: .005, cap: 50 },
    // уровни до 60 (этап 0, 2026-10-19): уровень места — из глубины: ядро 1–core, за ядром до edge у края мира; за ядром враги крепче
    // на grow за уровень (здоровье и урон), опыт за убийство — на xp за уровень; il — уровень вещи: стат × (1 + g·ур)/(1 + g·родной),
    // родной уровень вещи — по редкости nom; вещь с врага — уровень места + 0…drop; у торговца и кузнеца — уровень героя
    core: 20, edge: 60, grow: .033, xp: .06, bossBase: 30,     // bossBase — уровень, под который настроены боссы: выше — ×grow за уровень
    il: { g: .05, nom: [3, 8, 14, 22, 28, 32], drop: 2 } },     // рост за уровень (2026-10-18): было +4 здоровья, +0,4 урона   // опыт до следующего уровня = base × ур^pow; за уровень: +hpPer здоровья, +dmgPer урона, +1 очко навыка
  // сложность. hp/dmg — множители врагов (и боссов), count — добавка к числу врагов, hear — слух врагов, luck — к удаче,
  // xp — опыт, buy — цены торговца, boss — множитель времени возрождения боссов, death — штраф: ash — доля теряемого пепла (остаётся «могила»), gear — теряется уровень улучшения у надетого
  // элитные враги: шанс = chance + глубина × depthK + опасность × dangerK (+ nightK ночью). hp/dmg/xp — множители, luck и lootRolls — добыча.
  drops: { brandK: .25, chanceK: .5, slots: 1 },     // chanceK — доля прежнего шанса добычи с врага, slots — не больше вещей за бросок (просьба владельца: меньше мусора)
  loot: { on: true, q: .25, lv: 1.0, base: [60, 28, 9, 2.5, .5], goldKinds: ['chest', 'ironchest', 'locked', 'cache', 'altar'], gold: [[0, 0], [30, .01], [40, .02], [50, .03], [65, .045], [75, .06]] },     // добыча по уровню края: base — веса редкостей, lv — сдвиг к 60-му; золото с сундука по уровню [с уровня, шанс]     // добыча с врагов: вес оранжевых (клеймёных) ×brandK — их было до половины снаряжения; сундуков и боссов не касается
  // случайные свойства вещей (этап 4 «круче»): count — сколько у редкости (2 — редкий, 3 — великий, 4 — клеймёный, 5 — золотой);
  // base — [начало, рост за уровень вещи]; q — разброс качества; max — предел свойства. on: false — вещи как раньше
  ach: { on: true },
  ng: { on: true, hp: .5, dmg: .3, elite: .12 },     // «Новый круг» (этап 6 «круче»): за каждый круг враги +hp и +dmg (доля), шанс элиты +elite, элита — с двумя свойствами
  // «Бездна» (этап 6 «круче»): люк у лагеря (at) с уровня lv; ярус — арены arenas[0]+ярус/arenaEvery (до arenas[1]), врагов foes[0]+ярус×foes[1] на арену,
  // уровень врагов level[0]+ярус×level[1] (за 60 — сила растёт дальше), время time+ярус×timeTier с; модификатор каждые modEvery ярусов (до 2),
  // страж каждые guardEvery, окованный сундук каждые chestEvery; пепел ash×ярус. types: [вид, с какого яруса]
  abyss: { on: true, at: { x: 12, z: -24 }, lv: 30, arenas: [2, 5], arenaEvery: 6, foes: [3, .2], level: [30, 1.5], time: 150, timeTier: 4, modEvery: 5, guardEvery: 5, guardHp: 2.5, chestEvery: 5, ash: 40,
    eclipse: { goal: 8, ash: 2500 }, heal: .3,     // heal — доля здоровья за зачищенный ярус     // «Затмение недели»: пройти ярус goal — награда раз в неделю
    mod: { thick: 1.4, swift: 1.25, frail: 1.3, packs: 1.5, greedy: 1.6, dark: .55 },
    types: [['hound', 1], ['ghoul', 1], ['brute', 1], ['archer', 2], ['shield', 3], ['blackdog', 4], ['kad_soldier', 5], ['golem', 7], ['eclipse_fiend', 9], ['troll', 12], ['shrieker', 14], ['war_ghost', 16], ['demon_guard', 20]] },     // достижения (этап 6 «круче»): награды пепел, титулы, цвета плаща
  quests: { wake: 24, seek: 160, hunt: { hp: 3, dmg: 1.25, scale: 1.3 }, track: { step: [16, 24], r: 4 }, defend: { r: 9, leave: 35, gap: 5, ring: [12, 16] } },     // виды заданий (этап 5 «круче»): охота, «выследи», оборона; seek — «убей»: метка на ближайшем враге не дальше, м
  // 3.99: quality — разброс базовых чисел любой брони и оружия; count с «необычных» (1); …Ch — шанс эффекта стихии при ударе, %;
  // gems — камень внутри при находке: фиолетовая/оранжевая — с шансом purple, золотая — всегда (ранг goldRank); rank2 — доля 2-го ранга
  affix: { on: true, count: { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 }, q: [.6, 1], quality: [.85, 1.15], dot: .15, dur: 4, shockK: .3,
    gems: { purple: .2, goldRank: 2, rank2: .25, els: ['fire', 'ice', 'storm', 'venom', 'blood', 'earth', 'water'] },
    base: { dmg: [1, .12], armor: [1, .1], hp: [4, .6], crit: [2, .06], leech: [1, .03], spd: [2, .04], luck: [3, .15], regen: [.5, .01], stealth: [4, .1], burnCh: [3, .1], poisonCh: [3, .1], shockCh: [3, .1], bleedCh: [3, .1] },
    max: { dmg: 12, armor: 10, hp: 45, crit: 8, leech: 4, spd: 6, luck: 15, regen: 1.5, stealth: 12, burnCh: 12, poisonCh: 12, shockCh: 12, bleedCh: 12 } },
  // библиотека (4.00, просьба владельца): книжница в доме с полками в лагере (снаружи — вид церкви). Разбор ненужной вещи → чародейская пыль (yield по редкости);
  // зачарование за пепел и пыль: добавить свойство (не больше своих по редкости + extra и не больше cap), перековать одно, поднять качество.
  // Цена: пепел = base + цена вещи × valueK, пыль — dust по редкости; каждое зачарование вещи дороже на grow
  // прочность (4.03, просьба владельца): износ в % за удар оружием (hit), за ранение — каждой части брони (hurt), за смерть — всему (death).
  // До soft% сила полная, к 100% — ×(1 − drop). Починка у кузнеца: цена вещи × repair.k × износ (не меньше repair.min); kit — ремкомплект, −kit% износа
  dur: { on: true, hit: .06, hurt: .05, death: 8, soft: 70, drop: .5, repair: { k: .25, min: 1 }, kit: 40 },
  // ремесло 2.0 (4.02, просьба владельца): скованная вещь — «работа мастера»: качество от q[0] (навык 0) до q[1] (навык на пределе)
  // и не выше q[2], свойства — как у находки той же редкости. Реагент (материал) задаёт свойство: при ковке и в библиотеке.
  // reagN — сколько реагента по редкости вещи; ember — качество сразу на предел; shard — свойство до предела (библиотека)
  craft: { q: [1, 1.1, 1.15], reagN: [1, 1, 1, 2, 2, 3], ember: 'm_brand_ember', shard: 'm_eclipse_shard',
    reag: { dmg: 'm_horn', crit: 'm_imp_fang', leech: 'm_bone_dust', spd: 'm_raven_feather', luck: 'm_dark_glass', burnCh: 'm_sulfur', poisonCh: 'm_web', shockCh: 'm_copper_wire',
      bleedCh: 'm_wolf_claw', armor: 'm_mail_scrap', hp: 'm_bone', regen: 'm_tar', stealth: 'm_rotten_cloth' } },
  enchant: { on: true, npc: 'scribe', item: 'm_arcane_dust', yield: [1, 1, 2, 4, 6, 9], upYield: 1, dust: [1, 1, 2, 3, 4, 5], base: 20, valueK: .35, grow: .6, extra: 1, cap: 4 },
  elite: {
    chance: .04, outerK: .03, depthK: .03, dangerK: .03, nightK: .03, hp: 1.9, dmg: 1.2, xp: 3, scale: 1.2, luck: 10, lootRolls: 2,
    affixes: {
      swift:     { name: 'Быстрый',       nameF: 'Быстрая',       speed: 1.45, color: '#7ad0ff' },
      armored:   { name: 'Бронированный', nameF: 'Бронированная', hp: 1.6, color: '#c8c8d8' },
      vampiric:  { name: 'Кровопийца',    nameF: 'Кровопийца',    heal: .6, color: '#d03060' },
      explosive: { name: 'Взрывной',      nameF: 'Взрывная',      r: 3.2, delay: .9, dmg: 38, color: '#ff9a30' },
      burning:   { name: 'Пылающий',      nameF: 'Пылающая',      on: ['burn', .8, 3, 5], immune: ['burn'], color: '#ff6a20' }
    },
    // новые свойства (этап 2 «круче»): extra — включены; с глубины dual — второе свойство; chill — скорость героя после удара ледяного
    extra: true, dual: 1.5, chill: .75,
    affixes2: {
      frost:    { name: 'Ледяной',     nameF: 'Ледяная',      t: 1.5, color: '#9ad8ff' },
      mirror:   { name: 'Зеркальный',  nameF: 'Зеркальная',   k: .06, color: '#e8e8ff' },
      blink:    { name: 'Блуждающий',  nameF: 'Блуждающая',   cd: 9, color: '#b08aff' },
      summoner: { name: 'Призыватель', nameF: 'Призывательница', at: .5, n: 1, type: 'imp', color: '#8ad07a' }
    }
  },
  // сутки: len — секунд на полный круг; start — на какой фазе начинается игра (0.3 — полдень, 0.0 — рассвет);
  // contrast — резкость смены; nightBelow — при каком свете считаем ночью. night — что меняется ночью.
  daynight: {
    len: 480, start: .22, contrast: .75, nightBelow: .22,
    night: { count: 2, dmg: 1.15, xp: 1.25, luck: 8 },         // врагов больше и злее, опыта и удачи больше; торговец спит
    sky: {
      // шаг 6 аудита: днём солнце сильнее неба (есть объём), свет тёплый, туман светлый и тёплый; ночь синяя, а не чёрная
      day:   { fog: '#a8ab92', hemiSky: '#dfe8e0', hemiGround: '#4a5034', hemiI: 1.4, sun: '#ffe2b8', sunI: 3.2, dome: '#ffffff' },
      night: { fog: '#1c2433', hemiSky: '#7a8ab8', hemiGround: '#2a2a30', hemiI: 1.8, sun: '#8a9ad8', sunI: .7, dome: '#3a4258' },
      dusk: { k: .8, w: .85, fog: '#b07c78', hemiSky: '#f2b0a0', sun: '#ff8c4a', dome: '#ff9e7a' }     // 4.18г (просьба владельца): краски рассвета и заката; k — сила, w — ширина по свету
    },
    sunPos: [-30, 42, -40]     // откуда светит солнце (м): около 40° над горизонтом

  },
  // формы (шаг 7 аудита): grad — цвет вершин снизу и сверху детали; contact — земля темнее на k в r м у домов и стволов;
  // round — скруглённые кубики героя и врагов: доля k меньшей стороны, не больше max м, seg сегментов;
  // roof — палитра крыш (солома, серо-коричневый, сине-серый) и насколько светлее верхняя ступень
  // экономия кадра (3.40): вне кадра не рисуем и не анимируем, дальнее снимаем со сцены, траву вдали прореживаем
  cull: { foe: 70, decor: 150, box: 95, grass: [[32, 1], [56, .6], [1e9, .35]], hud: .1 },     // foe — дальше модель врага освобождается, м; grass — [до, доля]; hud — шаг кнопок, с
  groundTex: { on: true, tile: 4, gain: 1.5, tint: .35, layer: [1, .8, .95, .8, .55, .25, .25, .2] },     // layer — яркость слоёв: трава, тропа, камень, болото, грязь, снежная трава, снег, песок     // текстуры земли (3d/models/ground.webp): tile — метров на повтор, gain — яркость, tint — доля оттенка биома
  bladeFx: { on: true },     // стихия на клинке (bladefx3d.js): молния, огонь, лёд, яд, кровь — стиль выбран владельцем 2026-10-20
  // готовые модели (2026-10-20, выбор владельца; actors3d.js): герой и враги по видам → ключ модели из 3d/models; kits — рост, клипы, кисть, шлем.
  // Пока модель грузится или её нет — своя модель из кубиков. ?models=0 в адресе — только свои модели
  actors: { on: true,
    // анимации моделей (2026-10-21, «правильнее и мягче»): смешивание клипов, с — loco (стоит/идёт/бежит), atk — удар, roll — перекат,
    // hit — реакция на урон (не чаще hitGap с); пороги шага и бега — доли скорости героя/врага с запасом (on — включить, off — выключить);
    // sp — сглаживание оценки скорости (1/с)
    anim: { loco: .25, atk: .1, roll: .08, hit: .1, death: .15, hitGap: .8, walkOn: .1, walkOff: .05, runOn: .62, runOff: .48, sp: 10 },
    heroes: { thorn: 'kk_knight', vale: 'kk_rogue', jay: 'kk_ranger', irga: 'kk_mage', warlock: 'q_wizard', priest: 'q_cleric', brand: 'kk_barbarian' },
    foes: { barghest: 'q_wolf', rootgnaw: 'sf_ghoul', thornlord: 'q_king', oldoak: 'sf_drugdor', saltwarden: 'sf_drugdor', cathkraken: 'sf_skdragon', drowngod: 'sf_fish',     // рейды 20 и 40 (4.18)
      bogwarden: 'sf_drugdor', leviathan: 'sf_skdragon', ashgolem: 'sf_drugdor', cinderlord: 'q_king', rotmaw: 'sf_ghoul', riftheart: 'sf_mino', voidwarden: 'sf_minob', abyssmaw: 'sf_skdragon', voidking: 'q_king',     // Г5 (4.18)
      imp: 'q_demonfly', bomber: 'q_demonfly', ash_thief: 'q_demonfly', hound: 'q_wolf', blackdog: 'q_wolf', garm: 'q_wolf', eclipse_fiend: 'q_wolf', garm_beast: 'q_wolf', greywolf: 'q_wolf', towerhound: 'q_wolf',
      lunger: 'kk_skel_warrior', war_ghost: 'kk_skel_minion', witch: 'kk_skel_mage', archer: 'kk_rogue_hooded', kad_xbow: 'kk_rogue_hooded', shield: 'kk_knight', kad_soldier: 'kk_knight', kad_spear: 'kk_knight', kad_banner: 'kk_knight',
      royal_guard: 'kk_knight', masked_knight: 'kk_knight', shade: 'q_ghostskull', brandshade: 'q_ghostskull', shrieker: 'q_ghostskull', troll: 'q_yeti', castellan: 'q_king', ashking: 'q_king', brandlord: 'kk_knight', abyssking: 'q_king', oakking: 'q_king',
      brute: 'sf_mino', ghoul: 'sf_ghoul', devourer: 'sf_ghoul', golem: 'sf_drugdor', firegolem: 'sf_drugdor', drowned: 'sf_fish', drownedmaid: 'sf_fish', silt: 'sf_fish', swampelder: 'sf_fish',
      demon_guard: 'sf_minob', lord: 'sf_minob', gatebeast: 'sf_minob', hand_lord: 'sf_minob', chief: 'sf_minob', tidewyrm: 'sf_skdragon', bonetyrant: 'sf_sklord', namelessking: 'sf_sklord', gravewight: 'sf_sklord', abbot: 'sf_sklord' },
    npcs: { merchant: 'q_farmer', smith: 'kk_barbarian', captain: 'q_warrior', villager: 'q_farmer', villagerF: 'q_adv_f', traveler: 'q_hooded' },     // жители (выбор владельца 2026-10-20)
    beasts: { deer: 'q_stag', fox: 'q_fox', goat: 'q_cow', duck: 'q_chicken', heron: 'q_pigeon', crow: 'q_pigeon', horse: 'q_horse' },     // живность
    sizes: { heron: 1.3 },     // свой рост модели для вида (голубь в роли цапли)
    tints: { heron: '#c8d0d8', crow: '#3a3438', bomber: '#ffb070', ash_thief: '#e8d080', blackdog: '#404048', garm: '#a06050', eclipse_fiend: '#b080ff', garm_beast: '#c04838', greywolf: '#c8c8c0', towerhound: '#c09060',
      kad_soldier: '#8aa0ff', kad_spear: '#8aa0ff', kad_banner: '#a0b0ff', kad_xbow: '#a0b8ff', royal_guard: '#ff8a8a', masked_knight: '#605870', brandshade: '#ff6a6a', shrieker: '#ffe0b0', ashking: '#c0a080', oakking: '#a0d080', devourer: '#c0ffa0', firegolem: '#ff9a60', drownedmaid: '#a0e0d0', silt: '#b0c080', swampelder: '#c0a070', lord: '#ff9070', gatebeast: '#ff7060', hand_lord: '#c090ff', chief: '#ffc0a0', gravewight: '#c0d080', abbot: '#ffe0a0' },
    kits: {
      kk_knight: { anims: 'kk', height: 2.25, helm: ['Knight_Helmet', 'Knight_HelmetVisor'], cape: ['Knight_Cape'] },
      kk_rogue: { anims: 'kk', height: 2.15, cape: ['Rogue_Cape'] },
      kk_rogue_hooded: { anims: 'kk', height: 2.15, aim: 'aim', atk: 'bow' },
      kk_ranger: { anims: 'kk', height: 2.15, helm: ['Ranger_Hat'], cape: ['Ranger_Cape'] },
      kk_mage: { anims: 'kk', height: 2.2, helm: ['Mage_Hat'], cape: ['Mage_Cape'] },
      kk_skel_warrior: { anims: 'kk', height: 2.2, atk: 'p1' }, kk_skel_minion: { anims: 'kk', height: 2.0 }, kk_skel_mage: { anims: 'kk', height: 2.2, atk: 'cast', aim: 'spell' },
      q_wizard: { height: 2.2, hand: 'WeaponR', handL: 'FistL', hide: ['Wizard_Staff'], wRot: [Math.PI, 0, 0] }, q_cleric: { height: 2.15, hand: 'WeaponR', handL: 'FistL', hide: ['Cleric_Staff'], wRot: [Math.PI, 0, 0] }, q_demonfly: { height: 1.8, atk: 'a1' }, q_wolf: { height: 1.3, atk: 'a1' }, q_ghostskull: { height: 1.8, atk: 'a1' },
      q_yeti: { height: 2.1, atk: 'a1' }, q_king: { height: 2.0, atk: 'a1' },
      q_farmer: { height: 2.05 }, q_adv_f: { height: 1.95 }, q_hooded: { height: 1.95 }, kk_barbarian: { anims: 'kk', height: 2.3 }, q_warrior: { height: 2.15, hand: 'WeaponR', handL: 'FistL' },
      q_stag: { height: 2.2 }, q_fox: { height: .75 }, q_cow: { height: 1.35 }, q_chicken: { height: .45 }, q_pigeon: { height: .42 }, q_horse: { height: 2.7 },
      sf_mino: { height: 2.1 }, sf_ghoul: { height: 1.9 }, sf_drugdor: { height: 2.0 }, sf_fish: { height: 2.4 }, sf_minob: { height: 2.1 }, sf_skdragon: { height: 1.8 }, sf_sklord: { height: 2.1, split: { idle: [.1, 2.5], walk: [2.95, 4.33] } } } },
  shapes: { grad: [.7, 1.08], contact: { r: 1.5, k: .25 }, round: { on: true, k: .2, max: .06, seg: 1 },
    roof: { colors: ['#8f7e5e', '#6e5e50', '#56606a'], top: 1.15 } },
  // зелень (2026-10-17): пятна по плавному шуму (масштабы scale м: сочная/сухая трава, проплешины, поляны); множители цвета
  // земли lush / dry / dirt с силой k; проплешина там, где шум выше dirtT; цветы — на полянах (порог thr), доля per мест травы,
  // по n головок высотой h м радиусом r; кусты — где шум (масштаб scale) выше thr, доля p, не ближе clear м к тропе, размер size м
  flora: { on: true,
    patch: { scale: [30, 14, 11], lush: [.8, 1.05, .75], dry: [1.7, 1.22, .85], dirt: [1.75, 1.0, .9], k: [.6, .5, .45], dirtT: [.7, .82] },
    flowers: { thr: .6, per: .35, n: [3, 6], h: [.22, .36], r: .13, colors: ['#f4efe0', '#f0cf48', '#b88ad8', '#d8604a', '#7aa4e0'] },
    bushes: { scale: 18, thr: .58, p: .07, clear: 2.4, size: [.45, .8] } },
  // карта и миникарта (шаг 10б аудита, «как карта Skyrim»): подложка n×n с рельефом строится по budget мс за кадр; вода — ниже
  // waterIn м от кромки воды; светотень: свет light (x, y, z), преувеличение склонов exag, яркость shade[0] + shade[1] × освещённость, выше на
  // 1 м — светлее на lift; bright, desat — карта светлее и спокойнее земли в игре; неисследованное — дымка haze (rgb) с плотностью hazeFull / hazeMini; bg — за краем мира
  mapView: { miniSpan: 80, n: 400, budget: 2, wide: 2.4, tall: 1.2, far: .62, water: '#4f7b94', waterIn: .5, rock: '#8a8478', light: [-1, 1.6, -1], exag: 12, shade: [.62, .5], lift: .03, bright: 4.2, desat: .25,     // 4.05: подложка шире круга в wide раз и выше в tall; за краем — темнее (far)
    haze: [222, 212, 188], hazeFull: .62, hazeMini: .55, bg: '#a89c80', road: 'rgba(110,84,58,.85)',
    regions: { forest: 'Лес', swamp: 'Болота', mountains: 'Горы', waste: 'Пустошь', coast: 'Побережье' },
    // облака над картой (4.05): светлых light штук размером lightSize м, тень сдвинута на shadowOff м; тёмных клубов за краем — dark штук
    // размером darkSize м; дымка у края — veil м с непрозрачностью veilA; ветер — wind м/с; fps — частота кадров облаков
    clouds: { light: 70, lightSize: [40, 110], lightA: .55, shadowA: .22, shadowOff: 14, dark: 140, darkSize: [120, 420], darkA: .62, veil: 260, veilA: .5, wind: [3.5, 1.2], fps: 30 } },
  // палитра поверхности (E2): трава вместо пепла, деревья с кронами (bare — доля сухих), камни, небо (верх и горизонт)
  look: {
    town: { on: true, slate: '#3c4658', stone: .35, cool: [.97, 1, 1.04], roofK: [.18, 1.15], keep: ['market_red', 'tent'] },     // 4.09 «Камень и знамёна»: красные крыши KayKit — в сланец, стены — к серому камню (stone — доля серого); roofK — опорная яркость крыши и предел; keep — не трогать
    ground: ['#2c4222', '#35502a', '#4c6c34'], sand: '#a08e5e',
    trunk: ['#3a2a1c', '#4a3524'], leaf: ['#2e5a28', '#3a6a2e', '#4a7a36'], bare: .2,
    rock: ['#5e5c54', '#6c6a60'], skyTop: '#2e4a6a', skyHor: '#c8c098',
    // шаг 6 аудита: трава — плавный тихий шум (n×n, крупные пятна cells[0] и мелкие cells[1] на плитку, доля второго цвета hue,
    // яркость ±amp); тропы — цвет земли: середина до w[0] м, край до w[1] м, неровность edge м, сила k
    groundNoise: { n: 128, cells: [4, 16], hue: [.1, .5], amp: .06 },
    path: { color: '#4e3c2a', w: [.45, 1.2], edge: .3, k: .75 }
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
  fires: { on: true, open: 8, reach: 3.2, safeR: 18, gate: 5, campR: 70, gap: 80 },     // campR — у лагеря только его костёр; gap — костры не ближе друг к другу (2026-10-20)
  // сон (G4): ночью в таверне или у безопасного костра — до wake часов утра; мир проживает ночь шагами dt с; враг, заметивший
  // спящего ближе wakeR м, будит его (без лечения)
  sleep: { wake: 7, dt: .2, wakeR: 10 },
  // объём слоями (F4): арки над изогнутыми тропами (пролёт span, высота h), деревья с кроной над
  // тропой (ствол в off м от середины тропы, крона тянется на reach м к тропе, высота h, примерно каждые every м); сквозное окно
  // у героя: радиус r (доля полувысоты экрана), cut — сколько точек выбрасывать в центре окна
  overhead: { on: true, arch: { span: 4.2, h: 3.4 }, canopy: { off: 2.6, reach: 1.9, h: 3.3, every: 9 }, xray: { on: true, r: .16, cut: .7 } },
  // погода (F3): виды [вес, мин. длина с, макс. длина с], переход ramp с; в дождь туман гуще (+fog), земля темнее (×wet),
  // капель drops (косо по ветру, падают со скоростью fall м/с в коробке box [ширина, высота] у камеры), всплесков splash в
  // секунду, кругов на воде ripples; force — для тестов ('clear' | 'cloudy' | 'rain'). На бой погода не влияет.
  // шейдеры (V2): вода — рябь по течению (ripple), блики (glint), мелководье у берега shallow на shoreW м, пена foam на foamW м;
  // сила 0 — выключено
  // листва — пятна цвета по месту (vary), прогретые участки и мягкий просвет (lit); металл оружия — блеск shine, сила блика spec;
  // декор — потёртости и пятна камня и дерева (grime)
  shaders: { water: { on: true, ripple: 1, glint: .9, shallow: '#3f7c78', shoreW: 1.8, foam: '#d6e6dc', foamW: .6, flow: .7 },
    leaf: { on: true, vary: 1, lit: .22 }, metal: { on: true, shine: 60, spec: '#8c8c8c' }, grime: { on: false, k: .18 },     // потёртости выключены (шаг 4 «Минус»: мелкая деталь против «мягко»)
    // ободок силуэта (V2c): край фигуры светлее — днём day, ночью night; ореолы ночью у фонарей и костров: размер, м, и цвет; max — сколько сразу
    // материалы (T0–T2): мягкие доски, брёвна, кора, камень с мхом, кладка, ткань, металл, черепица и земля по виду поверхности в шейдере;
    // сила по видам (wood — и доски, и кора с камнем природы); plank — ширина доски, tile — ряд черепицы, м
    paint: { on: true, ground: .8, wood: 1, roof: 1, log: 1, masonry: 1, cloth: 1, metal: 1, leather: 1, hide: 1, fur: 1, bone: 1, scale: 1, model: 1.7, plank: .3, tile: .3 },     // model — множитель у героев, врагов и зверей: они мелкие     // кожа, шкура, шерсть, кость, чешуя — герои и враги (T4)
    rim: { on: true, day: .08, night: .45, pow: 5, hero: '#ffd8a8', foe: '#ff9078' }, halo: { on: true, lamp: [2.6, '#ffb35a'], fire: [4.4, '#ff8a3a'], near: 70, max: 128, lampModel: [1.14, .26, 2] } },     // 4.11: lampModel — высота светильника модели, вынос от столба, размер ореола
  weather: { on: true, kinds: { clear: [.5, 150, 360], cloudy: [.22, 80, 200], rain: [.17, 70, 160], fog: [.11, 70, 170] }, ramp: 14, fog: .6, mist: 1.8, wet: .7,     // 4.18г: туман — погода, mist — насколько гуще
    drops: 900, fall: 16, box: [34, 18], splash: 26, ripples: 24, force: null,
    // дождь в бою (шаг R): при полном дожде враги слышат ×hear и видят ×sight, огонь (шанс и длительность поджога) ×fire,
    // молния («Гроза») срабатывает ×storm; между ясно и дождём — плавно по силе дождя
    combat: { hear: .7, sight: .73, fire: .6, storm: 1.5 } },
  // звук: громкость всего, музыки и природы; атмосфера (D1) — журчание у реки, птицы и сова, своя музыка «лесная сказка»
  audio: {
    // треки оркестра (2026-10-21, авторы — 3d/ART-CREDITS.md): vol — доля громкости музыки; duck — в бою; fade — сек плавности;
    // first — сек до первого спокойного трека; gap — сек между их началами [от, до]; chance — доля пауз с треком; intro — при начале; boss — на босса
    tracks: { on: true, vol: .75, duck: .45, fade: 2.5, first: 45, gap: [70, 160], chance: .6, intro: 'intro', boss: 'boss_sunrise', roam: ['roam_peractorum', 'roam_piano', 'roam_solitudine', 'roam_article169'] },
    ownMusic: .55,     // громкость своей музыки игрока (custom3d.js), 0–1; в бою — меньше вдвое
    volume: .7, musicVol: .55, natureVol: .8, voices: 24, look: 1.2,          // предел одновременных голосов; ноты ставятся вперёд на look с
    water: { near: 2, far: 25, vol: .09, plips: 6 },                     // полная громкость у берега, тишина дальше far м; бульков в секунду
    birds: { vol: .05, gap: [2, 7], day: [.45, .75], owlGap: [9, 20], owlVol: .05, frogGap: [1.5, 5], frogVol: .045, frogNear: 16 },     // лягушки — вечером и ночью у воды ближе frogNear м   // пауза между трелями, рассвет→день (свет)
    combat: { r: 16, n: 2, fade: 1.5 }, rustle: { vol: .06 }, rain: { vol: .08 },     // шелест листвы (F2), шум дождя (F3)             // шелест листвы (F2)                                   // встревоженных врагов в r м: n — полный бой; музыка и птицы стихают
    music: { vol: .12, rest: [30, 60], dayBpm: 84, nightBpm: 70, nightVol: .6, phrase: 8, form: 'AABA' },
    fight: { on: true, vol: .1, bpm: 128, bossBpm: 138, hold: 4 },     // боевая музыка (этап 1 «круче»): громкость, темп, с босса — быстрее; hold — сколько секунд играет после боя
    // сведение (шаг 8 аудита): все шины → громкость → мягкий ограничитель (до limit — без изменений, выше — плавно к 1) → выход;
    // компрессор не взят: в Chromium он вдвое глушил и тихие звуки и добавлял 6 мс задержки. Тон начинается с нуля за att с, срез высоких
    // min(lpMax, частота × lpK); каждый звук — высота ±pitch и громкость ±vol; звук мира тише с расстоянием 1/(1 + d/k), дальше far м
    // не слышен, панорама по экрану ±pan (полная на panW м); гул ночью night, в опасном месте danger × опасность
    fx: { limit: .6, att: .006, lpMax: 3500, lpK: 4,
      vary: { pitch: .05, vol: .15 }, space: { k: 8, far: 36, pan: .7, panW: 15 }, drone: { night: .02, danger: .012 } }
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
  save: { bakEvery: 300 },
  spark: { kills: 3, fireR: 5, ash: 50 },
  mentor: { on: true, ash: 25, libraryLv: 4, wearAt: 50 },     // советы первопроходцу (4.01): пепел за выполненный совет; с какого уровня книжница зовёт в библиотеку
  path: { on: true, fires: 3, squadLv: 5 },     // шаг 13: «Путь пепла» — костров в первой вехе, наём с уровня     // шаг 12: «Первая искра» — врагов за оградой, радиус у костра (м), награда пеплом     // шаг 11: резервная копия сохранения раз в 300 с (две копии)
  bag: { slots: 40 },     // шаг 10б: 40 мест на старте (было 30)
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
    autoAim: 5.5, aimCone: 30,     // aimCone — при прицеле курсором удар и умения подхватывают врага в этом конусе (±град) у курсора
            // удар сам поворачивается к ближайшему врагу в этом радиусе
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
    moves: true,
    // Г9 «умные враги» (только при отряде, кроме retreat): приёмы — по своей цели (спутнику, если бьёт его); ring — встают вокруг цели, а не в кучу;
    // retreat — раненый стрелок или колдун (ниже below) отходит от того, кто рядом, на t с, один раз
    smart: { on: true, ring: 1.4, retreat: { below: .35, t: 1.6, near: 4 } },     // приёмы «числовых» врагов (этап 2 «круче»): ai 'move' + move у вида; false — как раньше (база боя)
    count: 6,             // сколько врагов держим на поле
    respawn: 1.6,         // пауза до появления нового
    ring: [14, 19],       // на каком расстоянии от героя появляются
    // спокойный мир (G1): наверху враги появляются стайками вне экрана (ring м), бродят около места (patrolR), замечают взглядом
    // (posts) или шумом ближе hear м (бег, бой); днём держим day врагов вокруг героя, ночью — night; off — как раньше (кольцо и погоня)
    roam: { on: true, ring: [32, 46], pack: [2, 4], hear: 10, day: 7, night: 10, respawn: 5,
      firstPack: { lv: 3, hp: .5, r: 90 } },     // шаг 12: пока герой ниже lv, стайки ближе r м к лагерю — «молодые» (здоровье ×hp)
    sleep: { r: 80, drop: 110 },   // дальше r от героя враг «спит» (не обновляется и не считается в числе живых вокруг), дальше drop бродячий — забывается
    brutePart: .3,        // доля рогачей среди врагов
    ash_thief: { name: 'Пепельный вор', ai: 'flee', flee: 24, run: [3.5, 1.5], noElite: true, xp: 40, hp: 120, speed: 5, damage: 0, range: 1, wind: 1, recover: 1, radius: .45, scale: .9, immune: ['fear'] },     // убегает с мешком (этап 4 «круче»)
    imp:   { name: 'Бес', xp: 14, hp: 126, speed: 3.4, damage: 11,  range: 1.5, wind: .45, recover: .75, radius: .45, scale: 1, ai: 'move', move: { kind: 'leap', min: 3.5, max: 7, cd: 7, first: 2 }, lunge: { min: 3.5, max: 7, aim: .5, speed: 14, len: 5.5, w: .8, cd: 7, mul: .7 } },
    brute: { name: 'Рогач', xp: 45, hp: 390, speed: 2.2, damage: 28, range: 2.1, wind: .7,  recover: 1.0, radius: .8,  scale: 1.6, ai: 'move', move: { kind: 'slam', r: 2.6, wind: .7, mul: .55, cd: 9, first: 3 } },
    hound: { name: 'Гончая', g: 'f', on: ['bleed', .6, 2.5, 4], xp: 10, hp: 90, speed: 5.6, damage: 10,  range: 1.3, wind: .28, recover: .55, radius: .4,  scale: .85, ai: 'move', move: { kind: 'howl', r: 12, t: 5, spd: 1.2, cd: 20, first: .5 } },   // быстрая, хрупкая; рыщет у руин и лагеря
    ghoul: { name: 'Упырь', on: ['poison', .7, 2, 6], xp: 33, hp: 270, speed: 2.8, damage: 20, range: 1.8, wind: .55, recover: .9,  radius: .55, scale: 1.2, ai: 'move', move: { kind: 'spit', min: 4, max: 9, wind: .15, delay: 1, r: 1.6, mul: .45, cd: 8, first: 2 } },   // упырь: у кладбища и в часовне
    // дальний бой: ranged.keep — на каком расстоянии держится от героя; стрела летит со speed, колдовство накрывает пятно r через delay секунд
    archer: { name: 'Лучник Ржавых', xp: 22, hp: 150, speed: 3.2, damage: 14, range: 13, wind: .9, recover: 1.3, radius: .45, scale: 1, ranged: { kind: 'arrow', speed: 14, keep: [6, 10] } },
    witch: { name: 'Колдун Затмения', xp: 38, hp: 200, speed: 2.8, damage: 26, range: 14, wind: 1.1, recover: 2.4, radius: .5, scale: 1.05, on: ['burn', .5, 3, 5], ranged: { kind: 'hex', r: 2.4, delay: 1.0, keep: [7, 11] } },
    // особое поведение (ai, 3d/src/foes3d.js); g — род имени ('f' — женский) для подписей элиты
    // shield: щит спереди (guard.arc — ширина, град; mul — сколько урона проходит; turn — скорость поворота, рад/с); пробивают фланг, удар из переката, тяжёлый удар, оглушение
    shield: { name: 'Щитоносец Ржавых', ai: 'shield', xp: 40, hp: 300, speed: 2.4, damage: 22, range: 1.9, wind: .65, recover: .9, radius: .6, scale: 1.3, guard: { arc: 110, mul: .15, turn: 2.2, breakStun: .9 } },
    // bomber: подбегает на fuse.at и поджигает фитиль: через fuse.t взрыв радиуса fuse.r (ранит героя, отряд и других врагов), сам гибнет
    bomber: { name: 'Тлеющий', ai: 'bomber', xp: 18, hp: 70, speed: 4.6, damage: 34, range: 1.6, wind: .4, recover: .6, radius: .45, scale: .95, fuse: { at: 2.2, t: 1.2, r: 2.8 }, on: ['burn', 1, 3, 4] },
    // lunge: с min–max целится aim секунд (полоса на земле), потом рывок по прямой len м со скоростью speed; w — ширина полосы; cd — перезарядка
    alaric: { name: 'Аларик Белый', ai: 'lunge', soldier: 'alaric', xp: 0, hp: 300, speed: 4.8, damage: 12, range: 2, wind: .36, recover: .45, radius: .5, scale: 1.05, lunge: { min: 3, max: 8, aim: .5, speed: 16, len: 7, w: .9, cd: 2, mul: 1.2 } },     // поединок Акта I: быстрый, точный, не убивает (этап 3)
    lunger: { name: 'Копейщик Погоста', ai: 'lunge', xp: 30, hp: 200, speed: 2.9, damage: 30, range: 1.8, wind: .6, recover: 1.1, radius: .5, scale: 1.15, lunge: { min: 4, max: 9, aim: .8, speed: 15, len: 8, w: .9, cd: 3.5, mul: 1.3 }, on: ['bleed', .5, 3, 4] },
    // blink: с min–max исчезает и появляется за спиной героя (behind м), замах после этого дольше на extra с; cd — перезарядка
    shade: { name: 'Тень', g: 'f', ai: 'blink', xp: 26, hp: 110, speed: 3.6, damage: 24, range: 1.5, wind: .75, recover: .8, radius: .45, scale: 1.05, blink: { min: 5, max: 12, cd: 5, behind: 1.7, extra: .3 }, immune: ['bleed', 'poison'] },
    // кто водится в области (по ближайшей зоне карты); третий элемент 'night' — только ночью; остальное — бесы и рогачи по brutePart
    regions: {
      graveyard: [['ghoul', 6], ['imp', 2], ['brute', 1], ['witch', 1], ['lunger', 2], ['shade', 3, 'night'], ['ghoul', 3, null, 'patrol'], ['lunger', 1, null, 'guard']],
      ruins: [['hound', 4], ['brute', 3], ['imp', 2], ['witch', 2], ['bomber', 2], ['brute', 2, null, 'guard'], ['witch', 1, null, 'guard']],
      camp: [['hound', 3], ['brute', 4], ['imp', 2], ['archer', 4], ['shield', 3], ['archer', 3, null, 'guard'], ['shield', 2, null, 'patrol'], ['brute', 2, null, 'patrol']],
      farm: [['hound', 3], ['imp', 4], ['ghoul', 1], ['archer', 2], ['bomber', 1], ['imp', 2, null, 'patrol']],
      bandits: [['archer', 3], ['brute', 3], ['hound', 2], ['shield', 1]],                 // стоянки разбойников и курганы большого мира (G2)
      barrow: [['ghoul', 4], ['shade', 2], ['lunger', 1]],
      warcamp: [['archer', 4], ['shield', 3], ['brute', 4], ['hound', 2], ['bomber', 2], ['lunger', 1]],     // вражеские лагеря (2026-10-18)
      city: [['shield', 3], ['brute', 3], ['witch', 2], ['shade', 2], ['lunger', 2], ['archer', 3], ['ghoul', 2]]     // павшие города
    },
    // гарнизоны (G2): опасные места и стоянки большого мира заселяются, когда герой ближе near м (но дальше far — вне экрана);
    // n — сколько врагов по виду места; после зачистки и ухода место заселяется снова через respawn с
    garrison: { near: 62, far: 28, respawn: 480, n: { camp: 4, ruins: 4, graveyard: 4, farm: 3, bandits: 3, barrow: 2, warcamp: 9, city: 14 },
      // вожаки (мини-боссы): сколько, звание, во сколько раз крепче элиты; spread — доля радиуса места, где встают гарнизоны; cityHp — крепче в городах
      chief: { warcamp: [1, 'Вожак лагеря', 2.2], city: [3, 'Капитан стражи', 2] }, spread: { warcamp: .6, city: .7 }, cityHp: 1.3, bossNear: 90 },
    // кто бродит по биому большого мира вне областей (C3b)
    biomes: {
      forest: [['imp', 4], ['brute', 4], ['hound', 2]],                       // как вне областей ядра (бесы и рогачи) + приправа биома;
      swamp: [['imp', 3], ['brute', 3], ['ghoul', 3], ['shade', 1, 'night']],  // сложные смеси — в опасных местах, как в ядре
      mountains: [['brute', 5], ['imp', 3], ['shield', 1]],
      waste: [['imp', 5], ['brute', 3], ['bomber', 1]],
      coast: [['imp', 4], ['brute', 3], ['archer', 1], ['hound', 1]]
    },
    // кто бродит по зонам Акта II (этап 7) — важнее биома: Мшистые топи, Предгорья, Ржавые пустоши
    zones: {
      moss: [['drowned', 3], ['kad_soldier', 2], ['kad_xbow', 2], ['kad_spear', 1], ['ghoul', 1], ['shade', 1, 'night']],
      foot: [['kad_soldier', 3], ['kad_xbow', 3], ['kad_spear', 2], ['kad_banner', 1], ['brute', 1]],
      rust: [['golem', 2], ['blackdog', 3], ['kad_soldier', 2], ['kad_xbow', 2], ['bomber', 1]],
      grey: [['blackdog', 3], ['royal_guard', 2], ['archer', 2], ['shield', 1], ['hound', 2]],     // Акт III: Серый берег, Затмённое побережье, Поля Великой войны
      dusk: [['eclipse_fiend', 3], ['shade', 2], ['blackdog', 2], ['witch', 1], ['brandshade', 1, 'night']],
      war: [['war_ghost', 3], ['lunger', 2], ['ghoul', 2], ['shade', 2], ['eclipse_fiend', 1]],
      rot: [['drowned', 3], ['ghoul', 2], ['shrieker', 2], ['eclipse_fiend', 2], ['brandshade', 1, 'night']],     // Акт IV: Гнилые топи, Горы Безмолвия, Сердце Затмения
      mute: [['troll', 2], ['shrieker', 2], ['war_ghost', 2], ['lunger', 2], ['brute', 1]],
      heart: [['demon_guard', 2], ['eclipse_fiend', 3], ['brandshade', 2], ['troll', 1], ['shade', 1]]
    },
    // outerK (C3b) заменён уровнем места: config3d.js → level.core/edge/grow (этап 0)
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
    castellan: { boss: true, name: 'Кастелян Пепла',   xp: 2200, hp: 10500, speed: 3.3, damage: 46, range: 3.4, wind: .7, recover: .9, radius: 1.6, scale: 2.6, heavy: true, immune: ['stun', 'fear'], on: ['burn', .55, 3, 4] },     // замки (C4)
    queen:     { boss: true, name: 'Королева Пустоши', g: 'f', xp: 2800, hp: 10000, speed: 4.4, damage: 44, range: 2.9, wind: .6, recover: .8, radius: 1.3, scale: 2.3, heavy: true, immune: ['stun', 'freeze', 'poison'], on: ['poison', .7, 4, 5] },
    ashking:   { boss: true, name: 'Пепельный Король', xp: 3600, hp: 15000, speed: 3.6, damage: 66, range: 3.5, wind: .7, recover: .85, radius: 1.7, scale: 2.9, heavy: true, immune: ['stun', 'fear'], on: ['burn', .7, 5, 6] },     // павшие города (2026-10-18)
    brandlord: { boss: true, name: 'Клеймёный Владыка', xp: 9000, hp: 15000, speed: 3.8, damage: 66, range: 3.6, wind: .7, recover: .85, radius: 1.8, scale: 3, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .6, 6, 6] },     // боссы колец мира ×2 (4.06): сила — по уровню места (60–80)
    abyssking: { boss: true, name: 'Король Бездны', xp: 14000, hp: 15000, speed: 3.6, damage: 66, range: 3.8, wind: .75, recover: .85, radius: 1.9, scale: 3.2, heavy: true, immune: ['stun', 'fear', 'freeze'], on: ['poison', .7, 6, 6] },
    // боссы подземелий (этап 5): здоровье и урон — под уровень base из instances (выше — рост ×grow, героическая — ×heroic)
    gravekeeper:  { boss: true, name: 'Могильщик Ольм',     xp: 900,  hp: 5200,  speed: 2.8, damage: 34, range: 3.0, wind: .65, recover: .9, radius: 1.3, scale: 2.2, heavy: true, immune: ['stun'], on: ['poison', .7, 3, 5] },
    ashsister:    { boss: true, name: 'Сестра Пепла', g: 'f', xp: 900, hp: 8000, speed: 3.8, damage: 30, range: 2.6, wind: .55, recover: .8, radius: 1.0, scale: 1.9, heavy: true, immune: ['stun', 'fear'], on: ['burn', .6, 3, 4] },
    boneshepherd: { boss: true, name: 'Костяной Пастырь',   xp: 1500, hp: 8000,  speed: 3.0, damage: 40, range: 3.2, wind: .65, recover: .9, radius: 1.5, scale: 2.5, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .7, 3, 5] },
    mossbeast:    { boss: true, name: 'Мшистый Зверь',      xp: 1800, hp: 9000,  speed: 3.4, damage: 52, range: 3.2, wind: .7, recover: .9, radius: 1.6, scale: 2.6, heavy: true, immune: ['stun'], on: ['poison', .7, 4, 5] },
    thornwitch:   { boss: true, name: 'Терновая Ведьма', g: 'f', xp: 1800, hp: 11000, speed: 3.6, damage: 46, range: 2.6, wind: .55, recover: .8, radius: 1.0, scale: 2.0, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .7, 4, 5] },
    greywolf:     { boss: true, name: 'Вожак Серых',        xp: 1800, hp: 9500,  speed: 5.0, damage: 50, range: 2.4, wind: .45, recover: .7, radius: 1.1, scale: 2.0, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .8, 4, 4] },
    oakking:      { boss: true, name: 'Ольховый Король',    xp: 3200, hp: 15000, speed: 3.0, damage: 60, range: 3.6, wind: .7, recover: .9, radius: 1.8, scale: 2.9, heavy: true, immune: ['stun', 'fear', 'freeze'], on: ['poison', .8, 5, 5] },
    // Акт II (этап 7): войско Кадмии (soldier — облик бойца, aura — знаменосец: враги рядом бьют сильнее на dmg), твари топей и кузни, Чёрные Псы
    kad_soldier: { name: 'Латник Кадмии', ai: 'shield', soldier: 'kad_soldier', xp: 50, hp: 380, speed: 2.6, damage: 30, range: 2, wind: .6, recover: .9, radius: .6, scale: 1.1, guard: { arc: 100, mul: .2, turn: 2.4, breakStun: .9 } },
    kad_xbow:    { name: 'Арбалетчик Кадмии', soldier: 'kad_xbow', xp: 32, hp: 190, speed: 3, damage: 24, range: 14, wind: 1, recover: 1.4, radius: .45, scale: 1, ranged: { kind: 'arrow', speed: 18, keep: [7, 11] } },
    kad_spear:   { name: 'Копейщик Кадмии', ai: 'lunge', soldier: 'kad_spear', xp: 42, hp: 270, speed: 2.9, damage: 32, range: 1.9, wind: .6, recover: 1, radius: .5, scale: 1.05, lunge: { min: 4, max: 9, aim: .7, speed: 15, len: 8, w: .9, cd: 3.2, mul: 1.3 }, on: ['bleed', .5, 2.5, 4] },
    kad_banner:  { name: 'Знаменосец Кадмии', soldier: 'kad_banner', xp: 80, hp: 520, speed: 2.4, damage: 26, range: 2, wind: .7, recover: 1, radius: .6, scale: 1.15, aura: { r: 7, dmg: .25 } },
    drowned:     { name: 'Утопленник', xp: 40, hp: 320, speed: 2.2, damage: 26, range: 1.8, wind: .6, recover: .9, radius: .55, scale: 1.2, on: ['poison', .7, 3, 5], ai: 'move', move: { kind: 'pull', min: 3, max: 8, wind: .6, mul: .4, force: 12, cd: 9, first: 2 } },
    golem:       { name: 'Огненный голем', xp: 90, hp: 720, speed: 1.8, damage: 40, range: 2.2, wind: .8, recover: 1.1, radius: .9, scale: 1.8, heavy: true, immune: ['burn'], on: ['burn', .8, 4, 4], ai: 'move', move: { kind: 'skin', at: .5, t: 5, mul: .5 } },
    blackdog:    { name: 'Чёрный пёс', xp: 55, hp: 300, speed: 4.6, damage: 30, range: 1.6, wind: .4, recover: .6, radius: .55, scale: 1.15, on: ['bleed', .8, 3, 4], ai: 'move', move: { kind: 'ambush', min: 5, max: 12, cd: 7, behind: 1.6, extra: .25, first: 2 } },
    garm:        { name: 'Гарм Безглазый', ai: 'lunge', xp: 0, hp: 4200, speed: 4.2, damage: 44, range: 2.2, wind: .5, recover: .6, radius: .8, scale: 1.6, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .9, 4, 5], lunge: { min: 3, max: 10, aim: .6, speed: 18, len: 9, w: 1.2, cd: 3, mul: 1.4 } },
    alaric2:     { name: 'Аларик Белый', ai: 'lunge', soldier: 'alaric', xp: 0, hp: 2600, speed: 5, damage: 44, range: 2.1, wind: .34, recover: .42, radius: .5, scale: 1.05, immune: ['stun'], lunge: { min: 3, max: 8, aim: .45, speed: 17, len: 7, w: .9, cd: 2, mul: 1.4 } },
    // боссы подземелий Акта II
    sapper:      { boss: true, name: 'Кадмийский минёр',  xp: 2000, hp: 11500, speed: 3.2, damage: 56, range: 2.8, wind: .6, recover: .85, radius: 1.1, scale: 2.0, heavy: true, immune: ['stun'], on: ['burn', .7, 4, 4] },
    drownedmaid: { boss: true, name: 'Утопленница', g: 'f', xp: 2000, hp: 9000, speed: 3.4, damage: 46, range: 2.6, wind: .55, recover: .8, radius: 1.0, scale: 2.0, heavy: true, immune: ['stun', 'fear'], on: ['poison', .7, 4, 5] },
    silt:        { boss: true, name: 'Хозяин Ила',        xp: 3200, hp: 14000, speed: 2.8, damage: 56, range: 3.4, wind: .7, recover: .9, radius: 1.7, scale: 2.8, heavy: true, immune: ['stun', 'fear'], on: ['poison', .8, 5, 5] },
    gatewarden:  { boss: true, name: 'Привратник Твердыни', xp: 2400, hp: 12000, speed: 3.0, damage: 58, range: 3.2, wind: .7, recover: .9, radius: 1.5, scale: 2.5, heavy: true, immune: ['stun'], on: ['bleed', .7, 4, 4] },
    gneis:       { boss: true, name: 'Комендант Гнейс',    xp: 2400, hp: 8500, speed: 3.6, damage: 50, range: 2.6, wind: .55, recover: .8, radius: 1.0, scale: 1.9, heavy: true, immune: ['stun', 'fear'] },
    borot:       { boss: true, name: 'Борот Синий',       xp: 3800, hp: 17000, speed: 3.0, damage: 66, range: 3.6, wind: .7, recover: .9, radius: 1.8, scale: 2.9, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .8, 5, 5] },
    armorer:     { boss: true, name: 'Мастер-оружейник',  xp: 2600, hp: 13000, speed: 3.0, damage: 60, range: 3.2, wind: .7, recover: .9, radius: 1.5, scale: 2.5, heavy: true, immune: ['stun'], on: ['burn', .7, 4, 4] },
    firegolem:   { boss: true, name: 'Сердце Горна',      xp: 2600, hp: 12500, speed: 2.4, damage: 68, range: 3.4, wind: .8, recover: 1, radius: 1.8, scale: 2.8, heavy: true, immune: ['stun', 'fear', 'burn'], on: ['burn', 1, 5, 5] },
    smelter:     { boss: true, name: 'Плавильщик',        xp: 4200, hp: 12300, speed: 3.0, damage: 63, range: 3.6, wind: .7, recover: .9, radius: 1.8, scale: 2.9, heavy: true, immune: ['stun', 'fear', 'burn'], on: ['burn', .9, 5, 5] },     // 3.97: здоровье −15%, урон −10% — отряд уровня подземелья проигрывал 3 боя из 4
    // Акт III (этап 7): стража Велиграда, тени клейма, твари Затмения, призраки Великой войны; Гарм-зверь — босс сцены; боссы Башни и Курганов
    royal_guard: { name: 'Стража Велиграда', ai: 'shield', soldier: 'royal_guard', xp: 70, hp: 560, speed: 2.8, damage: 42, range: 2, wind: .55, recover: .85, radius: .6, scale: 1.1, guard: { arc: 100, mul: .2, turn: 2.6, breakStun: .9 } },
    brandshade:  { name: 'Тень клейма', g: 'f', ai: 'blink', xp: 45, hp: 280, speed: 4, damage: 44, range: 1.6, wind: .6, recover: .7, radius: .45, scale: 1.1, blink: { min: 4, max: 11, cd: 4, behind: 1.6, extra: .25 }, immune: ['bleed', 'poison', 'fear'] },
    eclipse_fiend: { name: 'Тварь Затмения', xp: 65, hp: 400, speed: 5, damage: 46, range: 1.7, wind: .4, recover: .6, radius: .55, scale: 1.2, on: ['bleed', .7, 3, 4], immune: ['fear'], ai: 'move', move: { kind: 'slam', r: 3.5, wind: .5, mul: 1, on: ['burn', .7, 3, 4], cd: 6, first: 2 } },
    war_ghost:   { name: 'Призрак Великой войны', xp: 85, hp: 560, speed: 2.6, damage: 54, range: 2.2, wind: .65, recover: .9, radius: .6, scale: 1.3, immune: ['poison', 'bleed'], on: ['bleed', .5, 3, 3], ai: 'move', move: { kind: 'phase', min: 4, max: 12, t: 1.5, mul: .15, spd: 1.6, cd: 8, first: 2 } },
    garm_beast:  { boss: true, name: 'Гарм-зверь',        xp: 4400, hp: 16000, speed: 4.2, damage: 76, range: 3, wind: .55, recover: .7, radius: 1.4, scale: 2.4, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .9, 5, 5] },
    towerwarden: { boss: true, name: 'Страж Башни',       xp: 3000, hp: 15000, speed: 3.0, damage: 74, range: 3.2, wind: .7, recover: .9, radius: 1.5, scale: 2.5, heavy: true, immune: ['stun'] },
    keymaster:   { boss: true, name: 'Ключник',           xp: 3000, hp: 11500, speed: 3.4, damage: 66, range: 2.6, wind: .55, recover: .8, radius: 1.0, scale: 1.9, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .7, 4, 4] },
    lampwarden:  { boss: true, name: 'Смотритель Маяка',  xp: 3500, hp: 16500, speed: 2.9, damage: 78, range: 3.2, wind: .7, recover: .9, radius: 1.5, scale: 2.5, heavy: true, immune: ['stun'], on: ['burn', .6, 4, 4] },     // Маяк Затмения (2026-10-20)
    tidecaller:  { boss: true, name: 'Зовущая Прилив',    xp: 3500, hp: 12000, speed: 3.2, damage: 66, range: 2.8, wind: .6, recover: .8, radius: 1.0, scale: 2.0, heavy: true, immune: ['stun', 'fear'], on: ['poison', .6, 4, 4], g: 'f' },
    tidewyrm:    { boss: true, name: 'Змей Чёрного Прилива', xp: 5000, hp: 12000, speed: 4.0, damage: 74, range: 3.0, wind: .55, recover: .75, radius: 1.5, scale: 2.6, heavy: true, immune: ['stun', 'fear', 'poison'], on: ['poison', .8, 5, 5] },     // 3.97: здоровье −29%, урон −10%; в бою — лужи слабее, меньше призыва — отряд уровня подземелья проигрывал 3 боя из 4
    towerhound:  { boss: true, name: 'Пёс Башни',         xp: 4600, hp: 14400, speed: 4.4, damage: 70, range: 2.8, wind: .5, recover: .7, radius: 1.3, scale: 2.4, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .9, 5, 5] },     // 3.97: здоровье −15%, урон −10% — отряд уровня подземелья проигрывал 3 боя из 4
    bloodbanner: { boss: true, name: 'Кровавый знаменосец', xp: 4000, hp: 18000, speed: 3.0, damage: 86, range: 3.2, wind: .7, recover: .9, radius: 1.5, scale: 2.6, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .8, 5, 5] },
    namelessking: { boss: true, name: 'Безымянный король', xp: 4000, hp: 17000, speed: 2.8, damage: 82, range: 3.4, wind: .7, recover: .9, radius: 1.5, scale: 2.6, heavy: true, immune: ['stun', 'fear', 'poison'], on: ['bleed', .7, 4, 4] },
    // рейды 20 и 40 (4.18, просьба владельца: рейды на 20, 40, 60, 80)
    barghest: { boss: true, name: 'Баргест', xp: 2400, hp: 13000, speed: 5.0, damage: 46, range: 2.6, wind: 0.45, recover: 0.7, radius: 1.2, scale: 1.9, heavy: true, immune: ['fear'], on: ['bleed', .6, 4, 4] },
    rootgnaw: { boss: true, name: 'Корнегрыз', xp: 2400, hp: 15000, speed: 3.0, damage: 48, range: 3.0, wind: 0.65, recover: 0.9, radius: 1.3, scale: 2.2, heavy: true, immune: ['stun'], on: ['poison', .6, 4, 4] },
    hagmother: { boss: true, name: 'Мать-Ведьма', g: 'f', xp: 2600, hp: 12000, speed: 3.4, damage: 44, range: 2.6, wind: 0.55, recover: 0.8, radius: 1.0, scale: 1.9, heavy: true, immune: ['fear'], on: ['poison', .7, 5, 4] },
    thornlord: { boss: true, name: 'Терновый Лорд', xp: 2800, hp: 16000, speed: 3.2, damage: 52, range: 3.2, wind: 0.6, recover: 0.85, radius: 1.3, scale: 2.2, heavy: true, immune: ['stun', 'root'], on: ['bleed', .7, 4, 4] },
    oldoak: { boss: true, name: 'Древний Дуб', xp: 4000, hp: 22000, speed: 2.6, damage: 58, range: 3.6, wind: 0.75, recover: 1, radius: 1.8, scale: 2.9, heavy: true, immune: ['stun', 'root', 'fear'], on: ['poison', .8, 5, 5] },
    saltwarden: { boss: true, name: 'Соляной Страж', xp: 4200, hp: 19000, speed: 2.8, damage: 68, range: 3.4, wind: 0.7, recover: 0.9, radius: 1.5, scale: 2.5, heavy: true, immune: ['stun'], on: ['bleed', .6, 5, 4] },
    drownchoir: { boss: true, name: 'Хор Утонувших', xp: 4200, hp: 16000, speed: 3.2, damage: 62, range: 2.8, wind: 0.55, recover: 0.8, radius: 1.1, scale: 2.0, heavy: true, immune: ['fear', 'poison'], on: ['poison', .7, 5, 4] },
    abbess: { boss: true, name: 'Утонувшая Настоятельница', g: 'f', xp: 4400, hp: 17000, speed: 3.4, damage: 64, range: 2.8, wind: 0.55, recover: 0.8, radius: 1.1, scale: 2.0, heavy: true, immune: ['fear'], on: ['bleed', .7, 5, 4] },
    cathkraken: { boss: true, name: 'Кракен Собора', xp: 4800, hp: 22000, speed: 3.4, damage: 70, range: 3.4, wind: 0.6, recover: 0.85, radius: 1.6, scale: 2.6, heavy: true, immune: ['stun', 'root'], on: ['bleed', .7, 5, 5] },
    drowngod: { boss: true, name: 'Утонувший Бог', xp: 6500, hp: 30000, speed: 2.8, damage: 78, range: 3.8, wind: 0.7, recover: 0.9, radius: 1.8, scale: 3.0, heavy: true, immune: ['stun', 'root', 'fear', 'poison'], on: ['poison', .9, 6, 5] },
    // Г5 (4.18): боссы подземелий колец 60–80 и рейда «Престол Бездны»
    bogwarden: { boss: true, name: 'Страж Трясины', xp: 6500, hp: 19000, speed: 2.9, damage: 92, range: 3.4, wind: 0.7, recover: 0.9, radius: 1.6, scale: 2.6, heavy: true, immune: ['stun'], on: ['poison', .6, 5, 4] },
    drownqueen: { boss: true, name: 'Королева Утопших', g: 'f', xp: 6500, hp: 15000, speed: 3.4, damage: 84, range: 2.8, wind: 0.55, recover: 0.8, radius: 1.1, scale: 2.1, heavy: true, immune: ['fear'], on: ['bleed', .5, 4, 4] },
    leviathan: { boss: true, name: 'Глубинный Змей', xp: 9000, hp: 22000, speed: 3.6, damage: 96, range: 3.4, wind: 0.6, recover: 0.8, radius: 1.6, scale: 2.6, heavy: true, immune: ['stun', 'root'], on: ['bleed', .6, 5, 4] },
    ashgolem: { boss: true, name: 'Пепельный Колосс', xp: 7000, hp: 21000, speed: 2.4, damage: 100, range: 3.6, wind: 0.8, recover: 1, radius: 1.8, scale: 2.9, heavy: true, immune: ['stun', 'fear'], on: ['burn', .7, 5, 4] },
    cinderpriest: { boss: true, name: 'Жрица Углей', g: 'f', xp: 7000, hp: 16000, speed: 3.4, damage: 88, range: 2.8, wind: 0.55, recover: 0.8, radius: 1.1, scale: 2.1, heavy: true, immune: ['fear'], on: ['burn', .8, 5, 4] },
    cinderlord: { boss: true, name: 'Тлеющий Владыка', xp: 10000, hp: 24000, speed: 3.0, damage: 104, range: 3.6, wind: 0.7, recover: 0.9, radius: 1.5, scale: 2.6, heavy: true, immune: ['stun', 'fear'], on: ['burn', .9, 6, 5] },
    rotmaw: { boss: true, name: 'Гнилая Пасть', xp: 8000, hp: 22000, speed: 3.2, damage: 102, range: 3.2, wind: 0.65, recover: 0.85, radius: 1.6, scale: 2.6, heavy: true, immune: ['poison'], on: ['poison', .9, 6, 6] },
    sporemother: { boss: true, name: 'Мать Спор', g: 'f', xp: 8000, hp: 18000, speed: 3.0, damage: 92, range: 2.8, wind: 0.6, recover: 0.85, radius: 1.2, scale: 2.2, heavy: true, immune: ['poison', 'fear'], on: ['poison', .9, 6, 6] },
    riftheart: { boss: true, name: 'Сердце Разлома', xp: 11000, hp: 26000, speed: 2.6, damage: 108, range: 3.6, wind: 0.7, recover: 0.9, radius: 1.7, scale: 2.8, heavy: true, immune: ['stun', 'root', 'poison'], on: ['poison', .9, 6, 7] },
    voidwarden: { boss: true, name: 'Страж Пустоты', xp: 12000, hp: 30000, speed: 3.0, damage: 110, range: 3.6, wind: 0.7, recover: 0.9, radius: 1.7, scale: 2.9, heavy: true, immune: ['stun', 'root'], on: ['bleed', .7, 6, 5] },
    twinflame: { boss: true, name: 'Двуликое Пламя', xp: 12000, hp: 28000, speed: 3.6, damage: 106, range: 3.0, wind: 0.55, recover: 0.8, radius: 1.3, scale: 2.4, heavy: true, immune: ['fear'], on: ['burn', .9, 7, 5] },
    hollowqueen: { boss: true, name: 'Полая Королева', g: 'f', xp: 12000, hp: 27000, speed: 3.4, damage: 104, range: 3.0, wind: 0.55, recover: 0.8, radius: 1.2, scale: 2.3, heavy: true, immune: ['fear', 'poison'], on: ['poison', .7, 6, 5] },
    abyssmaw: { boss: true, name: 'Пасть Бездны', xp: 13000, hp: 34000, speed: 3.2, damage: 114, range: 3.6, wind: 0.65, recover: 0.85, radius: 1.9, scale: 3.0, heavy: true, immune: ['stun', 'root', 'fear'], on: ['bleed', .9, 7, 6] },
    voidking: { boss: true, name: 'Король Пустоты', xp: 18000, hp: 42000, speed: 3.0, damage: 120, range: 3.8, wind: 0.7, recover: 0.9, radius: 1.8, scale: 3.1, heavy: true, immune: ['stun', 'root', 'fear', 'poison'], on: ['burn', .9, 8, 6] },
    gravewight:  { boss: true, name: 'Отступник-могильщик', xp: 6000, hp: 15000, speed: 3.0, damage: 86, range: 3.6, wind: .7, recover: .9, radius: 1.8, scale: 2.9, heavy: true, immune: ['stun', 'fear', 'poison'], on: ['poison', .9, 5, 6] },
    // Акт IV (этап 7): кликуша (heal — лечит раненых своих: доля здоровья amt раз в cd с в радиусе r), горный тролль (regen — доля здоровья в секунду,
    // если 3 с не били), демон-страж; человек в маске — испытание; боссы Гнезда и Монастыря; Отступники — боссы сцен
    shrieker:    { name: 'Кликуша', g: 'f', xp: 95, hp: 480, speed: 2.8, damage: 50, range: 14, wind: 1.1, recover: 2.2, radius: .5, scale: 1.1, on: ['burn', .5, 4, 4], ranged: { kind: 'hex', r: 2.4, delay: 1, keep: [7, 11] }, heal: { r: 9, amt: .12, cd: 4 } },
    troll:       { name: 'Горный тролль', xp: 150, hp: 1500, speed: 2.4, damage: 80, range: 2.6, wind: .85, recover: 1.2, radius: 1.1, scale: 2.1, heavy: true, regen: .015 },
    demon_guard: { name: 'Демон-страж', xp: 160, hp: 1200, speed: 3.2, damage: 86, range: 2.4, wind: .6, recover: .8, radius: .9, scale: 1.9, heavy: true, immune: ['fear', 'stun'], on: ['burn', .7, 5, 4], ai: 'move', move: { kind: 'leap', min: 4, max: 9, cd: 6, first: 2 }, lunge: { min: 4, max: 9, aim: .7, speed: 16, len: 7, w: 1.2, cd: 6, mul: 1.2 } },
    masked_knight: { name: 'Человек в маске', ai: 'lunge', soldier: 'masked_k', xp: 0, hp: 6000, speed: 5, damage: 70, range: 2.3, wind: .34, recover: .45, radius: .55, scale: 1.15, immune: ['stun', 'fear'], lunge: { min: 3, max: 8, aim: .45, speed: 17, len: 7, w: 1, cd: 2.2, mul: 1.4 } },
    swampelder:  { boss: true, name: 'Староста-Отступник', xp: 5000, hp: 16000, speed: 3.0, damage: 94, range: 3.2, wind: .7, recover: .9, radius: 1.5, scale: 2.5, heavy: true, immune: ['stun', 'fear'], on: ['poison', .8, 6, 5] },
    feeder:      { boss: true, name: 'Кормилец',          xp: 5000, hp: 16000, speed: 2.8, damage: 96, range: 3.2, wind: .7, recover: .9, radius: 1.6, scale: 2.6, heavy: true, immune: ['stun'], on: ['poison', .8, 6, 5] },
    swarm:       { boss: true, name: 'Рой',               xp: 5000, hp: 14000, speed: 4.0, damage: 88, range: 2.6, wind: .5, recover: .7, radius: 1.2, scale: 2.2, heavy: true, immune: ['stun', 'fear', 'poison'], on: ['bleed', .8, 5, 4] },
    nestlord:    { boss: true, name: 'Хозяин Гнезда',     xp: 7000, hp: 15300, speed: 3.0, damage: 94, range: 3.6, wind: .7, recover: .9, radius: 1.8, scale: 2.9, heavy: true, immune: ['stun', 'fear', 'poison'], on: ['poison', .9, 7, 6] },     // 3.97: здоровье −15%, урон −10% — отряд уровня подземелья проигрывал 3 боя из 4
    abbeyshriek: { boss: true, name: 'Старшая кликуша', g: 'f', xp: 5400, hp: 15000, speed: 3.4, damage: 98, range: 2.6, wind: .55, recover: .8, radius: 1.0, scale: 2.0, heavy: true, immune: ['stun', 'fear'], on: ['burn', .8, 6, 4] },
    choir:       { boss: true, name: 'Безмолвный хор',    xp: 5400, hp: 16000, speed: 2.6, damage: 100, range: 3.4, wind: .7, recover: .9, radius: 1.6, scale: 2.6, heavy: true, immune: ['stun', 'fear', 'bleed'] },
    abbot:       { boss: true, name: 'Настоятель-Отступник', xp: 7600, hp: 15300, speed: 3.0, damage: 101, range: 3.6, wind: .7, recover: .9, radius: 1.8, scale: 2.9, heavy: true, immune: ['stun', 'fear', 'poison'], on: ['burn', .9, 7, 5] },     // 3.97: здоровье −15%, урон −10%; «Тишина» ×1,6, одна кликуша вместо двух (лечили босса) — отряд проигрывал 3 боя из 4
    ap_serpent:  { boss: true, name: 'Отступник-Змей',    xp: 7000, hp: 17000, speed: 3.6, damage: 112, range: 3.2, wind: .6, recover: .8, radius: 1.5, scale: 2.6, heavy: true, immune: ['stun', 'fear', 'poison'], on: ['poison', .9, 8, 5] },
    ap_boar:     { boss: true, name: 'Отступник-Вепрь',   xp: 7000, hp: 19000, speed: 3.4, damage: 118, range: 3.4, wind: .7, recover: .9, radius: 1.8, scale: 2.9, heavy: true, immune: ['stun', 'fear'], on: ['bleed', .9, 8, 5] },
    ap_moth:     { boss: true, name: 'Отступница-Моль', g: 'f', xp: 7000, hp: 16000, speed: 3.8, damage: 108, range: 2.8, wind: .55, recover: .8, radius: 1.3, scale: 2.4, heavy: true, immune: ['stun', 'fear'], on: ['burn', .9, 7, 4] },
    // рейд «Врата Длани» (этап 8): привратник и четверо Длани; Пятый (Аларик) появляется в бою с Владыкой и уходит — его не добить
    gatebeast:   { boss: true, name: 'Привратник Врат',   xp: 9000, hp: 30000, speed: 3.2, damage: 120, range: 3.6, wind: .7, recover: .9, radius: 1.8, scale: 3.0, heavy: true, immune: ['stun', 'fear'], on: ['burn', .8, 8, 5] },
    hand_womb:   { boss: true, name: 'Длань: Утроба',     xp: 9000, hp: 24000, speed: 2.8, damage: 118, range: 3.4, wind: .7, recover: .9, radius: 1.7, scale: 2.9, heavy: true, immune: ['stun', 'fear', 'poison'], on: ['poison', .9, 9, 6] },
    hand_whisper: { boss: true, name: 'Длань: Шёпот', g: 'f', xp: 9000, hp: 28000, speed: 3.4, damage: 124, range: 2.8, wind: .6, recover: .8, radius: 1.2, scale: 2.5, heavy: true, immune: ['stun', 'fear'], on: ['burn', .8, 8, 4] },
    hand_net:    { boss: true, name: 'Длань: Сеть',       xp: 9000, hp: 24000, speed: 3.0, damage: 120, range: 3.4, wind: .7, recover: .9, radius: 1.6, scale: 2.8, heavy: true, immune: ['stun', 'fear', 'bleed'], on: ['bleed', .8, 8, 5] },
    hand_lord:   { boss: true, name: 'Длань: Владыка',    xp: 16000, hp: 34000, speed: 3.0, damage: 130, range: 3.8, wind: .7, recover: .9, radius: 2.0, scale: 3.3, heavy: true, immune: ['stun', 'fear', 'poison', 'bleed'], on: ['burn', .9, 10, 5] },
    bonetyrant: { boss: true, name: 'Костяной Тиран', xp: 3300, hp: 13500, speed: 4, damage: 58, range: 3.3, wind: .6, recover: .8, radius: 1.5, scale: 2.7, heavy: true, immune: ['stun', 'poison'], on: ['bleed', .7, 4, 6] },
    chief:    { boss: true, name: 'Вожак Ржавых',       xp: 1400, hp: 11500, speed: 3.2, damage: 62, range: 3.4, wind: .7, recover: .9, radius: 1.7, scale: 2.7, heavy: true, immune: ['stun'], on: ['bleed', .8, 4, 5] },
    // слух: чем громче герой, тем дальше его слышат. Услышавший идёт к герою, пока тот не уйдёт дальше `lose`
    hear: { idle: 10, run: 17, fight: 25, house: .55, lose: 32, drift: .3 },
    // сторожа и патрули (четвёртый элемент в таблице области: 'guard' — стоит у поста, 'patrol' — ходит по маршруту; без него — бродит, как раньше).
    // Видят конусом (angle, град; range, м; стена закрывает обзор), слышат только бой (fightHear — доля слуха боя); заметив — кричат: встают соседи в alarm м.
    // Отходят от поста не дальше leash м; потеряв героя — возвращаются. modes: false — все бродят (для сравнения боя с прошлыми версиями)
    posts: { modes: true, angle: 120, range: 15, fightHear: .7, alarm: 11, leash: 28, look: .8, patrolPts: 3, patrolR: 9, patrolSpeed: .4, home: .55, cool: 4 },     // cool — после брошенной погони столько секунд идёт к посту и не замечает героя   // drift: доля скорости, с которой «бредёт» неуслышавший
    knockDecay: 9
  },

  // интерфейс (шаг 5): бой под меню останавливается за stopT с; окна появляются за inMs мс
  ui: { stopT: .15, inMs: 220 },
  // ощущение боя (этап 1 «круче»): только вид и звук, симуляция не меняется. kill — [замедление, с] на каждом убийстве;
  // elite — [замедление, с, цвет вспышки, сила]; boss — то же + наезд камеры (доля дистанции); hurt — [доля здоровья за удар,
  // замедление, с, цвет, сила]; level — [цвет, сила, наезд]; streak — серия: убийства не реже gap с, надпись с from-го;
  // low — ниже hp доли здоровья красная кайма до vig и сердце раз в beat [у порога, у нуля] с; calm — вспышка при «уменьшить движение»
  feel: { on: true, kill: [.15, .045], elite: [.3, .32, '#ffd27a', .22], boss: [.2, 1.1, '#fff4d8', .45, .14],
    hurt: [.15, .15, .05, '#c0222c', .28], level: ['#ffd27a', .3, .06], streak: { gap: 2.5, from: 3 },
    low: { hp: .3, vig: .55, beat: [.95, .55] }, calm: .4 },
  fx: {
    hitStop: .05,
    shake: .22,
    // тряска камеры (шаг 4 аудита): смещение = сила тряски × amp, плавное (сумма двух синусов частот f, Гц), без случайного шума;
    // при «уменьшить движение» тряски нет. Мигание неуязвимости — мягкая пульсация: base ± pulse с частотой pulseHz
    view: { amp: .17, f: [11, 17] }, invuln: { base: .18, pulse: .12, pulseHz: 1.3 }
  }
};
// мир = ручное ядро + пояс по зерну (C3b): генератор дописывает места, области, дома, ориентиры, связи и продолжение реки
stretchCore(BASE);     // лагерь крупнее: ядро раздвинуто до сборки мира (и в CFG3, и в CORE3)
export const CFG3 = expandBig(BASE);     // мир ×2 (4.04): прежний мир до world.inner + внешнее кольцо
// только ручное ядро (радиус coreR, без пояса): для тестов баланса, которые меряют ядро и сверяются со старыми цифрами
export const CORE3 = (() => { const c = JSON.parse(JSON.stringify(BASE)); c.world.radius = c.worldgen.coreR; c.worldgen.on = false; c.enemies.roam.on = false; c.weather.combat = null; return c; })();

// Что можно крутить на телефоне: путь в CFG3, подпись, диапазон
export const TWEAKS = [
  { path: 'view.camPitch', label: 'Наклон камеры', min: 25, max: 88, step: 1, unit: '°' },
  { path: 'view.camYaw', label: 'Поворот камеры', min: 0, max: 90, step: 1, unit: '°' },
  { path: 'view.camDist', label: 'Расстояние камеры', min: 6, max: 30, step: .5 },
  { path: 'view.fov', label: 'Угол обзора', min: 25, max: 80, step: 1, unit: '°' },
  { path: 'view.pixelScale', label: 'Размер «пикселя» (Ретро)', min: 1, max: 6, step: 1, reload: true },
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
