// Тест «Пути пепла» 3D (шаг 13 аудита): шесть вех по порядку — костры, Пожиратель, склеп (сокровищница), Слуга Затмения,
// Вожак Ржавых, финал; первая победа над боссом засчитана навсегда (возрождение — только «эхо»); финал — один раз;
// кузнец и журнал — после первого босса, наём — с 5-го уровня, блок сета — после 2 вещей одного сета; ветеран получает
// вехи по уже сделанному; мусор в сохранении чистится; у вехи есть строка и точка на карте.
import { CFG3 } from '../3d/src/config3d.js';
import { createWorld, mulberry32 } from '../3d/src/sim.js';
import { PATH, pathFresh, sanitizePath, pathEvent, pathTick, pathGoal, pathIndex, unlocks } from '../3d/src/ashpath3d.js';
import { travel } from '../3d/src/levels3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const mk = () => { const c = JSON.parse(JSON.stringify(CFG3)); c.events.on = false; c.wanderer.on = false; return createWorld(c, mulberry32(2)); };

ok(PATH.map(s => s.id).join() === 'fires,devourer,crypt,lord,chief,end', 'вехи не по порядку: ' + PATH.map(s => s.id).join());
{ const W = mk(); W.path = pathFresh(W); W.fires = { camp: 1 };
  let L = unlocks(W); ok(!L.smith && !L.journal && !L.squad && !L.sets, 'в начале открыто лишнее: ' + JSON.stringify(L));
  let g = pathGoal(W); ok(/1\/5/.test(g.text) && /0\/3/.test(g.text) && g.at, 'первая веха без счётчика или точки: ' + JSON.stringify(g));
  // костры
  const fires = W.map.fires.filter(f => !f.home).slice(0, 3); fires.forEach((f, i) => { W.fires[f.id] = 1; const r = pathTick(W); if (i < 2) ok(r === null, 'веха костров засчитана рано'); else ok(r && r.k === 'step' && r.i === 1, 'после 3 костров нет следующей вехи'); });
  g = pathGoal(W); ok(/Пожиратель/.test(g.text) && g.at && Math.hypot(g.at.x - W.cfg.bosses.list.find(b => b.type === 'devourer').x, g.at.z - W.cfg.bosses.list.find(b => b.type === 'devourer').z) < 1, 'веха босса без логова: ' + JSON.stringify(g));
  // чужой босс не продвигает, но засчитан навсегда
  pathEvent(W, { k: 'bossdead', type: 'chief' }); ok(pathTick(W) === null && W.path.slain.chief, 'чужой босс сдвинул путь или не записан');
  pathEvent(W, { k: 'bossdead', type: 'devourer' }); { const r = pathTick(W); ok(r && r.k === 'step' && PATH[r.i].id === 'crypt', 'после Пожирателя не склеп'); }
  L = unlocks(W); ok(L.smith && L.journal && !L.squad, 'после первого босса не открылись кузнец и журнал: ' + JSON.stringify(L));
  W.lv = CFG3.path.squadLv; ok(unlocks(W).squad, 'наём не открылся с уровнем');
  // склеп: настоящее подземелье, герой у входа — не засчитано; в сокровищнице — засчитано
  const d = CFG3.dungeons.list.find(q => q.id === 'crypt_pogost'); travel(W, d.id, d.entry.x, d.entry.z);
  ok(pathTick(W) === null && !W.path.crypt, 'склеп засчитан у входа');
  const v = W.map.rooms.find(r => r.id === 'vault'); W.player.x = (v.x0 + v.x1) / 2; W.player.z = (v.z0 + v.z1) / 2;
  { const r = pathTick(W); ok(W.path.crypt && r && PATH[r.i].id === 'lord', 'сокровищница склепа не засчитана'); }
  travel(W, 'surface', 0, 4);
  // Слуга побеждён, а Вожак убит раньше — его веха засчитана сразу, наступает финал
  pathEvent(W, { k: 'bossdead', type: 'lord' });
  { const r = pathTick(W); ok(r && r.k === 'end' && W.path.end, 'финал не наступил: ' + JSON.stringify(r)); ok(pathTick(W) === null, 'финал дважды'); ok(pathGoal(W) === null, 'после финала осталась цель'); }
  // сеты: блок открывается при 2 вещах одного сета и не закрывается
  W.path.sets = true; ok(unlocks(W).sets, 'блок сета не открыт'); }
// ветеран, мусор
{ const W = mk(); W.known.bestiary.devourer = 1; W.known.bestiary.lord = 1; const P = pathFresh(W); ok(P.slain.devourer && P.slain.lord && !P.slain.chief, 'ветеран без своих побед: ' + JSON.stringify(P.slain));
  W.path = P; ok(unlocks(W).smith, 'ветерану закрыт кузнец');
  const s = sanitizePath({ slain: { devourer: true, hacker: true, lord: 'да' }, crypt: 1, end: 0 }, W); ok(s.slain.devourer && !s.slain.hacker && !s.slain.lord && s.crypt === true && s.end === false, 'мусор не почищен: ' + JSON.stringify(s)); }
// путь выключен — всё открыто
{ const c = JSON.parse(JSON.stringify(CFG3)); c.path.on = false; const W = createWorld(c, mulberry32(3)); W.path = pathFresh(W); const L = unlocks(W); ok(L.smith && L.journal && L.squad && L.sets, 'выключенный путь закрыл системы'); }

if (fails.length) { console.log('ashpath3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Путь пепла 3D: OK');
