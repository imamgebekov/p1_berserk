// Сюжет Акта I (этап 3, 2026-10-19): все 12 сцен проходятся по порядку — разговор, цель, разговор в конце, награда;
// поединок с Алариком кончается без смерти (оба исхода); оборона брода при гибели героя начинается заново; спутники сюжета не гибнут
// и уходят после сцены; бой и добыча (W.rng) не сдвигаются от сюжета; прогресс сохраняется (бой в разгаре — заново с разговора).
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, step, killEnemy, spawnEnemy } from '../3d/src/sim.js';
import { ACT, storyTalk, storyTalked, storyActors, storyGoal, storyTick, serializeStory, sanitizeStory, brandOn } from '../3d/src/story3d.js';
import { createSaver, loadSave } from '../3d/src/save3d.js';
import { isNight } from '../3d/src/daynight.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (seed = 4) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(seed)); W.player.maxhp = W.player.hp = 1e6; W.lv = 25; return W; };
const talk = (W, kind) => { const t = storyTalk(W, kind); if (!t) return false; storyTalked(W, t.part); return t; };
const giverOf = c => c.auto ? null : c.giver;
function solve(W, c, opt = {}) {
  const S = W.story, G = c.goal;
  if (G.type === 'spark') { W.spark = W.spark || {}; W.spark.done = true; }
  if (G.type === 'quests') for (const id of G.list.slice(0, G.n)) W.quests[id] = { s: 'done', n: 0, ok: false, t: 0 };
  if (G.type === 'kill') { for (const id of [...S.foes]) { const e = W.enemies.find(q => q.id === id); if (e) killEnemy(W, e); } }
  if (G.type === 'boss') { const d = W.cfg.bosses.list.find(b => b.type === G.boss), e = W.enemies.find(q => q.boss && q.type === G.boss && !q.dead) || spawnEnemy(W, G.boss, d.x, d.z); e.boss = true; e.b = e.b || { minions: [] }; killEnemy(W, e); }
  if (G.type === 'duel') { const e = W.enemies.find(q => q.duel && !q.dead); if (!e) { fails.push(c.id + ': нет противника поединка'); return; } if (opt.lose) { W.player.hp = W.player.maxhp * .2; } else e.hp = e.maxhp * .2; }
  if (G.type === 'defend') { W.player.inv = 1e9; for (let i = 0; i < G.t * 10 + 20 && S.st === 'goal'; i++) step(W, .1, {}); }
  if (G.type === 'escort') { const a = W.allies.find(q => q.story), to = storyGoal(W).at; a.x = to.x; a.z = to.z; W.player.x = to.x + 1; W.player.z = to.z; }
  if (G.type === 'battle') { W.player.inv = 1e9; for (let k = 0; k < 40 && S.st === 'goal'; k++) { const b = W.enemies.find(e => !e.dead && e.type === G.banner && S.foes.includes(e.id)); if (b) killEnemy(W, b); else storyTick(W, G.every); } }
  if (G.type === 'siege') { const a = W.allies.find(q => q.ram), to = storyGoal(W).at; a.x = to.x; a.z = to.z; }
  if (G.type === 'talk') for (const k of G.talk) talk(W, k);
  if (G.type === 'bring') for (const [id, n] of G.items) W.inv.bag.push({ id, n });
  if (G.type === 'hunt') for (const h of G.hunt) { const e = W.enemies.find(q => q.boss && q.type === h.type && !q.dead); if (e) killEnemy(W, e); }
  if (G.type === 'sneak') { const to = storyGoal(W).at; W.player.x = to.x; W.player.z = to.z; }
  if (G.type === 'eclipse') { for (let i = 0; i < G.t * 2 + 10 && S.st === 'goal'; i++) storyTick(W, .5); }
  if (G.type === 'escape') { const e = W.enemies.find(q => q.escapee && !q.dead); e.hp = e.maxhp * (G.yieldFoe - .05); }
  storyTick(W, 1 / 60);
}
// 1. полный проход
{ const W = mk(); let r0 = null;
  for (let k = 0; k < ACT.length; k++) { const c = ACT[k], S = W.story; ok(S.i === k && S.st === 'wait', `${c.id}: сцена не ждёт разговора (${S.i}/${S.st})`);
    const g = giverOf(c); if (g) ok(storyActors(W).some(a => a.kind === g && a.mark === '!') || g === 'captain', `${c.id}: у ${g} нет «!»`);
    ok(talk(W, g || 'hostess'), `${c.id}: разговор в начале не открылся`);
    if (c.goal.type !== 'none') { ok(S.st === 'goal' && storyGoal(W).text.includes(c.name), `${c.id}: цель не началась`); if (c.goal.party) { const want = c.goal.party.length + (c.goal.army || []).reduce((t, [, n]) => t + n, 0) + (c.goal.type === 'siege' ? 1 : 0); ok(W.allies.filter(a => a.story).length === want, `${c.id}: отряд не пришёл`); } solve(W, c); }
    if (S.st === 'outro') { const ok2 = talk(W, c.outroAt || c.giver); ok(ok2, `${c.id}: разговор в конце не открылся`); }
    ok(W.story.i === k + 1 && !W.allies.some(a => a.story) && !W.duelOn, `${c.id}: сцена не закрылась (${W.story.i}/${W.story.st})`);
    if (k === 3) r0 = W.story; }
  ok(W.story.st === 'end' && W.inv.bag.some(s => s.id === 'a_cloak_wings') && W.inv.bag.some(s => s.id === 'r_seal_veligrad') && W.inv.bag.some(s => s.id === 'm_ember_irma') && W.inv.bag.some(s => s.id === 'l_slab') && !W.inv.bag.some(s => s.id === 'm_apostle_heart'), 'акты не пройдены, нет наград или Гедеон не взял материалы'); }
