// Замер на настоящей видеокарте Мака (T6): Chromium + Metal без ограничения 60 к/с, медиана по повторам.
// npm run bench:gpu -- [режимы flat,nodetails,full] [плотность 2] [доп. параметры адреса] [two|all места] [повторов 3]
// BR=webkit — движок Safari (без экрана он ограничен 30 к/с), PHONE=1 — экран телефона 390×844. Не входит в тесты: числа зависят от машины.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pw = await import('playwright');
const modes = (process.argv[2] || 'flat,nodetails,full').split(','), dpr = Number(process.argv[3] || 2), Q = process.argv[4] || '';
const WK = process.env.BR === 'webkit', browser = WK ? await pw.webkit.launch() : await pw.chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const dev = await createServer({ root, server: { port: 5197, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const SPOTS = (process.argv[5] === 'all' ? [['лагерь', 0, 4], ['лес', 84, 206], ['замок', -250, -58], ['склеп', -.5, 2, 'crypt_pogost']] : [['лагерь', 0, 4], ['лес', 84, 206]]), REP = Number(process.argv[6] || 3);
const Q_ = { flat: '&flat', nodetails: '&nodetails', nofeel: '&nofeel', full: '' };
const res = {};
const order = []; for (let k = 0; k < REP; k++) for (const m of modes) order.push(m);
for (const mode of order) {
  const ctx = await browser.newContext(process.env.PHONE ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: !WK || undefined, hasTouch: true } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr }), page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${dev.config.server.port}/3d/index.html?shot&hero=thorn${Q_[mode]}${Q}`);
  await page.waitForFunction(() => window.__b3d && window.__b3d.W, null, { timeout: 30000 });
  for (const [name, x, z, lvl] of SPOTS) {
    await page.evaluate(([x, z, lvl]) => { const b = window.__b3d, W = b.W; W.player.maxhp = W.player.hp = 1e6; if (b.cfg.weather) b.cfg.weather.force = 'clear'; if (lvl) b.travel(lvl, x, z); W.enemies.forEach(e => { e.dead = true; }); W.player.x = x; W.player.z = z; }, [x, z, lvl]);
    await page.waitForTimeout(3500);
    const r = await page.evaluate(() => new Promise(done => { const t0 = performance.now(); let n = 0; const ms = []; let last = t0;
      const f = t => { n++; ms.push(t - last); last = t; if (t - t0 < 4000) requestAnimationFrame(f); else { ms.sort((a, b) => a - b); const i = window.__b3d.renderer.info(); done({ fps: n / ((t - t0) / 1000), p95: ms[Math.floor(ms.length * .95)], calls: i.calls, tris: i.triangles }); } };
      requestAnimationFrame(f); }));
    ((res[name] ||= {})[mode] ||= []).push(r);
  }
  await ctx.close();
}
await browser.close(); await dev.close();
console.log('место'.padEnd(8), modes.map(m => m.padStart(22)).join(''));
for (const [name, row] of Object.entries(res)) console.log(name.padEnd(8), modes.map(m => { const a = row[m]; if (!a) return ''.padStart(22); a.sort((x, y) => x.fps - y.fps); const r = a[a.length >> 1]; return r ? `${r.fps.toFixed(0)} к/с p95 ${r.p95.toFixed(1)} ${r.calls}в`.padStart(22) : ''.padStart(22); }).join(''));
