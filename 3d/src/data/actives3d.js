// Новые активные умения древа (2026-10-20, просьба владельца): в каждой ветке 10 активных — 8 прежних умений героя и 22 новых.
// Новое умение собрано из готового вида действия (kind, abilities3d.js → GEN) со своей стихией и состоянием; числа вида —
// config3d.js → abilities.gen, p — свои поправки умения (k — множитель урона). br — ветка героя (0–2), lv — уровень 1-го ранга.
// Виды: nova — удар вокруг; cone — конус впереди; bolt — снаряд (n — веер); strike — удар по одной цели; dash — рывок;
// zone — удар в точке (прицел); field — поле в точке, бьёт тиками (прицел); cloud — облако яда (прицел); pull — тянет к себе;
// mark — метка с отложенным ударом; buff — усиление на время (stat); heal — лечение.
// Состояния st: burn, poison, bleed — урон со временем; freeze, stun, fear, root, blind — контроль; slow — замедление; crack — трещина брони.
const L = (br, id, name, kind, el, st, icon, p = {}) => ({ br, id, name, kind, el, st, icon, p });
export const NEW_ACTIVES = {
  thorn: [
    L(0, 'th_wall', 'Стена щитов', 'buff', 'steel', null, 'lorc/checked-shield', { stat: 'armor' }),
    L(0, 'th_taunt', 'Вызов', 'pull', 'steel', 'slow', 'lorc/shouting', { k: 1.4 }),
    L(0, 'th_slam', 'Удар щитом', 'cone', 'earth', 'stun', 'delapouite/shield-bash', { cone: 70, k: 1.3 }),
    L(0, 'th_stone', 'Каменная плоть', 'heal', 'earth', null, 'lorc/stone-sphere'),
    L(0, 'th_aegis', 'Эгида', 'buff', 'light', null, 'lorc/aura', { stat: 'regen' }),
    L(0, 'th_rampart', 'Бастион', 'nova', 'earth', 'root', 'delapouite/stone-wall', { k: 1.3 }),
    L(0, 'th_oath', 'Клятва стража', 'buff', 'blood', null, 'delapouite/sword-brandish', { stat: 'leech' }),
    L(0, 'th_judg', 'Кара', 'zone', 'light', 'stun', 'lorc/hammer-drop', { k: 1.2 }),
    L(1, 'th_cleave', 'Рассечение', 'cone', 'blood', 'bleed', 'lorc/sword-slice'),
    L(1, 'th_pierce', 'Пронзающий выпад', 'strike', 'steel', 'crack', 'lorc/sword-wound'),
    L(1, 'th_hurl', 'Метательный топор', 'bolt', 'steel', 'bleed', 'lorc/thrown-daggers'),
    L(1, 'th_ember', 'Огненный замах', 'cone', 'fire', 'burn', 'lorc/fire-wave'),
    L(1, 'th_lunge', 'Бросок палача', 'dash', 'steel', 'stun', 'lorc/sprint'),
    L(1, 'th_behead', 'Обезглавливание', 'strike', 'blood', null, 'lorc/decapitation', { k: 1.4 }),
    L(1, 'th_warcry', 'Клич крови', 'buff', 'blood', null, 'delapouite/barbarian', { stat: 'crit' }),
    L(2, 'th_stomp', 'Топот', 'nova', 'earth', 'slow', 'lorc/foot-trip'),
    L(2, 'th_lust', 'Жажда битвы', 'buff', 'fire', null, 'delapouite/enrage', { stat: 'spd' }),
    L(2, 'th_rend', 'Рваные раны', 'nova', 'blood', 'bleed', 'lorc/bloody-sword'),
    L(2, 'th_jump', 'Прыжок берсерка', 'zone', 'earth', 'stun', 'delapouite/jump-across'),
    L(2, 'th_storm', 'Буря клинков', 'field', 'steel', null, 'lorc/spinning-blades'),
    L(2, 'th_howl', 'Рёв зверя', 'nova', 'shadow', 'fear', 'lorc/wolf-howl'),
    L(2, 'th_wrath', 'Гнев', 'buff', 'fire', null, 'lorc/fist', { stat: 'dmg' }),
    L(0, 'th_xrift', 'Раскол земли', 'nova', 'earth', 'root', '', { k: 1.5 }),     // ряд 9 (4.06, предел 70)
    L(0, 'th_xheaven', 'Молот небес', 'zone', 'light', 'stun', '', { k: 2 }),     // вершина ветки
    L(1, 'th_xexecute', 'Казнь', 'strike', 'blood', 'bleed', '', { k: 1.9 }),
    L(1, 'th_xreaper', 'Жнец', 'cone', 'blood', 'bleed', '', { cone: 110, k: 2.1 }),
    L(2, 'th_xfury', 'Неистовство', 'buff', 'fire', null, '', { stat: 'dmg' }),
    L(2, 'th_xeclipse', 'Затмение ярости', 'nova', 'shadow', 'fear', '', { k: 2.2 })
  ],
  irga: [
    L(0, 'ir_flame', 'Огненная стрела', 'bolt', 'fire', 'burn', 'lorc/fire-ray'),
    L(0, 'ir_wave', 'Огненная волна', 'cone', 'fire', 'burn', 'lorc/fire-breath'),
    L(0, 'ir_ring', 'Кольцо огня', 'nova', 'fire', 'burn', 'lorc/fire-ring'),
    L(0, 'ir_pillar', 'Столп пламени', 'zone', 'fire', 'burn', 'lorc/fire-zone'),
    L(0, 'ir_wall', 'Стена огня', 'field', 'fire', null, 'delapouite/firewall'),
    L(0, 'ir_combust', 'Возгорание', 'mark', 'fire', null, 'carl-olsen/flame'),
    L(0, 'ir_phoenix', 'Крылья феникса', 'dash', 'fire', 'burn', 'lorc/fire-dash'),
    L(0, 'ir_inferno', 'Пекло', 'buff', 'fire', null, 'delapouite/fire-spell-cast', { stat: 'dmg' }),
    L(1, 'ir_shard', 'Ледяной осколок', 'bolt', 'ice', 'freeze', 'lorc/ice-bolt'),
    L(1, 'ir_cone', 'Конус холода', 'cone', 'ice', 'slow', 'lorc/frozen-orb'),
    L(1, 'ir_spike', 'Ледяные шипы', 'zone', 'ice', 'freeze', 'lorc/ice-spear'),
    L(1, 'ir_barrier', 'Ледяная преграда', 'buff', 'ice', null, 'lorc/ice-shield', { stat: 'armor' }),
    L(1, 'ir_frostbite', 'Обморожение', 'mark', 'ice', null, 'lorc/frostfire'),
    L(1, 'ir_glacier', 'Ледник', 'field', 'ice', null, 'lorc/snowflake-2', { slow: .45 }),
    L(1, 'ir_mend', 'Талая вода', 'heal', 'water', null, 'sbed/water-drop'),
    L(2, 'ir_bolt', 'Разряд', 'bolt', 'storm', 'stun', 'lorc/lightning-arc'),
    L(2, 'ir_storm', 'Гроза', 'field', 'storm', null, 'lorc/lightning-storm'),
    L(2, 'ir_void', 'Вихрь бездны', 'pull', 'shadow', 'slow', 'lorc/vortex'),
    L(2, 'ir_rot', 'Гнилой туман', 'cloud', 'venom', null, 'sbed/poison-cloud'),
    L(2, 'ir_blind', 'Ослепляющая вспышка', 'nova', 'light', 'blind', 'lorc/sun-radiations'),
    L(2, 'ir_jinx', 'Сглаз', 'strike', 'shadow', 'crack', 'skoll/evil-eyes', { range: 12, cone: 60 }),
    L(2, 'ir_surge', 'Всплеск силы', 'buff', 'storm', null, 'lorc/power-lightning', { stat: 'crit' }),
    L(0, 'ir_xcomet', 'Комета', 'zone', 'fire', 'burn', '', { k: 1.9 }),     // ряд 9 (4.06, предел 70)
    L(0, 'ir_xsun', 'Падающее солнце', 'field', 'fire', null, '', { k: 2 }),     // вершина ветки
    L(1, 'ir_xglacier', 'Ледник', 'cone', 'ice', 'freeze', '', { k: 1.6 }),
    L(1, 'ir_xwinter', 'Вечная зима', 'field', 'ice', null, '', { k: 1.9 }),
    L(2, 'ir_xvoid', 'Бездна', 'nova', 'shadow', 'fear', '', { k: 1.6 }),
    L(2, 'ir_xplague', 'Мор', 'cloud', 'venom', 'poison', '', { k: 2 })
  ],
  warlock: [
    L(0, 'wl_bolt', 'Стрела тьмы', 'bolt', 'shadow', 'crack', 'lorc/shadow-grasp'),
    L(0, 'wl_wither', 'Увядание', 'cone', 'shadow', 'slow', 'lorc/dead-wood'),
    L(0, 'wl_agony', 'Агония', 'mark', 'shadow', null, 'lorc/bleeding-eye'),
    L(0, 'wl_blight', 'Чума', 'cloud', 'venom', null, 'lorc/skull-bolt'),
    L(0, 'wl_corrupt', 'Скверна', 'strike', 'venom', 'poison', 'lorc/poison-bottle', { range: 12, cone: 60 }),
    L(0, 'wl_eclipse', 'Затмение', 'nova', 'shadow', 'blind', 'lorc/eclipse'),
    L(0, 'wl_void', 'Пустота', 'zone', 'shadow', 'crack', 'lorc/portal'),
    L(1, 'wl_leech', 'Кровавая пиявка', 'strike', 'blood', 'bleed', 'lorc/leeching-worm', { range: 12, cone: 60 }),
    L(1, 'wl_boil', 'Кипение крови', 'nova', 'blood', 'bleed', 'lorc/heart-drop'),
    L(1, 'wl_tap', 'Отворение жил', 'heal', 'blood', null, 'delapouite/heart-beats'),
    L(1, 'wl_rite', 'Обряд', 'buff', 'blood', null, 'lorc/bloody-stash', { stat: 'leech' }),
    L(1, 'wl_pool', 'Кровавая лужа', 'field', 'blood', null, 'lorc/drop'),
    L(1, 'wl_spike', 'Кровавый шип', 'bolt', 'blood', 'bleed', 'lorc/spiked-tentacle'),
    L(1, 'wl_vein', 'Сеть жил', 'pull', 'blood', 'root', 'lorc/tentacles-skull'),
    L(1, 'wl_crim', 'Багровая мощь', 'buff', 'blood', null, 'lorc/heart-tower', { stat: 'dmg' }),
    L(2, 'wl_fire', 'Адское пламя', 'bolt', 'fire', 'burn', 'lorc/flaming-trident'),
    L(2, 'wl_rain', 'Огненный дождь', 'field', 'fire', null, 'lorc/burning-meteor'),
    L(2, 'wl_gate', 'Врата преисподней', 'zone', 'fire', 'stun', 'lorc/magic-portal'),
    L(2, 'wl_howl', 'Вой бездны', 'nova', 'shadow', 'fear', 'lorc/screaming'),
    L(2, 'wl_rake', 'Когти беса', 'cone', 'blood', 'bleed', 'lorc/claw-slashes'),
    L(2, 'wl_leap', 'Прыжок демона', 'dash', 'fire', 'burn', 'lorc/bat-wing'),
    L(2, 'wl_dark', 'Тёмный дар', 'buff', 'shadow', null, 'lorc/imp-laugh', { stat: 'spd' }),
    L(0, 'wl_xwither', 'Иссушение', 'mark', 'shadow', null, '', { k: 1.8 }),     // ряд 9 (4.06, предел 70)
    L(0, 'wl_xruin', 'Погибель', 'zone', 'shadow', 'blind', '', { k: 2.1 }),     // вершина ветки
    L(1, 'wl_xfeast', 'Кровавый пир', 'heal', 'blood', null, ''),
    L(1, 'wl_xbloodstorm', 'Кровавый шторм', 'nova', 'blood', 'bleed', '', { k: 2 }),
    L(2, 'wl_xhellfire', 'Адское пламя', 'cone', 'fire', 'burn', '', { k: 1.7 }),
    L(2, 'wl_xgate', 'Врата бездны', 'field', 'shadow', null, '', { k: 2 })
  ],
  jay: [
    L(0, 'jy_aimed', 'Прицельный выстрел', 'bolt', 'steel', 'crack', 'lorc/arrow-flights', { k: 1.4 }),
    L(0, 'jy_pin', 'Пригвоздить', 'bolt', 'earth', 'root', 'lorc/pierced-body'),
    L(0, 'jy_thunder', 'Громовая стрела', 'bolt', 'storm', 'stun', 'lorc/lightning-arc'),
    L(0, 'jy_hunt', 'Метка охотника', 'mark', 'steel', null, 'lorc/target-arrows'),
    L(0, 'jy_barb', 'Зазубренная стрела', 'bolt', 'blood', 'bleed', 'lorc/barbed-arrow'),
    L(0, 'jy_pierce', 'Пробивная стрела', 'bolt', 'steel', null, 'lorc/striking-arrows', { pierce: 4 }),
    L(0, 'jy_calm', 'Холодная голова', 'buff', 'ice', null, 'lorc/archery-target', { stat: 'crit' }),
    L(1, 'jy_net', 'Ловчая сеть', 'zone', 'earth', 'root', 'lorc/fishing-net', { k: 1.6 }),
    L(1, 'jy_kick', 'Пинок', 'cone', 'earth', 'stun', 'lorc/boot-kick', { cone: 70, r: 2.8, k: 1.6 }),
    L(1, 'jy_run', 'Стремительный бег', 'buff', 'storm', null, 'darkzaitzev/running-ninja', { stat: 'spd' }),
    L(1, 'jy_bandage', 'Перевязка', 'heal', 'light', null, 'delapouite/arm-bandage'),
    L(1, 'jy_stakes', 'Колья', 'field', 'earth', null, 'delapouite/spiked-wall', { slow: .45, k: 1.6 }),
    L(1, 'jy_flash', 'Дымовая шашка', 'nova', 'shadow', 'blind', 'darkzaitzev/smoke-bomb'),
    L(1, 'jy_wild', 'Дикая сила', 'buff', 'blood', null, 'delapouite/bear-head', { stat: 'dmg' }),
    L(1, 'jy_dive', 'Нырок', 'dash', 'storm', null, 'lorc/dodging', { dist: 5, k: 1.5 }),
    L(2, 'jy_barrage', 'Шквал', 'bolt', 'steel', null, 'lorc/arrow-cluster', { n: 5, spread: 30, k: .55 }),
    L(2, 'jy_burst', 'Разрывная стрела', 'zone', 'fire', 'burn', 'lorc/arrow-flights'),
    L(2, 'jy_hail', 'Ледяной град', 'field', 'ice', null, 'lorc/ice-bolt', { slow: .4 }),
    L(2, 'jy_shrapnel', 'Шрапнель', 'cone', 'steel', 'bleed', 'lorc/shatter'),
    L(2, 'jy_fog', 'Ядовитый туман', 'cloud', 'venom', null, 'sbed/poison-cloud'),
    L(2, 'jy_peal', 'Раскат', 'nova', 'storm', 'stun', 'lorc/lightning-storm'),
    L(2, 'jy_wind', 'Попутный ветер', 'buff', 'storm', null, 'lorc/wind-slap', { stat: 'spd' }),
    L(0, 'jy_xlance', 'Пронзающий луч', 'bolt', 'light', null, '', { k: 2 }),     // ряд 9 (4.06, предел 70)
    L(0, 'jy_xdeadeye', 'Смертельный выстрел', 'mark', 'fire', null, '', { k: 2.3 }),     // вершина ветки
    L(1, 'jy_xsnare', 'Сеть охотника', 'zone', 'earth', 'root', '', { k: 1.3 }),
    L(1, 'jy_xwild', 'Зов дикой природы', 'heal', 'earth', null, ''),
    L(2, 'jy_xbarrage', 'Шквал', 'bolt', 'storm', 'stun', '', { n: 5, k: 1.2 }),
    L(2, 'jy_xskyfall', 'Небесный дождь', 'field', 'storm', null, '', { k: 2 })
  ],
  vale: [
    L(0, 'vl_flurry', 'Шквал ударов', 'cone', 'steel', null, 'lorc/sword-spin', { k: 1.15 }),
    L(0, 'vl_throw', 'Бросок кинжала', 'bolt', 'steel', 'crack', 'lorc/thrown-daggers'),
    L(0, 'vl_spin', 'Вращение', 'nova', 'steel', 'bleed', 'lorc/spinning-blades'),
    L(0, 'vl_lunge', 'Выпад', 'dash', 'steel', null, 'lorc/sprint', { dist: 5 }),
    L(0, 'vl_sunder', 'Рассечь доспех', 'strike', 'steel', 'crack', 'lorc/broken-shield'),
    L(0, 'vl_venom', 'Отравленный клинок', 'strike', 'venom', 'poison', 'lorc/dripping-blade'),
    L(0, 'vl_edge', 'Острота', 'buff', 'steel', null, 'delapouite/sharp-axe', { stat: 'crit' }),
    L(1, 'vl_ambush', 'Засада', 'strike', 'shadow', 'stun', 'lorc/backstab', { k: 1.3 }),
    L(1, 'vl_veil', 'Покров ночи', 'buff', 'shadow', null, 'lorc/hood', { stat: 'spd' }),
    L(1, 'vl_shroud', 'Саван', 'nova', 'shadow', 'blind', 'lorc/shadow-follower'),
    L(1, 'vl_mark', 'Метка смерти', 'mark', 'shadow', null, 'lorc/death-note'),
    L(1, 'vl_stars', 'Теневые звёзды', 'bolt', 'shadow', null, 'lorc/shuriken', { n: 3, spread: 24, k: .7 }),
    L(1, 'vl_snare', 'Тени-путы', 'zone', 'shadow', 'root', 'lorc/shadow-grasp'),
    L(1, 'vl_fade', 'Тёмное исцеление', 'heal', 'shadow', null, 'lorc/heart-drop'),
    L(2, 'vl_hemo', 'Кровавый вихрь', 'nova', 'blood', 'bleed', 'lorc/bleeding-wound'),
    L(2, 'vl_rupture', 'Разрыв', 'strike', 'blood', 'bleed', 'lorc/bleeding-wound'),
    L(2, 'vl_dew', 'Кровавая роса', 'field', 'blood', null, 'lorc/drop'),
    L(2, 'vl_drink', 'Испить', 'heal', 'blood', null, 'lorc/heart-bottle'),
    L(2, 'vl_rush', 'Кровавое неистовство', 'buff', 'blood', null, 'delapouite/enrage', { stat: 'dmg' }),
    L(2, 'vl_hook', 'Крюк', 'pull', 'blood', 'slow', 'lorc/grapple'),
    L(2, 'vl_slash', 'Багровый взмах', 'cone', 'blood', 'bleed', 'lorc/bloody-sword'),
    L(2, 'vl_vamp', 'Вампирский клинок', 'buff', 'blood', null, 'delapouite/vampire-dracula', { stat: 'leech' }),
    L(0, 'vl_xtempest', 'Вихрь клинков', 'cone', 'storm', 'crack', '', { k: 1.7 }),     // ряд 9 (4.06, предел 70)
    L(0, 'vl_xdeathmark', 'Метка смерти', 'mark', 'blood', null, '', { k: 2.3 }),     // вершина ветки
    L(1, 'vl_xvanish', 'Исчезновение', 'buff', 'shadow', null, '', { stat: 'crit' }),
    L(1, 'vl_xumbra', 'Удар из тьмы', 'strike', 'shadow', 'blind', '', { k: 2.2 }),
    L(2, 'vl_xhemo', 'Кровопускание', 'nova', 'blood', 'bleed', '', { k: 1.6 }),
    L(2, 'vl_xsanguine', 'Кровавая жатва', 'zone', 'blood', 'bleed', '', { k: 2.1 })
  ]
};
// ветки прежних умений героя (как раньше раскладывало древо по усилителям)
export const OLD_BRANCH = {
  thorn: { cry: 0, iron: 0, charge: 1, bash: 1, blood: 1, whirl: 2, rage: 2, quake: 2 },
  irga: { fireball: 0, meteor: 0, nova: 1, shield: 1, blizzard: 1, chain: 2, cloud: 2, spear: 2 },
  warlock: { hex: 0, souls: 0, doom: 0, drain: 1, pact: 1, summon: 2, terror: 2, grasp: 2 },
  jay: { frost: 0, firearrow: 0, hawk: 0, leap: 1, trap: 1, volley: 2, venom: 2, rain: 2 },
  vale: { dance: 0, execute: 0, fan: 0, blink: 1, shadow: 1, smoke: 1, parry: 2, bloodlet: 2 }
};
// прежние умения с прицелом по точке (кружок под мышью до удара)
export const OLD_AIM = new Set(['cloud', 'meteor', 'blizzard', 'grasp', 'rain']);
// запасной значок game-icons для умений 61–70 (4.06): значок похожего умения той же ветки (основной — рисованный, spellart3d.js)
export const ICON_ALIAS = { th_xrift: 'th_rampart', th_xheaven: 'th_judg', th_xexecute: 'th_behead', th_xreaper: 'th_cleave', th_xfury: 'th_lust', th_xeclipse: 'th_howl', ir_xcomet: 'ir_pillar', ir_xsun: 'ir_wall', ir_xglacier: 'ir_cone', ir_xwinter: 'ir_glacier', ir_xvoid: 'ir_void', ir_xplague: 'ir_rot', wl_xwither: 'wl_agony', wl_xruin: 'wl_void', wl_xfeast: 'wl_tap', wl_xbloodstorm: 'wl_boil', wl_xhellfire: 'wl_fire', wl_xgate: 'wl_gate', jy_xlance: 'jy_pierce', jy_xdeadeye: 'jy_hunt', jy_xsnare: 'jy_net', jy_xwild: 'jy_bandage', jy_xbarrage: 'jy_thunder', jy_xskyfall: 'jy_peal', vl_xtempest: 'vl_flurry', vl_xdeathmark: 'vl_mark', vl_xvanish: 'vl_veil', vl_xumbra: 'vl_ambush', vl_xhemo: 'vl_hemo', vl_xsanguine: 'vl_dew' };