// 2. поединок: проигрыш без смерти, победа — свои реплики
for (const lose of [true, false]) { const W = mk(5); W.story.i = ACT.findIndex(c => c.id === 'duel'); W.player.maxhp = 300; W.player.hp = 300; talk(W, 'alaric');
  const e = W.enemies.find(q => q.duel); ok(e && W.duelOn, 'поединок не начался');
  if (lose) { for (let i = 0; i < 20; i++) { const h = W.player.hp; W.player.inv = 0; const d = 999; W.player.hp -= Math.min(d, Math.max(0, W.player.hp - 1)); storyTick(W, .1); if (W.story.st !== 'goal') break; } }
  else { e.hp = e.maxhp * .2; storyTick(W, .1); }
  ok(!W.player.dead && W.story.st === 'outro' && W.story.won === !lose, `поединок (${lose ? 'проигрыш' : 'победа'}): ${W.story.st}, won ${W.story.won}`);
  const t = storyTalk(W, 'alaric'); ok(t && t.lines === (lose ? ACT.find(c => c.id === 'duel').outro : ACT.find(c => c.id === 'duel').outroWin), 'реплики после поединка не те'); }
// 3. брод: гибель — сцена заново с разговора, враги брода убраны
{ const W = mk(6); W.story.i = ACT.findIndex(c => c.id === 'hundred'); talk(W, 'alaric'); for (let i = 0; i < 40; i++) step(W, .1, {});
  ok(W.story.foes.length > 0, 'волны у брода не пришли'); W.player.dead = true; storyTick(W, .1); ok(W.story.st === 'wait' && !W.enemies.some(e => e.storyFoe && !e.dead), 'гибель на броде не вернула сцену к разговору'); }
// 4. спутники не гибнут
{ const W = mk(7); W.story.i = ACT.findIndex(c => c.id === 'firstblood'); talk(W, 'irma'); const a = W.allies.find(q => q.story); const e = spawnEnemy(W, 'brute', a.x + 1, a.z);
  for (let i = 0; i < 300; i++) { a.hp -= 50; if (a.hp < 1) a.hp = 1; } ok(!a.dead && a.hp >= 1, 'спутник сюжета погиб'); }
