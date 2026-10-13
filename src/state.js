// Всё изменяемое состояние игры. Модули боя/мира читают и пишут сюда, DOM не трогают:
// HUD сам сверяется с этим состоянием (src/hud.js).
import { CFG } from './config.js';

export const keys = { l: false, r: false, atk: false, jump: false };

export const P = {
  x: 0, z: 0, vz: 0, vx: 0, face: 1,
  hp: CFG.player.maxHp, maxhp: CFG.player.maxHp, lv: 1, xp: 0, rage: 0, rageOn: 0,
  swingT: -1, swingDur: CFG.player.lightSwing, combo: 0, comboT: 0, hitSet: null, heavy: false,
  inv: 0, dead: false, walk: 0, kills: 0, ash: 0, inCombat: 0
};

export const W = {
  enemies: [], parts: [], nums: [], npcs: [], boss: null,
  T: 0, freeze: 0, shake: 0, hurtFlash: 0, camX: 0,
  spawnT: CFG.spawn.firstDelay, killsSinceLord: 0, started: false,
  ecl: 0, cycle: 0, maxT: CFG.eclipse.firstTimer, timer: CFG.eclipse.firstTimer,
  eid: 1, chatT: CFG.chat.firstIdle, online: CFG.online.base,
  chatLog: [], chatSeq: 0, timers: []
};

// размеры вида (меняет renderer при resize)
export const V = { LW: CFG.view.width, LH: 260, G: 226, DPR: 1, SX: 1, SY: 1 };

export function resetState() {
  Object.assign(P, {
    x: CFG.world.fire + CFG.world.startOffset, z: 0, vz: 0, vx: 0, face: 1,
    hp: CFG.player.maxHp, maxhp: CFG.player.maxHp, lv: 1, xp: 0, rage: 0, rageOn: 0,
    swingT: -1, swingDur: CFG.player.lightSwing, combo: 0, comboT: 0, hitSet: null, heavy: false,
    inv: 0, dead: false, walk: 0, kills: 0, ash: 0, inCombat: 0
  });
  Object.assign(W, {
    enemies: [], parts: [], nums: [], npcs: [], boss: null,
    T: 0, freeze: 0, shake: 0, hurtFlash: 0, camX: 0,
    spawnT: CFG.spawn.firstDelay, killsSinceLord: 0, started: false,
    ecl: 0, cycle: 0, maxT: CFG.eclipse.firstTimer, timer: CFG.eclipse.firstTimer,
    eid: 1, chatT: CFG.chat.firstIdle, online: CFG.online.base,
    chatLog: [], chatSeq: 0, timers: []
  });
  keys.l = keys.r = keys.atk = keys.jump = false;
}
resetState();
