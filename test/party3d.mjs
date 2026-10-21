// Сбор группы (4.07): подземелье отряда — 4 (1 защитник, 1 лекарь, 1 боец, 1 стрелок), рейд — 10 (2/3/3/2). Герой занимает место
// своей роли, нанятые — свои; наёмники в полную силу, с именами; наверху уходят, в сохранение не попадают; в обычное подземелье — не идут.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32, step, hireAlly } from '../3d/src/sim.js';
import { travel } from '../3d/src/levels3d.js';
import { roleOfType, partyNeed } from '../3d/src/party3d.js';
import { allyHp } from '../3d/src/squad3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = (hero, seed = 1) => { const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false; const W = createWorld(c, mulberry32(seed)); W.hero = hero; W.lv = 40; return W; };
const inst = CFG3.dungeons.list.find(d => d.inst && !d.raid), raid = CFG3.dungeons.list.find(d => d.raid), plain = CFG3.dungeons.list.find(d => !d.inst && !d.castle);
const go = (W, d) => { const L = W.levels[d.id], e = (L && L.def && (L.def.entry || L.def.start)) || { x: 0, z: 0 }; travel(W, d.id, e.x, e.z); };
const roles = W => { const r = { tank: 0, heal: 0, melee: 0, ranged: 0 }; for (const a of W.allies) if (!a.dead && !a.guest && !a.story) r[roleOfType(W.cfg.squad.types[a.type])]++; return r; };
ok(inst && raid && plain, 'нет подземелья отряда, рейда или обычного подземелья');
// защитник Торн: добор лекаря, бойца и стрелка
{ const W = mk('thorn'); go(W, inst); const r = roles(W), hired = W.allies.filter(a => a.lfg);
  ok(hired.length === 3 && r.heal === 1 && r.melee === 1 && r.ranged === 1 && r.tank === 0, 'Торн: группа не 4 по ролям: ' + JSON.stringify(r));
  ok(hired.every(a => a.name && a.maxhp === allyHp(W, W.cfg.squad.types[a.type])) && new Set(hired.map(a => a.name)).size === 3, 'наёмники без имён или не в полную силу');
  ok(!hired.some(a => W.cfg.squad.types[a.type].hero === 'thorn'), 'в группе вторая копия героя');
  ok(W.ev.some(v => v.k === 'partyFill' && v.size === 4), 'нет сообщения о сборе');
  // повторный вход — не дублирует
  go(W, inst); ok(W.allies.filter(a => a.lfg).length === 3, 'повторный вход добавил наёмников');
  travel(W, 'surface', 0, 4); ok(!W.allies.some(a => a.lfg) && W.ev.some(v => v.k === 'partyLeave'), 'наверху наёмники не ушли'); }
// стрелок Сойка с нанятым защитником: добор лекаря и бойца
{ const W = mk('jay', 2); W.inv.ash = 1e5; W.lv = 30; W.nearNpc = 'captain'; const h = hireAlly(W, 'c_thorn'); ok(h === 'ok', 'наём защитника: ' + h);
  go(W, inst); const r = roles(W); ok(W.allies.filter(a => a.lfg).length === 2 && r.tank === 1 && r.heal === 1 && r.melee === 1 && r.ranged === 0, 'Сойка с защитником: ' + JSON.stringify(r));
}
// рейд: 10
{ const W = mk('irga', 3); go(W, raid); const r = roles(W); ok(W.allies.filter(a => a.lfg).length === 9 && r.tank === 2 && r.heal === 3 && r.melee === 3 && r.ranged === 1, 'рейд Ирги не 10 по ролям: ' + JSON.stringify(r)); }
// обычное подземелье — без наёмников; выключено — без наёмников
{ const W = mk('vale', 4); go(W, plain); ok(!W.allies.some(a => a.lfg), 'наёмники пришли в обычное подземелье');
  const W2 = mk('vale', 4); W2.cfg.party.on = false; go(W2, inst); ok(!W2.allies.some(a => a.lfg) && partyNeed(W2, inst) === null, 'party.on=false — наёмники есть'); }
// сохранение: наёмников нет
{ const mem = {}, st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const { createSaver } = await import('../3d/src/save3d.js'); const W = mk('thorn', 5); go(W, inst); createSaver(W, st).write(true);
  const d = JSON.parse(Object.values(mem).find(v => v.includes('"allies"')) || '{}'); ok(!(d.allies || []).length, 'наёмники попали в сохранение: ' + JSON.stringify(d.allies)); }
// в подземелье группа бьётся: наёмники живы и идут за героем
{ const W = mk('thorn', 6); go(W, inst); for (let i = 0; i < 120; i++) step(W, 1 / 60, {}); ok(W.allies.filter(a => a.lfg && !a.dead).length === 3, 'наёмники пропали за 2 с'); }
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log('Сбор группы 3D: OK');