// 5. сохранение
{ const st = new Map(), S = { getItem: k => st.get(k) ?? null, setItem: (k, v) => st.set(k, v), removeItem: k => st.delete(k) }, W = mk(8);
  W.story.i = ACT.findIndex(c => c.id === 'pogost'); talk(W, 'alaric'); createSaver(W, S).write(true); const sv = loadSave(40, S);
  ok(sv.story.i === W.story.i && sv.story.st === 'goal', 'сохранение потеряло сюжет: ' + JSON.stringify(sv.story));
  W.story.i = ACT.findIndex(c => c.id === 'hundred'); W.story.st = 'goal'; createSaver(W, S).write(true); ok(loadSave(40, S).story.st === 'wait', 'оборона в разгаре сохранилась как бой');
  ok(sanitizeStory({ i: 99, st: 'goal' }).st === 'end' && sanitizeStory(null).i === 0, 'чистка сюжета'); }

// 6. Акт III: Затмение — товарищи уходят во тьму, герой не гибнет, небо чёрное; скрытность — заметили, заново; клеймо — тени ночью
{ const W = mk(9); W.player.maxhp = W.player.hp = 300; W.story.i = ACT.findIndex(c => c.id === 'a3_eclipse'); talk(W, 'irma'); step(W, 1 / 60, {});
  ok(W.storyDark && W.light <= .06 && W.allies.filter(a => a.story).length === 3, 'Затмение не началось');
  let fell = 0; for (let i = 0; i < 125 * 10 && W.story.st === 'goal'; i++) { W.player.inv = 0; step(W, .1, {}); fell += W.ev.filter(v => v.k === 'storyFall').length; W.ev.length = 0; }
  ok(fell === 2 && !W.player.dead && W.story.st === 'outro' && !W.storyDark, `Затмение: ушло ${fell}, герой ${W.player.dead ? 'погиб' : 'жив'}, ${W.story.st}`); }
{ const W = mk(10); W.story.i = ACT.findIndex(c => c.id === 'a3_city'); talk(W, 'irma'); const g = W.enemies.filter(e => e.storyFoe && !e.dead);
  ok(g.length === 5 && g.every(e => e.mode === 'guard' && e.sight), 'стража скрытности не встала'); g[2].alert = true; storyTick(W, .1);
  ok(W.story.st === 'wait' && !W.enemies.some(e => e.storyFoe && !e.dead), 'заметили — а сцена идёт дальше'); }
{ const W = mk(11); W.story.i = ACT.findIndex(c => c.id === 'a3_brand'); ok(brandOn(W), 'клеймо не включилось после Затмения'); W.night = true; W.player.x = 300; W.player.z = 300; W.player.inv = 1e9;
  for (let t = 0; t < 4000; t += 5) if (isNight(t, W.cfg.daynight)) { W.t = t + 2; break; } let n = 0; for (let i = 0; i < 600; i++) { step(W, .1, {}); n += W.ev.filter(v => v.k === 'brand').length; W.ev.length = 0; if (n) break; }
  ok(n > 0 && W.enemies.some(e => e.type === 'brandshade' && !e.dead), 'ночью тени клейма не пришли');
  const W2 = mk(12); W2.story.i = ACT.findIndex(c => c.id === 'a3_eclipse'); ok(!brandOn(W2), 'клеймо до Затмения'); }
// 7. после финала: в мире стоят человек в маске (ежедневные дела), Ирма и хозяйка у огня
{ const W = mk(13); W.story.i = ACT.length; W.story.st = 'end'; const a = storyActors(W).map(q => q.kind); ok(['masked', 'irma', 'hostess'].every(k => a.includes(k)) && storyActors(W).every(q => !q.mark), 'после финала никого нет'); }
if (fails.length) { console.error('Сюжет: ПРОВАЛ\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`Сюжет Актов I–IV и финал 3D: OK (${ACT.length} сцен)`);
