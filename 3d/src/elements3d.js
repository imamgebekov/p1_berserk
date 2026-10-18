// Стихии и реакции (камни силы, 2026-10-18; таблица согласована владельцем). Семь стихий лежат на враге метками-статусами:
// огонь — горение, лёд — заморозка, вода — «мокрый», молния — «разряд», яд — отравление, кровь — кровотечение, земля — «трещина».
// Новая стихия на враге с другой стихией даёт реакцию из таблицы MIX. Реакция от реакции не срабатывает (W.reacting),
// между реакциями на одном враге — пауза cfg.elements.cd. Случайных чисел нет: сравнение боя с базой не сбивается.
// Числа — в config3d.js → elements. Статусы накладывает status3d.applyStatus; здесь — только реакции и их области.

export const ELEMENTS = ['fire', 'ice', 'water', 'storm', 'venom', 'blood', 'earth'];
export const ELEMENT_NAME = { fire: 'Огонь', ice: 'Лёд', water: 'Вода', storm: 'Молния', venom: 'Яд', blood: 'Кровь', earth: 'Земля' };
export const ELEMENT_COLOR = { fire: '#e2683a', ice: '#8fd0ec', water: '#3f8fd0', storm: '#e9d24a', venom: '#7cc35a', blood: '#c43a4a', earth: '#b08a5c' };
export const ELEM_OF = { burn: 'fire', freeze: 'ice', wet: 'water', shock: 'storm', poison: 'venom', bleed: 'blood', crack: 'earth' };
export const STATUS_OF = Object.fromEntries(Object.entries(ELEM_OF).map(([s, el]) => [el, s]));
// порядок, в котором ищется стихия на враге (заморозка и яд первыми — так было до таблицы)
const LYING = ['freeze', 'poison', 'burn', 'wet', 'shock', 'bleed', 'crack'];
export const mixKey = (a, b) => (ELEMENTS.indexOf(a) <= ELEMENTS.indexOf(b) ? a + '+' + b : b + '+' + a);

// имена смесей (и для книги рецептов): пара стихий → название; одинаковые — усиление стихии в оружии
export const MIX_NAME = {
  'fire+fire': 'Пекло', 'fire+ice': 'Раскол', 'fire+water': 'Пар', 'fire+storm': 'Плазма', 'fire+venom': 'Токсичный взрыв', 'fire+blood': 'Кипящая кровь', 'fire+earth': 'Лава',
  'ice+ice': 'Вечная мерзлота', 'ice+water': 'Гололёд', 'ice+storm': 'Ледяная буря', 'ice+venom': 'Холодный яд', 'ice+blood': 'Кровавые сосульки', 'ice+earth': 'Ледник',
  'water+water': 'Поток', 'water+storm': 'Грозовой поток', 'water+venom': 'Отравленный источник', 'water+blood': 'Кровавый прилив', 'water+earth': 'Трясина',
  'storm+storm': 'Перегрузка', 'storm+venom': 'Нейротоксин', 'storm+blood': 'Разрыв', 'storm+earth': 'Громовой удар',
  'venom+venom': 'Чума', 'venom+blood': 'Гниль', 'venom+earth': 'Ядовитые споры',
  'blood+blood': 'Жажда', 'blood+earth': 'Шипы', 'earth+earth': 'Сейсмика'
};

