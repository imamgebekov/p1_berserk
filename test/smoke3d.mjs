// Быстрая браузерная проверка перед пушем (2026-10-18, вместо 9 полных тестов — те запускаются на крупных шагах):
// игра грузится без ошибок на компьютере и телефоне, герой ходит, бьёт врага, открываются сумка, книга и навыки.
// Цель — 1–2 минуты. Полный набор: npm run test:browser.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'test', 'out'); mkdirSync(out, { recursive: true });
const bad = [], logs = [], ok = (c, m) => { if (!c) bad.push(m); };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5190, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html?shot&retro&hero=thorn`;
const poll = async (f, ms = 3000) => { for (let t = 0; t < ms; t += 100) { if (await f()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
try {
  // компьютер
  { const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', e => logs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
    await page.goto(url, { timeout: 30000 }); ok(await poll(() => page.evaluate(() => !!(window.__b3d && window.__b3d.W)), 8000), 'игра не загрузилась');
    const ev = (f, a) => page.evaluate(f, a);
    for (let k = 0; k < 20 && !(await ev(() => document.getElementById('dialog').hidden)); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(100); }     // пролог Акта I (этап 3) — пропустить
    await ev(() => { const W = window.__b3d.W; W.player.maxhp = W.player.hp = 1e6; W.enemies.length = 0; });
    await poll(() => ev(() => window.__b3d.perf().n >= 20), 20000);     // программная видеокарта сначала собирает шейдеры (секунды) — ждём, пока кадры пойдут
    { const sc = await ev(() => { let decor = 0; window.__b3d.renderer.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.pkind) decor++; }); return { decor }; });     // декор и детали мира в сцене (T5: строка с декором однажды пропала)
      ok(sc.decor > 0, 'на сцене нет уличного декора (заборы, фонари, детали мира)'); }
    const z0 = await ev(() => window.__b3d.W.player.z); await page.keyboard.down('KeyW');
    ok(await poll(async () => (await ev(() => window.__b3d.W.player.z)) < z0 - .8), 'W не ведёт героя'); await page.keyboard.up('KeyW');
    await ev(() => { const b = window.__b3d, p = b.W.player; p.face = 0; const e = b.spawn('imp', p.x, p.z + 1.6); e.hp = e.maxhp = 500; e.cd = 99; window.__imp = e; });
    await page.keyboard.down('Space'); await page.waitForTimeout(150); await page.keyboard.up('Space');
    ok(await poll(() => ev(() => window.__imp.hp < 500)), 'удар не попал по бесу');
    for (const [key, id] of [['KeyI', 'bag'], ['KeyR', 'journal'], ['KeyN', 'skills']]) {
      await page.keyboard.press(key); ok(await poll(() => ev(id => !document.getElementById(id).hidden, id), 2000), `${key} не открыл окно ${id}`);
      await page.keyboard.press('Escape'); ok(await poll(() => ev(id => document.getElementById(id).hidden, id), 2000), `Esc не закрыл окно ${id}`);
    }
    await page.screenshot({ path: join(out, 'smoke-desk.png') }); await page.close(); }
  // телефон
  { const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', e => logs.push('phone pageerror: ' + e.message));
    await page.goto(url, { timeout: 30000 }); ok(await poll(() => page.evaluate(() => !!(window.__b3d && window.__b3d.W)), 8000), 'телефон: игра не загрузилась');
    await page.waitForTimeout(600); await page.evaluate(() => { const b = document.querySelector('#dlgOpts button'); if (b && !document.getElementById('dialog').hidden) for (let k = 0; k < 9; k++) { const x = document.querySelector('#dlgOpts button'); if (!x || document.getElementById('dialog').hidden) break; x.click(); } });     // пролог на телефоне — пролистать
    const r = await page.evaluate(() => { const box = id => document.getElementById(id).getBoundingClientRect(); const a = box('bAtk'), b = box('bagBtn'); return { atk: a.width >= 44 && a.right <= innerWidth, bag: b.width >= 44 }; });
    ok(r.atk && r.bag, 'телефон: кнопки удара или сумки не на месте: ' + JSON.stringify(r));
    await page.tap('#bagBtn'); ok(await poll(() => page.evaluate(() => !document.getElementById('bag').hidden), 2000), 'телефон: сумка не открылась');
    await page.screenshot({ path: join(out, 'smoke-phone.png') }); await page.close(); }
} finally { await browser.close(); await dev.close(); }
ok(!logs.length, 'ошибки на странице: ' + logs.slice(0, 3).join(' | '));
if (bad.length) { console.error('Быстрая проверка в браузере: ПРОВАЛ\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('Быстрая проверка в браузере: OK');
