// Браузерный тест ударов 3D (шаг P1): у героя в руке модель надетого оружия, у каждого семейства движений свои замахи и след клинка.
// Снимает галерею test/out/3d-swing-<семейство>-<шаг>.png (замах заморожен в момент попадания) и проверяет, что нет ошибок.
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'test', 'out'); mkdirSync(out, { recursive: true });
let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  try { ({ chromium } = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'))); }
  catch { console.log('Playwright не найден — браузерный тест ударов пропущен'); process.exit(0); }
}
const problems = [], bad = m => problems.push(m), logs = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5185, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;
const SHOW = { slash: 'sword', thrust: 'spear', smash: 'hammer', spin: 'greatsword', flail: 'chain_ball', fists: 'fists' };

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/GPU stall due to ReadPixels/.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(url + '?shot'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const W = window.__b3d.W; W.enemies.forEach(e => { if (!e.boss) e.dead = true; }); W.player.x = 0; W.player.z = 8; W.player.face = Math.PI * .75; });

  for (const [fam, kind] of Object.entries(SHOW)) for (const step of ['a', 'b', 'fin']) {
    const r = await page.evaluate(async ({ kind, step }) => {
      const b = window.__b3d, W = b.W, p = W.player, cfg = b.cfg;
      const { BY_ID } = await import('/3d/src/data/items.js'), { refreshGear } = await import('/3d/src/sim.js');
      const id = kind === 'fists' ? null : Object.keys(BY_ID).find(k => BY_ID[k].kind === kind && BY_ID[k].mat === 'steel' && BY_ID[k].cat === 'weapon');
      W.inv.eq.weapon = id; refreshGear(W);
      W.freeze = 999; p.state = 'atk'; p.chain = step === 'a' ? 1 : step === 'b' ? 2 : 3; p.fin = step === 'fin'; p.atkT = 0;
      const hitT = cfg.player.attackHitAt * (W.gear.swing || 1);
      await new Promise(res => { const tick = () => { p.atkT = Math.min(hitT * 1.08, p.atkT + hitT / 14); if (p.atkT >= hitT * 1.08) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const h = b.renderer.hero;
      return { id, kind: W.wp.kind, wkind: h.weapon ? h.weapon.kind : 'fists', family: h.family };
    }, { kind, step });
    if (r.kind !== kind || r.wkind !== kind || r.family !== fam) bad(`${fam}/${step}: в руке не то оружие ${JSON.stringify(r)}`);
    await page.screenshot({ path: join(out, `3d-swing-${fam}-${step}.png`), clip: { x: 45, y: 150, width: 300, height: 330 } });
  }
  await page.evaluate(() => { const W = window.__b3d.W; W.freeze = 0; W.player.state = 'idle'; });
  await ctx.close();
  for (const l of logs) bad(l);
} finally { await browser.close(); await dev.close(); }

if (problems.length) { console.error('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('Удары 3D в браузере: OK');
