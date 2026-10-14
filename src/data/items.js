// Данные предметов. Числа статов — здесь (это «баланс предметов»); формулы и таблицы дропа — в config.js.
//
// stats: dmg — плоская прибавка к урону удара; armor — броня (снижение урона armor/(armor+armorK));
//        hp — здоровье; speed — скорость ходьбы, %; crit — шанс крита, %; rage — скорость набора Клейма, %.
// tier: с какой «глубины/уровня» предмет начинает выпадать (1–4).
// pal: [основной цвет, акцент] — иконка и (в шаге 2) слои спрайта; icon — ключ в src/icons.js.
// rarity: common — обычный, rare — редкий, cursed — проклятый (сильно, но со штрафом), branded — клеймёный.

export const SLOTS = ['weapon', 'head', 'body', 'cloak', 'amulet', 'ring'];
export const SLOT_NAMES = { weapon: 'Оружие', head: 'Голова', body: 'Тело', cloak: 'Плащ', amulet: 'Амулет', ring: 'Кольцо' };

export const STAT_KEYS = ['dmg', 'armor', 'hp', 'speed', 'crit', 'rage'];
export const STAT_NAMES = { dmg: 'Урон', armor: 'Броня', hp: 'Здоровье', speed: 'Скорость', crit: 'Шанс крита', rage: 'Набор Клейма' };
export const STAT_UNITS = { dmg: '', armor: '', hp: '', speed: '%', crit: '%', rage: '%' };

const I = (id, name, slot, rarity, tier, price, stats, icon, pal, desc) => ({ id, name, slot, rarity, tier, price, stats, icon, pal, desc });

