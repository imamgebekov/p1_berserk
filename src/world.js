// Мир: враги, Предвестник, «игроки»-NPC.
import { CFG } from './config.js';
import { P, W } from './state.js';
import { rnd, rndIn, clamp, random } from './util.js';
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
    reach: D.reach, wind: D.wind, cd: rnd(0, 1), myDmg: 0, npcDmg: 0,
    z: 0, vz: 0, phase: 1, atk: null, leapDir: 1, leapHit: false
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
  W.boss = b; W.eclipseDied = false;
  W.enemies = W.enemies.filter(e => e === b || Math.abs(e.x - P.x) < 70);
  chat('', 'Небо меркнет. Предвестник Затмения вышел в мир.', 'sys');
  after(.5, () => npcSay('ОН ПРИШЁЛ'));
  after(1.5, () => npcSay('все к Предвестнику!'));
  sfx.slam();
}

// Тип обычного врага по весам пула; враги открываются с уровня героя (config.spawn.pool)
export function pickSpawnType() {
  const pool = CFG.spawn.pool.filter(p => P.lv >= p.minLv);
  let sum = 0; for (const p of pool) sum += p.w;
  let x = random() * sum;
  for (const p of pool) { x -= p.w; if (x < 0) return p.type; }
  return pool[0].type;
}

// Предвестник призывает прислужников по обе стороны от себя
export function summonAround(boss) {
  const spread = CFG.bossPhase.summonSpread;
  CFG.bossPhase.summon.forEach((type, i) => {
    const side = i % 2 ? 1 : -1;
    spawnEnemy(type, clamp(boss.x + side * (spread + rnd(0, 14)), CFG.world.town + 30, CFG.world.length - 30));
  });
}
