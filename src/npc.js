// «Игроки»-NPC: имитация онлайна. Бродят рядом, бьют врагов и Предвестника, болтают.
import { CFG } from './config.js';
import { P, W } from './state.js';
import { rnd, riIn, rndIn, pick, sgn, clamp, random } from './util.js';
import { chat } from './chat.js';
import { burst, dmgNum, BLOOD } from './fx.js';
import { killEnemy } from './combat.js';

export function updateNpcs(dt) {
  const C = CFG.npcPlayers, boss = W.boss, L = CFG.world.length;
  for (const n of W.npcs) {
    n.tT -= dt;
    if (n.tT <= 0) {
      n.tT = rndIn(C.retarget);
      n.tx = boss ? boss.x + sgn(random() - .5) * rnd(26, 70) : P.x + rnd(-C.wanderRange, C.wanderRange);
      n.tx = clamp(n.tx, 40, L - 40);
    }
    if (Math.abs(n.x - P.x) > C.teleportDist) n.x = P.x + sgn(random() - .5) * 220;
    const target = W.enemies.find(e => Math.abs(e.x - n.x) < (e.type === 'boss' ? C.engageRangeBoss : C.engageRange));
    const dx = n.tx - n.x;
    if (!target && Math.abs(dx) > 5) { n.x += sgn(dx) * C.speed * dt; n.face = sgn(dx); n.walk += dt * 9; }
    if (target) n.face = sgn(target.x - n.x);
    n.cd -= dt;
    if (n.sw >= 0) { n.sw += dt; if (n.sw > C.swingTime) n.sw = -1; }
    if (target && n.cd <= 0) {
      const isBoss = target.type === 'boss';
      n.cd = rndIn(isBoss ? C.bossHitCooldown : C.hitCooldown); n.sw = 0;
      const d = riIn(isBoss ? C.bossDamage : C.damage);
      target.hp -= d; target.flash = .08; target.npcDmg += d;
      burst(target.x, target.h * .6, 3, BLOOD, 30, 20);
      dmgNum(target.x + rnd(-4, 4), target.h + 8, d, n.col);
      if (target.hp <= 0) {
        killEnemy(target);
        if (!isBoss && random() < C.barkChance) chat(n.name, pick(['мой', 'ещё один', 'легко']), 'npc', n.col);
      }
    }
    n.x = clamp(n.x, 20, L - 20);
  }
}
