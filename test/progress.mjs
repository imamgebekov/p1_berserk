// Тест прогресса: навыки, задания, сохранение (версия, миграции, повреждение, хранилище).
import { CFG, xpNeed } from '../src/config.js';
import { P, W, keys, resetState } from '../src/state.js';
import { setRng, mulberry32 } from '../src/util.js';
import { offAll } from '../src/events.js';
import { SKILLS, BRANCHES, SKILL_IDS, TOTAL_RANKS } from '../src/data/skills.js';
import { QUESTS, QUESTS_BY_ID } from '../src/data/quests.js';
import { ITEMS_BY_ID, SLOTS } from '../src/data/items.js';
import { newItem, giveItem, equipFromBag, recalc, derived } from '../src/inventory.js';
import { rankOf, canLearn, learn, respec, respecCost, mods, spentPoints } from '../src/skills.js';
import * as Q from '../src/quests.js';
import { grantReward } from '../src/rewards.js';
import { startSwing, rollSwing, tryBrand, gainXP, killEnemy, die } from '../src/combat.js';
import { spawnEnemy, spawnBoss } from '../src/world.js';
import { step } from '../src/sim.js';
import { tryUpgrade } from '../src/smith.js';
import { restock, stock } from '../src/shop.js';
import { VERSION, MIGRATIONS, migrate, snapshot, sanitize, applySave, createSaver } from '../src/save.js';

const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };
const fresh = seed => { resetState(); setRng(mulberry32(seed)); P.quests = {}; recalc(); W.started = true; };
const fakeStorage = (opts = {}) => {
  const m = new Map();
  return {
    m, getItem: k => { if (opts.getThrows) throw new Error('denied'); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (opts.setThrows) throw new Error('QuotaExceededError'); m.set(k, String(v)); },
    removeItem: k => m.delete(k)
  };
};

