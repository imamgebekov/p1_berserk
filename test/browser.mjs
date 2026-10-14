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
  page.setDefaultTimeout(8000);
  const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(url);
  await page.waitForSelector('#go');
  await page.tap('#go');

  // геометрия кнопок
  const geo = await page.evaluate(() => [...document.querySelectorAll('.btn,.mbtn,#mute,.veil button')].map(b => {
    const r = b.getBoundingClientRect(); return { id: b.id, x: r.x, y: r.y, w: r.width, h: r.height, vis: !!(r.width && r.height) };
  }));
  for (const b of geo.filter(b => b.vis)) {
    if (b.w < 44 || b.h < 44) problems.push(`${label}: кнопка #${b.id} ${b.w}×${b.h} < 44px`);
  }
  const pad = geo.filter(b => ['bl', 'br', 'batk', 'bjump', 'bbrand', 'mbag'].includes(b.id));
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
  // инвентарь: открыть кнопкой, пауза, карточка, надеть, закрыть
  await page.evaluate(() => { const B = window.__berserk; B.P.bag.length = 0; for (const id of ['w_bone_edge', 'h_horned_helm', 'c_raven']) B.giveItem(B.newItem(id)); });
  await page.tap('#mbag');
  await page.waitForSelector('#bag:not([hidden])');
  const t0 = await page.evaluate(() => { const B = window.__berserk; return { timer: B.W.timer, x: B.P.x, ex: B.W.enemies.map(e => e.x).join() }; });
  await page.waitForTimeout(400);
  const inv = await page.evaluate(() => {
    const B = window.__berserk, cells = [...document.querySelectorAll('#grid .cell, #eq .cell')].map(c => c.getBoundingClientRect());
    return { paused: B.W.paused, timer: B.W.timer, x: B.P.x, ex: B.W.enemies.map(e => e.x).join(), small: cells.filter(r => r.width < 44 || r.height < 44).length, n: cells.length,
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight };
  });
  if (!inv.paused) problems.push(`${label}: игра не на паузе при открытой сумке`);
  if (inv.timer !== t0.timer || inv.x !== t0.x || inv.ex !== t0.ex) problems.push(`${label}: мир двигался при паузе`);
  if (inv.small) problems.push(`${label}: ${inv.small} ячеек меньше 44px`);
  if (inv.overflow) problems.push(`${label}: экран сумки выходит за вьюпорт`);
  await page.tap('#grid .cell:nth-child(1)');
  await page.waitForSelector('#cardWrap:not([hidden])');
  const btnH = await page.evaluate(() => [...document.querySelectorAll('#card button')].map(b => b.getBoundingClientRect().height));
  if (btnH.some(h => h < 44)) problems.push(`${label}: кнопка карточки < 44px: ${btnH}`);
  const cardBox = await page.locator('#card').boundingBox();
  if (cardBox.y < 0 || cardBox.y + cardBox.height > (await page.viewportSize()).height + 1) problems.push(`${label}: карточка не влезает в экран`);
  await page.tap('.cbtn.main');
  const after = await page.evaluate(() => { const P = window.__berserk.P; return { w: P.eq.weapon && P.eq.weapon.id, bag: P.bag.length }; });
  if (after.w !== 'w_bone_edge') problems.push(`${label}: оружие не надето (${after.w})`);
  await page.screenshot({ path: join(out, label.replace(/\W+/g, '_') + '_bag.png') });
  await page.tap('#bagClose');
  // вкладка «Герой»: предпросмотр рисуется, слоты нажимаются, ничего не вылезает за экран
  await page.tap('#mhero');
  await page.waitForSelector('#heroTab:not([hidden])');
  await page.waitForTimeout(350);
  const hero = await page.evaluate(() => {
    const cv = document.getElementById('hPrev'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 60) lit++;
    const sizes = [...document.querySelectorAll('#bag .tab, #hL .cell, #hR .cell, #bagClose')].map(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); });
    const stageRight = document.querySelector('.hstage').getBoundingClientRect().right;
    return { lit, small: sizes.filter(v => v < 44).length, running: window.__berserk.inventoryUI.previewRunning(), tab: window.__berserk.inventoryUI.tab(),
      overflow: stageRight > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight, paused: window.__berserk.W.paused };
  });
  if (hero.tab !== 'hero' || !hero.paused) problems.push(`${label}: вкладка «Герой» не открылась (${hero.tab}, пауза=${hero.paused})`);
  if (hero.lit < 20) problems.push(`${label}: предпросмотр героя пустой (${hero.lit} светлых пикселей)`);
  if (!hero.running) problems.push(`${label}: анимация предпросмотра не идёт`);
  if (hero.small) problems.push(`${label}: на вкладке «Герой» ${hero.small} элементов меньше 44px`);
  if (hero.overflow) problems.push(`${label}: вкладка «Герой» выходит за вьюпорт`);
  await page.screenshot({ path: join(out, label.replace(/\W+/g, '_') + '_hero.png') });
  await page.tap('#hL .cell:nth-child(1)');
  const sw = await page.evaluate(() => ({ tab: window.__berserk.inventoryUI.tab(), card: !document.getElementById('cardWrap').hidden, running: window.__berserk.inventoryUI.previewRunning() }));
  if (sw.tab !== 'bag' || !sw.card) problems.push(`${label}: тап по слоту героя не открыл карточку (${JSON.stringify(sw)})`);
  if (sw.running) problems.push(`${label}: предпросмотр не остановился при уходе с вкладки`);
  await page.tap('.cbtn.close');
  await page.tap('#bagClose');
  const unp = await page.evaluate(() => window.__berserk.W.paused);
  if (unp) problems.push(`${label}: пауза не снялась после закрытия сумки`);
  // город: кнопка «Говорить», покупка, продажа, улучшение у кузнеца
  const confirmMain = async () => {
    await page.tap('#tCard .cbtn.main');
    const t = await page.locator('#tCard .cbtn.main').textContent().catch(() => null);
    if (t && t.includes('Точно')) await page.tap('#tCard .cbtn.main');
  };
  await page.evaluate(() => { const B = window.__berserk; B.W.spawnT = 999; B.W.enemies.length = 0; B.P.ash = 5000; B.P.bag.length = 0; B.P.x = 108; B.P.hp = B.P.maxhp; });
  await page.waitForFunction(() => !document.getElementById('talk').hidden);
  const talk = await page.evaluate(() => { const r = document.getElementById('talk').getBoundingClientRect(), pad = document.getElementById('pad').getBoundingClientRect();
    return { w: r.width, h: r.height, text: document.getElementById('talk').textContent, overlapsPad: r.bottom > pad.top }; });
  if (talk.h < 44 || talk.w < 44) problems.push(`${label}: кнопка «${talk.text}» ${talk.w}×${talk.h} < 44px`);
  if (talk.overlapsPad) problems.push(`${label}: кнопка «${talk.text}» заходит на пульт`);
  if (talk.text !== 'Торговец') problems.push(`${label}: у торговца кнопка называется «${talk.text}»`);
  await page.tap('#talk');
  await page.waitForSelector('#town:not([hidden])');
  const shop = await page.evaluate(() => ({ paused: window.__berserk.W.paused, kind: window.__berserk.townUI.kind(), n: document.querySelectorAll('#tGrid .cell').length,
    small: [...document.querySelectorAll('#town .tab, #tGrid .cell, #tClose')].filter(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 44; }).length,
    tabH: document.querySelector('#tTabs .tab').getBoundingClientRect().height, overflow: document.documentElement.scrollHeight > innerHeight }));
  if (!shop.paused || shop.kind !== 'merchant') problems.push(`${label}: торговец не открылся (${JSON.stringify(shop)})`);
  if (shop.n !== 8) problems.push(`${label}: в магазине ${shop.n} вещей вместо 8`);
  if (shop.small) problems.push(`${label}: в магазине ${shop.small} элементов меньше 44px`);
  if (shop.tabH > 80) problems.push(`${label}: вкладки магазина растянуты (${shop.tabH}px)`);
  if (shop.overflow) problems.push(`${label}: магазин выходит за вьюпорт`);
  await page.screenshot({ path: join(out, label.replace(/\W+/g, '_') + '_shop.png') });
  const ash0 = await page.evaluate(() => window.__berserk.P.ash);
  await page.tap('#tGrid .cell:nth-child(1)');
  await page.waitForSelector('#tCardWrap:not([hidden])');
  await confirmMain();
  const bought = await page.evaluate(() => ({ bag: window.__berserk.P.bag.length, ash: window.__berserk.P.ash, left: window.__berserk.W.shop.items.length }));
  if (bought.bag !== 1 || bought.ash >= ash0 || bought.left !== 7) problems.push(`${label}: покупка не сработала (${JSON.stringify(bought)}, было ${ash0})`);
  await page.locator('#tTabs .tab', { hasText: 'Продать' }).tap();
  await page.tap('#tGrid .cell:nth-child(1)');
  await page.waitForSelector('#tCardWrap:not([hidden])');
  await confirmMain();
  const sold = await page.evaluate(() => ({ bag: window.__berserk.P.bag.length, ash: window.__berserk.P.ash }));
  if (sold.bag !== 0 || sold.ash <= bought.ash) problems.push(`${label}: продажа не сработала (${JSON.stringify(sold)})`);
  await page.tap('#tClose');
  if (await page.evaluate(() => window.__berserk.W.paused)) problems.push(`${label}: пауза не снялась после закрытия города`);

  await page.evaluate(() => { const B = window.__berserk; B.P.x = 214; B.giveItem(B.newItem('w_bone_edge')); B.giveItem(B.newItem('w_rust_cleaver')); B.P.ash = 5000; });
  await page.waitForFunction(() => document.getElementById('talk').textContent === 'Кузнец');
  await page.tap('#talk');
  await page.waitForSelector('#town:not([hidden])');
  const smithInfo = await page.evaluate(() => ({ kind: window.__berserk.townUI.kind(), n: document.querySelectorAll('#tGrid .cell').length, tabs: !document.getElementById('tTabs').offsetHeight }));
  if (smithInfo.kind !== 'smith' || smithInfo.n !== 3) problems.push(`${label}: кузнец не открылся (${JSON.stringify(smithInfo)})`);
  await page.tap('#tGrid .cell:nth-child(1)');
  await page.waitForSelector('#tCardWrap:not([hidden])');
  const ash1 = await page.evaluate(() => window.__berserk.P.ash);
  await confirmMain();
  const up = await page.evaluate(() => ({ ash: window.__berserk.P.ash, up: window.__berserk.P.bag.concat(Object.values(window.__berserk.P.eq)).filter(Boolean).map(i => i.up || 0).reduce((a, b) => a + b, 0) }));
  if (up.ash >= ash1 || up.up !== 1) problems.push(`${label}: улучшение не сработало (${JSON.stringify(up)})`);
  await page.screenshot({ path: join(out, label.replace(/\W+/g, '_') + '_smith.png') });
  await page.tap('#tCard .cbtn.close').catch(() => {});
  await page.tap('#tClose');
  await page.evaluate(() => { window.__berserk.P.x = 600; });
  await page.waitForFunction(() => document.getElementById('talk').hidden);
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