// что делает смесь (книга рецептов): в оружии — стихия вещи и камень или два камня; на враге — вторая стихия поверх первой
export const MIX_TEXT = {
  'fire+fire': 'Горение сильнее и перекидывается на соседей.', 'fire+ice': 'Огонь по замёрзшему: большой урон, лёд и огонь сходят.',
  'fire+water': 'Облако пара: враги в нём теряют героя и не бьют. Огонь гаснет.', 'fire+storm': 'Молния поджигает соседей цели.',
  'fire+venom': 'Огонь по отравленному: взрыв по площади, тем сильнее, чем больше яда.', 'fire+blood': 'Кровотечение кипит: урон ×1,5, герою немного здоровья.',
  'fire+earth': 'Под целью лужа лавы: жжёт всех, кто в ней стоит.', 'ice+ice': 'Заморозка дольше; замёрзший при смерти разлетается осколками.',
  'ice+water': 'Мокрый замерзает надолго, под ним гололёд — враги вокруг медленнее.', 'ice+storm': 'Молния прыгает ещё на двоих и замедляет каждого.',
  'ice+venom': 'Яд не спадает, пока цель заморожена или замедлена.', 'ice+blood': 'Кровоточащий выпускает ледяные шипы: урон всем рядом.',
  'ice+earth': 'Лёд раскалывается: урон цели, оглушение всем рядом.', 'water+water': 'Удар отбрасывает сильнее и смывает с героя горение и яд.',
  'water+storm': 'Молния бьёт по цепочке всех мокрых рядом. В дождь мокрые все.', 'water+venom': 'Под целью лужа яда: травит каждого, кто в ней.',
  'water+blood': 'Вампиризм вдвое выше по мокрым и кровоточащим.', 'water+earth': 'Трясина: враги рядом в корнях, потом медленнее.',
  'storm+storm': 'Молния делает ещё три прыжка.', 'storm+venom': 'Разряд по отравленному оглушает, дольше при большем яде.',
  'storm+blood': 'Разряд вскрывает кровотечение: весь его урон сразу.', 'storm+earth': 'Молния в землю: урон и оглушение вокруг цели.',
  'venom+venom': 'Яд со всеми зарядами перекидывается на соседей при смерти.', 'venom+blood': 'Гниль: яд и кровь бьют сильнее, цель медленнее.',
  'venom+earth': 'Облако спор: яд на всех рядом.', 'blood+blood': 'Вампиризм выше, добивание лечит.',
  'blood+earth': 'Шипы из земли: урон и корни вокруг.', 'earth+earth': 'Трещина глубже: враг получает больше урона; тяжёлый удар оглушает.'
};

const len = (x, z) => Math.sqrt(x * x + z * z);
const hpd = (W, e, frac, base) => Math.round(base + Math.min(e.maxhp * frac, W.cfg.elements.hpCap));     // доля здоровья — не больше hpCap
const dmgOf = (W, e, hp) => hpd(W, e, hp[0], hp[1]);
const around = (W, e, r, self = false) => {
  const out = [], max = W.cfg.elements.max;
  for (const o of W.enemies) { if (o.dead || (!self && o === e)) continue; if (len(o.x - e.x, o.z - e.z) < r + W.cfg.enemies[o.type].radius) { out.push(o); if (out.length >= max) break; } }
  return out;
};
const drop = (e, k) => { if (e.st) { delete e.st[k]; if (!Object.keys(e.st).length) delete e.st; } };
const event = (W, e, key, extra) => W.ev.push({ k: 'react', name: MIX_NAME[key], key, x: e.x, z: e.z, ...extra });
const stunFor = (W, e, t) => (e.boss ? Math.min(t, W.cfg.elements.bossStun) : t);
const zone = (W, kind, e, Z, extra) => W.ezones.push({ kind, x: e.x, z: e.z, r: Z.r, t: Z.t, tick: Z.tick || .25, acc: 0, lvl: W.lvl, ...extra });

// мокрый ли враг для молнии: метка «мокрый» или сильный дождь
export const isWet = (W, e) => !!(e.st && e.st.wet) || (W.rain || 0) >= W.cfg.elements.rainWet;