// ---------- 1. дерево навыков ----------
{
  ok(SKILL_IDS.length >= 6 && SKILL_IDS.length <= 8, `узлов ${SKILL_IDS.length}, нужно 6–8`);
  ok(BRANCHES.flatMap(b => b.nodes).sort().join() === [...SKILL_IDS].sort().join(), 'ветки не покрывают все узлы ровно по разу');
  for (const id of SKILL_IDS) {
    const s = SKILLS[id];
    ok(s.name && s.desc && s.max >= 1 && s.max <= 4, `навык ${id}: поля`);
    ok(!s.req || SKILLS[s.req], `навык ${id}: неизвестное требование ${s.req}`);
    for (let r = 1; r <= s.max; r++) ok(/\d/.test(s.effect(r)) && !s.effect(r).includes('NaN') && !s.effect(r).includes('undefined'), `навык ${id} ранг ${r}: текст «${s.effect(r)}»`);
    // цепочка требований не зациклена
    let cur = id, n = 0; while (SKILLS[cur].req && n++ < 20) cur = SKILLS[cur].req; ok(n < 20, `цикл требований у ${id}`);
  }
  // требуемые темы заказчика: тяжёлый удар, длина цепочки, длительность Клейма, лечение у костра
  for (const need of ['heavy', 'chain', 'brandDur', 'fireHeal']) ok(SKILLS[need], 'нет навыка ' + need);
  ok(TOTAL_RANKS >= 14 && TOTAL_RANKS <= 30, `всего рангов ${TOTAL_RANKS}`);

  fresh(1);
  ok(canLearn('heavy') === 'points' && learn('heavy', recalc) === 'points', 'изучение без очков');
  P.sp = 10;
  ok(canLearn('chain') === 'locked' && learn('chain', recalc) === 'locked' && rankOf('chain') === 0 && P.sp === 10, 'узел без требования');
  ok(learn('heavy', recalc) === 'ok' && rankOf('heavy') === 1 && P.sp === 9, 'изучение');
  ok(learn('chain', recalc) === 'ok' && learn('heavy', recalc) === 'ok' && learn('heavy', recalc) === 'ok' && learn('heavy', recalc) === 'max' && rankOf('heavy') === 3, 'предел ранга');
  ok(canLearn('нет такого') === 'unknown', 'неизвестный навык');
  ok(spentPoints() === 4 && P.sp === 6, `учёт очков: потрачено ${spentPoints()}, осталось ${P.sp}`);

  // эффекты
  fresh(2); P.sp = 99;
  const base = { maxhp: P.maxhp, crit: P.stats.crit, speed: P.stats.speed, rage: P.stats.rage };
  learn('vigor', recalc); learn('vigor', recalc);
  ok(P.maxhp === base.maxhp + 2 * CFG.skills.effects.vigor.hp && P.hp === P.maxhp, `живучесть: ${P.hp}/${P.maxhp}`);
  for (const id of ['heavy', 'chain', 'crit', 'crit']) learn(id, recalc);
  ok(P.stats.crit === base.crit + 2 * CFG.skills.effects.crit.crit && derived().crit === P.stats.crit, 'крит от навыка');
  for (const id of ['fireHeal', 'swift']) learn(id, recalc);
  ok(P.stats.speed === CFG.skills.effects.swift.speed, 'скорость от навыка');
  learn('brandGain', recalc); ok(P.stats.rage === CFG.skills.effects.brandGain.rage, 'набор Клейма от навыка');

  // длина цепочки: 3 → 4 удара, тяжёлый только последний
  const heavyAt = (rankChain) => {
    fresh(3); P.sp = 9; learn('heavy', recalc); for (let i = 0; i < rankChain; i++) learn('chain', recalc);
    const seq = []; for (let i = 0; i < 12; i++) { P.comboT = .5; startSwing(); seq.push(P.heavy ? 'H' : 'l'); } return seq.join('');
  };
  const h0 = heavyAt(0), h1 = heavyAt(1), h2 = heavyAt(2);
  ok(h0.replace(/l/g, '').length === 4 && h1.replace(/l/g, '').length === 3 && h2.replace(/l/g, '').length === 2, `частота тяжёлых: ${h0} / ${h1} / ${h2}`);
  ok(h1.indexOf('H', h1.indexOf('H') + 1) - h1.indexOf('H') === 4 && h2.indexOf('H', h2.indexOf('H') + 1) - h2.indexOf('H') === 5, 'длина цепочки 4 и 5');

  // тяжёлый удар сильнее
  const meanHeavy = rk => { fresh(4); P.sp = 9; for (let i = 0; i < rk; i++) learn('heavy', recalc); P.heavy = true; let s = 0; for (let i = 0; i < 3000; i++) s += rollSwing().dmg; return s / 3000; };
  ok(meanHeavy(3) > meanHeavy(0) * 1.25, `тяжёлый удар не усилился: ${meanHeavy(0).toFixed(1)} → ${meanHeavy(3).toFixed(1)}`);

  // длительность Клейма
  fresh(5); P.sp = 9; learn('brandGain', recalc); learn('brandDur', recalc); learn('brandDur', recalc);
  P.rage = CFG.rage.max; tryBrand();
  ok(Math.abs(P.rageOn - (CFG.rage.duration + 2 * CFG.skills.effects.brandDur.seconds)) < 1e-9 && P.rageDur === P.rageOn, `длительность Клейма ${P.rageOn}`);
  step(1 / 60); ok(P.rage > 0 && P.rage <= CFG.rage.max, 'шкала Клейма при длинном Клейме');
  fresh(6); P.rage = CFG.rage.max; tryBrand(); ok(P.rageOn === CFG.rage.duration, 'Клеймо без навыка');

  // лечение у костра
  const healed = rk => { fresh(7); P.sp = 9; learn('vigor', recalc); for (let i = 0; i < rk; i++) learn('fireHeal', recalc); P.hp = 10; P.x = CFG.world.fire; P.inCombat = 0; W.spawnT = 999; W.timer = 999;
    for (let i = 0; i < 60; i++) step(1 / 60); return P.hp - 10; };
  ok(healed(3) > healed(0) * 1.5, `лечение у костра: ${healed(0).toFixed(1)} → ${healed(3).toFixed(1)}`);
  // радиус лечения
  fresh(8); P.sp = 9; learn('vigor', recalc); learn('fireHeal', recalc); learn('fireHeal', recalc); learn('fireHeal', recalc);
  P.hp = 10; P.x = CFG.world.fire + CFG.world.campfireHealRadius + 5; P.inCombat = 0; W.spawnT = 999; W.timer = 999; for (let i = 0; i < 30; i++) step(1 / 60);
  ok(P.hp > 10, 'радиус лечения не вырос');

  // очки за уровень
  fresh(9); const sp0 = P.sp; gainXP(xpNeed(1)); ok(P.lv === 2 && P.sp === sp0 + CFG.skills.pointsPerLevel, 'очко за уровень');
  gainXP(xpNeed(2) + xpNeed(3)); ok(P.lv === 4 && P.sp === sp0 + 3 * CFG.skills.pointsPerLevel, 'очки за несколько уровней подряд');

  // сброс
  fresh(10); P.lv = 5; recalc(); P.sp = 4; learn('vigor', recalc); learn('vigor', recalc); learn('heavy', recalc);
  const cost = respecCost(); ok(cost === CFG.skills.respecBase + CFG.skills.respecPerLevel * 5, 'цена сброса');
  P.ash = cost - 1; ok(respec(recalc) === 'ash' && spentPoints() === 3, 'сброс без пепла');
  P.ash = cost + 3; ok(respec(recalc) === 'ok' && P.ash === 3 && spentPoints() === 0 && P.sp === 4 && P.maxhp === CFG.player.maxHp + 4 * CFG.player.hpPerLevel, `сброс: sp=${P.sp} maxhp=${P.maxhp}`);
  ok(respec(recalc) === 'none', 'повторный сброс');
}

