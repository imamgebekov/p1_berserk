// «Кинокамера» сцен (этап 5 «круче»): в разговоре — полосы кадра, наезд камеры, интерфейс скрыт; после — всё как было.
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { try { ({ chromium } = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'))); } catch { console.log('Playwright не найден — тест кинокамеры пропущен'); process.exit(0); } }
const problems = [], bad = m => problems.push(m);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5187, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => bad('pageerror: ' + e.message));
  await page.goto(url); await page.waitForFunction(() => window.__b3d && window.__b3d.W);
  await page.locator('#heroCards button').first().click(); await page.waitForFunction(() => document.getElementById('heroPick').hidden);
  await page.waitForFunction(() => !document.getElementById('dialog').hidden, null, { timeout: 15000 }).catch(() => bad('пролог не открылся'));
  await page.waitForFunction(() => window.__b3d.renderer.cineAmt() > .7 && document.getElementById('cineTop').getBoundingClientRect().height > 30 && getComputedStyle(document.getElementById('tracker')).opacity === '0', null, { timeout: 20000 }).catch(() => {});     // программный рендер медленный — ждём условие
  const on = await page.evaluate(() => ({ cine: document.body.classList.contains('cine'), bar: document.getElementById('cineTop').getBoundingClientRect().height, amt: window.__b3d.renderer.cineAmt(), hud: getComputedStyle(document.getElementById('tracker')).opacity }));
  if (!on.cine) bad('в разговоре нет режима сцены');
  if (!(on.bar > 30)) bad(`полоса кадра ${on.bar} пк`);
  if (!(on.amt > .7)) bad(`камера не наехала: ${on.amt}`);
  if (on.hud !== '0') bad('трекер не скрыт в разговоре: ' + on.hud);
  for (let k = 0; k < 20 && !(await page.evaluate(() => document.getElementById('dialog').hidden)); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(100); }
  await page.waitForFunction(() => window.__b3d.renderer.cineAmt() < .05, null, { timeout: 20000 }).catch(() => {});
  const off = await page.evaluate(() => ({ cine: document.body.classList.contains('cine'), amt: window.__b3d.renderer.cineAmt() }));
  if (off.cine) bad('режим сцены остался после разговора');
  if (!(off.amt < .05)) bad(`камера не вернулась: ${off.amt}`);
  await ctx.close();
  console.log(`кинокамера: полоса ${Math.round(on.bar)} пк, наезд ${on.amt.toFixed(2)} → ${off.amt.toFixed(3)}`);
} finally { await browser.close(); await dev.close(); }
if (problems.length) { console.log('Кинокамера 3D: ПРОВАЛ\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('Кинокамера 3D: OK');
