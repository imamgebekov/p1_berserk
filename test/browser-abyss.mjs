// «Бездна» и подвиги (этап 6 «круче»): вход у люка, зачистка, спуск с пересборкой яруса, вкладка «Подвиги», кнопка «Нового круга».
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { try { ({ chromium } = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'))); } catch { console.log('Playwright не найден — тест Бездны пропущен'); process.exit(0); } }
const problems = [], bad = m => problems.push(m);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5188, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', e => bad('pageerror: ' + e.message));
  await page.goto(url, { timeout: 30000 }); await page.waitForFunction(() => window.__b3d && window.__b3d.W);
  await page.locator('#heroCards button').first().click(); await page.waitForFunction(() => document.getElementById('heroPick').hidden);
  for (let k = 0; k < 30 && !(await page.evaluate(() => document.getElementById('dialog').hidden)); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  // вход в Бездну
  await page.evaluate(() => { const W = window.__b3d.W, h = W.levels.surface.map.portals.find(q => q.abyssEnter); W.lv = 40; W.player.x = h.x; W.player.z = h.z; });
  await page.waitForFunction(() => !document.getElementById('portalBtn').hidden && !document.getElementById('heroicBtn').hidden);
  const btns = await page.evaluate(() => [document.getElementById('portalBtn').textContent, document.getElementById('heroicBtn').textContent]);
  if (!/Бездна/.test(btns[0]) || !/Затмение недели/.test(btns[1])) bad('кнопки у люка: ' + JSON.stringify(btns));
  await page.locator('#portalBtn').click();
  await page.waitForFunction(() => window.__b3d.W.lvl === 'abyss' && /Бездна · ярус 1/.test(document.getElementById('tracker').textContent));
  await page.waitForTimeout(800);
  // зачистка и спуск: новый ярус — новая карта и новый вид
  await page.evaluate(() => { const W = window.__b3d.W; for (const e of W.enemies) W.fx.kill(e); });
  await page.waitForFunction(() => /спуск открыт/.test(document.getElementById('tracker').textContent));
  await page.evaluate(() => { const W = window.__b3d.W, d = W.map.portals.find(q => q.abyssNext); W.player.x = d.x; W.player.z = d.z; });
  await page.waitForFunction(() => !document.getElementById('portalBtn').hidden && /ярус 2/.test(document.getElementById('portalBtn').textContent));
  await page.locator('#portalBtn').click();
  await page.waitForFunction(() => window.__b3d.W.abyss && window.__b3d.W.abyss.tier === 2);
  await page.waitForTimeout(1200);
  const vis = await page.evaluate(() => { const r = window.__b3d.renderer.dbg.scene; let n = 0; r.traverse(o => { if (o.visible && o.isMesh) n++; }); return n; });
  if (vis < 20) bad('ярус 2 почти пуст: видимых мешей ' + vis);
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'abyss-tier2.png') });
  // подвиги в журнале
  await page.evaluate(() => window.__b3d.journal.open('ach'));
  await page.waitForTimeout(300);
  const jt = await page.evaluate(() => document.getElementById('journalList').textContent);
  if (!/Подвиги: \d+ из \d+/.test(jt) || !/Первая кровь/.test(jt)) bad('вкладка «Подвиги»: ' + jt.slice(0, 120));
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'ach-tab.png') });
  await page.evaluate(() => window.__b3d.journal.close());
  // «Новый круг» скрыт до конца сюжета
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('panel').hidden);
  if (!(await page.evaluate(() => document.getElementById('ngBtn').hidden))) bad('кнопка «Новый круг» видна до конца сюжета');
  await ctx.close();
  console.log(`Бездна: ярус 2, видимых мешей ${vis}`);
} finally { await browser.close(); await dev.close(); }
if (problems.length) { console.log('Бездна и подвиги 3D: ПРОВАЛ\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('Бездна и подвиги 3D: OK');
