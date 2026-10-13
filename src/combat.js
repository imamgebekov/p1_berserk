// Бой: удары, урон, смерть, Клеймо, опыт, добыча.
import { CFG, xpNeed } from './config.js';
import { P, W } from './state.js';
import { riIn, rndIn, pick, random } from './util.js';
import { chat, npcSay } from './chat.js';
import { after } from './clock.js';
import { sfx } from './audio.js';
import { burst, dmgNum, BLOOD } from './fx.js';
import { env } from './env.js';

export function gainXP(n) {
  P.xp += n;
  while (P.xp >= xpNeed(P.lv)) {
    P.xp -= xpNeed(P.lv); P.lv++; P.maxhp += CFG.player.hpPerLevel; P.hp = P.maxhp;
    burst(P.x, 12, 24, ['#e0c070', '#f6eed9', '#e0602a'], 70, 60);
    sfx.level(); chat('', 'Новый уровень: ' + P.lv, 'sys');
    after(.8, () => npcSay(pick(['gz', 'гз', 'кто-то поднялся'])));
  }
}

function freeze(sec) { W.freeze = Math.max(W.freeze, env.reduce ? Math.min(sec, .03) : sec); }

export function killEnemy(e) {
  const i = W.enemies.indexOf(e);
  if (i >= 0) W.enemies.splice(i, 1);
  burst(e.x, e.h * .5, e.type === 'boss' ? 60 : 14, BLOOD, 70, 50);
  sfx.kill();
  if (e.type === 'boss') { bossDown(e); return; }
  P.kills++; W.killsSinceLord++;
  gainXP(e.xp);
  P.ash += riIn(CFG.loot.ashPerKill) * (e.type === 'lord' ? CFG.loot.lordAshMult : 1);
  if (random() < CFG.loot.flavorChance) {
    chat('', 'Получено: ' + pick(CFG.loot.flavorNames), 'sys');
    sfx.loot();
  }
}

function bossDown(e) {
  const all = Math.max(1, e.myDmg + e.npcDmg);
  const share = Math.round(100 * e.myDmg / all);
  gainXP(e.xp * (1 + W.cycle)); P.ash += CFG.loot.bossAshBase + share;
  W.boss = null; W.cycle++; W.maxT = CFG.eclipse.nextTimer; W.timer = W.maxT;
  chat('', 'Предвестник пал. Твой вклад: ' + share + '%', 'sys');
  W.shake = CFG.fx.shakeBossDown;
  after(.6, () => npcSay('gg'));
  after(1.6, () => npcSay(share > 35 ? 'Странник, ты зверь' : 'без вас бы не справились'));
}

export function hurtEnemy(e, dmg, face, heavy) {
  const A = CFG.enemyAi;
  e.hp -= dmg; e.flash = .1; e.myDmg += dmg;
  e.vx = face * (heavy ? A.knockHeavy : A.knockLight) * (A.knockResist[e.type] ?? 1);
  if (e.st === 'wind' && e.type !== 'boss') { e.st = 'walk'; e.t = 0; }
  burst(e.x, e.h * .6, heavy ? 12 : 7, BLOOD, 50, 40);
  dmgNum(e.x, e.h + 4, dmg, P.rageOn > 0 ? '#e0602a' : '#e8e0cc');
  freeze(P.rageOn > 0 ? CFG.fx.freezeRage : (heavy ? CFG.fx.freezeHeavy : CFG.fx.freezeLight));
  W.shake = Math.max(W.shake, heavy ? CFG.fx.shakeHeavy : CFG.fx.shakeLight);
  if (P.rageOn <= 0) P.rage = Math.min(CFG.rage.max, P.rage + (heavy ? CFG.rage.gainHeavy : CFG.rage.gainLight));
  P.inCombat = CFG.world.combatCooldown;
  sfx.hit(heavy);
  if (e.hp <= 0) killEnemy(e);
}

export function hurtPlayer(dmg, dir) {
  if (P.inv > 0 || P.dead) return;
  if (P.rageOn > 0) dmg = Math.round(dmg * CFG.rage.damageTaken);
  P.hp -= dmg; P.inv = CFG.player.invAfterHit; P.vx = dir * CFG.player.hurtKnock;
  W.hurtFlash = CFG.fx.hurtFlash; freeze(CFG.fx.freezeHurt); W.shake = Math.max(W.shake, CFG.fx.shakeHurt);
  if (P.rageOn <= 0) P.rage = Math.min(CFG.rage.max, P.rage + CFG.rage.gainHurt);
  burst(P.x, 10, 10, BLOOD, 50, 40);
  dmgNum(P.x, 24, dmg, '#c0222c');
  P.inCombat = CFG.world.combatCooldown; sfx.hurt();
  if (P.hp <= 0) die();
}

export function die() {
  P.hp = 0; P.dead = true; P.rageOn = 0; P.rage = 0;
  chat('', 'Странник погиб.', 'sys');
  after(.7, () => npcSay('F'));
}

export function rise() {
  P.dead = false; P.hp = P.maxhp; P.x = CFG.world.fire + CFG.world.startOffset; P.vx = 0; P.z = 0;
  P.inv = CFG.player.invOnRise; P.swingT = -1;
  W.enemies = W.enemies.filter(e => e === W.boss);
}

export function startSwing() {
  const C = CFG.player;
  P.combo = P.comboT > 0 ? (P.combo + 1) % C.comboLength : 0;
  P.heavy = P.combo === C.comboLength - 1;
  P.swingDur = (P.heavy ? C.heavySwing : C.lightSwing) * (P.rageOn > 0 ? CFG.rage.swingMult : 1);
  P.swingT = 0; P.hitSet = new Set(); sfx.whoosh(P.heavy);
}

export function tryBrand() {
  if (P.dead || !W.started) return;
  if (P.rage >= CFG.rage.max && P.rageOn <= 0) {
    P.rageOn = CFG.rage.duration; W.shake = CFG.fx.shakeBrand; freeze(CFG.fx.freezeBrand); sfx.brand();
    chat('', 'Клеймо горит.', 'sys');
  }
}

export function swingDamage() {
  const C = CFG.player;
  return (C.baseDamage + P.lv * C.damagePerLevel) * (P.heavy ? C.heavyMult : 1) *
    (P.rageOn > 0 ? CFG.rage.damageMult : 1) * rndIn(C.damageVariance);
}