// реакции: lying — статус, что лежал на враге; kind — новый статус; v — { dps, dur }. Вернёт true — новый статус не накладывать.
// ap(e, kind, dps, dur) — наложить статус без реакции
const MIX = {
  'fire+ice'(W, e, lying) { drop(e, lying); W.fx.react(e, 'Раскол', dmgOf(W, e, W.cfg.elements.mix.shatter.hp)); return true; },     // без таблицы — прежние 36 + 7%
  'fire+venom'(W, e, lying) { const n = e.st && e.st.poison ? e.st.poison.n : 1; drop(e, lying); W.fx.react(e, 'Токсичный взрыв', 0, { r: 3.2, d: 12 * n }); return true; },
  'fire+water'(W, e, lying, kind, v, ap, M) { drop(e, 'burn'); drop(e, 'wet'); zone(W, 'steam', e, M.steam); event(W, e, 'fire+water', { r: M.steam.r }); return true; },
  'fire+storm'(W, e, lying, kind, v, ap, M) {
    const P = M.plasma; let n = 0; event(W, e, 'fire+storm');
    for (const o of around(W, e, P.r)) { if (n++ >= P.n) break; W.ev.push({ k: 'chain', x: e.x, z: e.z, x2: o.x, z2: o.z }); ap(o, 'burn', P.dps, P.t); }
    return false;
  },
  'fire+blood'(W, e, lying, kind, v, ap, M) {
    if (kind === 'bleed') v.dps *= M.boil.k; else if (!e.st.bleed.boil) { e.st.bleed.dps *= M.boil.k; e.st.bleed.boil = true; }     // кровотечение кипит
    const p = W.player; if (!p.dead) p.hp = Math.min(p.maxhp, p.hp + M.boil.heal); event(W, e, 'fire+blood'); return false;
  },
  'fire+earth'(W, e, lying, kind, v, ap, M) { drop(e, 'crack'); zone(W, 'lava', e, M.lava); event(W, e, 'fire+earth', { r: M.lava.r }); return false; },
  'ice+water'(W, e, lying, kind, v, ap, M) {
    const G = M.glaze; drop(e, 'wet'); zone(W, 'glaze', e, G); event(W, e, 'ice+water', { r: G.r });
    if (kind === 'freeze') { v.dur *= G.k; return false; }     // мокрый замерзает надолго
    e.st.freeze.t *= G.k; return true;                         // вода на замёрзшего: лёд крепче
  },
  'ice+storm'(W, e, lying, kind, v, ap, M) {
    const I = M.icestorm, dmg = Math.max(1, Math.round((kind === 'shock' ? v.dps : dmgOf(W, e, M.torrent.hp)) * I.k)); let n = 0; event(W, e, 'ice+storm');
    for (const o of around(W, e, I.r)) { if (n++ >= I.n) break; W.ev.push({ k: 'chain', x: e.x, z: e.z, x2: o.x, z2: o.z }); W.fx.deal(o, dmg, 'storm'); if (!o.dead) ap(o, 'slow', M.glaze.slow, I.slow); }
    ap(e, 'slow', M.glaze.slow, I.slow); return kind === 'shock';
  },
  'ice+venom'(W, e, lying, kind, v) { if (kind === 'poison') v.hold = true; else e.st.poison.hold = true; event(W, e, 'ice+venom'); return false; },
  'ice+blood'(W, e, lying, kind, v, ap, M) { const S = M.shards, d = dmgOf(W, e, S.hp); drop(e, 'bleed'); event(W, e, 'ice+blood', { r: S.r });
    for (const o of around(W, e, S.r)) W.fx.deal(o, d, 'frost'); return kind === 'bleed'; },
  'ice+earth'(W, e, lying, kind, v, ap, M) { const G = M.glacier; drop(e, 'freeze'); drop(e, 'crack'); event(W, e, 'ice+earth', { r: G.r });
    W.fx.deal(e, dmgOf(W, e, G.hp), 'frost'); for (const o of around(W, e, G.r, true)) if (!o.dead) ap(o, 'stun', 0, stunFor(W, o, G.stun)); return true; },
  'water+storm'(W, e, lying, kind, v, ap, M) {
    const T = M.torrent, dmg = Math.max(1, Math.round((kind === 'shock' ? v.dps : dmgOf(W, e, T.hp)) * T.k)); event(W, e, 'water+storm', { r: T.r });
    let from = e; for (const o of around(W, e, T.r)) if (isWet(W, o)) { W.ev.push({ k: 'chain', x: from.x, z: from.z, x2: o.x, z2: o.z }); W.fx.deal(o, dmg, 'storm'); from = o; }
    return false;
  },
  'water+venom'(W, e, lying, kind, v, ap, M) { zone(W, 'spring', e, M.spring); event(W, e, 'water+venom', { r: M.spring.r }); return false; },
  'water+blood'(W, e) { event(W, e, 'water+blood'); return false; },
  'water+earth'(W, e, lying, kind, v, ap, M) { const B = M.bog; drop(e, 'wet'); zone(W, 'bog', e, B); event(W, e, 'water+earth', { r: B.r });
    for (const o of around(W, e, B.r, true)) ap(o, 'root', 0, B.root); return false; },
  'storm+venom'(W, e, lying, kind, v, ap, M) { const n = e.st.poison ? e.st.poison.n : 1; event(W, e, 'storm+venom'); ap(e, 'stun', 0, stunFor(W, e, Math.min(M.neuro.max, M.neuro.per * n))); return false; },
  'storm+blood'(W, e, lying, kind, v) { const s = e.st.bleed || (kind === 'bleed' ? { dps: v.dps, t: v.dur } : null); drop(e, 'bleed'); event(W, e, 'storm+blood');
    if (s) W.fx.deal(e, Math.max(1, Math.round(s.dps * s.t)), 'blood'); return kind === 'bleed'; },
  'storm+earth'(W, e, lying, kind, v, ap, M) { const T = M.thunder, d = dmgOf(W, e, T.hp); drop(e, 'crack'); event(W, e, 'storm+earth', { r: T.r });
    for (const o of around(W, e, T.r, true)) { W.fx.deal(o, d, 'storm'); if (!o.dead) ap(o, 'stun', 0, stunFor(W, o, T.stun)); } return kind === 'crack'; },
  'venom+blood'(W, e, lying, kind, v, ap, M) { event(W, e, 'venom+blood'); ap(e, 'slow', M.rot.slow, kind === 'poison' ? v.dur : e.st.poison.t); return false; },
  'venom+earth'(W, e, lying, kind, v, ap, M) { const S = M.spores; drop(e, 'crack'); event(W, e, 'venom+earth', { r: S.r });
    for (const o of around(W, e, S.r)) ap(o, 'poison', S.poison[0], S.poison[1]); return kind === 'crack'; },
  'blood+earth'(W, e, lying, kind, v, ap, M) { const T = M.thorns, d = dmgOf(W, e, T.hp); drop(e, 'crack'); event(W, e, 'blood+earth', { r: T.r });
    for (const o of around(W, e, T.r, true)) { W.fx.deal(o, d, 'blood'); if (!o.dead) ap(o, 'root', 0, T.root); } return kind === 'crack'; }
};