// ---------- 2. задания ----------
{
  // граф заданий корректен
  const ids = new Set(QUESTS.map(q => q.id));
  ok(ids.size === QUESTS.length && QUESTS.length >= 6, 'идентификаторы заданий');
  for (const q of QUESTS) {
    ok(q.title && q.text && q.goal >= 1 && q.reward && (q.reward.ash || q.reward.xp || q.reward.sp || q.reward.item || q.reward.rarity), `задание ${q.id}: поля`);
    ok(!q.after || ids.has(q.after), `задание ${q.id}: after`);
    ok(['kill', 'eclipse', 'equip', 'upgrade', 'level'].includes(q.type), `задание ${q.id}: тип`);
    if (q.reward.item) ok(ITEMS_BY_ID[q.reward.item], `задание ${q.id}: предмет-награда`);
    if (q.type === 'kill') ok(CFG.enemies[q.target], `задание ${q.id}: враг ${q.target}`);
  }
  ok(QUESTS.some(q => q.type === 'kill' && q.target === 'brute' && q.goal === 10), 'нет «убей 10 рогачей»');
  ok(QUESTS.some(q => q.type === 'eclipse'), 'нет «пережди затмение»');

  fresh(20);
  const avail = Q.available().map(q => q.id);
  ok(avail.includes('q_brutes') && avail.includes('q_imps') && avail.includes('q_dress') && !avail.includes('q_eclipse') && !avail.includes('q_three'), 'стартовые задания: ' + avail);
  // лимит активных
  ok(Q.accept('q_brutes') === 'ok' && Q.accept('q_imps') === 'ok' && Q.accept('q_dress') === 'ok', 'взять три');
  ok(Q.accept('q_brutes') === 'taken' && Q.accept('q_eclipse') === 'locked', 'повторно / закрытое');
  fresh(21); for (const id of ['q_brutes', 'q_imps']) Q.accept(id);
  // убийства считаются только у взятых и только нужного типа
  const kill = type => { const e = spawnEnemy(type, 600); e.hp = 0; killEnemy(e); };
  for (let i = 0; i < 9; i++) kill('brute'); kill('imp'); kill('lord');
  ok(Q.stateOf('q_brutes').n === 9 && Q.stateOf('q_brutes').st === 'active' && Q.stateOf('q_imps').n === 1, `прогресс убийств ${Q.stateOf('q_brutes').n}/${Q.stateOf('q_imps').n}`);
  ok(Q.tracker() && Q.tracker().text === 'Рогачи у границы: 9/10' && !Q.tracker().ready, 'трекер: ' + JSON.stringify(Q.tracker()));
  kill('brute');
  ok(Q.stateOf('q_brutes').st === 'done' && Q.readyToClaim().length === 1 && Q.tracker().ready, 'выполнение');
  kill('brute'); ok(Q.stateOf('q_brutes').n === 10, 'прогресс не превышает цель');
  // награда
  const ash0 = P.ash, xp0 = P.xp + P.lv * 1000;
  const text = Q.claim('q_brutes', grantReward);
  ok(text && text.includes('пепла') && P.ash === ash0 + QUESTS_BY_ID.q_brutes.reward.ash, 'награда пеплом: ' + text);
  ok(Q.claim('q_brutes', grantReward) === null && Q.claim('q_imps', grantReward) === null, 'повторная/невыполненная сдача');
  ok(Q.stateOf('q_brutes').st === 'claimed' && Q.available().some(q => q.id === 'q_eclipse'), 'следующее задание открылось');
  ok(W.chatLog.some(m => m.text.includes('Награда за')), 'нет сообщения о награде');

  // «пережди затмение»: считается, только если не падал
  fresh(22); Q.stateOf('q_brutes'); P.quests.q_brutes = { st: 'claimed', n: 10 }; Q.accept('q_eclipse');
  spawnBoss(); ok(W.eclipseDied === false, 'сброс флага падения');
  die(); ok(W.eclipseDied === true, 'падение во время Предвестника');
  P.dead = false; P.hp = P.maxhp;
  let b = W.boss; b.hp = 0; killEnemy(b);
  ok(Q.stateOf('q_eclipse').st === 'active' && Q.stateOf('q_eclipse').n === 0, 'затмение засчитано при падении');
  spawnBoss(); b = W.boss; b.hp = 0; killEnemy(b);
  ok(Q.stateOf('q_eclipse').st === 'done', 'затмение не засчитано без падения');
  const sp0 = P.sp; Q.claim('q_eclipse', grantReward); ok(P.sp === sp0 + 1, 'награда — очко навыка');

  // состоятельные: уровень, экипировка, улучшение
  fresh(23); P.quests.q_imps = { st: 'claimed', n: 15 }; P.quests.q_lords = { st: 'claimed', n: 2 }; P.quests.q_dress = { st: 'claimed', n: 3 };
  Q.accept('q_level5'); Q.accept('q_forge');
  ok(Q.stateOf('q_level5').n === 1, 'уровень 1 учтён сразу');
  gainXP(xpNeed(1) + xpNeed(2) + xpNeed(3) + xpNeed(4)); ok(P.lv === 5 && Q.stateOf('q_level5').st === 'done', 'задание на уровень');
  giveItem(newItem('w_bone_edge')); equipFromBag(0); P.ash = 99999;
  for (let i = 0; i < 40 && Q.stateOf('q_forge').st === 'active'; i++) tryUpgrade(P.eq.weapon);
  ok(Q.stateOf('q_forge').st === 'done' && P.eq.weapon.up >= 3, 'задание на улучшение');
  fresh(24); Q.accept('q_dress'); for (const id of ['h_iron_helm', 'b_leather_vest', 'c_wanderer']) { giveItem(newItem(id)); equipFromBag(P.bag.length - 1); }
  ok(Q.stateOf('q_dress').st === 'done', 'задание на слоты');
  const textItem = Q.claim('q_dress', grantReward); ok(textItem.includes('Железный шлем') && P.bag.some(i => i.id === 'h_iron_helm'), 'награда-предмет: ' + textItem);
  // награда по редкости и при полной сумке
  fresh(25); for (let i = 0; i < CFG.items.bagSize; i++) giveItem(newItem('r_copper'));
  const t2 = grantReward({ ash: 5, rarity: 'rare' }); ok(t2.includes('продано') && P.bag.length === CFG.items.bagSize, 'награда при полной сумке: ' + t2);
  fresh(26); grantReward({ rarity: 'cursed' }); ok(P.bag.length === 1 && ITEMS_BY_ID[P.bag[0].id].rarity === 'cursed', 'награда редкости');
  // трекер пуст
  fresh(27); ok(Q.tracker() === null, 'пустой трекер');
}

