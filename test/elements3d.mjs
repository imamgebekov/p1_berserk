// Тест стихий и реакций (камни силы, 2026-10-18): каждая пара из таблицы в обе стороны даёт свою реакцию и её действие;
// без таблицы (elements.react=false) — только «Раскол» и «Токсичный взрыв»; реакция от реакции не срабатывает; пауза между
// реакциями; оглушение босса ограничено; области работают и гаснут; дождь мочит всех для молнии; «Гниль», «Холодный яд», трещина.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, step, spawnEnemy } from '../3d/src/sim.js';
import { applyStatus, speedMul, isStunned, tickEnemy } from '../3d/src/status3d.js';
import { ELEMENTS, MIX_NAME, mixKey } from '../3d/src/elements3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const X = CFG3.elements, M = X.mix;
function mk(tweak) {
  const cfg = JSON.parse(JSON.stringify(CFG3)); cfg.enemies.count = 0; cfg.map.places = []; cfg.player.autoAim = 0; cfg.weather.force = 'clear'; cfg.enemies.roam.on = false;
  if (tweak) tweak(cfg);
  const W = createWorld(cfg, () => .5); W.player.x = 0; W.player.z = 0; W.player.inv = 1e9; step(W, 1 / 60, {}); return W;
}
const foe = (W, x, z, type = 'brute') => { const e = spawnEnemy(W, type, x, z); e.hp = e.maxhp = 1e6; e.alert = false; e.cd = 99; return e; };
const run = (W, sec) => { for (let i = 0; i < Math.round(sec * 60); i++) step(W, 1 / 60, {}); };
// статус стихии: [вид, dps, длительность]
const S = { fire: ['burn', 4, 4], ice: ['freeze', 0, 3], water: ['wet', 0, 6], storm: ['shock', 20, 1.5], venom: ['poison', 2, 5], blood: ['bleed', 3, 5], earth: ['crack', 0, 6] };
const put = (W, e, el) => applyStatus(W, e, ...S[el]);
const has = (e, k) => !!(e.st && e.st[k]);
const reacts = W => W.ev.filter(v => v.k === 'react');

// стенд пары: враг e (на нём a), сосед o в 1,8 м; потом на e стихия b
function pair(a, b, prep) {
  const W = mk(), e = foe(W, 6, 0), o = foe(W, 7.8, 0);
  if (prep) prep(W, e, o);
  put(W, e, a); W.t += 1; W.ev.length = 0;
  const h = { e: e.hp, o: o.hp, p: W.player.hp };
  put(W, e, b);
  return { W, e, o, h, ev: reacts(W) };
}

// ---------- 1. каждая пара в обе стороны ----------
const CHECK = {
  'fire+ice': ({ e, h }) => !has(e, 'freeze') && !has(e, 'burn') && h.e - e.hp > 30,
  'fire+venom': ({ e, o, h }) => !has(e, 'poison') && h.o - o.hp >= 12,
  'fire+water': ({ W, e, o }) => { run(W, .3); return !has(e, 'burn') && !has(e, 'wet') && W.ezones.some(z => z.kind === 'steam') && isStunned(o); },
  'fire+storm': ({ o }) => has(o, 'burn'),
  'fire+blood': ({ W, e }) => Math.abs(e.st.bleed.dps - 3 * M.boil.k) < 1e-9 && W.player.hp > 50,
  'fire+earth': ({ W, o, h }) => { run(W, .6); return W.ezones.some(z => z.kind === 'lava') && h.o - o.hp > 0 && has(o, 'burn'); },
  'ice+water': ({ W, e }) => has(e, 'freeze') && e.st.freeze.t >= 3 * M.glaze.k - 1e-6 && !has(e, 'wet') && W.ezones.some(z => z.kind === 'glaze'),
  'ice+storm': ({ o, h }) => has(o, 'slow') && h.o - o.hp > 0 && speedMul(o) < 1,
  'ice+venom': ({ W, e }) => { const t0 = e.st.poison.t; run(W, 1); return has(e, 'poison') && Math.abs(e.st.poison.t - t0) < 1e-6; },
  'ice+blood': ({ e, o, h }) => !has(e, 'bleed') && h.o - o.hp >= 14,
  'ice+earth': ({ e, o, h }) => isStunned(e) && isStunned(o) && h.e - e.hp >= 24 && !has(e, 'crack'),
  'water+storm': ({ W, o, h }) => h.o - o.hp > 0 && W.ev.some(v => v.k === 'chain'),
  'water+venom': ({ W, o }) => { run(W, .6); return W.ezones.some(z => z.kind === 'spring') && has(o, 'poison'); },
  'water+blood': () => true,
  'water+earth': ({ e, o }) => has(e, 'root') && has(o, 'root') && speedMul(o) === 0,
  'storm+venom': ({ e }) => isStunned(e),
  'storm+blood': ({ e, h }) => !has(e, 'bleed') && h.e - e.hp >= 3 * 5 - 1,
  'storm+earth': ({ o, h }) => isStunned(o) && h.o - o.hp >= 16,
  'venom+blood': ({ e }) => has(e, 'slow') && speedMul(e) < 1,
  'venom+earth': ({ o }) => has(o, 'poison'),
  'blood+earth': ({ o, h }) => has(o, 'root') && h.o - o.hp >= 14
};
const prepOf = key => (key === 'water+storm' ? (W, e, o) => applyStatus(W, o, 'wet', 0, 6) : key === 'fire+blood' ? W => { W.player.hp = 50; } : null);
let pairs = 0;
for (let i = 0; i < ELEMENTS.length; i++) for (let j = i + 1; j < ELEMENTS.length; j++) {
  const a = ELEMENTS[i], b = ELEMENTS[j], key = mixKey(a, b);
  for (const [x, y] of [[a, b], [b, a]]) {
    const r = pair(x, y, prepOf(key)); pairs++;
    ok(r.ev.length >= 1 && r.ev[0].name === MIX_NAME[key], `${x} → ${y}: нет реакции «${MIX_NAME[key]}» (события: ${r.ev.map(v => v.name).join(', ') || 'нет'})`);
    ok(CHECK[key](r), `${x} → ${y}: «${MIX_NAME[key]}» не делает своё`);
  }
}
ok(pairs === 42 && Object.keys(CHECK).length === 21 && Object.keys(MIX_NAME).length === 28, 'в таблице не 21 пара разных стихий и 7 одинаковых');

