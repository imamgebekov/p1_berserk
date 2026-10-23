// «Новая игра» (меню → «Игра», удержание 1,5 с): после перезагрузки нет старого прогресса — уровень 1, выбор героя, пустая сумка;
// настройки (звук) остаются. Раньше автосохранение при уходе со страницы возвращало старый прогресс.
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { try { ({ chromium } = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'))); } catch { console.log('Playwright не найден — тест новой игры пропущен'); process.exit(0); } }
const problems = [], bad = m => problems.push(m);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5186, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => bad('pageerror: ' + e.message));
  await page.goto(url, { timeout: 30000 }); await page.waitForFunction(() => window.__b3d && window.__b3d.W);
  if (!(await page.evaluate(() => !document.getElementById('heroPick').hidden))) bad('первый запуск: нет выбора героя');
  await page.locator('#heroCards button').first().click(); await page.waitForFunction(() => document.getElementById('heroPick').hidden);
  for (let k = 0; k < 20 && !(await page.evaluate(() => document.getElementById('dialog').hidden)); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(100); }
  await page.evaluate(() => { const b = window.__b3d, W = b.W; W.lv = 17; W.xp = 50; W.inv.ash = 999; localStorage.setItem('berserk3d.mute', '1'); b.saver.write(true); });
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('berserk3d.save') || 'null'));
  if (!before || before.prog.lv !== 17) bad('прогресс до новой игры не сохранился: ' + JSON.stringify(before && before.prog));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('panel').hidden);
  const bb = await page.locator('#saveReset').boundingBox();
  const nav = page.waitForEvent('framenavigated', { predicate: f => f === page.mainFrame(), timeout: 60000 });     // 2026-10-23: ждём саму перезагрузку, а не «load» — загрузка с vite бывает дольше 20 с
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(2500);
  await nav; await page.mouse.up().catch(() => {});
  await page.waitForFunction(() => window.__b3d && window.__b3d.W, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ lv: window.__b3d.W.lv, ash: window.__b3d.W.inv.ash, pick: !document.getElementById('heroPick').hidden, save: JSON.parse(localStorage.getItem('berserk3d.save') || 'null'), mute: localStorage.getItem('berserk3d.mute') }));
  if (after.lv !== 1) bad(`после новой игры уровень ${after.lv}, а не 1`);
  if (after.ash === 999) bad('после новой игры пепел остался');
  if (!after.pick) bad('после новой игры нет выбора героя');
  if (after.save && after.save.prog && after.save.prog.lv !== 1) bad('в сохранении старый уровень ' + after.save.prog.lv);
  if (after.mute !== '1') bad('новая игра сбросила настройку звука');
  await ctx.close();
} finally { await browser.close(); await dev.close(); }
if (problems.length) { console.log('Новая игра 3D: ПРОВАЛ\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('Новая игра 3D: OK (уровень 1, выбор героя, настройки на месте)');
