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
  // Торн со щитом: в сумке 8 слотов, щит во второй руке и даёт блок
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(300);
  await ev(() => { const W = window.__b3d.W; W.inv.eq.offhand = 's_tower_steel'; W.inv.eq.weapon = 'w_sword_steel'; W.player.x = 0; W.player.z = 4; });
  await page.keyboard.press('KeyI'); await page.waitForTimeout(300);
  const slots = await ev(() => document.querySelectorAll('#bag .slot').length);
  if (slots !== 8) bad('в сумке не 8 слотов: ' + slots);
  await page.screenshot({ path: join(out, '3d-desk-shield-bag.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const blk = await ev(() => { const W = window.__b3d.W, p = W.player; return W.gear.block; });
  if (!(blk > 0)) bad('щит не дал блока');
  await page.waitForTimeout(400); await page.screenshot({ path: join(out, '3d-desk-shield.png') });
  // умения Торна: вкладка «Умения» — 5 строк, «+» вкладывает очко; клавиша 1 — рывок, на кнопке перезарядка
  await ev(() => { const W = window.__b3d.W; W.lv = 30; W.ap = 28; W.ab = {}; W.acd = {}; W.player.x = 0; W.player.z = 4; W.player.face = 0; });
  await page.keyboard.press('KeyN'); await page.waitForTimeout(250);
  await page.locator('#skillTabs .tab', { hasText: 'Умения' }).click(); await page.waitForTimeout(150);
  const rows = await ev(() => document.querySelectorAll('#skillList .skrow').length);
  if (rows !== 5) bad('во вкладке «Умения» не 5 строк: ' + rows);
  for (let i = 0; i < 5; i++) await page.locator('#skillList .skrow .plus').nth(i).click();
  await page.screenshot({ path: join(out, '3d-desk-abilities.png') });
  if ((await ev(() => Object.keys(window.__b3d.W.ab).length)) !== 5) bad('«+» не вложил очки в умения');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  const vis = await ev(() => [...document.querySelectorAll('#abil .ab')].filter(b => !b.hidden).length);
  if (vis !== 5) bad('на панели не 5 кнопок умений: ' + vis);
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__b3d.W.acd.charge > 0, null, { timeout: 4000 }).catch(() => bad('клавиша 1 не запустила рывок'));
  await page.keyboard.press('Digit3'); await page.waitForTimeout(400); await page.screenshot({ path: join(out, '3d-desk-ability-bar.png') });
  // смена героя из меню: уровень и пепел остаются, Esc отменяет, 2 — Вейл
  await ev(() => { window.__b3d.W.inv.ash = 4321; });
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  if (!/Торн/.test(await ev(() => document.getElementById('heroNow').textContent))) bad('в меню не показан текущий герой');
  await page.locator('#heroSwitch').click(); await page.waitForTimeout(250);
  if (!(await shown('heroPick')) || !(await shown('heroCancel'))) bad('«Сменить героя» не открыла выбор с отменой');
  await page.screenshot({ path: join(out, '3d-desk-hero-switch.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  if ((await shown('heroPick')) || (await ev(() => window.__b3d.W.hero)) !== 'thorn') bad('Esc не отменил смену героя');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.locator('#heroSwitch').click(); await page.waitForTimeout(200);
  await page.keyboard.press('Digit2'); await page.waitForTimeout(300);
  const sw = await ev(() => ({ hero: window.__b3d.W.hero, lv: window.__b3d.W.lv, ash: window.__b3d.W.inv.ash, panel: window.__b3d.ui().panelOpen }));
  if (sw.hero !== 'vale' || sw.lv !== 30 || sw.ash !== 4321 || sw.panel) bad('смена героя потеряла прогресс: ' + JSON.stringify(sw));
  // окна не выходят за экран (высота в пикселях под zoom)
  await page.keyboard.press('KeyI'); await page.waitForTimeout(250);
  const fitBag = await ev(() => { const r = document.querySelector('#bag .pbox').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; });
  if (!fitBag) bad('сумка выходит за экран');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  // атмосфера звука (D1): после нажатия звук работает; у реки слышно воду и ставятся бульки, в лагере воды не слышно
  { await page.keyboard.press('KeyW');
    await ev(() => { const W = window.__b3d.W, P = W.map.river.bridges[0], s = Math.sin(P.ang), c = Math.cos(P.ang); W.enemies.length = 0; W.player.x = P.x - s * (P.len / 2 + 1); W.player.z = P.z - c * (P.len / 2 + 1); });
    await page.waitForTimeout(1500);
    const a1 = await ev(() => window.__b3d.audioStats());
    if (a1.state !== 'running') console.log('  звук в браузере не запущен (' + a1.state + ') — проверка атмосферы пропущена');
    else {
      if (!a1.mix || a1.mix.water < .5 || a1.plips < 1) bad('у реки не слышно воды: ' + JSON.stringify(a1));
      await ev(() => { const W = window.__b3d.W; W.player.x = 0; W.player.z = 3; }); await page.waitForTimeout(800);
      const a2 = await ev(() => window.__b3d.audioStats());
      if (a2.mix.water > .01) bad('у костра слышно реку: ' + JSON.stringify(a2.mix));
      console.log('  звук: ' + JSON.stringify({ water: a1.mix.water.toFixed(2), birds: a1.mix.birds.toFixed(2), notes: a2.notes, plips: a2.plips, voices: a2.maxVoices }));
    } }
  // свет сквозь облака (E2): на поверхности пятна света есть и не нулевые
  { const s = await ev(() => window.__b3d.renderer.sun()); if (!s || !s.on || !(s.op > 0)) bad('нет света сквозь облака: ' + JSON.stringify(s)); else console.log('  свет: ' + JSON.stringify(s)); }
  // фильтр ASCII (E1): включается в меню, холст в полный размер, кадр из символов на тёмном фоне, полоса здоровья чёткая; выключается
  { const toggle = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.locator('#asciiBtn').click(); await page.waitForTimeout(150); const t = await ev(() => document.getElementById('asciiBtn').textContent); await page.keyboard.press('Escape'); await page.waitForTimeout(400); return t; };
    const t1 = await toggle();
    const st = await ev(() => { const r = window.__b3d.renderer, a = r.ascii(), c = document.getElementById('gl'), d = Math.min(window.__b3d.cfg.view.ascii.dpr, devicePixelRatio || 1); return { on: !!a, w: c.width, h: c.height, iw: Math.floor(innerWidth * d), ih: Math.floor(innerHeight * d), dpr: d, rows: a && a.atlas.rows.length }; });
    if (!/ASCII/.test(t1) || !st.on || Math.abs(st.w - st.iw) > 2 || Math.abs(st.h - st.ih) > 2 || st.rows !== 4) bad('ASCII не включился или холст не в плотности экрана: ' + JSON.stringify({ t1, ...st }));
    const bar = await ev(() => { const b = window.__b3d, W = b.W, C = W.map.camp, p = W.player; W.enemies.length = 0; p.x = C.x; p.z = C.z + 2; p.inv = 1e9;
      const e = b.spawn('brute', p.x + 3, p.z); e.elite = false; e.affColor = undefined; e.hp = e.maxhp * .5; e.cd = 99; e.alert = false; e.st = null; return e.id; });
    await page.waitForTimeout(700);
    const read = () => ev(() => { const b = window.__b3d, W = b.W, e = W.enemies.find(q => !q.dead), c = document.getElementById('gl'), g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
      const x = g.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, g.width, g.height).data; let dark = 0, n = 0;
      for (let i = 0; i < d.length - 8; i += 4 * 7) { n++; if (Math.abs(d[i] + d[i + 1] + d[i + 2] - d[i + 4] - d[i + 5] - d[i + 6]) > 90) dark++; }     // резкий перепад с соседней точкой — штрих символа
      let red = 0;
      // полоса здоровья — сплошной красный прямоугольник ≥ 24 точек в ширину и 3 строки в высоту (символы так не умеют: штрихи тонкие и с зазорами)
      const R = k => d[k] > 60 && d[k] > 2.5 * d[k + 1] && d[k] > 2 * d[k + 2], W2 = g.width, runs = new Int32Array(W2);
      for (let yy = 0; yy < g.height; yy++) { let run = 0; for (let xx = 0; xx < W2; xx++) { const k = (yy * W2 + xx) * 4; if (R(k) && R(k + W2 * 4) && R(k + W2 * 8)) { if (++run >= 24) red = Math.max(red, run); } else run = 0; } }
      return { dark: dark / n, red }; });
    let px = await read(); for (let i = 0; i < 6 && px.red < 24; i++) { await page.waitForTimeout(500); px = await read(); }     // кадр со свежим врагом может прийти не сразу
    if (px.dark < .08) bad('в ASCII мало штрихов символов: ' + px.dark.toFixed(2));
    if (px.red < 20) bad('в ASCII не видно полосы здоровья врага: ' + px.red);
    await page.screenshot({ path: join(out, '3d-desk-ascii.png') });
    const t2 = await toggle();
    const st2 = await ev(() => { const c = document.getElementById('gl'), g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d'); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, g.width, g.height).data; let e = 0, n = 0;
      for (let i = 0; i < d.length - 8; i += 4 * 7) { n++; if (Math.abs(d[i] + d[i + 1] + d[i + 2] - d[i + 4] - d[i + 5] - d[i + 6]) > 90) e++; }
      return { on: !!window.__b3d.renderer.ascii(), w: c.width, iw: innerWidth, ps: window.__b3d.cfg.view.pixelScale, edges: e / n }; });
    if (px.dark < st2.edges * 2) bad(`в ASCII штрихов не больше, чем в обычном виде: ${px.dark.toFixed(3)} против ${st2.edges.toFixed(3)}`);
    if (/ASCII/.test(t2) || st2.on || Math.abs(st2.w - Math.floor(st2.iw / Math.round(st2.ps))) > 1) bad('ASCII не выключился: ' + JSON.stringify({ t2, ...st2 }));
    console.log('  ASCII: ' + JSON.stringify({ strokes: px.dark.toFixed(3), plain: st2.edges.toFixed(3), bar: px.red, dpr: st.dpr, w: st.w }));
    await ev(() => { window.__b3d.W.enemies.length = 0; }); }
  await ctx.close();
  // выбор героя при новой игре: три карточки, Сойка закрыта, кнопки не меньше 44 px; 2 — Вейл, сохраняется; после перезагрузки экрана нет
  { const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false }), pg = await c2.newPage(); pg.setDefaultTimeout(8000);
    pg.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await pg.goto(url + '?shot'); await pg.waitForTimeout(1200);
    const info = await pg.evaluate(() => ({ shown: !document.getElementById('heroPick').hidden, cards: [...document.querySelectorAll('.hcard')].map(c => ({ id: c.dataset.hero, shut: c.classList.contains('shut'), h: c.querySelector('button').getBoundingClientRect().height, dis: c.querySelector('button').disabled })), panel: window.__b3d.ui().panelOpen }));
    if (!info.shown || info.cards.length !== 3 || !info.panel) bad('нет экрана выбора героя или игра не на паузе: ' + JSON.stringify(info));
    if (!info.cards.every(c => c.h >= 44)) bad('кнопки выбора героя меньше 44 px');
    if (info.cards.some(c => c.dis)) bad('какой-то герой закрыт: ' + JSON.stringify(info.cards));
    await pg.screenshot({ path: join(out, '3d-desk-heroes.png') });
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
    // два клинка: рапира и кинжал во второй руке, удары чередуют руки
    const hands = await pg.evaluate(async () => { const b = window.__b3d, W = b.W, p = W.player; W.inv.eq.weapon = 'w_rapier_iron'; W.inv.eq.offhand = 'w_dagger_iron'; p.inv = 1e9; p.x = 0; p.z = 4; p.face = 0;
      const e = b.spawn('brute', 0, 5.4); e.hp = e.maxhp = 5000; e.cd = 99; const seen = new Set();
      for (let i = 0; i < 6; i++) { p.atkBuf = .2; await new Promise(r => setTimeout(r, 420)); seen.add(p.hand); }
      return [...seen]; });
    if (!hands.includes(1)) bad('Вейл не бьёт левым клинком: ' + JSON.stringify(hands));
    await pg.screenshot({ path: join(out, '3d-desk-vale-dual.png') });
    // выпад-телепорт (клавиша 1) за спину врага и тень-двойник (клавиша 4)
    await pg.evaluate(() => { const b = window.__b3d, W = b.W; W.lv = 30; W.ab = { blink: 1, shadow: 1 }; W.acd = {}; W.player.face = 0; const e = b.spawn('brute', W.player.x, W.player.z + 6); e.hp = e.maxhp = 5000; e.cd = 99; });
    await pg.keyboard.press('Digit1');
    await pg.waitForFunction(() => window.__b3d.W.acd.blink > 0, null, { timeout: 4000 }).catch(() => bad('клавиша 1 не дала выпад Вейла'));
    await pg.keyboard.press('Digit4');
    await pg.waitForFunction(() => window.__b3d.W.allies.some(a => a.decoy), null, { timeout: 4000 }).catch(() => bad('клавиша 4 не вызвала тень'));
    await pg.waitForTimeout(400); await pg.screenshot({ path: join(out, '3d-desk-vale-shadow.png') });
    await pg.reload(); await pg.waitForTimeout(1200);
    const r2 = await pg.evaluate(() => ({ hero: window.__b3d.W.hero, shown: !document.getElementById('heroPick').hidden }));
    if (r2.hero !== 'vale' || r2.shown) bad('после перезагрузки герой не Вейл или снова выбор: ' + JSON.stringify(r2));
    await c2.close(); }
  // Сойка: 3 — выбрать, в руке ржавый лук; выстрел по врагу — своя стрела летит и попадает
  { const c4 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false }), pg = await c4.newPage(); pg.setDefaultTimeout(8000);
    pg.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await pg.goto(url + '?shot'); await pg.waitForTimeout(1200);
    await pg.keyboard.press('Digit3'); await pg.waitForTimeout(300);
    const j = await pg.evaluate(() => ({ hero: window.__b3d.W.hero, w: window.__b3d.W.inv.eq.weapon }));
    if (j.hero !== 'jay' || j.w !== 'w_bow_rust') bad('Сойка не выбрана или без лука: ' + JSON.stringify(j));
    const hp = await pg.evaluate(() => { const b = window.__b3d, W = b.W, p = W.player; p.inv = 1e9; p.x = 0; p.z = 4; p.face = 0; W.enemies.forEach(e => { e.dead = true; }); const e = b.spawn('brute', 0, 13); e.hp = e.maxhp = 5000; e.cd = 99; return e.hp; });
    await pg.mouse.click(720, 450);
    const fly = await pg.waitForFunction(() => window.__b3d.W.proj.some(q => q.friendly) || window.__b3d.W.enemies.some(e => !e.dead && e.maxhp === 5000 && e.hp < 5000), null, { timeout: 3000 }).then(() => true, () => false);     // быстрая стрела может долететь раньше проверки
    await pg.screenshot({ path: join(out, '3d-desk-jay-shot.png') });
    await pg.waitForTimeout(900);
    const hit = await pg.evaluate(() => window.__b3d.W.enemies.some(e => !e.dead && e.maxhp === 5000 && e.hp < 5000));
    if (!fly || !hit) bad(`стрела Сойки не вылетела (${fly}) или не попала (${hit})`);
    // град стрел (клавиша 5) встаёт над врагом
    await pg.evaluate(() => { const W = window.__b3d.W; W.lv = 30; W.ab = { rain: 1, trap: 1 }; W.acd = {}; });
    await pg.keyboard.press('Digit5');
    await pg.waitForFunction(() => window.__b3d.W.zones.length > 0, null, { timeout: 4000 }).catch(() => bad('клавиша 5 не вызвала град стрел'));
    await pg.keyboard.press('Digit3'); await pg.waitForTimeout(500); await pg.screenshot({ path: join(out, '3d-desk-jay-rain.png') });
    await c4.close(); }
  // телефон: веер кнопок умений не налезает на «Удар», «Перекат» и друг на друга, кнопки не меньше 44 px, касание запускает умение
  { const c5 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), pg = await c5.newPage(); pg.setDefaultTimeout(8000);
    pg.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await pg.goto(url + '?shot&hero=thorn'); await pg.waitForTimeout(1200);
    await pg.evaluate(() => { const W = window.__b3d.W; W.lv = 30; W.ab = { charge: 1, cry: 1, whirl: 1, iron: 1, rage: 1 }; });
    await pg.waitForTimeout(400);
    const r = await pg.evaluate(() => { const box = el => el.getBoundingClientRect(), list = [...document.querySelectorAll('#abil .ab')].filter(b => !b.hidden).map(box), atk = box(document.getElementById('bAtk')), roll = box(document.getElementById('bRoll'));
      const over = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; let bad = 0;
      list.forEach((a, i) => { if (over(a, atk) || over(a, roll) || a.left < 0 || a.right > innerWidth) bad++; list.forEach((b, j) => { if (j > i && over(a, b)) bad++; }); });
      return { n: list.length, bad, min: Math.min(...list.map(a => Math.min(a.width, a.height))) }; });
    if (r.n !== 5 || r.bad || r.min < 44) bad('кнопки умений на телефоне: ' + JSON.stringify(r));
    await pg.screenshot({ path: join(out, '3d-phone-abilities.png') });
    await pg.locator('#abil .ab[data-i="2"]').tap();
    await pg.waitForFunction(() => window.__b3d.W.acd.whirl > 0, null, { timeout: 4000 }).catch(() => bad('касание кнопки не запустило вихрь'));
    await c5.close(); }
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
