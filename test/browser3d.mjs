// Браузерный тест 3D-прототипа: WebGL поднимается, вертикальный кадр, джойстик двигает героя, удар бьёт,
// ползунки меняют игру и переживают перезагрузку, нет ошибок в консоли. Скриншоты в test/out.
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
const problems = [], bad = m => problems.push(m), logs = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5179, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(url + '?shot'); await page.waitForTimeout(1500);

  const st = () => page.evaluate(() => { const W = window.__b3d.W, p = W.player; return { x: p.x, z: p.z, hp: p.hp, kills: W.kills, en: W.enemies.filter(e => !e.dead).length, t: W.t, state: p.state }; });
  if (await page.evaluate(() => !document.getElementById('nogl').hidden)) bad('WebGL не поднялся');
  const cv = await page.evaluate(() => { const c = document.getElementById('gl'); return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, ir: getComputedStyle(c).imageRendering }; });
  if (cv.cw !== 390 || cv.ch !== 664) bad('канвас не на весь экран ' + JSON.stringify(cv));
  if (cv.w > 390 || cv.w < 30) bad('внутреннее разрешение неожиданное ' + cv.w);
  console.log('канвас', JSON.stringify(cv));
  await page.screenshot({ path: join(out, '3d-start.png') });

  // джойстик: тап-перетаскивание в левой зоне, вверх по экрану = вперёд (−z)
  const s0 = await st();
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', 100, 450); await touch('touchMove', 100, 400); await page.waitForTimeout(700);
  const s1 = await st();
  await page.screenshot({ path: join(out, '3d-move.png') });
  await touch('touchEnd');
  if (!(s1.z < s0.z - 1.5)) bad(`джойстик вверх не двигает героя вперёд: z ${s0.z.toFixed(2)} → ${s1.z.toFixed(2)}`);
  if (await page.evaluate(() => window.__b3d.input.state.mx !== 0 || window.__b3d.input.state.mz !== 0)) bad('джойстик не обнулился после отпускания');

  // страница не листается и нет ссылок поверх игрового поля
  { const r = await page.evaluate(() => { const l = document.getElementById('back'), p = document.getElementById('panel'); return { inPanel: p.contains(l), scroll: [document.scrollingElement.scrollTop, document.scrollingElement.scrollHeight - innerHeight], pos: getComputedStyle(document.body).position }; });
    if (!r.inPanel) bad('ссылка на 2D лежит вне панели'); if (r.pos !== 'fixed') bad('страница не зафиксирована');
    const prevented = await page.evaluate(() => { const ev = new Event('touchmove', { cancelable: true, bubbles: true }); document.getElementById('gl').dispatchEvent(ev); return ev.defaultPrevented; });
    if (!prevented) bad('touchmove по полю не гасится (страница будет листаться)'); }
  // бой: ставим врага перед героем и бьём кнопкой
  await page.evaluate(() => { const w = window.__b3d.W, p = w.player; w.cfg.enemies.count = 0; w.enemies.length = 0; const e = { id: 999, type: 'imp', x: p.x + Math.sin(p.face) * 1.8, z: p.z + Math.cos(p.face) * 1.8, vx: 0, vz: 0, hp: 100, maxhp: 100, face: 0, state: 'chase', t: 0, cd: 5, flash: 0, dead: false, deadT: 0, hitMe: false }; w.enemies.push(e); });
  const b = await (await page.$('#bAtk')).boundingBox();
  await touch('touchStart', b.x + 20, b.y + 20); await page.waitForTimeout(250);
  await page.screenshot({ path: join(out, '3d-attack.png') });
  await page.waitForTimeout(500); await touch('touchEnd');
  const hp = await page.evaluate(() => window.__b3d.W.enemies.find(e => e.id === 999)?.hp ?? 0);
  if (!(hp < 100)) bad('удар кнопкой не задел врага');

  // дома: снаружи крыша видна, внутри тает, стены опускаются
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings[0]; w.enemies.length = 0; w.player.x = b.door.out.x + 2; w.player.z = b.door.out.z; w.player.inv = 1e9; });
  await page.waitForTimeout(900); await page.screenshot({ path: join(out, '3d-house-out.png') });
  if (await page.evaluate(() => window.__b3d.W.inside) !== -1) bad('снаружи дома герой «внутри»');
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings[0]; w.player.x = b.x; w.player.z = b.z; });
  await page.waitForTimeout(900); await page.screenshot({ path: join(out, '3d-house-in.png') });
  if (await page.evaluate(() => window.__b3d.W.inside) !== 0) bad('внутри дома герой не «внутри»');
  const roofA = await page.evaluate(() => window.__b3d.renderer.town.items[0].roof.visible);
  if (roofA) bad('крыша не скрылась, когда герой в доме');
  // сундук и дверь в браузере
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings[1]; w.player.hp = 40; w.player.x = b.chest.x; w.player.z = b.chest.z; });
  await page.waitForTimeout(500); await page.screenshot({ path: join(out, '3d-chest.png') });
  if (await page.evaluate(() => window.__b3d.W.map.buildings[1].chest.ready)) bad('сундук не открылся от касания');
  if (!(await page.$('#kills').then(e => e.textContent())).includes('пепел')) bad('в HUD нет пепла');
  await page.evaluate(() => { const w = window.__b3d.W, c = window.__b3d.cfg; w.player.x = -4; w.player.z = 2; c.view.camDist = 32; });
  await page.waitForTimeout(1200); await page.screenshot({ path: join(out, '3d-town.png') });
  await page.evaluate(() => { const w = window.__b3d.W; w.player.x = 0; w.player.z = 4; window.__b3d.cfg.view.camDist = 19; });

  // ползунки
  await page.tap('#gear'); await page.waitForTimeout(200);
  const rows = await page.$$eval('#tweaks input', a => a.length);
  if (rows < 10) bad('ползунков мало: ' + rows);
  const before = await page.evaluate(() => window.__b3d.cfg.view.camPitch);
  await page.evaluate(() => { const i = [...document.querySelectorAll('#tweaks input')][0]; i.value = i.min; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  const after = await page.evaluate(() => window.__b3d.cfg.view.camPitch);
  if (before === after) bad('ползунок не меняет настройку');
  await page.screenshot({ path: join(out, '3d-panel.png') });
  const frozen = await st(); await page.waitForTimeout(400); const f2 = await st();
  if (f2.t !== frozen.t) bad('мир идёт при открытой панели');
  await page.reload(); await page.waitForTimeout(800);
  const persisted = await page.evaluate(() => window.__b3d.cfg.view.camPitch);
  if (persisted !== after) bad(`настройка не пережила перезагрузку ${persisted} ≠ ${after}`);
  await page.tap('#gear'); await page.tap('#tweakReset');
  if (await page.evaluate(() => window.__b3d.cfg.view.camPitch) !== before) bad('«Сбросить» не вернул значение');
  await page.tap('#tweakClose');

  // смерть и возрождение
  await page.evaluate(() => { const p = window.__b3d.W.player; p.hp = 1; window.__b3d.W.enemies.push({ id: 1000, type: 'brute', x: p.x + .5, z: p.z, vx: 0, vz: 0, hp: 50, maxhp: 50, face: 0, state: 'wind', t: .99, cd: 0, flash: 0, dead: false, deadT: 0, hitMe: false }); });
  await page.waitForTimeout(2200);
  if (await page.evaluate(() => document.getElementById('dead').hidden)) bad('экран смерти не показан');
  else { await page.screenshot({ path: join(out, '3d-dead.png') }); await page.tap('#again'); if (await page.evaluate(() => window.__b3d.W.player.dead)) bad('не возродился'); }

  // горизонтальный экран
  await page.setViewportSize({ width: 664, height: 390 }); await page.waitForTimeout(400);
  if (await page.evaluate(() => document.getElementById('rotate').hidden)) bad('в альбомной ориентации нет подсказки повернуть');
  await page.setViewportSize({ width: 390, height: 664 });

  // кадры
  await page.waitForTimeout(500);
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 1500 ? requestAnimationFrame(f) : r(n / 1.5); }; f(); }));
  console.log('кадров/с (программный GL, для справки)', fps.toFixed(0));
} catch (e) { bad('исключение: ' + e.message); }
await browser.close(); await dev.close();
const fatal = logs.filter(l => !/GPU stall|swiftshader|GL Driver Message|ReadPixels/i.test(l));
if (fatal.length) bad('консоль: ' + fatal.slice(0, 5).join(' | '));
if (problems.length) { console.log('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('3D в браузере: OK');
