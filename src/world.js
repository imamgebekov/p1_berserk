// Мир: враги, Предвестник, «игроки»-NPC.
import { CFG } from './config.js';
import { P, W } from './state.js';
import { rnd, rndIn, clamp } from './util.js';
import { chat, npcSay, NPC_NAMES, NPC_COLORS } from './chat.js';
import { after } from './clock.js';
import { sfx } from './audio.js';

export function makeNpcs() {
  W.npcs = NPC_NAMES.slice(0, CFG.npcPlayers.count).map((n, i) => ({
    name: n, col: NPC_COLORS[i], x: CFG.world.town - 80 + i * 70, face: 1, tx: 0, tT: 0, cd: rnd(0, 1), sw: -1, walk: Math.random() * 6
  }));
}

export function spawnEnemy(type, x) {
  const D = CFG.enemies[type], S = CFG.scaling;
  const m = 1 + (P.lv - 1) * S.perPlayerLevel + W.cycle * S.perCycle;
  const e = {
    id: W.eid++, type, x, vx: 0, hp: Math.round(D.hp * m), maxhp: Math.round(D.hp * m), face: -1, st: 'walk', t: 0,
    flash: 0, w: D.w, h: D.h, spd: D.spd * rndIn(CFG.enemyAi.speedVariance), dmg: Math.round(D.dmg * m), xp: D.xp,
    reach: D.reach, wind: D.wind, cd: rnd(0, 1), myDmg: 0, npcDmg: 0
  };
  W.enemies.push(e);
  return e;
}

export function spawnBoss() {
  const E = CFG.eclipse;
  const x = clamp(P.x + E.bossSpawnAhead, CFG.world.town + E.bossMinX, CFG.world.length - E.bossEdge);
  const b = spawnEnemy('boss', x);
  b.hp = b.maxhp = Math.round(CFG.enemies.boss.hp * (1 + W.cycle * CFG.scaling.bossPerCycle));
  b.spd = CFG.enemies.boss.spd;
  W.boss = b;
  W.enemies = W.enemies.filter(e => e === b || Math.abs(e.x - P.x) < 70);
  chat('', 'Небо меркнет. Предвестник Затмения вышел в мир.', 'sys');
  after(.5, () => npcSay('ОН ПРИШЁЛ'));
  after(1.5, () => npcSay('все к Предвестнику!'));
  sfx.slam();
}
