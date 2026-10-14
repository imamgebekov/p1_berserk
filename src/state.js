// Всё изменяемое состояние игры. Модули боя/мира читают и пишут сюда, DOM не трогают:
// HUD сам сверяется с этим состоянием (src/hud.js).
import { CFG } from './config.js';

export const keys = { l: false, r: false, atk: false, jump: false };

const freshP = () => ({
  x: CFG.world.fire + CFG.world.startOffset, z: 0, vz: 0, vx: 0, face: 1,
  hp: CFG.player.maxHp, maxhp: CFG.player.maxHp, lv: 1, xp: 0, rage: 0, rageOn: 0,
  swingT: -1, swingDur: CFG.player.lightSwing, combo: 0, comboT: 0, hitSet: null, heavy: false,
  inv: 0, dead: false, walk: 0, kills: 0, ash: 0, inCombat: 0,
  // предметы: сумка — плотный массив экземпляров { uid, id, up }, надетое — по слотам
  bag: [], eq: { weapon: null, head: null, body: null, cloak: null, amulet: null, ring: null },
  stats: { dmg: 0, armor: 0, hp: 0, speed: 0, crit: 0, rage: 0 },
  newItems: 0,
  rageDur: CFG.rage.duration,
  rollT: -1, rollCd: 0, rollDir: 1, rollDodged: false, dodgeCd: 0,
  // прогресс: очки навыков, ранги навыков, задания { id: { st: 'active'|'done'|'claimed', n } }
  sp: 0, skills: {}, quests: {}
});

const freshW = () => ({
  enemies: [], proj: [], parts: [], nums: [], popups: [], npcs: [], boss: null,
  T: 0, freeze: 0, shake: 0, hurtFlash: 0, camX: 0,
  spawnT: CFG.spawn.firstDelay, killsSinceLord: 0, started: false, paused: false, hold: false,
  ecl: 0, cycle: 0, maxT: CFG.eclipse.firstTimer, timer: CFG.eclipse.firstTimer,
  eclipseDied: false, eid: 1, itemSeq: 0, chatT: CFG.chat.firstIdle, online: CFG.online.base,
  chatLog: [], chatSeq: 0, timers: [],
  shop: { items: [], built: false }
});

export const P = freshP();
export const W = freshW();

// размеры вида (меняет renderer при resize)
export const V = { LW: CFG.view.width, LH: 260, G: 226, DPR: 1, SX: 1, SY: 1, S: 1 };

export function resetState() {
  Object.assign(P, freshP());
  Object.assign(W, freshW());
  keys.l = keys.r = keys.atk = keys.jump = false;
}
