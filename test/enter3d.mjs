// Дома с входом и дома-декорации (владелец 2026-10-28): в сёлах вход — у каждого седьмого и у домов с жителем, они крупнее;
// лагерь, заставы, Цитадель, павшие города — все с входом. У декорации дверь не открывается, второго этажа нет, сундуки — во дворе;
// герой внутри декорации (старое сохранение) встаёт у двери снаружи.
import { CFG3 } from '../3d/src/config3d.js';
import { insideOf } from '../3d/src/map.js';
import { createWorld, step, mulberry32 } from '../3d/src/sim.js';
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const c = JSON.parse(JSON.stringify(CFG3)); c.enemies.count = 0; c.events.on = false; c.wanderer.on = false;
const W = createWorld(c, mulberry32(3)), B = W.map.buildings, E = c.map.enter;
const deco = B.filter(b => b.deco), vil = B.filter(b => b.vil && !b.city && !b.citadel);
ok(deco.length > B.length * .6, `декораций мало: ${deco.length} из ${B.length}`);
ok(B.filter(b => !b.vil || b.city || b.citadel).every(b => !b.deco), 'в лагере, Цитадели или павшем городе дом стал декорацией');
const share = vil.filter(b => !b.deco).length / vil.length; ok(share > 1 / E.every * .9 && share < 1 / E.every * 2, `в сёлах с входом ${(share * 100).toFixed(0)}%`);
ok(B.filter(b => b.npc).every(b => !b.deco), 'дом с жителем стал декорацией');
const area = a => a.reduce((s, b) => s + b.w * b.d, 0) / a.length; ok(area(vil.filter(b => !b.deco)) > area(deco) * 1.25, 'дома с входом в сёлах не крупнее декораций');
ok(!Object.keys(W.levels).some(id => id.startsWith('up:') && deco.some(b => b.floor === id)), 'у декорации есть второй этаж');
const inDeco = W.map.containers.filter(q => deco.some(b => q.x > b.x0 && q.x < b.x1 && q.z > b.z0 && q.z < b.z1)); ok(!inDeco.length, `сундуков внутри декораций: ${inDeco.length}`);
// дверь декорации не открывается; герой внутри — снаружи у двери
const b = deco[0], p = W.player; p.x = b.door.out.x; p.z = b.door.out.z; for (let i = 0; i < 30; i++) step(W, 1 / 60, {}); ok(b.door.open === 0, 'дверь декорации открылась');
p.x = b.x; p.z = b.z; step(W, 1 / 60, {}); ok(insideOf(W.map, p.x, p.z) !== b.id, 'герой остался внутри декорации');
if (fails.length) { console.log('ПРОВАЛ:\n' + fails.join('\n')); process.exit(1); }
console.log(`Дома с входом 3D: OK (с входом ${B.length - deco.length}, декораций ${deco.length}, в сёлах с входом ${(share * 100).toFixed(0)}%)`);
