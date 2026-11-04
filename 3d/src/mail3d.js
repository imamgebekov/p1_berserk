// Почта и гильдия (2026-11-05, план «расширение мира в стиле WoW»): письма — итоги аукциона, приглашение, подарок; гильдия ботов «Пепельный Круг»
// с общим чатом. Чистая логика (проверяется без браузера), окно — mailui.js. Письма и чат — в W.mail (сохраняются). Болтовня ботов идёт от
// своего потока случайных чисел W.grng, потоки боя и ботов не сдвигаются.
import { BY_ID } from './data/items.js';
import { addItem } from './inv.js';
import { mulberry32 } from './sim.js';
import { len, clamp } from './util3d.js';

export const mailFresh = () => ({ v: 1, box: [], id: 1, welcome: false, invited: false, world: [], g: { in: false, id: null, log: [], t: 0, q: [] } });
export const mailOf = W => W.mail || (W.mail = mailFresh());
const C = W => W.cfg.mail;
const bagMax = W => W.cfg.bag.slots + ((W.gear && W.gear.bag) || 0);
const grng = W => W.grng || (W.grng = mulberry32((W.cfg.world.seed * 7933 + 29) | 0));
const pick = (W, a) => a[Math.floor(grng(W)() * a.length)];
const fmt = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ''));

// ---------- письма ----------
export function send(W, o) {
  const M = mailOf(W), L = { id: M.id++, t: Math.round(W.t * 10) / 10, from: String(o.from || 'Неизвестный').slice(0, 40), subj: String(o.subj || '').slice(0, 60), text: String(o.text || '').slice(0, 400), ash: Math.max(0, Math.floor(o.ash || 0)), items: (o.items || []).slice(0, C(W).itemsMax), act: o.act || null, gid: o.gid || null, read: false, taken: false };
  M.box.unshift(L);
  while (M.box.length > C(W).max) { let i = -1; for (let k = M.box.length - 1; k >= 0 && i < 0; k--) if (M.box[k].read && !hasAtt(M.box[k])) i = k; for (let k = M.box.length - 1; k >= 0 && i < 0; k--) if (!hasAtt(M.box[k])) i = k; if (i < 0) break; M.box.splice(i, 1); }     // ящик полон: уходит старое без вложений, прочитанное раньше
  if (W.ev) W.ev.push({ k: 'mail', from: L.from, subj: L.subj });
  return L;
}
export const hasAtt = L => !L.taken && (L.ash > 0 || (L.items && L.items.length > 0));
export const unread = W => mailOf(W).box.filter(l => !l.read).length;
export const find = (W, id) => mailOf(W).box.find(l => l.id === id) || null;
export function readLetter(W, id) { const l = find(W, id); if (l) l.read = true; return l; }
const safe = W => { for (const e of W.enemies) if (!e.dead && e.alert && len(e.x - W.player.x, e.z - W.player.z) < C(W).safeR) return false; return true; };
export function take(W, id) {
  const l = find(W, id); if (!l) return 'none'; if (!hasAtt(l)) return 'empty';
  if (W.lvl && W.lvl !== 'surface') return 'place'; if (!safe(W)) return 'danger';
  const slots = bagMax(W), left = [];
  for (const e of l.items) if (addItem(W.inv, e.id, e.n || 1, slots) > 0) left.push(e);
  if (left.length === l.items.length && l.items.length) return 'full';
  W.inv.ash += l.ash; l.ash = 0; l.items = left; if (!left.length) l.taken = true; l.read = true;
  W.ev.push({ k: 'mailTake', ash: 0 }); return left.length ? 'part' : 'ok';
}
export function remove(W, id) { const M = mailOf(W), i = M.box.findIndex(l => l.id === id); if (i < 0) return 'none'; if (hasAtt(M.box[i])) return 'att'; M.box.splice(i, 1); return 'ok'; }

// события аукциона → письма-уведомления (вложения остаются у аукциониста: клеймить там)
export function mailOnEvent(W, v) {
  if (!C(W) || !C(W).on) return;
  const nm = id => (BY_ID[id] ? BY_ID[id].name : id), n = v.n > 1 ? ` ×${v.n}` : '';
  if (v.k === 'aucSold') send(W, { from: 'Аукцион', subj: 'Лот продан', text: `«${nm(v.id)}»${n} куплен${v.who ? ': ' + v.who : ''}. Выручка за вычетом комиссии: ${v.ash} пепла. Заберите её у аукциониста.` });
  else if (v.k === 'aucWon') send(W, { from: 'Аукцион', subj: 'Лот выигран', text: `Ваша ставка выиграла: «${nm(v.id)}»${n}. Вещь ждёт у аукциониста.` });
  else if (v.k === 'aucOutbid') send(W, { from: 'Аукцион', subj: 'Ставку перебили', text: `Вашу ставку на «${nm(v.id)}» перебил ${v.by}. Пепел вернулся и ждёт у аукциониста.` });
  else if (v.k === 'aucExpired') send(W, { from: 'Аукцион', subj: 'Лот не продан', text: `«${nm(v.id)}»${n} не нашёл покупателя. Вещь ждёт у аукциониста.` });
}

