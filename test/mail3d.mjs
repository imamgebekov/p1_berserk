// Почта и гильдия: письма, вложения, итоги аукциона, приглашение, чат, ответы ботов, сохранение
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
import { CFG3 } from '../3d/src/config3d.js';
import { send, take, remove, readLetter, unread, mailOnEvent, mailTick, joinGuild, leaveGuild, say, membersOf, inGuild, guildStats, guildList, myGuild, mailOf, serializeMail, sanitizeMail, hasAtt } from '../3d/src/mail3d.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗', m); } };
const mk = seed => { const W = createWorld(CFG3, mulberry32(seed)); W.wantBots = true; W.player.maxhp = W.player.hp = 1e9; step(W, 1 / 30, {}); W.enemies.length = 0; return W; };

{ const W = mk(3); W.player.x = 50; W.player.z = 50; W.ev.length = 0;
  const l = send(W, { from: 'Тест', subj: 'Привет', text: 'Текст', ash: 30, items: [{ id: 'p_heal3', n: 2 }] });
  ok(unread(W) === 1 && hasAtt(l) && W.ev.some(v => v.k === 'mail'), 'письмо не пришло');
  const a0 = W.inv.ash; ok(take(W, l.id) === 'ok' && W.inv.ash === a0 + 30 && !hasAtt(l) && l.read, 'вложение не выдано');
  ok(take(W, l.id) === 'empty', 'вложение выдано дважды');
  const l2 = send(W, { from: 'Т', subj: 'Враг', ash: 5 }); const e = { dead: false, alert: true, x: W.player.x + 3, z: W.player.z }; W.enemies.push(e); ok(take(W, l2.id) === 'danger', 'вложение рядом с врагом'); e.dead = true;
  ok(remove(W, l2.id) === 'att', 'письмо с вложением удалено'); ok(take(W, l2.id) === 'ok' && remove(W, l2.id) === 'ok', 'пустое письмо не удалено');
  const l3 = send(W, { from: 'Т', subj: 'Место', ash: 5 }); W.lvl = 'inst_brod'; ok(take(W, l3.id) === 'place', 'вложение в подземелье'); W.lvl = 'surface';
  const full = send(W, { from: 'Т', subj: 'Полная', items: [{ id: 'p_heal3', n: 1 }] }); const slots = W.cfg.bag.slots; const keep = W.inv.bag; W.inv.bag = Array.from({ length: slots }, (_, i) => ({ id: 'sword_iron_' + i, n: 1 })); ok(take(W, full.id) === 'full' || take(W, full.id) === 'ok', 'сумка полна: нет ответа'); W.inv.bag = keep; }
// предел ящика
{ const W = mk(4), K = CFG3.mail; for (let i = 0; i < K.max + 15; i++) send(W, { from: 'Т', subj: 'п' + i, text: 'x' }); ok(mailOf(W).box.length <= K.max, 'ящик растёт без предела'); }
// итоги аукциона → письма
{ const W = mk(5); W.ev.length = 0; mailOnEvent(W, { k: 'aucSold', id: 'p_heal3', n: 3, ash: 120, who: 'Сова' }); mailOnEvent(W, { k: 'aucWon', id: 'p_heal3', n: 1 }); mailOnEvent(W, { k: 'aucOutbid', id: 'p_heal3', by: 'Сивый' }); mailOnEvent(W, { k: 'aucExpired', id: 'p_heal3', n: 1 }); mailOnEvent(W, { k: 'die' });
  const b = mailOf(W).box; ok(b.length === 4 && b.every(l => l.from === 'Аукцион' && !hasAtt(l)), 'письма аукциона'); ok(b.some(l => l.text.includes('120')), 'в письме нет выручки'); }
// приветствие и приглашение
{ const W = mk(6); W.t = 0; mailTick(W, 1); ok(mailOf(W).box.length === 0, 'письмо раньше времени'); W.t = CFG3.mail.welcomeAt + 1; mailTick(W, 1); mailTick(W, 1); ok(mailOf(W).box.length === 1, 'приветствие не одно');
  W.lv = CFG3.mail.guild.inviteLv - 1; mailTick(W, 1); ok(mailOf(W).box.length === 1, 'приглашение до срока'); W.lv = CFG3.mail.guild.inviteLv; mailTick(W, 1); mailTick(W, 1);
  const inv = mailOf(W).box.find(l => l.act === 'guild'); ok(inv && mailOf(W).box.length === 2 && membersOf(W).length === CFG3.mail.guild.per * CFG3.mail.guild.list.length, 'приглашение или состав'); }