// ---------- 3. сохранение ----------
{
  // круговой обмен
  fresh(30); P.lv = 7; P.xp = 12; P.ash = 1234; P.kills = 77; P.sp = 3; W.cycle = 2;
  P.skills = { heavy: 2, chain: 1, vigor: 3 };
  giveItem(newItem('w_bone_edge')); giveItem(newItem('h_horned_helm')); giveItem(newItem('r_silver')); equipFromBag(0); P.eq.weapon.up = 4; recalc();
  restock(); const shopIds = stock().map(e => e.item.id).join();
  P.quests = { q_brutes: { st: 'claimed', n: 10 }, q_imps: { st: 'active', n: 6 }, q_eclipse: { st: 'done', n: 1 } };
  const store = fakeStorage(); const saver = createSaver(store);
  ok(saver.write() && store.m.has(CFG.save.key), 'запись');
  const raw = store.m.get(CFG.save.key); ok(raw.length < 4000, 'размер сохранения ' + raw.length);
  const expect = { lv: P.lv, xp: P.xp, ash: P.ash, kills: P.kills, sp: P.sp, bag: P.bag.map(i => i.id + ':' + i.up).join(), eq: SLOTS.map(s => P.eq[s] ? P.eq[s].id + ':' + P.eq[s].up : '-').join(), skills: JSON.stringify(P.skills), quests: JSON.stringify(P.quests), maxhp: P.maxhp, dmg: derived().dmg, cycle: W.cycle };
  resetState(); P.quests = {};
  const r = saver.load(); ok(r.data && !r.error && !r.migrated, 'загрузка: ' + JSON.stringify(r.error));
  applySave(r.data);
  const got = { lv: P.lv, xp: P.xp, ash: P.ash, kills: P.kills, sp: P.sp, bag: P.bag.map(i => i.id + ':' + i.up).join(), eq: SLOTS.map(s => P.eq[s] ? P.eq[s].id + ':' + P.eq[s].up : '-').join(), skills: JSON.stringify(P.skills), quests: JSON.stringify(P.quests), maxhp: P.maxhp, dmg: derived().dmg, cycle: W.cycle };
  for (const k of Object.keys(expect)) ok(expect[k] === got[k], `круговой обмен: ${k}: ${expect[k]} ≠ ${got[k]}`);
  ok(stock().map(e => e.item.id).join() === shopIds, 'ассортимент не сохранился');
  ok(P.hp === P.maxhp && P.x === CFG.world.fire + CFG.world.startOffset && !P.dead, 'после загрузки герой у костра со здоровьем');
  ok(new Set([...P.bag, ...Object.values(P.eq).filter(Boolean)].map(i => i.uid)).size === P.bag.length + Object.values(P.eq).filter(Boolean).length, 'uid предметов после загрузки не уникальны');
  const nu = newItem('r_copper'); ok(![...P.bag, ...Object.values(P.eq)].filter(Boolean).some(i => i.uid === nu.uid), 'новый uid совпал с загруженным');

  // пустое хранилище
  ok(createSaver(fakeStorage()).load().data === null && createSaver(fakeStorage()).peek() === null, 'пустое хранилище');
  ok(createSaver(store).peek().lv === 7, 'peek');

  // миграции
  const mig = { 1: d => ({ ...d, P: { ...d.P, extra: 'a' } }), 2: d => { d.P.extra += 'b'; return d; } };
  const m3 = migrate({ v: 1, P: { lv: 3 } }, { version: 3, migrations: mig });
  ok(m3.v === 3 && m3.P.extra === 'ab' && m3.P.lv === 3, 'цепочка миграций: ' + JSON.stringify(m3));
  const orig = { v: 1, P: { lv: 3 } }; migrate(orig, { version: 2, migrations: mig }); ok(orig.v === 1 && orig.P.extra === undefined, 'миграция портит исходный объект');
  let err = null; try { migrate({ v: 5 }, { version: 2, migrations: mig }); } catch (e) { err = e.message; } ok(err && err.includes('новой версией'), 'сохранение из будущего: ' + err);
  err = null; try { migrate({ v: 1 }, { version: 3, migrations: { 1: d => d } }); } catch (e) { err = e.message; } ok(err && err.includes('миграции с v2'), 'нет миграции: ' + err);
  err = null; try { migrate({ P: {} }); } catch (e) { err = e.message; } ok(err, 'без версии');
  err = null; try { migrate({ v: 1 }, { version: 2, migrations: { 1: () => null } }); } catch (e) { err = e.message; } ok(err, 'миграция вернула null');
  ok(VERSION >= 1 && Object.keys(MIGRATIONS).every(k => Number(k) < VERSION), 'миграции указывают на будущие версии');

  // повреждённые данные: не падаем, копия сохраняется
  const bad = fakeStorage(); bad.m.set(CFG.save.key, '{"v":1,"P":{broken');
  const rb = createSaver(bad).load(); ok(rb.data === null && rb.error && bad.m.get(CFG.save.backupKey) === '{"v":1,"P":{broken', 'повреждённый JSON: копия не сохранена');
  const fut = fakeStorage(); fut.m.set(CFG.save.key, JSON.stringify({ v: 99, P: {} }));
  const rf = createSaver(fut).load(); ok(rf.data === null && rf.error && fut.m.has(CFG.save.backupKey), 'сохранение из будущего без копии');
  const arr = fakeStorage(); arr.m.set(CFG.save.key, '[1,2,3]'); ok(createSaver(arr).load().data === null, 'массив вместо объекта');
  for (const junk of ['null', '42', '"str"', '{}', '{"v":"1"}']) { const s = fakeStorage(); s.m.set(CFG.save.key, junk); const x = createSaver(s).load(); ok(x.data === null, 'мусор ' + junk + ' принят'); }

  // очистка значений
  const dirty = sanitize({ v: 1, P: { lv: 500, xp: -5, ash: 'много', kills: NaN, sp: 1e9, skills: { heavy: 99, нет: 3, chain: -2 }, bag: [{ id: 'нет такого' }, null, { id: 'w_bone_edge', up: 99 }, { id: 'h_iron_helm', up: 5 }, 7],
    eq: { weapon: { id: 'h_iron_helm' }, head: { id: 'h_iron_helm', up: 3 }, body: null, cloak: 'x' }, quests: { q_brutes: { st: 'active', n: 999 }, q_imps: { st: 'взломано', n: 3 }, нет: { st: 'done' }, q_eclipse: { st: 'done', n: 0 } } },
    W: { cycle: -4, shop: ['r_copper', 'нет', 'c_sackcloth'] } });
  ok(dirty.lv === 99 && dirty.xp === 0 && dirty.ash === 0 && dirty.kills === 0 && dirty.sp === 99, 'очистка чисел: ' + JSON.stringify([dirty.lv, dirty.xp, dirty.ash, dirty.kills, dirty.sp]));
  ok(JSON.stringify(dirty.skills) === '{"heavy":3}', 'очистка навыков ' + JSON.stringify(dirty.skills));
  ok(dirty.bag.length === 2 && dirty.bag[0].up === CFG.smith.maxLevel && dirty.bag[1].up === 0, 'очистка сумки ' + JSON.stringify(dirty.bag));
  ok(dirty.eq.weapon === null && dirty.eq.head && dirty.eq.head.up === 0 && dirty.eq.cloak === null, 'очистка экипировки (чужой слот) ' + JSON.stringify(dirty.eq));
  ok(dirty.quests.q_brutes.n === QUESTS_BY_ID.q_brutes.goal - 1 && !dirty.quests.q_imps && !dirty.quests['нет'] && dirty.quests.q_eclipse.n === 1, 'очистка заданий ' + JSON.stringify(dirty.quests));
  ok(dirty.cycle === 0 && dirty.shop.join() === 'r_copper,c_sackcloth', 'очистка мира');
  const full = sanitize({ v: 1, P: { bag: Array.from({ length: 99 }, () => ({ id: 'r_copper' })) } }); ok(full.bag.length === CFG.items.bagSize, 'переполненная сумка');
  // применение «грязного» сохранения не ломает игру
  resetState(); applySave(dirty); ok(Number.isFinite(P.maxhp) && P.hp === P.maxhp && P.lv === 99, 'применение очищенного');
  for (let i = 0; i < 100; i++) step(1 / 60);

  // хранилище недоступно или переполнено
  const tw = createSaver(fakeStorage({ setThrows: true })); fresh(31); ok(tw.write() === false && tw.status.error.includes('Quota'), 'запись при переполнении не упала');
  const tg = createSaver(fakeStorage({ getThrows: true })); ok(tg.load().data === null && tg.load().error, 'чтение при запрете не упало');
  const none = createSaver(null); ok(none.write() === false && none.load().data === null && none.status.available === false, 'нет хранилища');
  none.tick(100); none.reset();

  // автосохранение
  const st = fakeStorage(), sv = createSaver(st); fresh(32); W.started = false;
  sv.tick(CFG.save.interval + 1); ok(!st.m.has(CFG.save.key), 'сохранение до начала игры'); W.started = true;
  sv.tick(CFG.save.interval - 1); ok(!st.m.has(CFG.save.key), 'рано сохранилось'); sv.tick(2); ok(st.m.has(CFG.save.key), 'нет автосохранения по таймеру');
  const t1 = st.m.get(CFG.save.key); P.ash = 4321; sv.request(); sv.tick(.5); ok(st.m.get(CFG.save.key) === t1 || JSON.parse(st.m.get(CFG.save.key)).P.ash !== 4321, 'сохранение чаще minGap');
  sv.tick(CFG.save.minGap); ok(JSON.parse(st.m.get(CFG.save.key)).P.ash === 4321, 'сохранение по запросу');
  sv.reset(); ok(!st.m.has(CFG.save.key) && !st.m.has(CFG.save.backupKey), 'сброс');
  // миграция с резервной копией через load
  const old = fakeStorage(); old.m.set(CFG.save.key, JSON.stringify({ v: VERSION, P: { lv: 3 } }));
  ok(createSaver(old).load().data.lv === 3 && !old.m.has(CFG.save.backupKey), 'актуальный формат без копии');
}

// ---------- 4. совместимость с остальным ----------
{
  // шина событий не накапливает подписчиков и бот с навыками не ломает симуляцию
  fresh(40); P.sp = 20; for (const id of ['heavy', 'chain', 'crit', 'brandGain', 'brandDur', 'vigor', 'fireHeal', 'swift']) learn(id, recalc);
  Q.accept('q_brutes'); Q.accept('q_imps'); Q.accept('q_dress');
  W.started = true;
  for (let i = 0; i < 6000; i++) { keys.r = i % 200 < 150; keys.atk = i % 3 === 0; keys.jump = i % 90 === 0; step(1 / 60); if (P.dead) { P.dead = false; P.hp = P.maxhp; } }
  ok(Number.isFinite(P.hp) && Number.isFinite(P.maxhp), 'симуляция с навыками и заданиями');
}

if (fails.length) { console.error('\nПРОВАЛ (прогресс):\n' + fails.slice(0, 30).join('\n')); process.exit(1); }
console.log(`Прогресс: OK (навыков ${SKILL_IDS.length}, рангов ${TOTAL_RANKS}, заданий ${QUESTS.length}, версия сохранения ${VERSION})`);
