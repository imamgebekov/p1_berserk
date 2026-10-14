// Все числа 3D-прототипа — здесь. Единицы: метры (условно), секунды, градусы.
// Панель ⚙ в игре меняет часть этих чисел на лету (список — TWEAKS внизу) и умеет скопировать их текстом.

export const CFG3 = {
  view: {
    pixelScale: 3,        // размер «пикселя» в экранных пикселях: больше — грубее и быстрее
    fov: 48,              // угол обзора камеры
    camPitch: 58,         // наклон камеры вниз: 90 — строго сверху, 30 — почти горизонтально
    camDist: 15,          // расстояние камеры до героя
    camLookUp: 1.0,       // на какую высоту над землёй смотрит камера
    camFollow: 7,         // «пружинность» слежения (больше — жёстче)
    fogDensity: .03       // плотность тумана
  },

  world: {
    radius: 70,           // граница мира (круг)
    props: 90,            // число деревьев и камней
    seed: 7
  },

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
    aggro: 24,
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
