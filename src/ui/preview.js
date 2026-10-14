// Крупный предпросмотр героя на экране персонажа: тот же слоистый рисунок, что и в мире.
import { P } from '../state.js';
import { drawHero } from '../render/hero.js';
import { createFxPool } from '../render/fxpool.js';
import { R, g, setCtx } from '../render/gfx.js';

export function createPreview(canvas) {
  const ctx = canvas.getContext('2d');
  const pool = createFxPool(32);
  const W_ = 52, H_ = 48;
  const pose = { sx: 12, fy: 44, f: 1, ang: -.8, T: 0, dt: 0, rage: false, moving: false, walk: 0, white: false, swing: -1, heavy: false };
  let raf = 0, last = 0, T = 0;

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
    pose.T = T; pose.dt = dt;
    const prev = g; setCtx(ctx);
    ctx.imageSmoothingEnabled = false;
    R(0, 0, W_, H_, '#120d0b');
    R(0, 44, W_, 4, '#17110f'); R(0, 44, W_, 1, '#5a4a3d');
    if (pose.rage) { ctx.globalAlpha = .18; R(0, 0, W_, 44, '#a1121f'); ctx.globalAlpha = 1; }
    drawHero(pose, P.eq, pool);
    pool.step(dt); pool.draw();
    setCtx(prev);
    raf = requestAnimationFrame(frame);
  }
  canvas.addEventListener('click', () => { pose.rage = !pose.rage; });

  return {
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    get running() { return !!raf; }
  };
}