// найти и провести реакцию; вернёт true — новый статус не накладывать. v — { dps, dur }, их реакция может поменять
export function react(W, e, kind, v, ap) {
  const C = W.cfg.elements, el = ELEM_OF[kind]; if (!el || W.reacting) return false;
  if ((e.rcd || 0) > W.t) return false;
  for (const s of LYING) {
    const other = ELEM_OF[s];
    if (other === el) continue;
    const lying = (e.st && e.st[s]) || (s === 'wet' && el === 'storm' && isWet(W, e) ? true : null); if (!lying) continue;
    const key = mixKey(el, other), fn = MIX[key]; if (!fn) continue;
    if (!e.st) e.st = {};
    W.reacting = true; e.rcd = W.t + (e.boss ? C.bossCd : C.cd);
    try { return fn(W, e, s, kind, v, ap, C.mix); } finally { W.reacting = false; }
  }
  return false;
}

// области реакций: пар (враги в нём не видят героя), лава, гололёд и трясина (замедляют), отравленный источник
export function tickZones(W, dt, ap) {
  if (!W.ezones || !W.ezones.length) return;
  const M = W.cfg.elements.mix;
  W.ezones = W.ezones.filter(z => z.lvl === W.lvl && z.t > 0);
  W.reacting = true;
  try {
    for (const z of W.ezones) {
      z.t -= dt; z.acc += dt; if (z.acc < z.tick) continue;
      const k = z.acc; z.acc = 0;
      for (const o of W.enemies) {
        if (o.dead || len(o.x - z.x, o.z - z.z) > z.r + W.cfg.enemies[o.type].radius) continue;
        if (z.kind === 'steam') ap(o, 'blind', 0, .4);
        else if (z.kind === 'lava') { W.fx.deal(o, Math.max(1, Math.round(M.lava.dps * k)), 'fire'); if (!o.dead) ap(o, 'burn', M.lava.burn[0], M.lava.burn[1]); }
        else if (z.kind === 'glaze' || z.kind === 'bog') ap(o, 'slow', M[z.kind].slow, .4);
        else if (z.kind === 'spring' && !(o.st && o.st.poison && o.st.poison.t > M.spring.poison[1] - k)) ap(o, 'poison', M.spring.poison[0], M.spring.poison[1]);
      }
    }
  } finally { W.reacting = false; }
}