// гильдия: вступить, чат, ответы, выйти
{ const W = mk(7); W.t = 100; ok(say(W, 0) === 'none', 'чат без гильдии'); const gid = guildList(W)[1].id; ok(joinGuild(W, 'нет') === 'none', 'чужая гильдия'); ok(joinGuild(W, gid) === 'ok' && inGuild(W) && myGuild(W).id === gid && joinGuild(W, gid) === 'have', 'вступление');
  const gift = mailOf(W).box.find(l => l.subj.startsWith('Добро')); ok(gift.from && membersOf(W, gid).some(a => a.name === gift.from), 'письмо не от члена гильдии'); ok(gift && gift.ash === CFG3.mail.guild.gift, 'подарок'); const n0 = mailOf(W).g.log.length;
  let said = 0; for (let i = 0; i < 40; i++) { if (say(W, i % 4) === 'ok') said++; } ok(said === 40 && mailOf(W).g.log.filter(x => x.me).length === 40, 'фразы героя не записаны');
  W.t += 12; mailTick(W, 1); ok(mailOf(W).g.log.some(x => !x.me && membersOf(W, gid).some(a => a.name === x.who)), 'соратники не ответили');
  mailOf(W).g.log.length = 0; const t0 = 0; for (let k = 0; k < 600; k++) { W.t += 1; mailTick(W, 1); } ok(mailOf(W).g.log.length + mailOf(W).world.length > t0 + 8, 'боты не болтают сами'); ok(mailOf(W).world.length > 2 && mailOf(W).world.every(x => /^\[..\] /.test(x.who) || !x.me), 'общий канал пуст'); ok(mailOf(W).g.log.every(x => x.me || membersOf(W, gid).some(a => a.name === x.who) || x.who === myGuild(W).name), 'в чате гильдии чужие');
  ok(mailOf(W).g.log.length <= CFG3.mail.log, 'журнал растёт без предела'); ok(leaveGuild(W) === 'ok' && !inGuild(W) && say(W, 0) === 'none', 'выход'); }
// гильдии: все бот в своих, живут вместе, рейтинг
{ const W = mk(14), L = guildList(W), per = CFG3.mail.guild.per; ok(L.length >= 3, 'мало гильдий');
  for (const g of L) { const m = membersOf(W, g.id); ok(m.length === per, `в «${g.name}» ${m.length} ботов`); ok(m.every(a => a.home === m[0].home), `«${g.name}» живёт в разных местах`); }
  ok(W.bots.some(a => !a.guild), 'нет одиночек'); const st = guildStats(W); ok(st.length === L.length && st.every((g, i) => !i || st[i - 1].lv * 10 + st[i - 1].kills >= g.lv * 10 + g.kills), 'рейтинг не по порядку');
  for (let k = 0; k < 60; k++) step(W, 1 / 20, {}); for (const g of L) { const m = membersOf(W, g.id); ok(m.every(a => Math.hypot(a.x - m[0].x, a.z - m[0].z) < 400), `«${g.name}» разбрелась`); } }
// чат не сдвигает потоки боя и ботов
{ const A = mk(8), B = mk(8); joinGuild(B, guildList(B)[0].id); for (let k = 0; k < 300; k++) { B.t += 1; mailTick(B, 1); } const ra = A.brng(), rb = B.brng(); ok(ra === rb, 'чат сдвинул поток ботов'); const ma = A.rng(), mb = B.rng(); ok(ma === mb, 'чат сдвинул поток боя'); }
// сохранение
{ const W = mk(9); send(W, { from: 'А', subj: 'Б', text: 'В', ash: 7, items: [{ id: 'p_heal3', n: 2 }] }); joinGuild(W, guildList(W)[0].id); say(W, 1); readLetter(W, mailOf(W).box[0].id);
  const back = sanitizeMail(W, JSON.parse(JSON.stringify(serializeMail(W)))); ok(back.box.length === mailOf(W).box.length && back.g.in && back.g.id === mailOf(W).g.id && back.world.length === mailOf(W).world.length && back.g.log.length === mailOf(W).g.log.length && back.id === mailOf(W).id, 'почта не сохранилась');
  const junk = sanitizeMail(W, { id: 'x', welcome: 1, box: [5, null, { id: 3, subj: 7, text: 't', ash: -9, items: [{ id: 'нет', n: 5 }, { id: 'p_heal3', n: 1e9 }], act: 'зло' }, { id: NaN }], world: [{ text: 5 }, { text: 'ок', who: 'я' }], g: { in: 1, id: 'нет', log: [{ text: 'ок' }] } });
  ok(junk.box.length === 1 && junk.box[0].ash === 0 && junk.box[0].items.length === 1 && junk.box[0].items[0].n <= 999 && junk.box[0].act === null && junk.world.length === 1 && !junk.g.in && junk.g.log.length === 0, 'мусор в почте принят'); ok(sanitizeMail(W, null).box.length === 0 && sanitizeMail(W, 'x').g.in === false, 'пустое сохранение'); }
if (bad) { console.log('Почта 3D: упало', bad); process.exit(1); } console.log('Почта 3D: OK');
