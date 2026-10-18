// Рецепты крафта. mats — материалы и вещи (по одной) из сумки, ash — пепел, needs — книга знаний (null: известен с начала).
// Именные вещи сетов и уникальные клинки делаются только здесь: трофеи боссов, редкие материалы и нужная книга.
import { CATALOG } from './items.js';
export const RECIPES = [];
const R = (id, res, n, mats, ash, needs, text) => RECIPES.push({ id, result: { id: res, n }, mats, ash, needs, text });

// плавка
R('ingot', 'm_ingot', 1, [['m_ore', 3], ['m_coal', 1]], 5, null, 'Переплавка руды в слиток.');
R('steel', 'm_steel_ingot', 1, [['m_ingot', 2], ['m_coal', 2]], 12, 'smelting', 'Слитки и уголь дают сталь.');
R('alloy', 'm_ash_alloy', 1, [['m_steel_ingot', 2], ['m_ash_salt', 2], ['m_soot', 1]], 30, 'alloy', 'Сплав для именных вещей.');
// лекарство
R('antidote', 'p_antidote', 2, [['m_grave_moss', 2], ['m_ash_salt', 1]], 8, 'medic', 'Снимает яд, кровь и горение.');
R('salve', 'h_salve', 1, [['m_tallow', 2], ['m_grave_moss', 2], ['m_beast_hide', 1]], 15, 'medic', 'Мазь из пепла.');
R('elixir', 'p_elixir', 1, [['m_amber', 1], ['m_grave_moss', 3], ['m_ash_salt', 2]], 60, 'medic', 'Эликсир жизни.');
// оружие среднего уровня: железо → закалённое → стальное
for (const k of ['sword', 'axe', 'mace', 'spear', 'dagger']) {
  R(`w_${k}_tempered`, `w_${k}_tempered`, 1, [[`w_${k}_iron`, 1], ['m_tempered_sinew', 1], ['m_ingot', 2]], 20, 'fine', 'Закалка железного клинка.');
  R(`w_${k}_steel`, `w_${k}_steel`, 1, [[`w_${k}_tempered`, 1], ['m_steel_ingot', 3]], 40, 'fine', 'Сталь вместо железа.');
}
// кожаная броня
for (const id of ['a_head_hood_leather', 'a_body_jerkin_leather', 'a_cloak_cape_leather', 'a_boots_shoes_leather']) R(id, id, 1, [['m_beast_hide', 3], ['m_sinew', 1]], 12, 'leather', 'Кожа и жила.');
// чёрная броня
for (const id of ['a_head_sallet_black', 'a_body_cuirass_black', 'a_cloak_pelt_black', 'a_boots_greaves_black']) R(id, id, 1, [['m_steel_ingot', 3], ['m_black_resin', 1], ['m_beast_hide', 2]], 120, 'blackarm', 'Чернение стали смолой.');
// именные сеты боссов: трофей + сплав + серебряная нить + чёрная смола
const TROPHY = { pogost: 'm_devourer_heart', eclipse: 'm_eclipse_cloak', rust: 'm_chief_fang' };
for (const set of Object.keys(TROPHY)) for (const slot of ['head', 'body', 'cloak', 'boots']) R(`as_${set}_${slot}`, `as_${set}_${slot}`, 1, [[TROPHY[set], 1], ['m_ash_alloy', 2], ['m_silver_thread', 2], ['m_black_resin', 1]], 300, `set_${set}`, 'Именная часть сета.');
// уникальные клинки: чёрная основа того же типа + трофей босса + сплав
const BLADES = { pogost: ['whisper:dagger', 'bitterfruit:sickle', 'reaper:scythe', 'undertaker:pick', 'needle:spear'], eclipse: ['ember:sword', 'widow:rapier', 'nightmaw:greatsword', 'finalword:axe', 'ashchron:halberd', 'eclipsebrother:flail'], rust: ['roar:hammer', 'law:war_axe', 'wardnail:mace', 'lullaby:club', 'pocketstorm:chain_ball'] };
for (const boss of Object.keys(BLADES)) for (const s of BLADES[boss]) { const [id, kind] = s.split(':'); R(`wu_${id}`, `wu_${id}`, 1, [[`w_${kind}_black`, 1], [TROPHY[boss], 2], ['m_ash_alloy', 1]], 250, `blades_${boss}`, 'Уникальный клинок.'); }
// золочение (2026-10-18): клеймёная основа того же места + трофей замка (оружие и щит — печать Кастеляна, остальное — вуаль Королевы) + сплав и серебряная нить; известно с начала
for (const g of CATALOG.filter(i => i.pool === 'gold' && i.base)) R('gild_' + g.id.slice(2), g.id, 1, [[g.base, 1], [g.slot === 'weapon' || g.slot === 'offhand' ? 'm_castellan_seal' : 'm_queen_veil', 1], ['m_ash_alloy', 2], ['m_silver_thread', 2]], 500, null, 'Золочение клеймёной вещи: трофей замка, сплав и серебряная нить.');
// алхимия и кожевенное дело (этап 6): известны сразу, открываются навыком ремесла
R('alch_heal1', 'p_heal1', 2, [['m_grave_moss', 2]], 2, null, 'Мох с погоста, вываренный до горечи.');
R('alch_heal2', 'p_heal2', 2, [['m_grave_moss', 3], ['m_ash_salt', 1]], 6, null, 'Соль пепла держит силу отвара.');
R('alch_haste', 'p_haste', 1, [['m_amber', 1], ['m_grave_moss', 2]], 10, null, 'Янтарь в отваре разгоняет кровь.');
R('alch_heal3', 'p_heal3', 2, [['m_grave_moss', 3], ['m_amber', 1], ['m_ash_salt', 1]], 14, null, 'Крепкий отвар для долгого боя.');
R('alch_rage', 'p_rage', 1, [['m_tallow', 1], ['m_amber', 1], ['m_ash_salt', 2]], 18, null, 'Тёмный жир и соль — злость на дне склянки.');
R('alch_skin', 'p_skin', 1, [['m_ore', 2], ['m_grave_moss', 2], ['m_amber', 1]], 22, null, 'Рудная пыль ложится на кожу камнем.');
R('lt_sinew', 'm_tempered_sinew', 1, [['m_sinew', 2], ['m_tallow', 1]], 4, null, 'Жила, вываренная в жиру, тянется и не рвётся.');
R('lt_pelt', 'a_cloak_pelt_black', 1, [['m_beast_hide', 4], ['m_black_resin', 1], ['m_tempered_sinew', 1]], 60, null, 'Плащ из шкур, пропитанных чёрной смолой.');
// ремесло prof и требование навыка skill (этап 6): по виду рецепта
const SKILL = [[/^ingot$/, 0], [/^steel$/, 10], [/_tempered$/, 20], [/^w_.*_steel$/, 35], [/^alloy$/, 45], [/_black$/, 55], [/^wu_/, 70], [/^as_/, 70], [/^gild_/, 100],
  [/^antidote$/, 10], [/^salve$/, 25], [/^elixir$/, 100], [/^alch_heal1$/, 0], [/^alch_heal2$/, 30], [/^alch_haste$/, 45], [/^alch_heal3$/, 65], [/^alch_rage$/, 70], [/^alch_skin$/, 85],
  [/hood_leather$/, 0], [/shoes_leather$/, 5], [/cape_leather$/, 10], [/^lt_sinew$/, 15], [/jerkin_leather$/, 20], [/^lt_pelt$/, 70]];
for (const r of RECIPES) {
  r.prof = /^(antidote|salve|elixir|alch_)/.test(r.id) ? 'alch' : /(_leather$|^lt_)/.test(r.id) ? 'leather' : 'smith';
  r.skill = (SKILL.find(([re]) => re.test(r.id)) || [0, 0])[1];
}
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));
export const TROPHIES = TROPHY;      // набор → трофей
