// Задания Хранителя костра. type: kill (target — тип врага), eclipse (пережить гибель Предвестника),
// equip (занять N слотов), upgrade (оружие до +N), level (достичь уровня N).
// reward: ash, xp, sp (очки навыков), item (id вещи) или rarity (случайная вещь этой редкости).
// after — задание, после которого это становится доступным.
export const QUESTS = [
  { id: 'q_brutes', title: 'Рогачи у границы', text: 'Убей 10 рогачей: они вытоптали тропу к городу.', type: 'kill', target: 'brute', goal: 10, reward: { ash: 70, xp: 40 } },
  { id: 'q_imps', title: 'Мелкая нечисть', text: 'Убей 15 бесов, что пляшут у границы пустоши.', type: 'kill', target: 'imp', goal: 15, reward: { ash: 55, xp: 30 } },
  { id: 'q_dress', title: 'Одеться по погоде', text: 'Надень вещи в трёх разных слотах.', type: 'equip', goal: 3, reward: { ash: 60, item: 'h_iron_helm' } },
  { id: 'q_eclipse', title: 'Пережди затмение', text: 'Дождись гибели Предвестника и сам не падай, пока он на ногах.', type: 'eclipse', goal: 1, reward: { ash: 150, sp: 1 }, after: 'q_brutes' },
  { id: 'q_lords', title: 'Слуги Затмения', text: 'Убей 2 Слуг Затмения: они выходят из тени.', type: 'kill', target: 'lord', goal: 2, reward: { ash: 120, xp: 90 }, after: 'q_imps' },
  { id: 'q_forge', title: 'Закалка', text: 'Улучши оружие у кузнеца до +3.', type: 'upgrade', goal: 3, reward: { ash: 100, sp: 1 }, after: 'q_dress' },
  { id: 'q_level5', title: 'Закалённый странник', text: 'Достигни 5 уровня.', type: 'level', goal: 5, reward: { ash: 90, rarity: 'rare' }, after: 'q_lords' },
  { id: 'q_three', title: 'Три затмения', text: 'Пережди ещё три затмения, ни разу не упав.', type: 'eclipse', goal: 3, reward: { ash: 400, rarity: 'cursed', sp: 1 }, after: 'q_eclipse' }
];
export const QUESTS_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));
