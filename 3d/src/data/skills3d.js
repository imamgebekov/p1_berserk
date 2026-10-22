// Таланты (этап 2, 2026-10-19): у каждого героя три специализации по шесть талантов и общая ветка «Скиталец».
// Талант k в ветке открывается, когда в ветке уже вложено k × TIER_STEP очков. Очки — те же очки навыков (одно за уровень).
// Талант даёт: stats — характеристики за ранг (те же ключи, что у вещей, плюс arc, rollcd, regen, stealth, trade, bag);
// ab — усиление умения за ранг: { id, k: { ключ настройки: доля }, cd: −доля перезарядки, cost: −доля цены };
// fx — особый эффект за ранг (как у комплектов: thorns, lastStand, rollBlast, ashCloak, killHeal, plague, ignite, rage);
// res — ресурс умений за ранг: regen — в секунду, hit — за удар оружием.
import { NEW_ACTIVES } from './actives3d.js';
const T = (id, name, max, eff, text) => ({ id, name, max, ...eff, text });
const COMMON = { id: 'wander', name: 'Скиталец', color: '#5d9cec', common: true, skills: [
  T('step', 'Лёгкая поступь', 5, { stats: { spd: 2 } }, '+2% скорости за ранг'),
  T('nose', 'Чутьё добычи', 5, { stats: { luck: 4 } }, '+4 удачи за ранг'),
  T('eye', 'Меткий глаз', 3, { stats: { reach: .2 } }, '+0,2 дальности удара за ранг'),
  T('sneak', 'Тихий шаг', 4, { stats: { stealth: 6 } }, 'шум тише: враги слышат на 6% ближе за ранг'),
  T('haggle', 'Торговая жилка', 4, { stats: { trade: 5 } }, '+5% к цене продажи за ранг'),
  { ...T('pockets', 'Глубокие карманы', 3, { stats: { bag: 3 } }, '+3 места в сумке за ранг'), tier: 1 }     // tier — открывается рано, не по порядку
] };
const ab = (id, k, cd = 0, cost = 0) => ({ ab: { id, k, cd, cost } });
export const TREES = {
  thorn: [
    { id: 'th_warden', name: 'Страж', color: '#7fb069', role: 'защита', skills: [
      T('th_temper', 'Закалка', 5, { stats: { hp: 12 } }, '+12 здоровья за ранг'),
      T('th_skin', 'Толстая кожа', 5, { stats: { armor: 3 } }, '+3 брони за ранг'),
      T('th_iron', 'Несгибаемый', 4, ab('iron', { t: .1 }, .08), 'Несокрушимость: дольше на 10% и перезарядка короче на 8% за ранг'),
      T('th_thorns', 'Шипы', 3, { fx: { thorns: .1 } }, 'враг получает 10% нанесённого вам урона за ранг'),
      T('th_cry', 'Голос вожака', 3, ab('cry', { fear: .15, armor: .15 }, .1), 'Боевой клич: страх и броня сильнее на 15%, перезарядка короче на 10% за ранг'),
      T('th_stand', 'Последний рубеж', 1, { fx: { lastStand: .2 } }, 'при здоровье ниже 40% урон по вам −20%')
    ] },
    { id: 'th_slayer', name: 'Палач', color: '#e8643a', role: 'урон по одному', skills: [
      T('th_hand', 'Тяжёлая рука', 5, { stats: { dmg: 2 } }, '+2 урона за ранг'),
      T('th_roar', 'Хищный глаз', 5, { stats: { crit: 3 } }, '+3% шанс крита за ранг'),
      T('th_bash', 'Сокрушитель', 4, ab('bash', { mul: .12, stun: .1 }), 'Сокрушающий удар: урон +12% и оглушение дольше на 10% за ранг'),
      T('th_charge', 'Таран', 3, ab('charge', { mul: .15 }, .1), 'Рывок с размаха: урон +15%, перезарядка короче на 10% за ранг'),
      T('th_bloodrush', 'Кровавый порыв', 3, ab('blood', { leech: .15, t: .1 }), 'Кровавый порыв: вампиризм +15% и дольше на 10% за ранг'),
      T('th_ignite', 'Раскалённый клинок', 1, { fx: { ignite: .35 } }, 'крит поджигает врага в 35% случаев')
    ] },
    { id: 'th_berserk', name: 'Берсерк', color: '#c43a4a', role: 'ярость и толпа', skills: [
      T('th_frenzy', 'Неистовство', 4, { stats: { swingMul: .96 } }, 'удары быстрее на 4% за ранг'),
      T('th_thirst', 'Жажда крови', 4, { stats: { leech: 1.5 } }, '+1,5% вампиризма за ранг'),
      T('th_whirl', 'Буря стали', 4, ab('whirl', { mul: .12 }, 0, .06), 'Вихрь: урон +12%, цена −6% за ранг'),
      T('th_quake', 'Сотрясатель', 3, ab('quake', { mul: .15, root: .1 }, .08), 'Землетрясение: урон +15%, корни дольше, перезарядка короче на 8% за ранг'),
      T('th_fury', 'Неуёмная ярость', 3, { ...ab('rage', { t: .1, dmg: .1 }, .1), res: { hit: .5 } }, 'Ярость берсерка: сильнее и дольше на 10%, перезарядка короче; +0,5 ярости за удар'),
      T('th_madness', 'Боевое безумие', 1, { fx: { rage: .25 } }, 'при здоровье ниже 40% урон +25%')
    ] }
  ],
  irga: [
    { id: 'ir_fire', name: 'Огонь', color: '#e2683a', role: 'урон по площади', skills: [
      T('ir_heat', 'Жар', 5, { stats: { dmg: 2 } }, '+2 урона за ранг'),
      T('ir_ball', 'Пламенный шар', 4, ab('fireball', { mul: .12, dps: .12 }), 'Огненный шар: урон и горение +12% за ранг'),
      T('ir_meteor', 'Падающая звезда', 3, ab('meteor', { mul: .15, burn: .1 }, .06), 'Метеор: урон +15%, горение дольше, перезарядка короче на 6% за ранг'),
      T('ir_ignite', 'Искра', 3, { fx: { ignite: .15 } }, 'крит поджигает врага: +15% за ранг'),
      T('ir_flow', 'Поток силы', 3, { res: { regen: 1 } }, '+1 маны в секунду за ранг'),
      T('ir_ash', 'Пепельный покров', 1, { fx: { ashCloak: .35 } }, 'при ударе по вам — 35% поджечь врагов вокруг')
    ] },
    { id: 'ir_frost', name: 'Лёд', color: '#8fd0ec', role: 'контроль и защита', skills: [
      T('ir_iceskin', 'Ледяная кожа', 5, { stats: { armor: 3 } }, '+3 брони за ранг'),
      T('ir_nova', 'Зимний круг', 4, ab('nova', { mul: .12, freeze: .1 }, .06), 'Ледяное кольцо: урон +12%, заморозка дольше, перезарядка короче на 6% за ранг'),
      T('ir_blizzard', 'Белая мгла', 3, ab('blizzard', { mul: .15 }, .06), 'Вьюга: урон +15%, перезарядка короче на 6% за ранг'),
      T('ir_shield', 'Крепкий щит', 3, ab('shield', { absorb: .1, t: .1 }), 'Щит маны: поглощает больше и держится дольше на 10% за ранг'),
      T('ir_clear', 'Ясный ум', 4, { stats: { crit: 3 } }, '+3% шанс крита за ранг'),
      T('ir_stand', 'Ледяное сердце', 1, { fx: { lastStand: .2 } }, 'при здоровье ниже 40% урон по вам −20%')
    ] },
    { id: 'ir_curse', name: 'Проклятия', color: '#9a6ad8', role: 'яд и бездна', skills: [
      T('ir_will', 'Тёмная воля', 5, { stats: { hp: 10 } }, '+10 здоровья за ранг'),
      T('ir_cloud', 'Гнилой туман', 4, ab('cloud', { dps: .15 }, 0, .06), 'Ядовитое облако: яд +15%, цена −6% за ранг'),
      T('ir_chain', 'Ветвистая молния', 4, ab('chain', { mul: .12 }), 'Цепная молния: урон +12% за ранг'),
      T('ir_spear', 'Остриё бездны', 3, ab('spear', { mul: .15 }, .08), 'Копьё бездны: урон +15%, перезарядка короче на 8% за ранг'),
      T('ir_soul', 'Жажда души', 4, { stats: { leech: 1.5 } }, '+1,5% вампиризма за ранг'),
      T('ir_plague', 'Мор', 1, { fx: { plague: 4 } }, 'враг, ударивший вас, отравлен на 4 с')
    ] }
  ],
  brand: [     // Клеймёный рыцарь (Г4, 4.17)
    { id: 'bk_rage', name: 'Клеймо', color: '#c8282a', role: 'ярость и кровь', skills: [
      T('bk_pain', 'Боль даёт силу', 5, { stats: { dmg: 2 } }, '+2 урона за ранг'),
      T('bk_cleave', 'Тяжёлый взмах', 4, ab('cleaver', { mul: .12 }), 'Рубка драконов: удар +12% за ранг'),
      T('bk_fury', 'Неугасимая ярость', 3, ab('fury', { amt: .12, t: .1 }, .06), 'Ярость клейма: сильнее и дольше, перезарядка короче на 6% за ранг'),
      T('bk_cannon', 'Порох', 3, ab('cannon', { mul: .12 }), 'Ручная пушка: урон +12% за ранг'),
      T('bk_blood', 'Жажда крови', 4, { stats: { leech: 1.5 } }, '+1,5% вампиризма за ранг'),
      T('bk_last', 'Последний бой', 1, { fx: { lastStand: .2 } }, 'при здоровье ниже 40% урон по вам −20%')
    ] },
    { id: 'bk_steel', name: 'Сталь', color: '#a8b0b8', role: 'защита', skills: [
      T('bk_skin', 'Чёрные латы', 5, { stats: { armor: 3 } }, '+3 брони за ранг'),
      T('bk_hp', 'Живучесть', 4, { stats: { hp: 12 } }, '+12 здоровья за ранг'),
      T('bk_endure', 'Стиснуть зубы', 3, ab('endure', { k: .1 }, .06), 'Стерпеть: лечит больше, перезарядка короче на 6% за ранг'),
      T('bk_rush', 'Таранный удар', 3, ab('rush', { mul: .12 }), 'Таран: удар +12% за ранг'),
      T('bk_regen', 'Неубиваемый', 3, { stats: { regen: 1 } }, '+1 к восстановлению здоровья за ранг'),
      T('bk_thorns', 'Шипы лат', 1, { fx: { thorns: .2 } }, '20% урона по вам возвращается врагу')
    ] },
    { id: 'bk_dark', name: 'Тьма', color: '#6a3a8a', role: 'тень и страх', skills: [
      T('bk_dark', 'Глаз тьмы', 5, { stats: { crit: 2 } }, '+2% шанс крита за ранг'),
      T('bk_cut', 'Глубокий удар', 4, ab('darkcut', { mul: .12 }), 'Удар тьмы: урон +12% за ранг'),
      T('bk_howl', 'Звериный рёв', 3, ab('howl', { sd: .12 }, .06), 'Рёв: страх дольше, перезарядка короче на 6% за ранг'),
      T('bk_volley', 'Тугой самострел', 3, ab('volley', { mul: .1 }), 'Залп самострела: урон +10% за ранг'),
      T('bk_feed', 'Пир тьмы', 3, { fx: { killHeal: .01 } }, 'убийство лечит на 1% здоровья за ранг'),
      T('bk_plague', 'Гниль клейма', 1, { fx: { plague: 4 } }, 'враг, ударивший вас, отравлен на 4 с')
    ] }
  ],
  priest: [     // Жрец (Г3, 4.16)
    { id: 'pr_light', name: 'Свет', color: '#ffe08a', role: 'лечение отряда', skills: [
      T('pr_will', 'Кроткая воля', 5, { stats: { hp: 10 } }, '+10 здоровья за ранг'),
      T('pr_mend', 'Тёплые руки', 4, ab('mend', { k: .1 }), 'Исцеление: лечит на 10% больше за ранг'),
      T('pr_hymn', 'Громкий гимн', 3, ab('hymn', { amt: .12, t: .1 }, .06), 'Гимн: сильнее и дольше, перезарядка короче на 6% за ранг'),
      T('pr_rad', 'Яркое сияние', 3, ab('radiance', { mul: .12, sd: .1 }), 'Сияние: удар и слепота сильнее за ранг'),
      T('pr_well', 'Неиссякаемая вера', 3, { res: { regen: 1 } }, '+1 веры в секунду за ранг'),
      T('pr_saint', 'Святость', 1, { fx: { killHeal: .03 } }, 'убийство лечит на 3% здоровья')
    ] },
    { id: 'pr_shield', name: 'Щиты', color: '#9ad8ff', role: 'обереги и защита', skills: [
      T('pr_skin', 'Освящённая кожа', 5, { stats: { armor: 3 } }, '+3 брони за ранг'),
      T('pr_sanct', 'Крепкий оберег', 4, ab('sanctum', { abs: .12 }), 'Щит веры: гасит на 12% больше за ранг'),
      T('pr_pen', 'Тяжёлое покаяние', 3, ab('penance', { mul: .12, sd: .1 }, .06), 'Покаяние: удар и оглушение сильнее, перезарядка короче на 6% за ранг'),
      T('pr_hp', 'Стойкость', 4, { stats: { hp: 12 } }, '+12 здоровья за ранг'),
      T('pr_regen', 'Тихая молитва', 3, { stats: { regen: 1 } }, '+1 к восстановлению здоровья за ранг'),
      T('pr_stand', 'Последняя молитва', 1, { fx: { lastStand: .2 } }, 'при здоровье ниже 40% урон по вам −20%')
    ] },
    { id: 'pr_shadow', name: 'Тень', color: '#8a5ad0', role: 'урон тьмой', skills: [
      T('pr_dark', 'Тёмное слово', 5, { stats: { dmg: 2 } }, '+2 урона за ранг'),
      T('pr_touch', 'Глубокое касание', 4, ab('vtouch', { mul: .12 }), 'Касание тьмы: удар +12% за ранг'),
      T('pr_smite', 'Гнев небес', 3, ab('smite', { mul: .12 }, .06), 'Кара: урон +12%, перезарядка короче на 6% за ранг'),
      T('pr_hallow', 'Широкий круг', 3, ab('hallow', { mul: .1, r: .08 }), 'Освящение: сильнее и шире за ранг'),
      T('pr_crit', 'Прозрение', 3, { stats: { crit: 2 } }, '+2% шанс крита за ранг'),
      T('pr_plague', 'Чёрный мор', 1, { fx: { plague: 4 } }, 'враг, ударивший вас, отравлен на 4 с')
    ] }
  ],
  warlock: [     // Морок (2026-10-20)
    { id: 'wl_curse', name: 'Проклятия', color: '#8a4ad0', role: 'урон со временем', skills: [
      T('wl_rot', 'Гниль', 5, { stats: { dmg: 2 } }, '+2 урона за ранг'),
      T('wl_hex', 'Тяжкая порча', 4, ab('hex', { crack: .12, dps: .12 }), 'Порча: трещина и яд +12% за ранг'),
      T('wl_doom', 'Неотвратимый рок', 3, ab('doom', { mul: .15 }, .06), 'Рок: удар +15%, перезарядка короче на 6% за ранг'),
      T('wl_plague', 'Мор', 3, { fx: { plague: .15 } }, 'яд перекидывается на соседей: +15% за ранг'),
      T('wl_well', 'Колодец душ', 3, { res: { regen: 1 } }, '+1 души в секунду за ранг'),
      T('wl_ash', 'Пепельный саван', 1, { fx: { ashCloak: .35 } }, 'при ударе по вам — 35% поджечь врагов вокруг')
    ] },
    { id: 'wl_blood', name: 'Кровь', color: '#c03040', role: 'живучесть', skills: [
      T('wl_skin', 'Дублёная кожа', 5, { stats: { armor: 3 } }, '+3 брони за ранг'),
      T('wl_drain', 'Жажда', 4, ab('drain', { mul: .12, heal: .1 }), 'Похищение жизни: урон +12%, лечение +10% за ранг'),
      T('wl_pact', 'Честный договор', 3, ab('pact', { dmg: .15, t: .1 }, .06), 'Кровавый договор: урон и время +, перезарядка короче на 6% за ранг'),
      T('wl_feed', 'Кормление', 3, { fx: { killHeal: .01 } }, 'убийство лечит на 1% здоровья за ранг'),
      T('wl_hp', 'Чёрная кровь', 4, { stats: { hp: 12 } }, '+12 здоровья за ранг'),
      T('wl_stand', 'Последний вздох', 1, { fx: { lastStand: .2 } }, 'при здоровье ниже 40% урон по вам −20%')
    ] },
    { id: 'wl_demon', name: 'Бесы', color: '#e06a2a', role: 'призыв и страх', skills: [
      T('wl_claw', 'Когти', 5, { stats: { crit: 2 } }, '+2% шанс крита за ранг'),
      T('wl_imp', 'Старший бес', 4, ab('summon', { hp: .15, mul: .12 }), 'Бес: здоровье +15%, урон +12% за ранг'),
      T('wl_terror', 'Ночной кошмар', 3, ab('terror', { fear: .12 }, .06), 'Ужас: страх дольше на 12%, перезарядка короче на 6% за ранг'),
      T('wl_grasp', 'Цепкие руки', 3, ab('grasp', { root: .12, mul: .1 }), 'Хватка мёртвых: корни дольше, удар сильнее за ранг'),
      T('wl_swarm', 'Голодный рой', 3, ab('souls', { mul: .1 }, .05), 'Рой душ: урон +10%, перезарядка короче на 5% за ранг'),
      T('wl_thorns', 'Шипы преисподней', 1, { fx: { thorns: .2 } }, '20% урона по вам возвращается врагу')
    ] }
  ],
  jay: [
    { id: 'jy_mark', name: 'Меткость', color: '#e8c04a', role: 'урон по одному', skills: [
      T('jy_eye', 'Острый глаз', 5, { stats: { crit: 3 } }, '+3% шанс крита за ранг'),
      T('jy_string', 'Тугая тетива', 5, { stats: { dmg: 2 } }, '+2 урона за ранг'),
      T('jy_hawk', 'Глаз ястреба', 3, ab('hawk', { t: .1, crit: .1 }, .1), 'Ястребиный глаз: дольше и сильнее на 10%, перезарядка короче на 10% за ранг'),
      T('jy_frost', 'Иней на остриях', 4, ab('frost', { mul: .12, freeze: .1 }), 'Ледяная стрела: урон +12%, заморозка дольше за ранг'),
      T('jy_reach', 'Дальнобойность', 3, { stats: { reach: .2 } }, '+0,2 дальности за ранг'),
      T('jy_ignite', 'Горящий наконечник', 1, { fx: { ignite: .3 } }, 'крит поджигает врага в 30% случаев')
    ] },
    { id: 'jy_survive', name: 'Выживание', color: '#7fb069', role: 'ловкость и ловушки', skills: [
      T('jy_step', 'Лёгкий шаг', 5, { stats: { spd: 2 } }, '+2% скорости за ранг'),
      T('jy_tumble', 'Кувырок', 4, { stats: { rollcd: .08 } }, 'перекат восстанавливается на 0,08 с быстрее за ранг'),
      T('jy_leap', 'Пружина', 3, ab('leap', { mul: .1 }, .1), 'Отскок с выстрелом: урон +10%, перезарядка короче на 10% за ранг'),
      T('jy_trap', 'Мастер ловушек', 3, ab('trap', { mul: .15, root: .1 }, .08), 'Капкан: урон +15%, держит дольше, перезарядка короче на 8% за ранг'),
      T('jy_breath', 'Второе дыхание', 4, { stats: { regen: .5 } }, '+0,5 здоровья в секунду за ранг'),
      T('jy_blast', 'Взрывной перекат', 1, { fx: { rollBlast: 40 } }, 'перекат оставляет взрыв (40 урона рядом)')
    ] },
    { id: 'jy_storm', name: 'Буря стрел', color: '#c8a46c', role: 'урон по площади', skills: [
      T('jy_volley', 'Широкий веер', 4, ab('volley', { mul: .12 }), 'Залп веером: урон +12% за ранг'),
      T('jy_rain', 'Ливень', 4, ab('rain', { mul: .12 }, .06), 'Град стрел: урон +12%, перезарядка короче на 6% за ранг'),
      T('jy_venom', 'Гадюка', 4, ab('venom', { mul: .1, dps: .15 }), 'Ядовитая стрела: урон +10%, яд +15% за ранг'),
      T('jy_fire', 'Пал', 3, ab('firearrow', { mul: .12, dps: .12 }, 0, .08), 'Зажигательная стрела: урон и горение +12%, цена −8% за ранг'),
      T('jy_focus', 'Собранность', 3, { res: { regen: 1 } }, '+1 концентрации в секунду за ранг'),
      T('jy_plague', 'Отравленный колчан', 1, { fx: { plague: 4 } }, 'враг, ударивший вас, отравлен на 4 с')
    ] }
  ],
  vale: [
    { id: 'vl_blades', name: 'Клинки', color: '#6ab0ff', role: 'урон по одному', skills: [
      T('vl_hand', 'Точная рука', 5, { stats: { dmg: 2 } }, '+2 урона за ранг'),
      T('vl_crit', 'Слабое место', 5, { stats: { crit: 3 } }, '+3% шанс крита за ранг'),
      T('vl_dance', 'Вихрь клинков', 4, ab('dance', { mul: .12 }), 'Танец клинков: урон +12% за ранг'),
      T('vl_fan', 'Стальной веер', 4, ab('fan', { mul: .12, dps: .1 }), 'Веер ножей: урон +12%, кровь +10% за ранг'),
      T('vl_exec', 'Палач теней', 3, ab('execute', { mul: .12, kill: .05 }, .08), 'Смертельный удар: урон +12%, добивает раньше, перезарядка короче за ранг'),
      T('vl_feast', 'Упоение', 1, { fx: { killHeal: 8 } }, 'убийство возвращает 8 здоровья')
    ] },
    { id: 'vl_shade', name: 'Тень', color: '#8a8aa8', role: 'скрытность', skills: [
      T('vl_sneak', 'Беззвучный', 5, { stats: { stealth: 6 } }, 'шум тише: враги слышат на 6% ближе за ранг'),
      T('vl_blink', 'Короткий путь', 3, ab('blink', { mul: .1 }, .1), 'Выпад-телепорт: урон +10%, перезарядка короче на 10% за ранг'),
      T('vl_smoke', 'Густой дым', 3, ab('smoke', { t: .12, spd: .1 }, .08), 'Дымовая завеса: дольше и быстрее, перезарядка короче на 8% за ранг'),
      T('vl_shadow', 'Двойник', 3, ab('shadow', { t: .15, mul: .15 }), 'Тень-двойник: дольше и сильнее на 15% за ранг'),
      T('vl_step', 'Скользящий шаг', 5, { stats: { spd: 2 } }, '+2% скорости за ранг'),
      T('vl_blast', 'Дымный перекат', 1, { fx: { rollBlast: 30 } }, 'перекат оставляет взрыв (30 урона рядом)')
    ] },
    { id: 'vl_blood', name: 'Кровь', color: '#c43a4a', role: 'выносливость', skills: [
      T('vl_thirst', 'Жажда крови', 4, { stats: { leech: 1.5 } }, '+1,5% вампиризма за ранг'),
      T('vl_bloodlet', 'Глубокий надрез', 4, ab('bloodlet', { mul: .1, dps: .15 }), 'Кровопускание: урон +10%, кровь +15% за ранг'),
      T('vl_parry', 'Отражение', 3, ab('parry', { mul: .12, t: .1 }, .1), 'Парирование: ответ сильнее, держится дольше, перезарядка короче за ранг'),
      T('vl_temper', 'Закалка', 5, { stats: { hp: 10 } }, '+10 здоровья за ранг'),
      T('vl_frenzy', 'Неистовство', 4, { stats: { swingMul: .96 } }, 'удары быстрее на 4% за ранг'),
      T('vl_thorns', 'Кровавая отдача', 1, { fx: { thorns: .2 } }, 'враг получает 20% нанесённого вам урона')
    ] }
  ]
};
// древо по 32 узла (2026-10-20): к каждому новому умению ветки — талант-усилитель, и ещё 4 таланта характеристик
const STAT_SETS = [
  [['Крепость', 'hp', 8, 5, '+8 здоровья', 'n:th_temper'], ['Броня духа', 'armor', 2, 5, '+2 брони', 'n:th_skin'], ['Стойкость', 'regen', .4, 4, '+0,4 здоровья в секунду', 'n:jy_breath'], ['Сила удара', 'dmg', 1.5, 5, '+1,5 урона', 'n:th_hand']],
  [['Сила удара', 'dmg', 1.5, 5, '+1,5 урона', 'n:th_hand'], ['Точность', 'crit', 2, 5, '+2% шанс крита', 'n:th_roar'], ['Быстрый замах', 'swingMul', .97, 3, 'удары быстрее на 3%', 'n:th_frenzy'], ['Кровопийца', 'leech', 1, 4, '+1% вампиризма', 'n:th_thirst']],
  [['Быстрые ноги', 'spd', 1.5, 5, '+1,5% скорости', 'n:step'], ['Точность', 'crit', 2, 5, '+2% шанс крита', 'n:th_roar'], ['Крепость', 'hp', 8, 5, '+8 здоровья', 'n:th_temper'], ['Длинная рука', 'reach', .15, 3, '+0,15 дальности удара', 'n:eye']]
];
// таланты рядов 9–10 (4.06, предел 70): сильнее прежних, для игры против врагов 70–80
const HIGH_SETS = [
  [['Ветеран', 'hp', 20, 5, '+20 здоровья', 'n:th_temper'], ['Закалённый', 'armor', 4, 5, '+4 брони', 'n:th_skin'], ['Мощь', 'dmg', 3, 5, '+3 урона', 'n:th_hand'], ['Живучесть', 'regen', .8, 3, '+0,8 здоровья в секунду', 'n:jy_breath']],
  [['Мощь', 'dmg', 3, 5, '+3 урона', 'n:th_hand'], ['Смертельная точность', 'crit', 3, 5, '+3% шанс крита', 'n:th_roar'], ['Жажда', 'leech', 1.5, 4, '+1,5% вампиризма', 'n:th_thirst'], ['Ветеран', 'hp', 20, 5, '+20 здоровья', 'n:th_temper']],
  [['Мощь', 'dmg', 3, 5, '+3 урона', 'n:th_hand'], ['Ветеран', 'hp', 20, 5, '+20 здоровья', 'n:th_temper'], ['Порыв', 'spd', 2, 4, '+2% скорости', 'n:step'], ['Смертельная точность', 'crit', 3, 5, '+3% шанс крита', 'n:th_roar']]
];
const DOT = new Set(['burn', 'poison', 'bleed']);
const boostKeys = d => { const k = d.kind === 'buff' ? { amt: .1 } : d.kind === 'heal' || d.kind === 'gheal' ? { k: .1 } : d.kind === 'ward' ? { abs: .1 } : d.kind === 'cloud' ? { dps: .1 } : { mul: .1 }; if (d.st && d.kind !== 'cloud') k[DOT.has(d.st) ? 'dps' : 'sd'] = .1; return k; };     // что усиливает талант: сила вида и его состояния
for (const [hero, list] of Object.entries(NEW_ACTIVES)) TREES[hero].forEach((b, bi) => {
  for (const d of list.filter(x => x.br === bi)) b.skills.push({ ...T('g_' + d.id, 'Опыт: ' + d.name, 3, ab(d.id, boostKeys(d), .06), `«${d.name}»: сила +10%, перезарядка короче на 6% за ранг`), icon: 'n:' + d.id, boost: d.id });
  STAT_SETS[bi].forEach(([name, st, v, max, txt, icon], j) => b.skills.push({ ...T(b.id + '_s' + j, name, max, { stats: { [st]: v } }, txt + ' за ранг'), icon, gen: true }));
  HIGH_SETS[bi].forEach(([name, st, v, max, txt, icon], j) => b.skills.push({ ...T(b.id + '_h' + j, name, max, { stats: { [st]: v } }, txt + ' за ранг'), icon, high: true }));
});
export const TIER_STEP = 3;           // очков в ветке на каждый следующий талант
const DEFAULT = 'thorn';
// ветки героя: три специализации и общая
export const branchesOf = hero => [...(TREES[hero] || TREES[DEFAULT]), COMMON];
export const BRANCHES = branchesOf(DEFAULT);     // для старых мест кода и тестов: ветки Торна
const ALL = [...Object.values(TREES).flat(), COMMON];
export const SKILLS = Object.fromEntries(ALL.flatMap(b => b.skills.map((s, i) => [s.id, { ...s, branch: b.id, tier: s.tier ?? i }])));
const HERO_OF = Object.fromEntries(Object.entries(TREES).flatMap(([h, bs]) => bs.flatMap(b => b.skills.map(s => [s.id, h]))));
export const MAX_RANKS = branchesOf(DEFAULT).flatMap(b => b.skills).reduce((a, s) => a + s.max, 0);
const mine = (id, hero) => !!SKILLS[id] && (!HERO_OF[id] || HERO_OF[id] === (hero || DEFAULT));

