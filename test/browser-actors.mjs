// Готовые 3D-модели (3.80): с ?models=1 герой и враги — модели KayKit/Quaternius/Sketchfab со скелетом; ошибок нет; без параметра в автотестах — свои модели.
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { try { ({ chromium } = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'))); } catch { console.log('Playwright не найден — тест моделей пропущен'); process.exit(0); } }
const problems = [], bad = m => problems.push(m);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5194, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const base = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;
const skinned = page => page.evaluate(() => { let n = 0; window.__b3d.renderer.dbg.scene.traverse(o => { if (o.isSkinnedMesh && o.visible) n++; }); return n; });
async function open(q) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', e => bad('pageerror: ' + e.message)); page.on('console', m => { if (/модель не загрузилась/.test(m.text())) bad(m.text()); });
  await page.goto(base + q, { timeout: 60000 }); await page.waitForFunction(() => window.__b3d && window.__b3d.W);
  await page.locator('#heroCards button').first().click(); await page.waitForFunction(() => document.getElementById('heroPick').hidden);
  for (let k = 0; k < 30 && !(await page.evaluate(() => document.getElementById('dialog').hidden)); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  return page;
}
try {
  { const page = await open(''); await page.waitForTimeout(1500); const n = await skinned(page); if (n) bad('без ?models=1 в автотесте есть модели со скелетом: ' + n); await page.context().close(); }
  const page = await open('?models=1');
  await page.waitForFunction(() => { let n = 0; window.__b3d.renderer.dbg.scene.traverse(o => { if (o.isSkinnedMesh) n++; }); return n > 0; }, null, { timeout: 60000 }).catch(() => bad('модель героя не появилась'));
  const n0 = await skinned(page);
  await page.evaluate(async () => { const W = window.__b3d.W, S = await import('/3d/src/sim.js'), p = W.player; p.inv = 999;
    ['imp', 'hound', 'lunger', 'archer', 'troll', 'ghoul', 'golem', 'drowned'].forEach((t, i) => { const a = i / 8 * 6.28, e = S.spawnEnemy(W, t, p.x + Math.sin(a) * 6, p.z + Math.cos(a) * 6); e.alert = false; }); });
  await page.waitForTimeout(8000);
  const n1 = await skinned(page);
  if (!(n1 > n0)) bad(`враги не получили готовые модели: ${n0} → ${n1}`);
  await page.keyboard.down('Space'); await page.waitForTimeout(300); await page.keyboard.up('Space'); await page.waitForTimeout(500);
  await page.locator('#bagBtn').click(); await page.waitForTimeout(1500);
  if (!(await page.locator('canvas.herov').count())) bad('в сумке нет холста героя');
  console.log(`  моделей со скелетом: герой ${n0}, с врагами ${n1}`);
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'actors-bag.png') });
} finally { await browser.close(); await dev.close(); }
if (problems.length) { console.log('ПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('Готовые модели 3D: OK');
