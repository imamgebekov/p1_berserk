// Браузерный тест «шлифовки для телефона»: чёткие пиксели, пауза, автопауза, поворот, настройки (левша, громкость),
// установка (манифест, иконки) и офлайн через service worker.
import { createServer, build, preview } from 'vite';
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
  catch { console.log('Playwright не найден — браузерный тест пропущен'); process.exit(0); }
}
const problems = [], bad = m => problems.push(m);
const device = { viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const browser = await chromium.launch();
const dev = await createServer({ root, server: { port: 5177, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/`;
let prev = null;

async function open(ctx, label, logs) {
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(label + ' ' + m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push(label + ' pageerror: ' + e.message));
  await page.goto(url); await page.waitForSelector('#go');
  return page;
}
const geo = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(); return { id: e.id, x: r.x, y: r.y, w: r.width, h: r.height }; }), sel);

try {
  console.log('раздел 1: чёткие пиксели');
  // ---------- 1. чёткие пиксели ----------
  for (const [w, h, dpr] of [[390, 664, 3], [375, 553, 2], [430, 760, 3], [320, 540, 2]]) {
    const logs = []; const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
    const page = await open(ctx, `пиксели ${w}×${h}`, logs); await page.tap('#go'); await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const V = window.__berserk.V, cv = document.getElementById('c'), hud = document.getElementById('hud').getBoundingClientRect(), c = cv.getBoundingClientRect();
      return { S: V.S, LW: V.LW, LH: V.LH, cw: cv.width, ch: cv.height, cssW: c.width, cssH: c.height, bottomGap: hud.bottom - c.bottom, left: c.left, right: hud.right - c.right, dpr: devicePixelRatio }; });
    if (!Number.isInteger(r.S) || r.cw !== r.LW * r.S || r.ch !== r.LH * r.S) bad(`пиксели ${w}×${h}: масштаб/размеры ${JSON.stringify(r)}`);
    if (Math.abs(r.bottomGap) > 1) bad(`пиксели ${w}×${h}: холст не прижат к низу сцены (${r.bottomGap})`);
    if (r.left < 0 || r.right < -1 || r.left + r.right > r.S / Math.min(r.dpr, 2) + 2) bad(`пиксели ${w}×${h}: боковые поля ${r.left}/${r.right}`);
    const effDpr = Math.min(r.dpr, 2); if (Math.abs(r.cssW * effDpr - r.cw) > .5) bad(`пиксели ${w}×${h}: css-размер ${r.cssW} не соответствует ${r.cw}/${effDpr}`);
    await ctx.close(); for (const l of logs) bad(l);
  }

  console.log('раздел 2: пауза и настройки');
  // ---------- 2. пауза, автопауза, настройки ----------
  {
    const logs = []; const ctx = await browser.newContext(device); let page = await open(ctx, 'пауза', logs);
    // настройки с экрана входа: без паузы
    await page.tap('#startSettings'); await page.waitForSelector('#pause:not([hidden])');
    const pre = await page.evaluate(() => ({ title: document.getElementById('pauseTitle').textContent, hold: window.__berserk.W.hold, btn: document.getElementById('resume').textContent }));
    if (pre.title !== 'Настройки' || pre.hold || pre.btn !== 'Назад') bad('настройки на экране входа: ' + JSON.stringify(pre));
    await page.tap('#resume'); if (!(await page.locator('#pause').isHidden())) bad('«Назад» не закрыл настройки');
    await page.tap('#go');
    const pb = (await geo(page, '#pauseBtn'))[0]; if (pb.w < 44 || pb.h < 44) bad(`кнопка «Пауза» ${pb.w}×${pb.h}`);
    await page.evaluate(() => { const B = window.__berserk; B.W.spawnT = 999; B.P.x = 600; });
    await page.tap('#pauseBtn'); await page.waitForSelector('#pause:not([hidden])');
    const t0 = await page.evaluate(() => ({ timer: window.__berserk.W.timer, x: window.__berserk.P.x, hold: window.__berserk.W.hold }));
    await page.waitForTimeout(600);
    const t1 = await page.evaluate(() => ({ timer: window.__berserk.W.timer, x: window.__berserk.P.x }));
    if (!t0.hold) bad('пауза не включила hold'); if (t1.timer !== t0.timer) bad(`таймер затмения шёл на паузе: ${t0.timer} → ${t1.timer}`);
    const ctl = await geo(page, '#setVol, #setMute, #setLefty, #setReduce, #resume');
    for (const c of ctl) if (c.h < 44) bad(`элемент настроек #${c.id} высотой ${c.h}`);
    const over = await page.evaluate(() => document.getElementById('pause').scrollWidth > innerWidth + 1);
    if (over) bad('пауза выходит по ширине');
    await page.screenshot({ path: join(out, 'polish_pause.png') });
    await page.tap('#resume'); await page.waitForTimeout(300);
    const t2 = await page.evaluate(() => ({ hold: window.__berserk.W.hold, timer: window.__berserk.W.timer }));
    if (t2.hold || t2.timer >= t1.timer) bad('игра не продолжилась после «Продолжить»: ' + JSON.stringify(t2));

    // автопауза при сворачивании
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    if (!(await page.evaluate(() => window.__berserk.W.hold && !document.getElementById('pause').hidden))) bad('автопауза при сворачивании не сработала');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    if (!(await page.evaluate(() => window.__berserk.W.hold))) bad('после возврата игра не должна продолжаться сама (нужно «Продолжить»)');
    await page.tap('#resume');

    // автопауза не включается поверх открытой сумки
    await page.tap('#mbag'); await page.waitForSelector('#bag:not([hidden])');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); });
    if (!(await page.locator('#pause').isHidden())) bad('автопауза открылась поверх сумки');
    await page.tap('#bagClose');

    console.log('  автопауза проверена');
    // поворот телефона
    await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(450);
    const rot = await page.evaluate(() => ({ shown: !document.getElementById('rotate').hidden, hold: window.__berserk.W.hold }));
    if (!rot.shown || !rot.hold) bad('экран «поверните телефон» не показан в горизонтали: ' + JSON.stringify(rot));
    await page.screenshot({ path: join(out, 'polish_rotate.png') });
    await page.setViewportSize({ width: 390, height: 664 }); await page.waitForTimeout(450);
    const back = await page.evaluate(() => ({ shown: !document.getElementById('rotate').hidden, hold: window.__berserk.W.hold }));
    if (back.shown || back.hold) bad('экран поворота не исчез в вертикали: ' + JSON.stringify(back));

    console.log('  поворот проверен');
    // левша
    const before = await geo(page, '.btn'); const pos = id => before.find(b => b.id === id);
    await page.tap('#pauseBtn'); await page.tap('#setLefty');
    if (!(await page.evaluate(() => document.body.classList.contains('lefty')))) bad('класс lefty не включился');
    await page.tap('#resume'); await page.waitForTimeout(100);
    const after = await geo(page, '.btn, .mbtn'); const p2 = id => after.find(b => b.id === id);
    if (!(p2('batk').x < p2('bl').x && p2('bjump').x < p2('br').x && pos('batk').x > pos('bl').x)) bad('раскладка левши не зеркальна: ' + JSON.stringify(after.map(a => [a.id, Math.round(a.x)])));
    const pad = after.filter(g => ['bl', 'br', 'batk', 'bjump', 'broll', 'bbrand', 'mhero', 'mbag', 'mskills'].includes(g.id));
    for (let i = 0; i < pad.length; i++) for (let j = i + 1; j < pad.length; j++) { const a = pad[i], c = pad[j]; if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) bad(`левша: кнопки #${a.id} и #${c.id} пересекаются`); }
    for (const b of pad) if (b.x < 0 || b.x + b.w > 391) bad(`левша: кнопка #${b.id} вне экрана`);
    await page.screenshot({ path: join(out, 'polish_lefty.png') });

    console.log('  левша проверена');
    // громкость и «меньше движения» сохраняются между запусками
    await page.tap('#pauseBtn');
    await page.locator('#setVol').evaluate(el => { el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.tap('#setReduce');
    const stt = await page.evaluate(() => JSON.parse(localStorage.getItem('berserk.settings')));
    if (stt.volume !== .4 || stt.lefty !== true || stt.reduce !== 'on') bad('настройки не сохранились: ' + JSON.stringify(stt));
    if (!(await page.evaluate(() => document.body.classList.contains('reduce')))) bad('«меньше движения» не включило класс reduce');
    await page.tap('#setMute'); if ((await page.evaluate(() => JSON.parse(localStorage.getItem('berserk.settings')).muted)) !== true) bad('«звук выкл» не сохранился');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload(); await page.waitForSelector('#go');
    const re = await page.evaluate(() => ({ lefty: document.body.classList.contains('lefty'), reduce: document.body.classList.contains('reduce') }));
    if (!re.lefty || !re.reduce) bad('настройки не применились после перезагрузки: ' + JSON.stringify(re));
    await page.tap('#startSettings'); const vol = await page.locator('#setVol').inputValue(); if (vol !== '40') bad('ползунок громкости после перезагрузки: ' + vol);
    await page.tap('#resume');

    // настройки переживают сброс прогресса
    await page.tap('#go'); await page.tap('#mhero'); await page.waitForSelector('#heroTab:not([hidden])');
    await page.tap('#resetBtn'); await Promise.all([page.waitForNavigation(), page.tap('#resetBtn')]); await page.waitForSelector('#go');
    if (!(await page.evaluate(() => document.body.classList.contains('lefty') && localStorage.getItem('berserk.settings') !== null))) bad('сброс прогресса стёр настройки');
    await ctx.close(); for (const l of logs) bad(l);
  }

  console.log('раздел 3: установка и офлайн');
  // ---------- 3. установка и офлайн ----------
  {
    await dev.close();                                  // dev-сервер выставляет NODE_ENV=development, а сборке нужен production
    process.env.NODE_ENV = 'production';
    await build({ root, logLevel: 'silent' });
    prev = await preview({ root, preview: { port: 5178, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
    const purl = `http://127.0.0.1:${prev.config.preview.port}/`;
    const logs = []; const ctx = await browser.newContext(device);
    const page = await ctx.newPage(); page.setDefaultTimeout(10000);
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push('офлайн ' + m.type() + ': ' + m.text()); });
    page.on('pageerror', e => logs.push('офлайн pageerror: ' + e.message));
    await page.goto(purl); await page.waitForSelector('#go');
    const head = await page.evaluate(() => ({ manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'), apple: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'),
      capable: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content, vp: document.querySelector('meta[name=viewport]')?.content }));
    if (!head.manifest || !head.apple || head.capable !== 'yes' || !head.vp.includes('viewport-fit=cover')) bad('мета для установки: ' + JSON.stringify(head));
    const swText = await (await page.request.get(purl + 'sw.js')).text();
    if (swText.includes('_headers') || swText.includes('.nojekyll')) bad('service worker пытается кэшировать служебные файлы хостинга');
    const man = await (await page.request.get(purl + 'manifest.webmanifest')).json();
    if (man.display !== 'standalone' || man.orientation !== 'portrait' || !man.icons.some(i => i.sizes === '512x512') || man.start_url !== './') bad('манифест: ' + JSON.stringify(man));
    for (const f of ['icon-180.png', 'icon-192.png', 'icon-512.png']) { const r = await page.request.get(purl + f); if (!r.ok() || !(r.headers()['content-type'] || '').includes('png')) bad(`иконка ${f}: ${r.status()} ${r.headers()['content-type']}`); }
    const swOk = await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise(r => setTimeout(() => r(false), 6000))]));
    if (!swOk) bad('service worker не зарегистрировался (нет import.meta.env.PROD?)');
    await page.waitForFunction(async () => (await caches.keys()).some(k => k.startsWith('berserk-')) && (await (await caches.open((await caches.keys())[0])).keys()).length >= 6, null, { timeout: 8000 }).catch(() => bad('service worker не закэшировал сборку'));
    await page.reload(); await page.waitForSelector('#go');   // чтобы страница управлялась SW
    await ctx.setOffline(true);
    await page.reload(); await page.waitForSelector('#go');
    const off = await page.evaluate(() => ({ controlled: !!navigator.serviceWorker.controller, ok: !!window.__berserk }));
    if (!off.controlled || !off.ok) bad('офлайн: страница не загрузилась из кэша ' + JSON.stringify(off));
    await page.tap('#go'); await page.waitForTimeout(800);
    if (!(await page.evaluate(() => window.__berserk.W.started && window.__berserk.W.T > .3))) bad('офлайн: игра не запустилась');
    await ctx.setOffline(false);
    await ctx.close(); for (const l of logs) bad(l);
  }
} finally { await browser.close(); await dev.close().catch(() => {}); if (prev) await new Promise(r => prev.httpServer.close(r)); }

if (problems.length) { console.error('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('Браузерный тест шлифовки: OK');
