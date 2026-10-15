// Браузерный тест 3D на компьютере (Мак, окно без касаний): кнопки для пальца спрятаны, интерфейс крупнее,
// WASD (и на русской раскладке), мышь бьёт и катит, E — люк, M — карта, I — сумка, N — навыки, Esc — меню и закрыть.
// Узкое по высоте окно не просит «повернуть телефон». Скриншоты в test/out (3d-desk-*.png).
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
  catch { console.log('Playwright не найден — браузерный тест компьютера пропущен'); process.exit(0); }
}
const problems = [], bad = m => problems.push(m), logs = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5181, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/GPU stall due to ReadPixels/.test(m.text())) logs.push(m.type() + ': ' + m.text()); });   // ReadPixels — от скриншотов большого окна
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(url + '?shot&hero=thorn'); await page.waitForTimeout(1500);
  const ev = (f, arg) => page.evaluate(f, arg);
  const shown = id => ev(id => { const el = document.getElementById(id); return !!el && !el.hidden && getComputedStyle(el).display !== 'none'; }, id);
  const safe = () => ev(() => { const W = window.__b3d.W; W.player.maxhp = W.player.hp = 1e6; W.player.inv = 99; W.enemies.forEach(e => { if (!e.boss) e.dead = true; }); });
  await safe();

  // режим «стол»
  if (!(await ev(() => document.documentElement.hasAttribute('data-desk')))) bad('компьютер не распознан (нет data-desk)');
  for (const id of ['bAtk', 'bRoll', 'zone']) if (await shown(id)) bad(`на компьютере видна кнопка для пальца: ${id}`);
  const dz = await ev(() => Number(getComputedStyle(document.documentElement).getPropertyValue('--dz')));
  if (!(dz > 1 && dz <= 1.6)) bad('интерфейс не стал крупнее: --dz=' + dz);
  const hud = await ev(() => { const r = document.getElementById('miniBtn').getBoundingClientRect(); return { r: r.right, b: r.bottom, w: r.width }; });
  if (hud.r > 1440 || hud.b > 900 || hud.w < 100) bad('миникарта за экраном или мелкая: ' + JSON.stringify(hud));
  await page.screenshot({ path: join(out, '3d-desk-start.png') });

  // WASD: вверх = вперёд (−z); на русской раскладке та же физическая клавиша
  const z0 = await ev(() => window.__b3d.W.player.z);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  const z1 = await ev(() => window.__b3d.W.player.z);
  if (!(z1 < z0 - 1)) bad(`W не ведёт героя вперёд: ${z0.toFixed(2)} → ${z1.toFixed(2)}`);
  await ev(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'ф', code: 'KeyA' })));
  const x0 = await ev(() => window.__b3d.W.player.x); await page.waitForTimeout(500);
  await ev(() => dispatchEvent(new KeyboardEvent('keyup', { key: 'ф', code: 'KeyA' })));
  const x1 = await ev(() => window.__b3d.W.player.x);
  if (!(x1 < x0 - .8)) bad(`на русской раскладке A («ф») не ведёт влево: ${x0.toFixed(2)} → ${x1.toFixed(2)}`);

  // мышь: левая — удар по врагу перед героем, правая — перекат
  await ev(() => { const b = window.__b3d, p = b.W.player; p.face = Math.PI; b.spawn('imp', p.x, p.z - 1.6); });
  const hp0 = await ev(() => window.__b3d.W.enemies.filter(e => !e.dead && !e.boss).reduce((a, e) => a + e.hp, 0));
  await page.mouse.move(720, 450); await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
  const hp1 = await ev(() => window.__b3d.W.enemies.filter(e => !e.boss).reduce((a, e) => a + Math.max(0, e.hp), 0));
  if (!(hp1 < hp0)) bad(`левая кнопка мыши не бьёт: ${hp0} → ${hp1}`);
  await ev(() => { window.__b3d.W.player.rollCd = 0; });
  await page.mouse.click(720, 450, { button: 'right' }); await page.waitForTimeout(80);
  if ((await ev(() => window.__b3d.W.player.state)) !== 'roll') bad('правая кнопка мыши не катит');
  await page.waitForTimeout(600); await safe();

  // E у люка: спуск и подъём; на кнопке подписана клавиша
  await ev(() => { const b = window.__b3d, d = b.cfg.dungeons.list.find(q => !q.hidden); b.W.player.x = d.at.x + .6; b.W.player.z = d.at.z; });
  await page.waitForTimeout(400);
  const lbl = await ev(() => document.getElementById('portalBtn').textContent);
  if (!/· E$/.test(lbl)) bad('на кнопке люка нет подсказки клавиши: ' + lbl);
  const pr = await ev(() => { const r = document.getElementById('portalBtn').getBoundingClientRect(); return { cx: (r.left + r.right) / 2, b: r.bottom, h: r.height }; });
  if (Math.abs(pr.cx - 720) > 60 || pr.b > 900 || pr.h < 44) bad('кнопка люка не по центру, за экраном или мелкая: ' + JSON.stringify(pr));
  await page.screenshot({ path: join(out, '3d-desk-hatch.png') });
  await page.keyboard.press('KeyE'); await page.waitForTimeout(800);
  if ((await ev(() => window.__b3d.W.lvl)) === 'surface') bad('E у люка не спускает');
  await safe(); await page.screenshot({ path: join(out, '3d-desk-cellar.png') });
  await ev(() => { const b = window.__b3d, d = b.cfg.dungeons.list.find(q => q.id === b.W.lvl); if (!d) return; b.W.player.x = d.exit.x + .3; b.W.player.z = d.exit.z; });
  await page.waitForTimeout(300); await page.keyboard.press('KeyE'); await page.waitForTimeout(800);
  if ((await ev(() => window.__b3d.W.lvl)) !== 'surface') bad('E у лестницы не поднимает');
  await ev(() => { const p = window.__b3d.W.player; p.x = 0; p.z = 4; }); await safe();

  // закрытый лагерь: частокол и ворота
  await ev(() => { const b = window.__b3d, C = b.cfg.camp, p = b.W.player; p.x = C.x + C.r - 6; p.z = C.z + 3; p.face = Math.PI / 2; });
  await page.waitForTimeout(500); await page.screenshot({ path: join(out, '3d-desk-camp.png') });
  if (!(await ev(() => !!window.__b3d.W.map.camp && window.__b3d.W.map.blocks.length > 100))) bad('нет частокола лагеря');
  await ev(() => { const p = window.__b3d.W.player; p.x = 0; p.z = 4; });
  // сказочный торговец: повозка видна, E открывает его витрину с заголовком и таймером
  await ev(() => { const W = window.__b3d.W, p = W.player; W.wanderer = { x: p.x + 2.8, z: p.z, face: 1, t: 120, stock: [{ id: 'p_fairy_elixir', n: 2 }, { id: 'u_recall', n: 1 }] }; W.wandT = 1e9; });
  await page.waitForFunction(() => window.__b3d.W.nearNpc === 'wanderer', null, { timeout: 4000 }).catch(() => bad('у повозки нет торговца'));
  await page.waitForTimeout(300); await page.screenshot({ path: join(out, '3d-desk-wanderer.png') });
  await page.keyboard.press('KeyE'); await page.waitForTimeout(250);
  if (!(await shown('shop'))) bad('E не открыла витрину сказочного торговца');
  else { const h = await ev(() => document.getElementById('shopHead').textContent + ' | ' + document.getElementById('shopList').textContent); if (!/Сказочный торговец/.test(h) || !/Эликсир феи/.test(h)) bad('витрина не сказочная: ' + h.slice(0, 120)); await page.screenshot({ path: join(out, '3d-desk-wanderer-shop.png') }); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await ev(() => { const W = window.__b3d.W; W.wanderer = null; W.player.x = 0; W.player.z = 4; });
  // случайные события: обоз у ворот и путник в беде — модели рисуются, в трекере строка события
  for (const kind of ['caravan', 'rescue']) {
    await ev(k => { const W = window.__b3d.W; W.event = null; W.allies = W.allies.filter(a => !a.guest); W.cfg.events.kinds = { [k]: 1 }; W.evT = 0; }, kind);
    await page.waitForFunction(() => !!window.__b3d.W.event, null, { timeout: 4000 }).catch(() => bad('не стартовало событие ' + kind));
    await ev(() => { const W = window.__b3d.W, g = W.allies.find(a => a.id === W.event.guest); W.player.x = g.x + 6; W.player.z = g.z + 6; });
    await page.waitForTimeout(600);
    const line = await ev(() => document.getElementById('tracker').textContent);
    if (!(kind === 'caravan' ? /обоз/i : /путник/i).test(line)) bad(`нет строки события ${kind}: ${line}`);
    const ov = await ev(() => { const a = document.getElementById('tracker').getBoundingClientRect(), b = document.getElementById('miniBtn').getBoundingClientRect(); return a.top < b.bottom && a.bottom > b.top && a.left < b.right && a.right > b.left; });
    if (ov) bad('строка события налезает на миникарту');
    await page.screenshot({ path: join(out, `3d-desk-event-${kind}.png`) });
  }
  await ev(() => { const W = window.__b3d.W; W.event = null; W.allies = W.allies.filter(a => !a.guest); W.enemies = W.enemies.filter(e => !e.evId); W.evT = 1e9; W.player.x = 0; W.player.z = 4; });
  // оживление: жители ходят по лагерю, дым идёт, ворона взлетает от героя
  { const l0 = await ev(() => window.__b3d.life()); await page.waitForTimeout(2500); const l1 = await ev(() => window.__b3d.life());
    if (!l0 || l0.villagers.length < 3) bad('нет жителей в лагере: ' + JSON.stringify(l0 && l0.villagers.length));
    else if (!l1.villagers.some((v, i) => Math.hypot(v.x - l0.villagers[i].x, v.z - l0.villagers[i].z) > .5)) bad('жители стоят на месте');
    if (!(l1 && l1.puffs > 0)) bad('нет дыма из труб');
    await page.screenshot({ path: join(out, '3d-desk-life.png') });
    const c = l1.crows[0]; await ev(c => { const p = window.__b3d.W.player; p.x = c.x + 3; p.z = c.z; }, c);
    await page.waitForFunction(() => window.__b3d.life().crows[0].state !== 'sit', null, { timeout: 3000 }).catch(() => bad('ворона не взлетела от героя'));
    await ev(() => { const p = window.__b3d.W.player; p.x = 0; p.z = 4; }); }
  // окна: M — карта, I — сумка, N — навыки, Esc — закрыть, Esc на пустом месте — меню с клавишами
  await page.keyboard.press('KeyM'); await page.waitForTimeout(250);
  if (!(await shown('map'))) bad('M не открыла карту');
  await page.screenshot({ path: join(out, '3d-desk-map.png') });
  await page.keyboard.press('KeyM'); await page.waitForTimeout(150);
  if (await shown('map')) bad('M не закрыла карту');
  await page.keyboard.press('KeyI'); await page.waitForTimeout(250);
  if (!(await shown('bag'))) bad('I не открыла сумку');
  const bb = await ev(() => { const r = document.querySelector('#bag .pbox').getBoundingClientRect(); return { w: r.width, l: r.left }; });
  if (bb.w > 1440 * .9 || bb.l < 60) bad('сумка растянута на весь экран: ' + JSON.stringify(bb));     // две колонки шире, но по центру с полями
  await page.screenshot({ path: join(out, '3d-desk-bag.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  if (await shown('bag')) bad('Esc не закрыл сумку');
  await page.keyboard.press('KeyN'); await page.waitForTimeout(200);
  if (!(await shown('skills'))) bad('N не открыла навыки');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  if (!(await shown('panel')) || !(await shown('keysHelp'))) bad('Esc не открыл меню с клавишами');
  await page.screenshot({ path: join(out, '3d-desk-menu.png') });
  const t0 = await ev(() => window.__b3d.W.t); await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
  if ((await ev(() => window.__b3d.W.t)) !== t0) bad('пока открыто меню, игра идёт');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  if (await shown('panel')) bad('Esc не закрыл меню');

  // низкое широкое окно: не просит повернуть телефон, игра идёт
  await page.setViewportSize({ width: 1000, height: 480 }); await page.waitForTimeout(400);
  const ta = await ev(() => window.__b3d.W.t); await page.waitForTimeout(400);
  if (await shown('rotate')) bad('в низком окне просит повернуть телефон');
  if ((await ev(() => window.__b3d.W.t)) <= ta) bad('в низком окне игра стоит');
  await page.screenshot({ path: join(out, '3d-desk-low.png') });
  await ctx.close();
  // выбор героя при новой игре: три карточки, Сойка закрыта, кнопки не меньше 44 px; 2 — Вейл, сохраняется; после перезагрузки экрана нет
  { const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false }), pg = await c2.newPage(); pg.setDefaultTimeout(8000);
    pg.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await pg.goto(url + '?shot'); await pg.waitForTimeout(1200);
    const info = await pg.evaluate(() => ({ shown: !document.getElementById('heroPick').hidden, cards: [...document.querySelectorAll('.hcard')].map(c => ({ id: c.dataset.hero, shut: c.classList.contains('shut'), h: c.querySelector('button').getBoundingClientRect().height, dis: c.querySelector('button').disabled })), panel: window.__b3d.ui().panelOpen }));
    if (!info.shown || info.cards.length !== 3 || !info.panel) bad('нет экрана выбора героя или игра не на паузе: ' + JSON.stringify(info));
    if (!info.cards.every(c => c.h >= 44)) bad('кнопки выбора героя меньше 44 px');
    if (!info.cards.find(c => c.id === 'jay').dis || info.cards.find(c => c.id === 'vale').dis) bad('Сойка открыта или Вейл закрыт');
    await pg.screenshot({ path: join(out, '3d-desk-heroes.png') });
    await pg.keyboard.press('Digit3'); await pg.waitForTimeout(150);
    if (!(await pg.evaluate(() => !document.getElementById('heroPick').hidden))) bad('3 выбрала закрытую Сойку');
    await pg.keyboard.press('Digit2'); await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => ({ hero: window.__b3d.W.hero, hidden: document.getElementById('heroPick').hidden, panel: window.__b3d.ui().panelOpen, hp: window.__b3d.W.player.maxhp }));
    if (r.hero !== 'vale' || !r.hidden || r.panel) bad('2 не выбрала Вейла: ' + JSON.stringify(r));
    await pg.waitForTimeout(600); await pg.screenshot({ path: join(out, '3d-desk-vale.png') });
    // чужое оружие в сумке помечено и не надевается
    await pg.evaluate(() => { window.__b3d.W.inv.bag.push({ id: 'w_axe_iron', n: 1 }); });
    await pg.keyboard.press('KeyI'); await pg.waitForTimeout(300);
    const nw = pg.locator('#bag .tile.nw'); if ((await nw.count()) !== 1) bad('топор в сумке Вейла не помечен');
    else { await nw.first().click(); await pg.waitForTimeout(200);
      const card = await pg.evaluate(() => ({ txt: document.getElementById('bag').textContent, wear: [...document.querySelectorAll('#bag .acts button')].some(b => /Надеть/.test(b.textContent)) }));
      if (!/Не для Вейла/.test(card.txt) || card.wear) bad('у чужого топора нет пометки или есть «Надеть»');
      await pg.screenshot({ path: join(out, '3d-desk-vale-bag.png') }); }
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
    await pg.reload(); await pg.waitForTimeout(1200);
    const r2 = await pg.evaluate(() => ({ hero: window.__b3d.W.hero, shown: !document.getElementById('heroPick').hidden }));
    if (r2.hero !== 'vale' || r2.shown) bad('после перезагрузки герой не Вейл или снова выбор: ' + JSON.stringify(r2));
    await c2.close(); }
  // на телефоне карточки идут столбиком и прокручиваются; кнопка Вейла достижима и выбирает его
  { const c3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), pg = await c3.newPage(); pg.setDefaultTimeout(8000);
    pg.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await pg.goto(url + '?shot'); await pg.waitForTimeout(1200);
    const wide = await pg.evaluate(() => [...document.querySelectorAll('.hcard')].every(c => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
    if (!wide) bad('карточки героев шире экрана телефона');
    await pg.screenshot({ path: join(out, '3d-phone-heroes.png') });
    await pg.locator('.hcard[data-hero="vale"] button').tap();
    if ((await pg.evaluate(() => window.__b3d.W.hero)) !== 'vale') bad('на телефоне Вейл не выбирается касанием');
    await c3.close(); }
  for (const l of logs) bad(l);
} finally { await browser.close(); await dev.close(); }

if (problems.length) { console.error('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('3D на компьютере: OK');
