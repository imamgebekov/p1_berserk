// Город: торговец с лотком и фонарём, кузнец с наковальней и горном.
import { CFG } from '../config.js';
import { W, V } from '../state.js';
import { env } from '../env.js';
import { nearNpc } from '../town.js';
import { readyToClaim, available, activeList } from '../quests.js';
import { R, disc, g } from './gfx.js';

let lastHit = 0;

function bubble(sx, y, T) {
  const bob = env.reduce ? 0 : Math.round(Math.sin(T * 4));
  R(sx - 5, y + bob, 11, 7, '#e8e0cc'); R(sx - 1, y + 7 + bob, 3, 2, '#e8e0cc');
  R(sx - 3, y + 3 + bob, 1, 1, '#0b0908'); R(sx, y + 3 + bob, 1, 1, '#0b0908'); R(sx + 3, y + 3 + bob, 1, 1, '#0b0908');
}

// знак над Хранителем: «!» есть задания, «?» можно сдать
function questMark(sx, y, T, ch, col) {
  const bob = env.reduce ? 0 : Math.round(Math.sin(T * 3));
  y += bob;
  if (ch === '!') { R(sx - 1, y, 2, 5, col); R(sx - 1, y + 6, 2, 2, col); }
  else { R(sx - 2, y, 4, 1, col); R(sx + 1, y + 1, 2, 2, col); R(sx - 1, y + 3, 2, 1, col); R(sx - 1, y + 4, 2, 1, col); R(sx - 1, y + 6, 2, 2, col); }
}

export function drawTown(pool) {
  const { LW, G } = V, camX = W.camX, T = W.T, still = env.reduce, near = nearNpc();

  // --- торговец ---
  let sx = Math.round(CFG.town.merchantX - camX);
  if (sx > -40 && sx < LW + 40) {
    const bob = still ? 0 : Math.round(Math.sin(T * 2));
    // лоток с товаром
    R(sx - 22, G - 7, 12, 7, '#2a2018'); R(sx - 22, G - 8, 12, 1, '#4a3826');
    R(sx - 20, G - 11, 3, 3, '#a8a396'); R(sx - 16, G - 10, 2, 2, '#c0222c'); R(sx - 13, G - 12, 2, 4, '#6a5a3a');
    // фонарь
    const flick = still ? 0 : (T * 8 | 0) % 2;
    disc(sx + 9, G - 20, 10, 'rgba(224,160,64,.07)');
    R(sx + 8, G - 18, 1, 14, '#2a2018'); R(sx + 7, G - 22, 3, 3, flick ? '#ffd27a' : '#e0a040');
    // фигура
    R(sx - 2, G - 5, 2, 5, '#191413'); R(sx + 1, G - 5, 2, 5, '#191413');
    R(sx - 4, G - 14 + bob, 8, 10, '#5a4632'); R(sx - 4, G - 6, 8, 1, '#2a1c10');
    R(sx - 8, G - 17 + bob, 5, 10, '#3a2a1a'); R(sx - 8, G - 19 + bob, 5, 2, '#6a5a46');
    R(sx - 3, G - 19 + bob, 6, 6, '#4a3826'); R(sx - 1, G - 21 + bob, 3, 2, '#4a3826');
    R(sx, G - 17 + bob, 3, 3, '#0a0808'); R(sx + 1, G - 16 + bob, 1, 1, '#e0c070');
    R(sx + 3, G - 12 + bob, 4, 2, '#5a4632');
    if (near && near.id === 'merchant') bubble(sx, G - 33, T);
  }

  // --- Хранитель костра: старик с посохом у огня ---
  sx = Math.round(CFG.town.keeperX - camX);
  if (sx > -40 && sx < LW + 40) {
    const bob = still ? 0 : Math.round(Math.sin(T * 1.6));
    R(sx - 3, G - 5, 2, 5, '#191413'); R(sx + 1, G - 5, 2, 5, '#191413');
    R(sx - 4, G - 15 + bob, 8, 11, '#4a4a52'); R(sx - 4, G - 6, 8, 1, '#2a2a30'); R(sx - 5, G - 14 + bob, 2, 7, '#3a3a42');
    R(sx - 3, G - 20 + bob, 6, 6, '#cdb89a'); R(sx - 4, G - 21 + bob, 8, 3, '#d8d4cc'); R(sx - 3, G - 15 + bob, 6, 3, '#d8d4cc');
    R(sx + 1, G - 18 + bob, 1, 1, '#1a1210');
    R(sx + 6, G - 24, 1, 22, '#4a3220'); R(sx + 5, G - 26, 3, 3, '#e0a040');
    disc(sx + 6, G - 25, 8, 'rgba(224,160,64,.06)');
    R(sx + 3, G - 12 + bob, 3, 2, '#4a4a52');
    if (near && near.id === 'keeper') bubble(sx, G - 35, T);
    else if (readyToClaim().length) questMark(sx, G - 29, T, '?', '#8fd08a');
    else if (!activeList().length && available().length) questMark(sx, G - 29, T, '!', '#e0c070');
  }

  // --- кузнец ---
  sx = Math.round(CFG.town.smithX - camX);
  if (sx > -40 && sx < LW + 40) {
    // горн
    R(sx - 24, G - 9, 12, 9, '#2a2220'); R(sx - 24, G - 10, 12, 1, '#4a3a34');
    const pulse = still ? .8 : .6 + .3 * Math.sin(T * 7);
    g.globalAlpha = pulse; R(sx - 22, G - 11, 8, 2, '#e0602a'); R(sx - 20, G - 12, 4, 1, '#ffd27a'); g.globalAlpha = 1;
    disc(sx - 18, G - 10, 14, 'rgba(224,96,42,.06)');
    // наковальня
    R(sx + 9, G - 3, 8, 3, '#2a2a30'); R(sx + 8, G - 6, 10, 3, '#4a4a52'); R(sx + 18, G - 5, 3, 1, '#4a4a52');
    // фигура
    R(sx - 2, G - 5, 2, 5, '#191413'); R(sx + 1, G - 5, 2, 5, '#191413');
    R(sx - 4, G - 14, 8, 9, '#6a5646'); R(sx - 3, G - 11, 6, 7, '#3a2e24');
    R(sx - 2, G - 19, 5, 5, '#cdb89a'); R(sx - 3, G - 20, 7, 2, '#2a1a12'); R(sx - 2, G - 15, 5, 2, '#2a1a12');
    R(sx + 1, G - 17, 1, 1, '#1a1210');
    // молот: замах и удар
    const phase = still ? .8 : (T % 1.4) / 1.4;
    if (phase < .6) { R(sx + 3, G - 17, 2, 5, '#6a5646'); R(sx + 2, G - 22, 5, 3, '#6a6a72'); R(sx + 4, G - 19, 1, 3, '#4a3220'); }
    else { R(sx + 3, G - 13, 6, 2, '#6a5646'); R(sx + 8, G - 10, 5, 3, '#6a6a72'); R(sx + 7, G - 8, 1, 2, '#4a3220'); }
    if (!still && phase >= .65 && lastHit < .65) {
      for (let i = 0; i < 4; i++) pool.emit(sx + 13, G - 7, i % 2 ? '#ffd27a' : '#e0602a', (Math.random() - .3) * 40, -Math.random() * 30 - 6, .4);
    }
    lastHit = phase;
    if (near && near.id === 'smith') bubble(sx, G - 31, T);
  }
}
