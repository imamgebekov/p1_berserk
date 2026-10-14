// Единый файл баланса. Любое игровое число (урон, шансы, тайминги, цены) живёт здесь.
// Время — в секундах, расстояния — в пикселях низкого разрешения (мир шириной view.width).

export const CFG = {
  view: {
    width: 176,          // ширина низкого разрешения
    minHeight: 180,
    groundOffset: 34,    // земля = высота - groundOffset
    maxDpr: 2,           // потолок плотности пикселей холста (экономит заливку на iPhone)
    maxDt: 1 / 30        // кадр длиннее считаем как 1/30 с
  },

  world: {
    length: 2600,
    town: 300,           // правее — пустошь, враги не заходят левее town+20
    fire: 150,           // костёр
    startOffset: 24,     // игрок появляется в fire + startOffset
    campfireHealRadius: 34,
    campfireHealPerSec: 14,
    combatCooldown: 4    // сек без боя до лечения у костра
  },

  player: {
    maxHp: 70,
    hpPerLevel: 10,
    walkSpeed: 50,
    rageSpeed: 62,
    swingMoveFactor: .35,   // скорость при замахе
    jumpVel: 125,
    gravity: 420,
    knockDecay: .02,        // vx *= knockDecay^dt
    baseDamage: 6,
    damagePerLevel: 1.6,
    damageVariance: [.85, 1.15],
    heavyMult: 1.6,
    lightSwing: .28,
    heavySwing: .4,
    hitWindow: [.3, .78],   // доля замаха, когда клинок бьёт
    reachLight: 32,
    reachHeavy: 40,
    weaponBaseLen: 29,      // длина стартового меча; каждый px длины клинка сверх этого даёт reachPerLen к дальности
    reachPerLen: .4,
    comboWindow: .55,       // окно продолжения цепочки после удара
    comboLength: 3,         // третий удар тяжёлый
    hitBehind: -3,          // насколько можно задеть за спиной
    hitHeightSlack: 4,
    invAfterHit: .7,
    invOnRise: 1.2,
    hurtKnock: 90
  },

  rage: {
    max: 100,
    duration: 9,
    gainLight: 7,
    gainHeavy: 12,
    gainHurt: 14,
    damageMult: 2,
    damageTaken: .7,
    swingMult: .72,
    hpDrain: 1.6            // в секунду, но не ниже 1 hp
  },

  xp: { base: 24, exp: 1.45 },

  // hp/spd/dmg — базовые, дальше умножаются на масштаб (уровень игрока и круг Предвестника)
  enemies: {
    imp:   { w: 6,  h: 8,  hp: 18,  spd: 40, dmg: 5,  xp: 6,   reach: 9,  wind: .38 },
    brute: { w: 10, h: 15, hp: 48,  spd: 24, dmg: 10, xp: 14,  reach: 13, wind: .55 },
    lord:  { w: 16, h: 24, hp: 150, spd: 20, dmg: 16, xp: 60,  reach: 18, wind: .7 },
    boss:  { w: 26, h: 44, hp: 600, spd: 15, dmg: 30, xp: 220, reach: 40, wind: .95 }
  },
  scaling: { perPlayerLevel: .12, perCycle: .1, bossPerCycle: .25 },
  enemyAi: {
    speedVariance: [.9, 1.15],
    aggroDist: 190,
    despawnDist: 300,
    recoverTime: .5,
    bossRecoverTime: .9,
    cooldown: [.25, .8],
    bossCooldownMult: 2,
    knockLight: 60,
    knockHeavy: 110,
    knockResist: { boss: .1, lord: .5 },
    bossSlamRange: 28,
    bossSlamForward: 22,
    bossSlamMaxZ: 10,
    lordHitZ: .7
  },

  spawn: {
    interval: [1.8, 3.4],
    firstDelay: 2,
    maxAlive: 6,
    distance: [105, 150],
    minDistance: 80,
    townMargin: 40,
    lordEvery: 9,           // каждый N-й убитый — Слуга
    impChance: .6
  },

  eclipse: {
    firstTimer: 45,
    nextTimer: 70,
    smoothing: .7,
    bossSpawnAhead: 150,
    bossMinX: 160,          // от town
    bossEdge: 120
  },

  loot: {
    // Пепел за убийство: диапазон по типу врага, умножается на (1 + (ур-1)*ashPerLevel + глубина*ashPerDepth)
    ash: { imp: [1, 3], brute: [2, 5], lord: [10, 16] },
    ashPerLevel: .03,
    ashPerDepth: .4,
    bossAshBase: 100,       // + bossAshPerCycle за каждый уже побеждённый круг + ваш вклад в % урона
    bossAshPerCycle: .15,

    // Предметы. luck = глубина*luckPerDepth + (ур-1)*luckPerLevel + круг*luckPerCycle + бонус таблицы.
    // maxTier = 1 + floor(luck / tierStep) (+ bossTierBonus у Предвестника): какие предметы вообще могут выпасть.
    // вес редкости = base * (1 + luck * grow)
    luckPerDepth: 2.0,      // глубина 0..1 (от границы города до края мира)
    luckPerLevel: .15,
    luckPerCycle: .35,
    tierStep: 1.0,
    bossTierBonus: 1,
    rarityOrder: ['common', 'rare', 'cursed', 'branded'],
    tables: {
      normal: { base: { common: 100, rare: 10, cursed: 3, branded: 0 }, grow: { common: 0, rare: 1.0, cursed: 1.5, branded: 0 } },
      elite:  { base: { common: 55, rare: 30, cursed: 12, branded: 1 }, grow: { common: 0, rare: .6, cursed: .8, branded: .6 } },
      shop:   { base: { common: 100, rare: 24, cursed: 7, branded: 0 }, grow: { common: 0, rare: .8, cursed: 1.0, branded: 0 } },
      boss:   { base: { common: 0, rare: 60, cursed: 25, branded: 5 }, grow: { common: 0, rare: .2, cursed: .4, branded: .5 } }
    },
    // chance — вероятность, что с врага вообще что-то выпадет; rolls — сколько бросков; luck — бонус к удаче
    drops: {
      imp:   { chance: .14, rolls: 1, table: 'normal', luck: 0 },
      brute: { chance: .26, rolls: 1, table: 'normal', luck: .3 },
      lord:  { chance: .85, rolls: 1, table: 'elite',  luck: 1.0 },
      boss:  { chance: 1,   rolls: 3, table: 'boss',   luck: 1.5 }
    }
  },

  town: {
    merchantX: 108, smithX: 214,
    talkRange: 30
  },

  // Торговец: ассортимент обновляется после каждого Предвестника
  shop: {
    size: 8,
    guaranteedCommon: 3,    // столько дешёвых обычных вещей есть всегда
    buyMarkup: { common: 2.0, rare: 2.3, cursed: 3.5, branded: 4.0 },   // цена покупки = price * наценка редкости (продажа — items.sellRatio)
    luckBonus: 1.0,         // бонус к удаче: в магазине чуть лучше, чем «с земли» у города
    junkRarity: 'common'    // «продать хлам» продаёт всё этой редкости
  },

  // Кузнец: улучшение оружия за пепел
  smith: {
    maxLevel: 10,
    dmgFlat: 2,             // прибавка к урону за уровень: dmgFlat + базовый урон оружия * dmgPercent
    dmgPercent: .06,
    baseCost: 25,           // цена уровня = (baseCost + price*costPerPrice) * costGrowth^уровень
    costPerPrice: .1,
    costGrowth: 1.65,
    success: [1, 1, 1, 1, .9, .8, .65, .5, .4, .3],   // шанс успеха попытки n → n+1
    breakFrom: 6,           // с этого уровня неудача ещё и снижает уровень
    breakChance: .5
  },

  items: {
    bagSize: 20,
    bagCols: 5,
    sellRatio: .3,          // цена продажи = price * sellRatio
    armorK: 30,             // снижение урона = armor / (armor + armorK)
    armorMin: -15,
    critMult: 1.75,
    critCap: 60,            // % шанса крита, не выше
    speedMin: -30, speedMax: 40,
    rageMax: 150,
    hpFloor: 10,            // здоровье не ниже
    confirmMs: 2500,        // окно второго тапа «Точно?»
    rarity: {
      common:  { name: 'Обычный',   color: '#b8ae9a' },
      rare:    { name: 'Редкий',    color: '#5aa0ff' },
      cursed:  { name: 'Проклятый', color: '#b070e8' },
      branded: { name: 'Клеймёный', color: '#ff6a3a' }
    }
  },

  npcPlayers: {
    count: 4,
    speed: 30,
    retarget: [2, 4.5],
    wanderRange: 120,
    teleportDist: 300,
    engageRange: 30,
    engageRangeBoss: 46,
    swingTime: .25,
    hitCooldown: [.8, 1.2],
    bossHitCooldown: [1.1, 1.7],
    damage: [6, 10],
    bossDamage: [4, 7],
    barkChance: .3
  },

  chat: {
    idleInterval: [7, 15],
    firstIdle: 6,
    maxLines: 6,
    fadeAfter: 11,
    removeAfter: 12.5
  },

  online: { base: 1284, jitter: [-40, 60], eclipseBonus: 90, updateRate: .6 },

  // эффекты (сек)
  fx: {
    freezeLight: .05, freezeHeavy: .067, freezeRage: .083, freezeHurt: .067, freezeBrand: .133,
    shakeLight: 2, shakeHeavy: 4, shakeHurt: 5, shakeBrand: 8, shakeBoss: 6, shakeBossDown: 8,
    freezeCrit: .075,
    shakeDecay: 18,
    hurtFlash: .35,
    maxParticles: 220       // потолок, чтобы кадр на телефоне не разрастался
  }
};

export const xpNeed = lv => Math.floor(CFG.xp.base * Math.pow(lv, CFG.xp.exp));
