// Сборка кадра: низкоразрядный холст → растягивание на экран → ники и виньетка в высоком разрешении.
import { CFG } from '../config.js';
import { P, W, V } from '../state.js';
import { clamp, vrnd } from '../util.js';
import { env } from '../env.js';
import { R, num, setCtx, g } from './gfx.js';
import { drawSky, drawGround, drawProps } from './scene.js';
import { drawPlayer, drawEnemy, drawNpc } from './sprites.js';
import { createFxPool } from './fxpool.js';

export function createRenderer(cv, lo) {
  const dctx = cv.getContext('2d');
  setCtx(lo.getContext('2d'));
  let vig = null;
  const ashFx = [];
  const pool = createFxPool();

  function resize(cssW, cssH, dpr) {
    V.DPR = Math.min(dpr || 1, CFG.view.maxDpr);
    cv.width = Math.round(cssW * V.DPR); cv.height = Math.round(cssH * V.DPR);
    V.LH = Math.max(CFG.view.minHeight, Math.floor(V.LW * cssH / cssW));
    lo.width = V.LW; lo.height = V.LH;
    V.G = V.LH - CFG.view.groundOffset;
    V.SX = cv.width / V.LW; V.SY = cv.height / V.LH;
    // состояние контекста сбрасывается при смене размера: шрифт ставим здесь, а не каждый кадр
    dctx.font = `${Math.round(11 * V.DPR)}px ui-monospace, Menlo, monospace`;
    dctx.textAlign = 'center';
    // виньетка: градиент строим один раз, силу задаём через globalAlpha
    const w = cv.width, h = cv.height;
    vig = dctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .25, w / 2, h / 2, Math.max(w, h) * .75);
    vig.addColorStop(0, 'rgba(160,10,20,0)'); vig.addColorStop(1, 'rgba(160,10,20,1)');
  }

  function render(dt) {
    const { LW, LH, G } = V, T = W.T, reduce = env.reduce;
    g.imageSmoothingEnabled = false;
    const sh = (!reduce && W.shake > 0) ? [Math.round(vrnd(-1, 1) * W.shake * .5), Math.round(vrnd(-1, 1) * W.shake * .5)] : [0, 0];
    g.setTransform(1, 0, 0, 1, sh[0], sh[1]);
    drawSky(); drawGround(); drawProps();
    W.npcs.forEach(drawNpc);
    W.enemies.forEach(drawEnemy);
    if (!P.dead) drawPlayer(pool, dt);
    pool.step(dt); pool.draw();
    // частицы
    for (const p of W.parts) { g.globalAlpha = clamp(p.life * 2, 0, 1); R(p.x - W.camX, G - p.z, p.s, p.s, p.c); }
    g.globalAlpha = 1;
    for (const n of W.nums) num(n.n, Math.round(n.x - W.camX - String(n.n).length * 2), Math.round(G - n.z - n.t * 18), n.c);
    // пепел в воздухе (при reduced-motion не рисуем)
    if (!reduce) {
      if (!ashFx.length) for (let i = 0; i < 38; i++) ashFx.push({ x: vrnd(0, LW), y: vrnd(0, LH), s: vrnd(4, 14), d: Math.random() });
      const col = W.ecl > .5 ? '#c4161c' : '#bfb5a0';
      g.globalAlpha = .5;
      for (const a of ashFx) {
        a.y += a.s * dt * 1.2; a.x -= a.s * dt * .6 + Math.sin(T + a.d * 6) * 2.4 * dt;
        if (a.y > G + 20) { a.y = -2; a.x = vrnd(0, LW); }
        if (a.x < 0) a.x = LW;
        R(a.x, a.y, 1, 1, col);
      }
      g.globalAlpha = 1;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);

    // на экран
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.imageSmoothingEnabled = false;
    dctx.drawImage(lo, 0, 0, LW, LH, 0, 0, cv.width, cv.height);

    // ники «игроков»
    for (const n of W.npcs) {
      const x = (n.x - W.camX) * V.SX;
      if (x < -40 || x > cv.width + 40) continue;
      dctx.fillStyle = 'rgba(0,0,0,.6)'; dctx.fillText(n.name, x + 1, (G - 20) * V.SY + 1);
      dctx.fillStyle = n.col; dctx.fillText(n.name, x, (G - 20) * V.SY);
    }

    // виньетка: Клеймо, урон, смерть
    let a = 0;
    if (P.rageOn > 0) a = reduce ? .4 : .4 + .1 * Math.sin(T * 10);
    if (W.hurtFlash > 0) a = Math.max(a, reduce ? Math.min(W.hurtFlash, .25) : W.hurtFlash * 1.4);
    if (P.dead) a = .55;
    if (a > 0 && vig) {
      dctx.globalAlpha = clamp(a, 0, 1);
      dctx.fillStyle = vig; dctx.fillRect(0, 0, cv.width, cv.height);
      dctx.globalAlpha = 1;
    }
  }

  return { resize, render };
}