export const spentIn = (skills, branchId) => { const b = ALL.find(x => x.id === branchId); return b ? b.skills.reduce((a, s) => a + (skills[s.id] || 0), 0) : 0; };
// можно ли вложить очко в талант (только свой герой или общая ветка)
export function canRank(skills, id, sp, hero = DEFAULT) {
  const s = SKILLS[id]; if (!s || !mine(id, hero)) return 'none';
  if ((skills[id] || 0) >= s.max) return 'max';
  if (spentIn(skills, s.branch) < s.tier * TIER_STEP) return 'locked';
  if (sp < 1) return 'sp';
  return 'ok';
}
// характеристики от талантов
export function skillStats(skills) {
  const g = {};
  for (const id of Object.keys(skills)) { const s = SKILLS[id]; if (!s || !s.stats) continue; const r = skills[id]; for (const [k, v] of Object.entries(s.stats)) { if (k === 'swingMul') g.swingMul = (g.swingMul || 1) * Math.pow(v, r); else g[k] = (g[k] || 0) + v * r; } }
  return g;
}
// особые эффекты, усиления умений и ресурс от талантов: { fx, ab: { id: { k, cd, cost } }, res: { regen, hit } }
export function talentMods(skills) {
  const fx = {}, ab = {}, res = {};
  for (const id of Object.keys(skills)) { const s = SKILLS[id], r = skills[id]; if (!s || !r) continue;
    for (const [k, v] of Object.entries(s.fx || {})) fx[k] = (fx[k] || 0) + v * r;
    for (const [k, v] of Object.entries(s.res || {})) res[k] = (res[k] || 0) + v * r;
    if (s.ab) { const a = ab[s.ab.id] = ab[s.ab.id] || { k: {}, cd: 0, cost: 0 }; for (const [k, v] of Object.entries(s.ab.k || {})) a.k[k] = (a.k[k] || 0) + v * r; a.cd += (s.ab.cd || 0) * r; a.cost += (s.ab.cost || 0) * r; } }
  return { fx, ab, res };
}
// настройки умения с талантами: ключи × (1 + доля), перезарядка и цена короче (не меньше половины)
export function withTalents(A, m) {
  if (!m) return A; const o = { ...A }, each = (v, f) => (Array.isArray(v) ? v.map(f) : f(v));
  for (const [k, x] of Object.entries(m.k)) if (k in o) o[k] = each(o[k], v => (typeof v === 'number' ? v * (1 + x) : v));
  if (m.cd && o.cd) o.cd = each(o.cd, v => v * Math.max(.5, 1 - m.cd));
  if (m.cost && o.cost) o.cost = Math.round(o.cost * Math.max(.5, 1 - m.cost));
  return o;
}
export const sanitizeSkills = (d, hero = DEFAULT) => { const out = {}; if (d && typeof d === 'object') for (const id of Object.keys(d)) { const s = SKILLS[id]; if (s && mine(id, hero) && Number.isFinite(d[id]) && d[id] > 0) out[id] = Math.min(s.max, Math.floor(d[id])); } return out; };