// ---------- гильдии ----------
const G = W => C(W).guild;
export const guildList = W => G(W).list;
export const guildOf = (W, id) => G(W).list.find(g => g.id === id) || null;
export const myGuild = W => { const g = mailOf(W).g; return g.in ? guildOf(W, g.id) : null; };
export const inGuild = W => !!myGuild(W);
export const membersOf = (W, id) => (W.bots || []).filter(a => a.guild && (!id || a.guild === id));
// ранг гильдии: сумма уровней и убийств членов; список по убыванию
export function guildStats(W) {
  return G(W).list.map(g => { const m = membersOf(W, g.id); return { ...g, members: m.length, online: m.filter(a => !a.dead).length, lv: m.reduce((s, a) => s + a.lv, 0), kills: m.reduce((s, a) => s + (a.kills || 0), 0), me: mailOf(W).g.in && mailOf(W).g.id === g.id }; }).sort((x, y) => y.lv * 10 + y.kills - (x.lv * 10 + x.kills));
}
export function chat(W, who, text, me, ch) {
  const M = mailOf(W), log = ch === 'w' ? M.world : M.g.log, n = ch === 'w' ? C(W).log : C(W).log;
  log.push({ t: Math.round(W.t * 10) / 10, who: String(who).slice(0, 28), text: String(text).slice(0, 140), me: !!me }); while (log.length > n) log.shift();
  if (!me && ch !== 'w' && W.ev) W.ev.push({ k: 'guildChat', who, text });
}
export function joinGuild(W, id) {
  const M = mailOf(W); if (M.g.in) return 'have'; const g = guildOf(W, id); if (!g) return 'none'; if (!membersOf(W, id).length) return 'empty';
  M.g.in = true; M.g.id = id; M.g.t = W.t + 4; M.g.log.length = 0; M.g.q.length = 0;
  chat(W, g.name, 'Герой вступил в гильдию. Добро пожаловать!', false, 'g'); const l = membersOf(W, id)[0];
  send(W, { from: l.name, subj: `Добро пожаловать в «${g.name}»`, text: `Мы — «${g.name}». Держим связь в общем чате гильдии: болтаем, зовём друг друга и делимся новостями. Вот немного пепла на первое время.`, ash: G(W).gift });
  return 'ok';
}
export function leaveGuild(W) { const g = mailOf(W).g; if (!g.in) return 'none'; g.in = false; g.id = null; g.q.length = 0; return 'ok'; }
export function say(W, i) {
  const M = mailOf(W), K = G(W); if (!M.g.in) return 'none'; const t = K.quick[i]; if (!t) return 'none';
  chat(W, 'Вы', t, true, 'g'); if (grng(W)() < K.reply[0]) { const m = membersOf(W, M.g.id).filter(a => !a.dead); if (m.length) { const a = pick(W, m), r = K.replies[i] ? pick(W, K.replies[i]) : pick(W, K.lines.idle), [lo, hi] = K.reply[1]; M.g.q.push({ at: W.t + lo + grng(W)() * (hi - lo), who: a.name, text: r, ch: 'g' }); } }
  return 'ok';
}
// болтовня ботов: любой бот пишет по состоянию; своя гильдия героя — в чат гильдии, остальные — в общий канал; соратник иногда отвечает
function chatter(W) {
  const K = G(W), M = mailOf(W), m = (W.bots || []).filter(a => !a.dead); if (!m.length) return; const a = pick(W, m), mine = M.g.in && a.guild === M.g.id;
  const kind = a.mode === 'rest' ? 'rest' : a.lastLv && a.lastLv !== a.lv ? 'lvl' : grng(W)() < .45 ? 'kill' : 'idle'; a.lastLv = a.lv;
  const tag = a.guild ? `[${guildOf(W, a.guild).tag}] ` : '', text = fmt(pick(W, K.lines[kind]), { lv: a.lv, k: a.kills || 0 });
  if (mine) chat(W, a.name, text, false, 'g'); else if (grng(W)() < K.world) chat(W, tag + a.name, text, false, 'w');
  if (a.guild && grng(W)() < K.follow) { const mates = membersOf(W, a.guild).filter(o => o !== a && !o.dead); if (mates.length) { const b = pick(W, mates), at = W.t + 3 + grng(W)() * 8, tx = pick(W, K.lines.follow); if (mine) M.g.q.push({ at, who: b.name, text: tx, ch: 'g' }); else if (grng(W)() < K.world) M.g.q.push({ at, who: `[${guildOf(W, b.guild).tag}] ${b.name}`, text: tx, ch: 'w' }); } }
}
export function mailTick(W, dt) {
  const K = C(W); if (!K || !K.on) return; const M = mailOf(W);
  if (!M.welcome && W.t > K.welcomeAt) { M.welcome = true; send(W, { from: 'Капитан Бруно', subj: 'Письма и почта', text: 'Письма приходят сюда: итоги аукциона, приглашения, награды. Забрать вложение можно в любом безопасном месте наверху.' }); }
  if (!M.invited && W.lv >= G(W).inviteLv && membersOf(W).length) { M.invited = true; const gs = guildStats(W).filter(g => g.members), g0 = gs[0], a = membersOf(W, g0.id)[0]; send(W, { from: a.name, subj: `Приглашение в «${g0.name}»`, text: `Мы — небольшая гильдия «${g0.name}», слышали о вас. Вступайте: общий чат, советы, иногда подарок. Бесплатно. Есть и другие гильдии — смотрите во вкладке «Гильдия».`, act: 'guild', gid: g0.id }); }
  const g = M.g;
  for (let i = g.q.length - 1; i >= 0; i--) if (g.q[i].at <= W.t) { const x = g.q[i]; if (x.ch === 'w' || g.in) chat(W, x.who, x.text, false, x.ch); g.q.splice(i, 1); }
  if (W.t >= g.t) { if (membersOf(W).length) chatter(W); const [lo, hi] = G(W).chat; g.t = W.t + lo + grng(W)() * (hi - lo) / (g.in ? 1 : 1.6); }
}