export const ITEMS = [
  // --- оружие ---
  I('w_rust_cleaver', 'Ржавый тесак', 'weapon', 'common', 1, 14, { dmg: 3 }, 'sword', ['#8a7a68', '#5a4a3a'], 'Старая сталь, знавшая лучшие руки.'),
  I('w_forged_sabre', 'Кованый палаш', 'weapon', 'common', 2, 40, { dmg: 6 }, 'sword', ['#b0aa9c', '#6a5a46'], 'Тяжёлый, честный, без лишних слов.'),
  I('w_iron_slab', 'Железная плита', 'weapon', 'common', 3, 90, { dmg: 10, speed: -5 }, 'great', ['#9a9588', '#4a4036'], 'Не меч, а обвинение. Зато бьёт.'),
  I('w_bone_edge', 'Костяной клинок', 'weapon', 'rare', 1, 110, { dmg: 7, crit: 5 }, 'sword', ['#d8cfb8', '#8a7a5a'], 'Вырезан из рёбер того, кто не успел убежать.'),
  I('w_ember_edge', 'Тлеющий клинок', 'weapon', 'rare', 3, 190, { dmg: 11, rage: 12 }, 'sword', ['#e08a4a', '#7a2a12'], 'Кромка тлеет, даже когда ночь холодна.'),
  I('w_widow_blade', 'Вдовий меч', 'weapon', 'cursed', 3, 230, { dmg: 18, hp: -20 }, 'great', ['#8a5ac0', '#2a1a3a'], 'Берёт больше, чем даёт.'),
  I('w_eclipse_sting', 'Жало Затмения', 'weapon', 'cursed', 4, 340, { dmg: 26, hp: -35, speed: 8 }, 'axe', ['#6a3aa0', '#1a0f26'], 'Ковали в тени, где нет ни солнца, ни луны.'),
  I('w_brand_giant', 'Клеймёный исполин', 'weapon', 'branded', 4, 560, { dmg: 22, crit: 8, rage: 25 }, 'great', ['#d8442a', '#3a0c0c'], 'Меч, слишком большой для человека. Тебе как раз.'),

  // --- голова ---
  I('h_leather_hood', 'Кожаный капюшон', 'head', 'common', 1, 10, { armor: 1, hp: 4 }, 'hood', ['#6a5a46', '#2a2018'], 'Пахнет дымом и чужим потом.'),
  I('h_iron_helm', 'Железный шлем', 'head', 'common', 2, 36, { armor: 3, hp: 8 }, 'helm', ['#9a9588', '#4a4036'], 'Вмятина слева — память о чьём-то топоре.'),
  I('h_bone_oracle', 'Костяной оберег-шлем', 'head', 'rare', 1, 95, { armor: 2, hp: 12 }, 'helm', ['#d8cfb8', '#7a6a4a'], 'Череп зверя, надетый как приговор.'),
  I('h_horned_helm', 'Рогатый шлем', 'head', 'rare', 3, 170, { armor: 4, hp: 12, dmg: 2 }, 'helm', ['#a89a80', '#5a2a1a'], 'Рога настоящие. Хозяин — нет.'),
  I('h_hanged_mask', 'Маска висельника', 'head', 'cursed', 3, 220, { crit: 8, hp: -10, armor: 1 }, 'hood', ['#8a5ac0', '#2a1a3a'], 'Видит слабые места. Свои — тоже.'),
  I('h_brand_crown', 'Венец Клейма', 'head', 'branded', 4, 520, { armor: 5, hp: 15, rage: 20, crit: 4 }, 'helm', ['#d8442a', '#3a0c0c'], 'Жжёт лоб. Привыкаешь.'),

  // --- тело ---
  I('b_torn_shirt', 'Рваная рубаха', 'body', 'common', 1, 8, { armor: 1, hp: 6 }, 'body', ['#7a6a58', '#3a2e24'], 'Лучше, чем ничего. Ненамного.'),
  I('b_leather_vest', 'Кожаный жилет', 'body', 'common', 2, 38, { armor: 3, hp: 10 }, 'body', ['#8a6a46', '#3a2a1a'], 'Дублёная шкура, шитая по живому.'),
  I('b_chainmail', 'Кольчуга', 'body', 'common', 3, 88, { armor: 6, hp: 16, speed: -3 }, 'body', ['#a8a396', '#4a4640'], 'Звенит на каждом шагу, пугая даже тебя.'),
  I('b_brute_hide', 'Панцирь рогача', 'body', 'rare', 3, 180, { armor: 8, hp: 20 }, 'body', ['#8a6a5a', '#4a2a22'], 'Нарост, который не пробить с первого раза.'),
  I('b_widow_shroud', 'Саван вдовы', 'body', 'cursed', 3, 240, { armor: 4, hp: 30, dmg: -2 }, 'body', ['#8a5ac0', '#2a1a3a'], 'Тёплый, как могила. Тяжёлый, как память.'),
  I('b_brand_plate', 'Латы клеймёных', 'body', 'branded', 4, 600, { armor: 12, hp: 35, rage: 10 }, 'body', ['#d8442a', '#3a0c0c'], 'Клеймо проступает сквозь металл.'),

  // --- плащ ---
  I('c_sackcloth', 'Дерюга', 'cloak', 'common', 1, 9, { hp: 5, speed: 2 }, 'cloak', ['#7a6a58', '#3a2e24'], 'Мешок, прикинувшийся плащом.'),
  I('c_wanderer', 'Плащ странника', 'cloak', 'common', 2, 34, { speed: 4, armor: 1 }, 'cloak', ['#5a5448', '#2a2620'], 'Видал дороги, которых больше нет.'),
  I('c_ash_cloak', 'Пепельный плащ', 'cloak', 'rare', 2, 120, { hp: 12, speed: 3 }, 'cloak', ['#8a8478', '#3a3630'], 'Осыпается серым с каждым шагом.'),
  I('c_raven', 'Вороний плащ', 'cloak', 'rare', 3, 175, { speed: 6, crit: 4 }, 'cloak', ['#3a3a4a', '#1a1a22'], 'Перья не его, но летать помогают.'),
  I('c_hanged_cape', 'Плащ висельника', 'cloak', 'cursed', 3, 225, { dmg: 4, armor: -2, speed: 8 }, 'cloak', ['#8a5ac0', '#2a1a3a'], 'Лёгкий, потому что хозяин всё уже потерял.'),
  I('c_crimson', 'Багряный плащ', 'cloak', 'branded', 4, 540, { speed: 8, rage: 18, hp: 10, crit: 4 }, 'cloak', ['#c0222c', '#3a0c10'], 'Цвет, который не отстирать и не забыть.'),

  // --- амулет ---
  I('a_beast_fang', 'Клык рогача', 'amulet', 'common', 1, 12, { dmg: 1, hp: 4 }, 'amulet', ['#d8cfb8', '#6a5a46'], 'Ещё тёплый. Почти.'),
  I('a_charred', 'Обугленный амулет', 'amulet', 'common', 2, 42, { hp: 10 }, 'amulet', ['#6a5a52', '#2a201a'], 'Побывал в огне и не жалуется.'),
  I('a_bone_charm', 'Костяной оберег', 'amulet', 'rare', 1, 100, { armor: 2, hp: 12 }, 'amulet', ['#d8cfb8', '#8a7a5a'], 'Шепчет, когда рядом смерть.'),
  I('a_eclipse_eye', 'Глаз затмения', 'amulet', 'rare', 3, 185, { crit: 7, dmg: 3 }, 'amulet', ['#d8a84a', '#3a2a0a'], 'Смотрит туда, где ты ещё не ударил.'),
  I('a_black_tear', 'Чёрная слеза', 'amulet', 'cursed', 3, 235, { dmg: 8, hp: -15 }, 'amulet', ['#8a5ac0', '#1a1024'], 'Её не вытирают. Ей платят.'),
  I('a_brand_seal', 'Печать Клейма', 'amulet', 'branded', 4, 580, { rage: 30, crit: 5, dmg: 4 }, 'amulet', ['#e0602a', '#3a0c0c'], 'Оттиск, что горит под кожей.'),

  // --- кольцо ---
  I('r_copper', 'Медное кольцо', 'ring', 'common', 1, 8, { dmg: 1 }, 'ring', ['#b0703a', '#5a3216'], 'Позеленело, как и всё вокруг.'),
  I('r_bone_ring', 'Кольцо из кости', 'ring', 'common', 2, 32, { crit: 2, hp: 4 }, 'ring', ['#d8cfb8', '#7a6a4a'], 'Палец был чужой. Теперь не нужен.'),
  I('r_ash_ring', 'Кольцо пепла', 'ring', 'rare', 2, 115, { hp: 10, rage: 8 }, 'ring', ['#a8a29a', '#e0602a'], 'Тлеет изнутри, не остывает.'),
  I('r_silver', 'Серебряное кольцо', 'ring', 'rare', 3, 170, { crit: 5, speed: 3 }, 'ring', ['#c8ccd4', '#5a6272'], 'Холодное. Это приятно.'),
  I('r_widow_ring', 'Кольцо вдовы', 'ring', 'cursed', 3, 215, { dmg: 6, armor: -3 }, 'ring', ['#8a5ac0', '#2a1a3a'], 'Клялись «пока смерть не разлучит». Не разлучила.'),
  I('r_brand_ring', 'Кольцо клеймёного', 'ring', 'branded', 4, 500, { crit: 8, rage: 15, dmg: 3 }, 'ring', ['#d8442a', '#3a0c0c'], 'Горячее, чем должно быть.')
];

export const ITEMS_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
