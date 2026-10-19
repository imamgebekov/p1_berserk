// Снимки «было — стало» для материалов (T0–T2): лагерь и природа на Маке и телефоне. node test/shots-paint.mjs <папка> [flat|paint] [camp|nature]
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
const SETS = { camp: [['fire', 0, 4], ['stalls', 12, 12], ['smithy', 8, -2], ['house', -9, -1], ['wall', 18, 21]],
  nature: [['forest', 84, 206], ['rocks', 100, -168], ['river', 4, -48], ['cliff', 21, -456]] };
const SPOTS = SETS[process.argv[4] || 'camp'], wait = process.argv[4] === 'nature' ? 14000 : 2500;
let code = 0;
try {
  for (const [dev_, vp] of [['mac', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }]]) {
    const ctx = await browser.newContext(vp), page = await ctx.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', e => { console.log('pageerror: ' + e.message); code = 1; });
    page.on('console', m => { if (m.type() === 'error' && /shader|program|glsl/i.test(m.text())) { console.log('шейдер: ' + m.text().slice(0, 400)); code = 1; } });
    await page.goto(url); await page.waitForTimeout(2500);
    if (dev_ === 'mac' && tag === 'paint') {                                   // все виды материалов собираются в шейдер без ошибок
      const bad = await page.evaluate(async () => {
        const P = await import('/3d/src/paint3d.js'), r = window.__b3d.renderer; let src = null;
        r.scene.traverse(o => { if (!src && o.isMesh && o.material && o.material.isMeshLambertMaterial) src = o; });
        const ms = P.PAINT_KINDS.map(k => { const m = P.paintMat(new src.material.constructor({ color: '#6a5a4a' }), k); const o = new src.constructor(src.geometry, m); o.position.copy(r.camera.position); o.position.y -= 3; r.scene.add(o); return o; });
        r.gl.compile(r.scene, r.camera); r.gl.render(r.scene, r.camera);
        const errs = r.gl.info.programs.filter(p => p.diagnostics && !p.diagnostics.runnable).map(p => p.name);
        ms.forEach(o => r.scene.remove(o)); return errs;
      });
      if (bad.length) { console.log('шейдер не собран:', bad.join(', ')); code = 1; } else console.log('все виды материалов собраны');
    }
    for (const [name, x, z] of SPOTS) {
      await page.evaluate(([x, z]) => { const b = window.__b3d, W = b.W; W.player.maxhp = W.player.hp = 1e6; W.enemies.forEach(e => { e.dead = true; }); W.player.x = x; W.player.z = z; }, [x, z]);
      await page.waitForTimeout(wait); await page.evaluate(() => window.__b3d.W.enemies.forEach(e => { e.dead = true; }));
      await page.screenshot({ path: join(out, `${tag}-${dev_}-${name}.png`) });
      if (dev_ === 'mac') await page.screenshot({ path: join(out, `${tag}-close-${name}.png`), clip: { x: 400, y: 200, width: 640, height: 440 } });     // крупный план у героя
    }
    await ctx.close();
  }
} finally { await browser.close(); await dev.close(); }
console.log('снимки:', out, tag); process.exit(code);