// ---------- сохранение ----------
export function serializeMail(W) { const M = mailOf(W); return { v: 1, id: M.id, welcome: M.welcome, invited: M.invited, box: M.box, world: M.world, g: { in: M.g.in, id: M.g.id, log: M.g.log, t: Math.round(M.g.t * 10) / 10 } }; }
export function sanitizeMail(W, d) {
  const M = mailFresh(); if (!d || typeof d !== 'object') return M; const K = C(W), str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  M.welcome = !!d.welcome; M.invited = !!d.invited; M.id = Number.isFinite(d.id) ? clamp(Math.floor(d.id), 1, 1e9) : 1;
  if (Array.isArray(d.box)) for (const l of d.box.slice(0, K.max)) {
    if (!l || typeof l !== 'object' || !Number.isFinite(l.id)) continue; const items = [];
    if (Array.isArray(l.items)) for (const e of l.items.slice(0, K.itemsMax)) if (e && BY_ID[e.id]) items.push({ id: e.id, n: clamp(Math.floor(e.n) || 1, 1, 999) });
    M.box.push({ id: Math.floor(l.id), t: Number.isFinite(l.t) ? l.t : 0, from: str(l.from, 40), subj: str(l.subj, 60), text: str(l.text, 400), ash: Number.isFinite(l.ash) ? clamp(Math.floor(l.ash), 0, 1e9) : 0, items, act: l.act === 'guild' ? 'guild' : null, gid: guildOf(W, l.gid) ? l.gid : null, read: !!l.read, taken: !!l.taken });
    M.id = Math.max(M.id, Math.floor(l.id) + 1);
  }
  const logOf = (src, into) => { if (Array.isArray(src)) for (const x of src.slice(-K.log)) if (x && typeof x.text === 'string') into.push({ t: Number.isFinite(x.t) ? x.t : 0, who: str(x.who, 28), text: str(x.text, 140), me: !!x.me }); };
  logOf(d.world, M.world);
  if (d.g && typeof d.g === 'object') { const gid = guildOf(W, d.g.id) ? d.g.id : null; M.g.in = !!d.g.in && !!gid; M.g.id = M.g.in ? gid : null; M.g.t = Number.isFinite(d.g.t) ? d.g.t : 0; if (M.g.in) logOf(d.g.log, M.g.log); }
  return M;
}
