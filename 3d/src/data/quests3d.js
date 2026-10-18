// Задания. giver — кто выдаёт (merchant, smith, captain). type и поля цели:
//   kill {enemy, n}, boss {boss}, visit {place}, bring {item, n} (сдаются выдавшему), craft {item}, tome {tome}, open {n, kind?}, hire {}
// reward: ash, xp, items [[id, n]]. after — id задания, которое надо выполнить раньше. minLv — рекомендуемый уровень.
// repeat: секунды до повторной выдачи (заказы). Тексты авторские.
export const QUESTS = [
  // ---- торговец Пепельного Брода ----
  { id: 'm_imps', giver: 'merchant', name: 'Беспокойные пустоши', text: 'Бесы лезут к дороге и пугают покупателей. Прогоните пятерых.', type: 'kill', enemy: 'imp', n: 5, reward: { ash: 60, xp: 30 } },
  { id: 'm_food', giver: 'merchant', name: 'Нужна еда', text: 'Склад пуст, караван не придёт. Принесите четыре ржаных хлеба.', type: 'bring', item: 'f_rye', n: 4, reward: { ash: 70, xp: 25 } },
  { id: 'm_hounds', giver: 'merchant', name: 'Гончие у дороги', text: 'Гончие рвут вьючных. Четыре штуки, и разговор окончен.', type: 'kill', enemy: 'hound', n: 4, after: 'm_imps', reward: { ash: 90, xp: 45, items: [['p_heal2', 1]] } },
  { id: 'm_open', giver: 'merchant', name: 'Что в сундуках', text: 'Говорят, в домах ещё осталось добро. Вскройте восемь любых ящиков, сундуков и бочек.', type: 'open', n: 8, reward: { ash: 100, xp: 40 } },
  { id: 'm_polya', giver: 'merchant', name: 'Разведка Полей', text: 'Что там, на Сухих Полях? Сходите и вернитесь живым. Книга за труды.', type: 'visit', place: 'polya', reward: { ash: 80, xp: 60, items: [['tome_leather', 1]] } },
  { id: 'm_coins', giver: 'merchant', name: 'Коллекционер', text: 'Один покупатель собирает серебряные кругляши. Три штуки, и он станет щедрым.', type: 'bring', item: 'c_round', n: 3, reward: { ash: 130, xp: 40 } },
  { id: 'm_ghoul', giver: 'merchant', name: 'Тихий погост', text: 'С Погоста тянет холодом. Тройка упырей, и в бестиарии будет, что почитать.', type: 'kill', enemy: 'ghoul', n: 3, minLv: 4, after: 'm_hounds', reward: { ash: 140, xp: 90, items: [['tome_bestiary_pogost', 1]] } },
  { id: 'm_b_imps', giver: 'merchant', name: 'Заказ: бесы', text: 'Дорога опять кишит бесами. Десять голов за вознаграждение.', type: 'kill', enemy: 'imp', n: 10, repeat: 900, after: 'm_imps', reward: { ash: 120, xp: 50 } },
  // ---- кузнец слободы ----
  { id: 's_ingot', giver: 'smith', name: 'Первый слиток', text: 'Попробуйте перекроить руду в слиток сами. Рецепт простой. Книгу по плавке дам за труд.', type: 'craft', item: 'm_ingot', reward: { ash: 40, xp: 30, items: [['tome_smelting', 1]] } },
  { id: 's_ore', giver: 'smith', name: 'Руда для кузни', text: 'Горн голодный. Принесите восемь кусков руды.', type: 'bring', item: 'm_ore', n: 8, reward: { ash: 90, xp: 30 } },
  { id: 's_steel', giver: 'smith', name: 'Сталь с нуля', text: 'Теперь сталь. Книга у вас есть? Тогда куйте.', type: 'craft', item: 'm_steel_ingot', after: 's_ingot', reward: { ash: 150, xp: 60 } },
  { id: 's_hide', giver: 'smith', name: 'Шкуры гончих', text: 'Для кожи нужны шкуры. Четыре штуки, от гончих.', type: 'bring', item: 'm_beast_hide', n: 4, reward: { ash: 110, xp: 40, items: [['tome_fine', 1]] } },
  { id: 's_tome', giver: 'smith', name: 'Знание дороже золота', text: 'Прочтите «Ковку пепельного сплава», и приходите. Книгу ищите в запертых сундуках.', type: 'tome', tome: 'alloy', minLv: 8, reward: { ash: 220, xp: 150, items: [['m_black_resin', 1]] } },
  { id: 's_devourer', giver: 'smith', name: 'Сердце Пожирателя', text: 'Нужно сердце того, кто живёт в склепе. Убейте Пожирателя Погоста.', type: 'boss', boss: 'devourer', minLv: 10, after: 's_hide', reward: { ash: 300, xp: 400, items: [['m_black_resin', 2]] } },
  // ---- капитан Заставы ----
  { id: 'c_lager', giver: 'captain', name: 'Лагерь Ржавых', text: 'Разведайте лагерь. Только разведайте: идти в одиночку не советую.', type: 'visit', place: 'lager', minLv: 6, reward: { ash: 150, xp: 100, items: [['p_heal3', 1]] } },
  { id: 'c_brutes', giver: 'captain', name: 'Рогачи у границы', text: 'Шестеро рогачей не дают вывозить зерно. Заберите их.', type: 'kill', enemy: 'brute', n: 6, minLv: 5, reward: { ash: 220, xp: 140 } },
  { id: 'c_shields', giver: 'captain', name: 'Стена из щитов', text: 'У Ржавых завелись щитоносцы. В лоб их не взять: заходите сбоку, бейте из переката или с размаха.', type: 'kill', enemy: 'shield', n: 5, minLv: 6, reward: { ash: 240, xp: 160 } },
  { id: 'c_bombers', giver: 'captain', name: 'Тлеющие в руинах', text: 'Тлеющие бросаются под ноги и рвутся. Шестерых — и дорога к руинам снова наша. Держитесь подальше, когда зашипят.', type: 'kill', enemy: 'bomber', n: 6, minLv: 5, reward: { ash: 200, xp: 130, items: [['p_heal2', 1]] } },
  { id: 'c_hire', giver: 'captain', name: 'Свой отряд', text: 'Нанимайте бойца. Один человек в пустошах не воин, а добыча.', type: 'hire', reward: { ash: 100, xp: 40 } },
  { id: 'c_ruins', giver: 'captain', name: 'Руины Скорби', text: 'Что там стряслось? Дойдите до руин и вернитесь с вестями.', type: 'visit', place: 'ruiny', minLv: 7, after: 'c_lager', reward: { ash: 180, xp: 120 } },
  { id: 'c_archers', giver: 'captain', name: 'Стрелки на холме', text: 'Лучники Ржавых бьют по обозам издалека. Сократите их: четверых хватит.', type: 'kill', enemy: 'archer', n: 4, minLv: 6, after: 'c_lager', reward: { ash: 200, xp: 160 } },
  { id: 'c_witch', giver: 'captain', name: 'Огонь над руинами', text: 'Колдуны Затмения жгут землю там, где мы стоим. Двоих достаточно, чтобы остальные отступили.', type: 'kill', enemy: 'witch', n: 2, minLv: 8, after: 'c_ruins', reward: { ash: 260, xp: 240, items: [['p_heal3', 1]] } },
  { id: 'c_chief', giver: 'captain', name: 'Голова Вожака', text: 'Вожак Ржавых держит весь лагерь в страхе. Убейте его.', type: 'boss', boss: 'chief', minLv: 12, after: 'c_lager', reward: { ash: 500, xp: 700, items: [['key_black', 1]] } },
  { id: 'c_lord', giver: 'captain', name: 'Слуга Затмения', text: 'Он выходит из руин на закате. Убейте его до того, как придёт ночь.', type: 'boss', boss: 'lord', minLv: 14, after: 'c_ruins', reward: { ash: 650, xp: 900, items: [['key_black', 1]] } },
  { id: 'c_devourer', giver: 'captain', name: 'Погост не спит', text: 'Пожиратель Погоста поднимает мёртвых. Остановите его.', type: 'boss', boss: 'devourer', minLv: 10, reward: { ash: 400, xp: 500 } },
  { id: 'c_b_hounds', giver: 'captain', name: 'Заказ: гончие', text: 'Гончие опять рыщут по дороге. Десять пасти, на выбор.', type: 'kill', enemy: 'hound', n: 10, repeat: 900, after: 'c_hire', reward: { ash: 160, xp: 80 } },
  // ---- отряд «Пепельные Крылья» (этап 3, Акт I): открываются по сюжету — story: после какой сцены ----
  { id: 't_hounds', giver: 'timka', story: 'duel', name: 'Стая у тракта', text: 'Гончие режут наших лошадей. Восемь штук — и Корд перестанет ворчать.', type: 'kill', enemy: 'hound', n: 8, reward: { ash: 140, xp: 160 } },
  { id: 't_scout', giver: 'timka', story: 'firstblood', name: 'Что в Руинах', text: 'Аларик хочет знать, что творится в Руинах Скорби. Сходи посмотри, только не геройствуй.', type: 'visit', place: 'ruiny', reward: { ash: 120, xp: 220 } },
  { id: 't_archers', giver: 'timka', story: 'pogost', name: 'Стрелки на опушке', text: 'Лучники Ржавых бьют из кустов. Шестерых хватит, чтобы остальные задумались.', type: 'kill', enemy: 'archer', n: 6, reward: { ash: 220, xp: 380 } },
  { id: 't_wolves', giver: 'timka', story: 'hundred', name: 'Волчий лес', text: 'В Ольховом лесу гончих больше, чем деревьев. Проредим, пока Ирма отдыхает.', type: 'kill', enemy: 'hound', n: 12, reward: { ash: 360, xp: 900 } },
  { id: 'k_bread', giver: 'kord', story: 'duel', name: 'Похлёбка', text: 'Хлеба. Шесть.', type: 'bring', item: 'f_rye', n: 6, reward: { ash: 110, xp: 120 } },
  { id: 'k_ore', giver: 'kord', story: 'firstblood', name: 'Руда для молота', text: 'Молот треснул. Руды. Восемь.', type: 'bring', item: 'm_ore', n: 8, reward: { ash: 180, xp: 200 } },
  { id: 'k_hides', giver: 'kord', story: 'pogost', name: 'Шкуры на зиму', text: 'Зима скоро. Шкуры. Пять.', type: 'bring', item: 'm_beast_hide', n: 5, reward: { ash: 220, xp: 320 } },
  { id: 'k_shields', giver: 'kord', story: 'masked', name: 'Стена на стену', text: 'Щитоносцы Ржавых. Пять. Покажи, как ломать стену.', type: 'kill', enemy: 'shield', n: 5, reward: { ash: 300, xp: 520 } },
  { id: 'i_drill', giver: 'irma', story: 'firstblood', name: 'Учебный бой', text: 'Двенадцать бесов. Не для пепла — для руки. Повторим, когда скажу.', type: 'kill', enemy: 'imp', n: 12, repeat: 900, reward: { ash: 90, xp: 180 } },
  { id: 'i_ghouls', giver: 'irma', story: 'pogost', name: 'Мёртвые не лежат', text: 'После Пожирателя упыри всё ещё бродят у Погоста. Восемь — и хватит.', type: 'kill', enemy: 'ghoul', n: 8, reward: { ash: 260, xp: 420 } },
  { id: 'i_lungers', giver: 'irma', story: 'masked', name: 'Копья из тумана', text: 'Копейщики Погоста стали ходить по ночам. Пятеро. Береги ноги.', type: 'kill', enemy: 'lunger', n: 5, reward: { ash: 320, xp: 600 } },
  { id: 'i_brutes', giver: 'irma', story: 'rust', name: 'Добить Ржавых', text: 'От Ржавых остались рогачи-одиночки. Десять. Чтобы не собрались снова.', type: 'kill', enemy: 'brute', n: 10, reward: { ash: 420, xp: 800 } },
];
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));
export const GIVER_NAME = { merchant: 'Торговец', smith: 'Кузнец', captain: 'Капитан Заставы', timka: 'Тимка', kord: 'Корд', irma: 'Ирма', alaric: 'Аларик Белый' };
export const questLine = q => ({ kill: `Убить: ${q.n}`, boss: 'Победить босса', visit: 'Дойти до места', bring: `Принести: ${q.n}`, craft: 'Скрафтить', tome: 'Прочитать книгу', open: `Вскрыть контейнеров: ${q.n}`, hire: 'Нанять бойца' }[q.type]);
