// Снимки «было — стало» для материалов (T0): лагерь на Маке и телефоне. node test/shots-paint.mjs <папка> [flat]
// flat — без материалов (?flat). Не входит в test:browser: только для сравнения глазами.
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = process.argv[2] || join(root, 'test', 'out'), tag = process.argv[3] === 'flat' ? 'flat' : 'paint';
mkdirSync(out, { recursive: true });
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'))); }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5191, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html?shot&hero=thorn` + (tag === 'flat' ? '&flat' : '');
const SPOTS = [['fire', 0, 4], ['stalls', 12, 12], ['smithy', 8, -2], ['house', -9, -1], ['wall', 18, 21]];
let code = 0;
try {
  for (const [dev_, vp] of [['mac', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }]]) {
    const ctx = await browser.newContext(vp), page = await ctx.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', e => { console.log('pageerror: ' + e.message); code = 1; });
    page.on('console', m => { if (m.type() === 'error' && /shader|program|glsl/i.test(m.text())) { console.log('шейдер: ' + m.text().slice(0, 400)); code = 1; } });
    await page.goto(url); await page.waitForTimeout(2500);
    for (const [name, x, z] of SPOTS) {
      await page.evaluate(([x, z]) => { const b = window.__b3d, W = b.W; W.player.maxhp = W.player.hp = 1e6; W.enemies.forEach(e => { e.dead = true; }); W.player.x = x; W.player.z = z; }, [x, z]);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(out, `${tag}-${dev_}-${name}.png`) });
      if (dev_ === 'mac') await page.screenshot({ path: join(out, `${tag}-close-${name}.png`), clip: { x: 400, y: 200, width: 640, height: 440 } });     // крупный план у героя
    }
    await ctx.close();
  }
} finally { await browser.close(); await dev.close(); }
console.log('снимки:', out, tag); process.exit(code);