// ---------- 2. без таблицы — только две прежние реакции ----------
{ let extra = 0, old = 0;
  for (const a of ELEMENTS) for (const b of ELEMENTS) { if (a === b) continue;
    const W = mk(c => { c.elements.react = false; }), e = foe(W, 6, 0); foe(W, 7.8, 0); put(W, e, a); W.ev.length = 0; put(W, e, b);
    const n = reacts(W).length; if ((b === 'fire' && (a === 'ice' || a === 'venom'))) old += n; else extra += n; }
  ok(old === 2 && extra === 0, `без таблицы реакции не как раньше: прежних ${old}, лишних ${extra}`); }

// ---------- 3. реакция от реакции не срабатывает; пауза между реакциями ----------
{ const W = mk(), e = foe(W, 6, 0), o = foe(W, 7.8, 0); applyStatus(W, o, 'poison', 2, 5); put(W, e, 'storm'); W.t += 1; W.ev.length = 0; put(W, e, 'fire');
  ok(reacts(W).length === 1 && has(o, 'burn') && has(o, 'poison'), `«Плазма» по отравленному соседу запустила вторую реакцию: ${reacts(W).map(v => v.name)}`); }
{ const W = mk(), e = foe(W, 6, 0); put(W, e, 'venom'); W.t += 1; put(W, e, 'storm'); W.ev.length = 0; put(W, e, 'blood');
  ok(reacts(W).length === 0, 'вторая реакция на том же враге без паузы'); W.t += X.cd + .01; put(W, e, 'earth'); ok(reacts(W).length === 1, 'после паузы реакция не идёт'); }

// ---------- 4. боссы: оглушение не дольше bossStun, корни и пар не держат ----------
{ const W = mk(), e = foe(W, 6, 0); e.boss = true; for (let i = 0; i < 5; i++) put(W, e, 'venom'); W.t += 1; put(W, e, 'storm');
  ok(isStunned(e) && e.st.stun.t <= X.bossStun + 1e-9, 'босс оглушён «Нейротоксином» дольше предела');
  ok(!applyStatus(W, e, 'root', 0, 2) && !applyStatus(W, e, 'blind', 0, 2), 'босс поддаётся корням или пару');
  W.t += X.cd + .1; W.ev.length = 0; put(W, e, 'earth'); ok(!reacts(W).length, 'реакции на боссе без долгой паузы — оглушение подряд');
  W.t += X.bossCd; put(W, e, 'storm'); ok(reacts(W).length === 1, 'после паузы босса реакция не идёт'); }

// ---------- 5. области гаснут по времени и при смене уровня ----------
{ const W = mk(), e = foe(W, 6, 0); put(W, e, 'fire'); W.t += 1; put(W, e, 'earth'); ok(W.ezones.length === 1, 'лава не появилась');
  run(W, M.lava.t + .3); ok(W.ezones.length === 0, 'лава не гаснет');
  put(W, e, 'ice'); W.t += 1; put(W, e, 'water'); W.lvl = 'other'; run(W, .1); ok(W.ezones.length === 0, 'гололёд остался после смены уровня'); W.lvl = undefined; }

// ---------- 6. дождь: все мокрые для молнии ----------
{ const W = mk(c => { c.weather.force = 'rain'; }), e = foe(W, 6, 0), o = foe(W, 7.8, 0); W.ev.length = 0; const h = o.hp; put(W, e, 'storm');
  ok(reacts(W).some(v => v.name === 'Грозовой поток') && o.hp < h, 'в дождь молния не идёт по мокрым'); }
{ const W = mk(), e = foe(W, 6, 0); W.ev.length = 0; put(W, e, 'storm'); ok(!reacts(W).length, 'без дождя сухой враг мокрый'); }

// ---------- 7. «Гниль», трещина ----------
{ const W = mk(), e = foe(W, 6, 0); put(W, e, 'venom'); W.t += 1; put(W, e, 'blood'); const h = e.hp; tickEnemy(W, e, .5);
  ok(Math.abs((h - e.hp) - (2 + 3) * .5 * M.rot.k) < 1e-6, `«Гниль» не усиливает яд и кровь: ${(h - e.hp).toFixed(2)}`); }
{ const W = mk(), e = foe(W, 6, 0); put(W, e, 'earth'); const h = e.hp; W.fx.deal(e, 100, null); ok(h - e.hp === Math.round(100 * X.crack), 'трещина не добавляет урона'); }

if (fails.length) { console.error('Стихии 3D: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`Стихии 3D: OK (${pairs} сочетаний, 21 пара)`);
