// Браузерный тест 3D в WebKit (движок Safari на Маке и iPhone): игра грузится без ошибок и идёт; на Маке выбор героя,
// меню целиком без прокрутки, окна не выходят за экран, смена героя сохраняет прогресс, клавиша умения работает;
// на iPhone выбор героя касанием, кнопка «Удар» бьёт. Если WebKit для Playwright не установлен — тест пропускается.
// Скриншоты: test/out/3d-safari-*.png
import { createServer } from 'vite';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'test', 'out'); mkdirSync(out, { recursive: true });
let webkit;
try { ({ webkit } = await import('playwright')); if (!existsSync(webkit.executablePath())) throw new Error('нет WebKit'); }
catch { console.log('WebKit для Playwright не найден — тест Safari пропущен (npx playwright install webkit)'); process.exit(0); }
const problems = [], bad = m => problems.push(m), logs = [];
const browser = await webkit.launch();
const dev = await createServer({ root, server: { port: 5183, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;
const watch = pg => { pg.setDefaultTimeout(8000); pg.on('pageerror', e => logs.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text()); }); };
const runs = pg => pg.evaluate(async () => { const t0 = window.__b3d.W.t; await new Promise(r => setTimeout(r, 900)); return window.__b3d.W.t > t0; });

try {
  // ---- Мак (Safari) ----
  { const ctx = await browser.newContext({ viewport: { width: 1440, height: 780 }, deviceScaleFactor: 2 }), pg = await ctx.newPage(); watch(pg);
    await pg.goto(url + '?shot'); await pg.waitForTimeout(1500);
    if (!(await pg.evaluate(() => !document.getElementById('heroPick').hidden))) bad('Мак: нет выбора героя при новой игре');
    await pg.keyboard.press('Digit3'); await pg.waitForFunction(() => window.__b3d.W.hero === 'jay', null, { timeout: 4000 }).catch(() => bad('Мак: 3 не выбрала Сойку'));
    if (!(await runs(pg))) bad('Мак: игра стоит');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
    const menu = await pg.evaluate(() => { const b = document.querySelector('#panel .pbox'), r = b.getBoundingClientRect(); return { fit: b.scrollHeight <= b.clientHeight + 2, top: r.top, bottom: r.bottom, H: innerHeight }; });
    if (!menu.fit || menu.bottom > menu.H + 1 || menu.top < 0) bad('Мак: меню не помещается без прокрутки: ' + JSON.stringify(menu));
    await pg.screenshot({ path: join(out, '3d-safari-menu.png') });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
    for (const [key, id] of [['KeyI', 'bag'], ['KeyN', 'skills'], ['KeyM', 'map']]) {
      await pg.keyboard.press(key); await pg.waitForTimeout(350);
      const r = await pg.evaluate(id => { const b = document.querySelector(`#${id} .pbox`); if (!b || !b.offsetParent) return null; const q = b.getBoundingClientRect(); return { top: q.top, bottom: q.bottom, H: innerHeight }; }, id);
      if (!r || r.top < 0 || r.bottom > r.H + 1) bad(`Мак: окно ${id} выходит за экран: ` + JSON.stringify(r));
      await pg.keyboard.press(key === 'KeyM' ? 'KeyM' : 'Escape'); await pg.waitForTimeout(250);
    }
    // смена героя: уровень и пепел остаются
    await pg.evaluate(() => { const W = window.__b3d.W; W.lv = 12; W.inv.ash = 555; });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(300); await pg.click('#heroSwitch'); await pg.waitForTimeout(300);
    await pg.keyboard.press('Digit1'); await pg.waitForTimeout(300);
    const sw = await pg.evaluate(() => ({ hero: window.__b3d.W.hero, lv: window.__b3d.W.lv, ash: window.__b3d.W.inv.ash }));
    if (sw.hero !== 'thorn' || sw.lv !== 12 || sw.ash !== 555) bad('Мак: смена героя потеряла прогресс: ' + JSON.stringify(sw));
    // умение по клавише 1
    await pg.evaluate(() => { const W = window.__b3d.W; W.ap = 3; W.ab = { charge: 1 }; W.acd = {}; W.resHero = W.hero; W.res = 100; });
    await pg.keyboard.press('Digit1');
    await pg.waitForFunction(() => window.__b3d.W.acd.charge > 0, null, { timeout: 4000 }).catch(() => bad('Мак: клавиша 1 не запустила рывок'));
    await pg.screenshot({ path: join(out, '3d-safari-desk.png') });
    // качество (шаг 14): по умолчанию «Авто» без теней; «Высокое» — тени (земля принимает, деревья и герой отбрасывают);
    // «Низкое» — холст меньше и без теней
    { const q0 = await pg.evaluate(() => window.__b3d.renderer.quality()); if (!q0.auto || q0.shadowsOn) bad('Мак: по умолчанию не «Авто» или с тенями: ' + JSON.stringify(q0));
      const pick = async q => { await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); if (await pg.evaluate(() => document.getElementById('panel').hidden)) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(200); } await pg.locator(`#qualTabs .tab[data-q="${q}"]`).click(); await pg.keyboard.press('Escape'); await pg.waitForTimeout(1500); };
      await pick('high');
      const h = await pg.evaluate(() => { const r = window.__b3d.renderer, q = r.quality(); let recv = 0, cast = 0; r.scene.traverse(o => { if (o.isMesh && o.receiveShadow) recv++; if (o.isMesh && o.castShadow) cast++; }); window.__b3d.perfReset(); return { on: q.shadowsOn, recv, cast }; });
      await pg.waitForTimeout(3000); const pf = await pg.evaluate(() => window.__b3d.perf());
      if (!h.on || h.recv < 4 || h.cast < 20) bad('Мак: «Высокое» без теней: ' + JSON.stringify(h));
      console.log('  тени (WebKit): ' + JSON.stringify({ ...h, p95: +pf.p95.toFixed(1), calls: pf.calls }));
      await pg.screenshot({ path: join(out, '3d-safari-shadows.png') });
      await pick('low');
      const l = await pg.evaluate(() => { const c = document.getElementById('gl'), q = window.__b3d.renderer.quality(); return { on: q.shadowsOn, w: c.width, cw: c.clientWidth }; });
      if (l.on || Math.abs(l.w - Math.floor(l.cw * 1.5 * .75)) > 2) bad('Мак: «Низкое» с тенями или холст не ×0,75: ' + JSON.stringify(l)); }
    await ctx.close(); }
  // ---- iPhone (Safari) ----
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), pg = await ctx.newPage(); watch(pg);
    await pg.goto(url + '?shot'); await pg.waitForTimeout(1500);
    const wide = await pg.evaluate(() => [...document.querySelectorAll('.hcard')].every(c => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
    if (!wide) bad('iPhone: карточки героев шире экрана');
    await pg.locator('.hcard[data-hero="vale"] button').tap();
    await pg.waitForFunction(() => window.__b3d.W.hero === 'vale', null, { timeout: 4000 }).catch(() => bad('iPhone: Вейл не выбирается касанием'));
    if (!(await runs(pg))) bad('iPhone: игра стоит');
    await pg.evaluate(() => { const b = window.__b3d, p = b.W.player; p.inv = 1e9; const e = b.spawn('brute', p.x, p.z + 1.6); e.hp = e.maxhp = 5000; e.cd = 99; });
    await pg.locator('#bAtk').tap();
    await pg.waitForFunction(() => window.__b3d.W.player.state === 'atk' || window.__b3d.W.enemies.some(e => e.maxhp === 5000 && e.hp < 5000), null, { timeout: 4000 }).catch(() => bad('iPhone: «Удар» не бьёт'));
    await pg.screenshot({ path: join(out, '3d-safari-phone.png') });
    await ctx.close(); }
  for (const l of logs) bad(l);
} finally { await browser.close(); await dev.close(); }

if (problems.length) { console.error('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('3D в Safari (WebKit): OK');
