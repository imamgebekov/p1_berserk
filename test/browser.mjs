// Смоук-тест в настоящем Chromium: мобильный вьюпорт iPhone, касания по кнопкам, ошибки консоли, время кадра,
// размеры кнопок (≥ 44 px) и отсутствие пересечений. Скриншоты — в test/out/.
// Если Playwright не установлен — тест пропускается (код 0).
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
  catch { console.log('Playwright не найден — браузерный тест пропущен'); process.exit(0); }
}

const server = await createServer({ root, server: { port: 5199, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.config.server.port}/`;

const problems = [];
const browser = await chromium.launch();
async function session(label, device) {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(url);
  await page.waitForSelector('#go');
  await page.tap('#go');

  // геометрия кнопок
  const geo = await page.evaluate(() => [...document.querySelectorAll('.btn,#mute,.veil button')].map(b => {
    const r = b.getBoundingClientRect(); return { id: b.id, x: r.x, y: r.y, w: r.width, h: r.height, vis: !!(r.width && r.height) };
  }));
  for (const b of geo.filter(b => b.vis)) {
    if (b.w < 44 || b.h < 44) problems.push(`${label}: кнопка #${b.id} ${b.w}×${b.h} < 44px`);
  }
  const pad = geo.filter(b => ['bl', 'br', 'batk', 'bjump', 'bbrand'].includes(b.id));
  for (let i = 0; i < pad.length; i++) for (let j = i + 1; j < pad.length; j++) {
    const a = pad[i], c = pad[j];
    if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) problems.push(`${label}: кнопки #${a.id} и #${c.id} пересекаются`);
  }

  // играем касаниями: идём вправо, бьём, прыгаем, жмём Клеймо
  const hold = async (sel, ms) => {
    const box = await page.locator(sel).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.dispatchEvent(sel, 'pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y });
    await page.waitForTimeout(ms);
    await page.dispatchEvent(sel, 'pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y });
  };
  await page.evaluate(() => { window.__frames = []; let p = performance.now(); const f = n => { window.__frames.push(n - p); p = n; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await hold('#br', 2500);
  for (let i = 0; i < 6; i++) { await hold('#batk', 350); await hold('#bjump', 150); }
  await hold('#bbrand', 80);
  await hold('#bl', 800);
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const fr = window.__frames.slice(10).sort((a, b) => a - b);
    const W = window.__berserk.W;
    return { n: fr.length, p50: fr[fr.length >> 1], p95: fr[Math.floor(fr.length * .95)], max: fr[fr.length - 1], T: W.T, enemies: W.enemies.length,
      hud: document.getElementById('stats').textContent, canvas: [document.getElementById('c').width, document.getElementById('c').height] };
  });
  await page.screenshot({ path: join(out, label.replace(/\W+/g, '_') + '.png') });
  console.log(' ', label, JSON.stringify(info));
  if (info.n < 30) problems.push(`${label}: за тест отрисовано всего ${info.n} кадров`);
  if (info.T < 2) problems.push(`${label}: игровое время почти не шло (${info.T})`);
  // ошибки консоли
  for (const l of logs) problems.push(`${label}: ${l}`);
  await ctx.close();
}

try {
  await session('iPhone 14 портрет', { viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await session('iPhone SE портрет', { viewport: { width: 375, height: 553 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await session('reduced-motion', { viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
} finally { await browser.close(); await server.close(); }

if (problems.length) { console.error('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('OK');
