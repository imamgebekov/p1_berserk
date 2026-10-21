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
  if (process.env.ECO_OFF) await ctx.addInitScript(() => { try { localStorage.setItem('berserk3d.prefs', JSON.stringify({ eco: false })); } catch (e) { /* без хранилища */ } });
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  // «Ретро» (крупные пиксели): Chromium без видеокарты на полном разрешении даёт ~8 кадр/с, а проверки управления меряют время;
  // гладкий вид (шаг 2 аудита) проверяется ниже размером холста и в тестах Мака и Safari
  await page.goto(url + '?shot&hero=thorn&retro&dev', { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForFunction(() => window.__b3d && window.__b3d.W, null, { timeout: 180000 }); await page.waitForTimeout(1500);     // холодный сервер разработки собирает модули дольше 25 с (было зависание с 3.77)     // ?dev: панель настройки и ссылка на 2D видны только так
  // окна кузнеца, журнала и найма проверяем как открытые: «Путь пепла» (шаг 13) открывает их после первого босса и с 5-го уровня
  await page.evaluate(() => { window.__b3d.W.path.slain.devourer = true; });

  const st = () => page.evaluate(() => { const W = window.__b3d.W, p = W.player; return { x: p.x, z: p.z, hp: p.hp, kills: W.kills, en: W.enemies.filter(e => !e.dead).length, t: W.t, state: p.state }; });
  if (await page.evaluate(() => !document.getElementById('nogl').hidden)) bad('WebGL не поднялся');
  const cv = await page.evaluate(() => { const c = document.getElementById('gl'); return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, ir: getComputedStyle(c).imageRendering }; });
  if (cv.cw !== 390 || cv.ch !== 664) bad('канвас не на весь экран ' + JSON.stringify(cv));
  if (cv.w > 390 || cv.w < 30 || !/pixelated|crisp/.test(cv.ir)) bad('внутреннее разрешение «Ретро» неожиданное ' + JSON.stringify(cv));
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
  { const a = await page.evaluate(() => window.__b3d.W.cfg.view.camYaw * Math.PI / 180), dx = s1.x - s0.x, dz = s1.z - s0.z;     // вперёд = от камеры, она повёрнута на camYaw
    const fwd = -(dx * Math.sin(a) + dz * Math.cos(a)), side = Math.abs(dx * Math.cos(a) - dz * Math.sin(a));
    if (!(fwd > 1 && side < fwd * .3)) bad(`джойстик вверх не двигает героя вперёд: вперёд ${fwd.toFixed(2)}, вбок ${side.toFixed(2)}`); }
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

  // места и карта: подпись места, миникарта, большая карта с туманом
  await page.evaluate(() => { const w = window.__b3d.W; w.enemies.length = 0; w.cfg.enemies.count = 0; for (const [x, z] of [[0, 6], [-28, 30], [56, -44], [-46, -30]]) { window.__b3d.reveal(x, z, 22); } w.player.x = 56; w.player.z = -44; w.player.inv = 1e9; });
  await page.waitForTimeout(1500);     // программный GL — около 9 кадров/с: подпись меняется не сразу
  { const t = await page.$eval('#place', e => ({ hidden: e.hidden, text: e.textContent, cls: e.className })); if (t.hidden || !t.text.includes('Лагерь Ржавых') || t.cls !== 'danger') bad('подпись места не показана: ' + JSON.stringify(t)); }
  await page.screenshot({ path: join(out, '3d-place.png') });
  { const px = await page.evaluate(() => { const c = document.getElementById('mini'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 40) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return set.size; }); if (px < 6) bad('миникарта пустая: цветов ' + px); }
  await page.tap('#miniBtn'); await page.waitForTimeout(250);
  if (await page.evaluate(() => document.getElementById('map').hidden)) bad('большая карта не открылась');
  { const px = await page.evaluate(() => { const c = document.getElementById('mapCv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 400) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return set.size; }); if (px < 8) bad('большая карта пустая: цветов ' + px); }
  await page.screenshot({ path: join(out, '3d-map.png') });
  await page.tap('#mapClose'); await page.waitForTimeout(100);
  // навыки: очко вложить, ветки переключаются, эффекты видны
  await page.evaluate(() => { const w = window.__b3d.W; w.lv = 6; w.sp = 4; w.skills = {}; });
  await page.waitForTimeout(150);
  if (!(await page.$eval('#skillBtn', e => e.classList.contains('dot')))) bad('нет отметки о свободных очках навыков');
  await page.tap('#skillBtn'); await page.waitForTimeout(250);
  if (await page.evaluate(() => document.getElementById('skills').hidden)) bad('окно навыков не открылось');
  await page.screenshot({ path: join(out, '3d-skills.png') });
  const dmg0 = await page.evaluate(() => window.__b3d.W.gear.dmg);
  await page.tap('.tnode[data-key="t:th_hand"]'); await page.waitForTimeout(100);     // древо (2026-10-20): выбрать узел, «Вложить очко»
  await page.tap('.tcard .tbuy'); await page.waitForTimeout(100); await page.tap('.tcard .tbuy'); await page.waitForTimeout(120);
  if ((await page.evaluate(() => window.__b3d.W.skills.th_hand)) !== 2 || (await page.evaluate(() => window.__b3d.W.sp)) !== 2) bad('вложение очка в талант не сработало');
  if (!(await page.evaluate(() => [...[...document.querySelectorAll('.tbranch')][1].querySelectorAll('.tnode')].find(n => n.style.gridRowStart === '5').classList.contains('lock')))) bad('пятый ряд должен быть закрыт');     // древо 96 узлов (3.88): ряд 5 ждёт 6 очков в ветке
  { const small = await page.evaluate(() => [...document.querySelectorAll('#skills button')].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 40 || b.getBoundingClientRect().width < 40)).map(b => b.textContent)); if (small.length) bad('кнопки навыков мельче 40px: ' + small.join(',')); }
  await page.tap('#skillClose'); await page.waitForTimeout(100);
  { const d = await page.evaluate(() => window.__b3d.W.gear.dmg); if (!(d >= dmg0 + 4)) bad(`талант не повлиял на урон: ${dmg0} → ${d}`); }
  await page.evaluate(() => { const w = window.__b3d.W; w.lv = 1; w.sp = 0; w.skills = {}; });
  // торговец: кнопка «Торговать» появляется рядом, покупка и продажа
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings.find(b => b.npc && b.npc.kind === 'merchant'); w.player.x = b.npc.x + 1.2; w.player.z = b.npc.z; w.inv.ash = 500; w.inv.bag.push({ id: 'k_goblet', n: 1 }); });
  await page.waitForTimeout(500); await page.screenshot({ path: join(out, '3d-merchant.png') });
  if (await page.evaluate(() => document.getElementById('talk').hidden)) bad('кнопка «Торговать» не появилась рядом с торговцем');
  else {
    await page.tap('#talk'); await page.waitForTimeout(250);
    if (await page.evaluate(() => document.getElementById('shop').hidden)) bad('окно торговли не открылось');
    await page.screenshot({ path: join(out, '3d-shop.png') });
    const n0 = await page.evaluate(() => window.__b3d.W.inv.bag.length);
    await page.tap('.buyp .ttile:not(.poor)'); await page.waitForTimeout(120); await page.tap('.tsel .tact.buy'); await page.waitForTimeout(150);     // первая по карману (2026-10-20: сетка значков, карточка с кнопкой)
    if (!(await page.evaluate(() => window.__b3d.W.inv.ash < 500))) bad('покупка не списала пепел');
    await page.tap('#shopTabs .tab[data-tab="sell"]'); await page.tap('#shopJunk'); await page.waitForTimeout(150);
    if (await page.evaluate(() => window.__b3d.W.inv.bag.some(s => s.id === 'k_goblet'))) bad('«Продать хлам» не продал кубок');
    await page.screenshot({ path: join(out, '3d-shop-sell.png') });
    await page.tap('#shopClose'); await page.waitForTimeout(100);
  }
  // дальние враги и элита: лучник стреляет, колдун ставит пятно, элита отрисована, ошибок нет
  await page.evaluate(() => { const b = window.__b3d, w = b.W; w.player.x = 0; w.player.z = 4; w.enemies.length = 0; w.cfg.elite.chance = 1; const a = b.spawn('archer', 8, 4); a.alert = true; a.cd = .01; const k = b.spawn('witch', -8, 4); k.alert = true; k.cd = .01; w.cfg.elite.chance = .04; });
  await page.waitForTimeout(2600); await page.screenshot({ path: join(out, '3d-ranged.png') });
  { const r = await page.evaluate(() => { const w = window.__b3d.W; return { elites: w.enemies.filter(e => e.elite).length, ev: w.proj.length + w.haz.length, hp: w.player.hp }; }); if (r.elites !== 2) bad('элитные враги не появились: ' + JSON.stringify(r)); }
  await page.evaluate(() => { const w = window.__b3d.W; w.enemies.length = 0; w.proj.length = 0; w.haz.length = 0; w.player.hp = w.player.maxhp; });
  // сутки и звук: часы в шапке, ночь меняет небо и закрывает торговца, кнопка звука
  await page.evaluate(() => { const w = window.__b3d.W; w.t = 188 + 30; }); await page.waitForTimeout(600);
  { const r = await page.evaluate(() => ({ night: window.__b3d.W.night, time: document.getElementById('hudTime').textContent, moon: !!document.querySelector('#hudTime svg[data-ic="moon"]') })); if (!r.night || !r.moon || !/^\d\d:\d\d$/.test(r.time)) bad('ночь не наступила или нет часов с луной: ' + JSON.stringify(r)); }
  await page.screenshot({ path: join(out, '3d-night.png') });
  await page.evaluate(() => { const w = window.__b3d.W; w.t = 0; }); await page.waitForTimeout(600);
  if (await page.evaluate(() => window.__b3d.W.night)) bad('день не вернулся');
  await page.tap('#gear'); await page.waitForTimeout(150); const m0 = await page.$eval('#muteBtn', e => e.textContent); await page.tap('#muteBtn'); const m1 = await page.$eval('#muteBtn', e => e.textContent); if (m0 === m1) bad('кнопка звука не переключилась'); await page.tap('#muteBtn'); await page.tap('#tweakClose'); await page.waitForTimeout(100);
  // телефон: левша и размер кнопок меняют раскладку, код сохранения выгружается
  await page.tap('#gear'); await page.waitForTimeout(150);
  { const x0 = await page.$eval('#bAtk', e => e.getBoundingClientRect().left), w0 = await page.$eval('#bAtk', e => e.getBoundingClientRect().width);
    await page.tap('#leftyBtn'); await page.tap('.tab[data-v="1.2"]'); await page.waitForTimeout(100);
    const x1 = await page.$eval('#bAtk', e => e.getBoundingClientRect().left), w1 = await page.$eval('#bAtk', e => e.getBoundingClientRect().width);
    if (!(x1 < x0 && w1 > w0)) bad(`левша/размер не сработали: x ${x0}→${x1}, w ${w0}→${w1}`);
    await page.tap('#leftyBtn'); await page.tap('.tab[data-v="1"]'); }
  await page.tap('#fpsBtn'); await page.waitForTimeout(700); if (!/кадр/.test(await page.$eval('#fps', e => e.textContent))) bad('счётчик кадров не показан'); await page.tap('#fpsBtn');
  await page.tap('#expBtn'); await page.waitForTimeout(200); if (!(await page.$eval('#saveCode', e => e.value)).startsWith('B3D1:')) bad('код сохранения не выгружен');
  await page.screenshot({ path: join(out, '3d-prefs.png') });
  await page.tap('#tweakClose'); await page.waitForTimeout(100);
  // задания: кнопка рядом с торговцем, взять и увидеть в трекере
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings.find(b => b.npc && b.npc.kind === 'merchant'); w.player.x = b.npc.x + 1.2; w.player.z = b.npc.z; });
  await page.waitForTimeout(400);
  if (await page.evaluate(() => document.getElementById('questBtn').hidden)) bad('кнопка заданий не появилась у торговца');
  else {
    await page.tap('#questBtn'); await page.waitForTimeout(200);
    if (await page.evaluate(() => document.getElementById('quests').hidden)) bad('окно заданий не открылось');
    await page.tap('#questList .qcard.available .qbtn.main'); await page.waitForTimeout(150);
    await page.screenshot({ path: join(out, '3d-quests.png') });
    await page.tap('#questClose'); await page.waitForTimeout(500);
    if (await page.evaluate(() => document.getElementById('tracker').hidden)) bad('трекер задания не показан');
  }
  await page.evaluate(() => { const w = window.__b3d.W; w.player.x = 0; w.player.z = 4; });
  // кузнец: кнопка меняется на «Кузнец», улучшение списывает пепел
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings.find(b => b.npc && b.npc.kind === 'smith'); w.player.x = b.npc.x + 1.2; w.player.z = b.npc.z; w.inv.ash = 900; w.inv.eq.weapon = 'w_sword_iron'; });
  await page.waitForTimeout(500);
  if ((await page.$eval('#talk', e => e.hidden || e.textContent)) !== 'Кузнец') bad('у кузнеца кнопка не «Кузнец»');
  else {
    await page.tap('#talk'); await page.waitForTimeout(250);
    if (await page.evaluate(() => document.getElementById('smith').hidden)) bad('окно кузнеца не открылось');
    await page.screenshot({ path: join(out, '3d-smith.png') });
    await page.tap('#smithList .srow:first-child .buy'); await page.waitForTimeout(150);
    if (!(await page.evaluate(() => window.__b3d.W.inv.up.weapon === 1 && window.__b3d.W.inv.ash < 900))) bad('улучшение у кузнеца не сработало');
    await page.tap('#smithClose'); await page.waitForTimeout(100);
  }
  // капитан: найм бойцов в отряд
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings.find(b => b.npc && b.npc.kind === 'captain'); w.lv = 20; w.player.x = b.npc.x + 1.2; w.player.z = b.npc.z; w.inv.ash = 12000; });     // наём дороже с 3.78
  await page.waitForTimeout(500);
  if ((await page.$eval('#talk', e => e.hidden || e.textContent)) !== 'Наём') bad('у капитана кнопка не «Наём»');
  else {
    await page.tap('#talk'); await page.waitForTimeout(250);
    if (await page.evaluate(() => document.getElementById('captain').hidden)) bad('окно найма не открылось');
    await page.screenshot({ path: join(out, '3d-captain.png') });
    await page.tap('#captainList .srow:nth-child(2) .buy'); await page.tap('#captainList .srow:nth-child(3) .buy'); await page.waitForTimeout(150);
    if ((await page.evaluate(() => window.__b3d.W.allies.length)) !== 2) bad('наём не сработал: ' + (await page.evaluate(() => window.__b3d.W.allies.length)));
    { const small = await page.evaluate(() => [...document.querySelectorAll('#captain button')].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 40 || b.getBoundingClientRect().width < 40)).map(b => b.textContent)); if (small.length) bad('кнопки найма мельче 40px: ' + small.join(',')); }
    await page.tap('#captainClose'); await page.waitForTimeout(100);
    await page.evaluate(() => { const w = window.__b3d.W; w.player.x = 0; w.player.z = 4; w.cfg.enemies.count = 0; w.enemies.length = 0; });
    await page.waitForTimeout(2500); await page.screenshot({ path: join(out, '3d-squad.png') });
    await page.evaluate(() => { const w = window.__b3d.W; window.__b3d.spawn('brute', w.player.x + 3, w.player.z - 4).alert = true; });
    await page.waitForTimeout(2500); await page.screenshot({ path: join(out, '3d-squad-fight.png') });
    await page.evaluate(() => { const w = window.__b3d.W; w.allies.length = 0; w.enemies.length = 0; w.lv = 1; });
  }
  // оружие со стихией: поджигает, комбо растёт, карточка показывает свойства
  await page.evaluate(() => { const w = window.__b3d.W; w.inv.bag.push({ id: 'w_sword_steel_fire', n: 1 }); w.inv.bag.push({ id: 'wu_ember', n: 1 }); w.player.x = 0; w.player.z = 4; w.cfg.enemies.count = 0; w.enemies.length = 0; });
  await page.tap('#bagBtn'); await page.waitForTimeout(200);
  await page.tap('#bagList .tile[title^="Угль Затмения"]'); await page.waitForTimeout(120);
  { const t = await page.$eval('#bagCard', e => e.textContent); if (!t.includes('Пламя') || !t.includes('Добивание')) bad('в карточке уникального клинка нет свойств: ' + t.slice(0, 120)); }
  await page.screenshot({ path: join(out, '3d-unique.png') });
  await page.tap('#bagCard .acts .main'); await page.tap('#bagClose'); await page.waitForTimeout(150);
  await page.evaluate(() => { const w = window.__b3d.W, p = w.player; p.face = Math.PI / 2; w.cfg.player.autoAim = 5.5; const e = window.__b3d.spawn('brute', p.x + 1.6, p.z); e.hp = e.maxhp = 5000; e.alert = true; e.state = 'rec'; e.t = -1e9; w.__foe = e; });
  { const b = await (await page.$('#bAtk')).boundingBox(); const cdp2 = await ctx.newCDPSession(page);
    // серия — быстрыми касаниями (удержание теперь заряжает тяжёлый удар)
    for (let i = 0; i < 8; i++) { await cdp2.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + 20, y: b.y + 20, id: 2 }] }); await page.waitForTimeout(70); await cdp2.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200); }
    await page.screenshot({ path: join(out, '3d-combo.png') }); }
  { const r = await page.evaluate(() => ({ n: window.__b3d.W.combo.n, st: Object.keys(window.__b3d.W.__foe.st || {}), shown: !document.getElementById('combo').hidden }));
    if (r.n < 3 || !r.shown) bad('счётчик комбо не растёт или не виден: ' + JSON.stringify(r));
    // удержание: заряд (кольцо под героем), отпускание — тяжёлый удар
    { const b = await (await page.$('#bAtk')).boundingBox(); const cdp3 = await ctx.newCDPSession(page);
      const hp0 = await page.evaluate(() => window.__b3d.W.__foe.hp);
      const t0 = await page.evaluate(() => window.__b3d.W.t);
      await cdp3.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + 20, y: b.y + 20, id: 3 }] });
      await page.waitForFunction(t0 => window.__b3d.W.t - t0 > 1.6, t0, { timeout: 8000 }).catch(() => {});     // заряд — в игровом времени: при 12 кадр/с 1,5 с реальных — меньше секунды игры
      const st = await page.evaluate(() => window.__b3d.W.player.state); await page.screenshot({ path: join(out, '3d-charge.png') });
      await cdp3.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const hv = await page.waitForFunction(() => window.__b3d.W.player.heavy > .9, null, { timeout: 3000 }).then(() => 1).catch(() => page.evaluate(() => window.__b3d.W.player.heavy)); await page.waitForTimeout(700);     // ждём в игре: при 12 кадр/с 150 мс — один кадр
      const hp1 = await page.evaluate(() => window.__b3d.W.__foe.hp);
      if (st !== 'charge') bad('удержание кнопки «Удар» не заряжает: ' + st);
      if (!(hv > .9) || !(hp1 < hp0)) bad(`отпускание после заряда не дало тяжёлый удар: heavy=${hv}, ${hp0} → ${hp1}`); } if (!r.st.includes('burn') && !(await page.evaluate(() => window.__b3d.W.__foe.hp < 5000))) bad('меч с огнём не бьёт: ' + JSON.stringify(r)); }
  await page.evaluate(() => { const w = window.__b3d.W; w.inv.eq.weapon = null; w.enemies.length = 0; w.cfg.player.autoAim = 0; });
  // босс: полоса здоровья, предупреждение, подпись
  await page.evaluate(() => { const w = window.__b3d.W; w.enemies = w.enemies.filter(x => !x.boss); const e = window.__b3d.spawnBoss('devourer'); w.cfg.player.hp = 5000; w.player.hp = w.player.maxhp = 5000; w.player.inv = 0; w.player.x = e.x + 8; w.player.z = e.z; w.player.face = -Math.PI / 2; });
  await page.waitForTimeout(500);
  if (await page.$eval('#boss', e => e.hidden)) bad('полоса босса не показана рядом с логовом');
  else { const nm = await page.$eval('#bossName', e => e.textContent); if (!nm.includes('Пожиратель')) bad('имя босса: ' + nm);
    await page.evaluate(() => { const w = window.__b3d.W, e = w.enemies.find(x => x.boss && x.type === 'devourer'); w.player.x = e.x + 4; w.player.z = e.z; e.b.cd = 0; });
    let seen = false; for (let i = 0; i < 40 && !seen; i++) { await page.waitForTimeout(100); seen = await page.evaluate(() => window.__b3d.W.enemies.some(x => x.boss && x.b && x.b.state === 'wind')); }
    if (!seen) bad('босс не начал атаку с предупреждением'); await page.screenshot({ path: join(out, '3d-boss.png') }); }
  await page.evaluate(() => { const w = window.__b3d.W; w.enemies = w.enemies.filter(x => !x.boss); w.cfg.player.hp = 100; w.player.x = 0; w.player.z = 4; w.player.inv = 1e9; });
  // сеты: карточка части показывает комплект и бонусы; сложность в ⚙
  await page.evaluate(() => { const w = window.__b3d.W; w.inv.eq.head = 'a_head_helm_mail'; w.inv.eq.body = 'a_body_mail_mail'; w.inv.bag.push({ id: 'a_boots_greaves_mail', n: 1 }); w.inv.bag.push({ id: 'a_cloak_cloak_mail', n: 1 }); });
  await page.tap('#bagBtn'); await page.waitForTimeout(200);
  await page.tap('#bagList .tile[title^="Кольчужные поножи"]'); await page.waitForTimeout(120);
  { const t = await page.$eval('#bagCard', e => e.textContent); if (!t.includes('Сет «Рыцарь» 2/4') || !t.includes('шипы')) bad('карточка не показывает сет: ' + t.slice(0, 160)); }
  await page.screenshot({ path: join(out, '3d-set.png') });
  await page.tap('#bagCard .acts .main'); await page.waitForTimeout(100);
  if (!(await page.$eval('#bagStats', e => e.textContent)).includes('Рыцарь')) bad('в статах нет активного сета');
  await page.tap('#bagClose'); await page.waitForTimeout(100);
  await page.evaluate(() => { const w = window.__b3d.W; w.inv.eq.head = w.inv.eq.body = w.inv.eq.boots = null; w.inv.bag = []; });
  await page.tap('#gear'); await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, '3d-difficulty.png') });
  await page.tap('#difTabs .tab[data-id="ashen"]'); await page.waitForTimeout(100);
  if ((await page.evaluate(() => window.__b3d.W.difficulty)) !== 'ashen') bad('сложность не переключилась');
  await page.evaluate(() => { const w = window.__b3d.W; w.lv = 1; w.kills = 0; w.inv.ash = 0; w.inv.bag = []; });
  await page.tap('#difTabs .tab[data-id="eclipse"]'); await page.waitForTimeout(100);
  if (await page.$eval('#ironBtn', e => e.hidden)) bad('железный режим не предложен на «Затмении» в свежей игре');
  await page.tap('#difTabs .tab[data-id="berserk"]'); await page.tap('#tweakClose'); await page.waitForTimeout(100);
  // смерть: пепел остаётся могилой
  await page.evaluate(() => { const w = window.__b3d.W; w.player.x = 30; w.player.z = 30; w.inv.ash = 400; w.player.inv = 0; w.player.hp = 1; w.cfg.player.hp = 100; const e = window.__b3d.spawn('brute', 31, 30); e.alert = true; e.state = 'wind'; e.t = w.cfg.enemies.brute.wind - .01; });
  await page.waitForFunction(() => !document.getElementById('dead').hidden, null, { timeout: 6000 }).catch(() => {});     // экран ждёт 0,9 с игры: при 12 кадр/с это дольше 1,8 с
  { const r = await page.evaluate(() => ({ dead: !document.getElementById('dead').hidden, txt: document.getElementById('deadTxt').textContent, tomb: window.__b3d.W.tomb })); if (!r.dead || !r.txt.includes('100') || !r.tomb) bad('экран смерти без штрафа: ' + JSON.stringify(r)); }
  await page.screenshot({ path: join(out, '3d-death.png') }); await page.tap('#again'); await page.waitForTimeout(200);
  await page.evaluate(() => { const w = window.__b3d.W; w.tomb = null; w.inv.ash = 0; w.player.x = 0; w.player.z = 4; w.player.inv = 1e9; w.enemies = w.enemies.filter(x => x.boss); });
  // крафт и книги: прочитать том в сумке, ковка у кузнеца, журнал знаний
  await page.evaluate(() => { const w = window.__b3d.W; w.enemies = w.enemies.filter(x => x.boss); w.known = { tomes: {}, bestiary: {}, places: {}, kinds: {}, items: {} }; w.inv.bag = [{ id: 'tome_atlas_polya', n: 1 }, { id: 'm_ore', n: 6 }, { id: 'm_coal', n: 2 }]; w.inv.ash = 100; w.known.items.m_ore = 1; w.known.items.m_coal = 1; });
  await page.tap('#bagBtn'); await page.waitForTimeout(200);
  await page.tap('#bagList .tile[title^="Атлас Сухих Полей"]'); await page.waitForTimeout(120);
  await page.screenshot({ path: join(out, '3d-tome.png') });
  await page.tap('#bagCard .acts .main'); await page.waitForTimeout(150);
  if (!(await page.evaluate(() => window.__b3d.W.known.tomes.atlas_polya && window.__b3d.W.known.bestiary.hound === 2))) bad('книга не прочитана');
  await page.tap('#bagJournal'); await page.waitForTimeout(250);
  if (await page.evaluate(() => document.getElementById('journal').hidden)) bad('журнал не открылся');
  await page.tap('#journalTabs .tab[data-tab="bestiary"]'); await page.waitForTimeout(100);     // книга открывается на «Рецептах» (2026-10-18)
  { const t = await page.$eval('#journalList', e => e.textContent); if (!t.includes('Гончая') || !t.includes('Здоровье')) bad('бестиарий не показывает полную запись: ' + t.slice(0, 120)); }
  await page.screenshot({ path: join(out, '3d-journal.png') });
  await page.tap('#journalTabs .tab[data-tab="atlas"]'); await page.waitForTimeout(100);
  { const t = await page.$eval('#journalList', e => e.textContent); if (!t.includes('Сухие Поля') || !t.includes('Телега')) bad('атлас не показывает открытое: ' + t.slice(0, 200)); }
  await page.tap('#journalTabs .tab[data-tab="recipes"]'); await page.waitForTimeout(100);
  { const t = await page.$eval('#journalList', e => e.textContent); if (!t.includes('Закрытые рецепты') || !t.includes('Слухи')) bad('рецепты без подсказок о книгах'); }
  await page.tap('#journalTabs .tab[data-tab="sources"]'); await page.waitForTimeout(100);
  await page.tap('#journalList .jrow:has-text("Кусок руды")'); await page.waitForTimeout(100);
  { const t = await page.$eval('#journalList', e => e.textContent); if (!t.includes('Контейнеры') || !t.includes('Идёт в крафт')) bad('источники руды: ' + t.slice(0, 200)); }
  await page.screenshot({ path: join(out, '3d-sources.png') }); await page.tap('#journalClose'); await page.waitForTimeout(100);
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings.find(b => b.npc && b.npc.kind === 'smith'); w.player.x = b.npc.x + 1.2; w.player.z = b.npc.z; w.player.inv = 1e9; });
  await page.waitForTimeout(400); await page.tap('#talk'); await page.waitForTimeout(200);
  await page.tap('#smithTabs .tab[data-tab="craft"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: join(out, '3d-forge.png') });
  await page.tap('#smithList .srow:first-of-type .buy'); await page.waitForTimeout(150);
  if (!(await page.evaluate(() => window.__b3d.W.inv.bag.some(s => s.id === 'm_ingot')))) bad('ковка в браузере не сработала');
  { const t = await page.$eval('#smithList', e => e.textContent); if (!t.includes('Нужна книга')) bad('закрытые рецепты не показаны с книгой'); }     // по умолчанию — все рецепты
  { const small = await page.evaluate(() => [...document.querySelectorAll('#smith button, #journal button')].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 40 || b.getBoundingClientRect().width < 40)).map(b => b.textContent)); if (small.length) bad('кнопки ковки/журнала мельче 40px: ' + small.join(',')); }
  await page.tap('#smithClose'); await page.waitForTimeout(100);
  await page.evaluate(() => { const w = window.__b3d.W; w.player.x = 0; w.player.z = 4; });
  // новые враги: рисуются без ошибок
  await page.evaluate(() => { const w = window.__b3d.W; w.player.x = 0; w.player.z = 4; w.cfg.enemies.count = 0; w.enemies.length = 0; for (const [i, t] of ['hound', 'ghoul', 'imp', 'brute'].entries()) window.__b3d.spawn(t, -3 + i * 2, -3); });
  await page.waitForTimeout(500); await page.screenshot({ path: join(out, '3d-monsters.png') });
  await page.evaluate(() => { const w = window.__b3d.W; w.enemies.length = 0; w.cfg.enemies.count = 4; });
  // дома: снаружи крыша видна, внутри тает, стены опускаются
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings[0]; w.enemies.length = 0; w.player.x = b.door.out.x + 2; w.player.z = b.door.out.z; w.player.inv = 1e9; });
  await page.waitForTimeout(900); await page.screenshot({ path: join(out, '3d-house-out.png') });
  if (await page.evaluate(() => window.__b3d.W.inside) !== -1) bad('снаружи дома герой «внутри»');
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings[0]; w.player.x = b.x; w.player.z = b.z; });
  await page.waitForTimeout(900); await page.screenshot({ path: join(out, '3d-house-in.png') });
  if (await page.evaluate(() => window.__b3d.W.inside) !== 0) bad('внутри дома герой не «внутри»');
  const roofA = await page.evaluate(() => window.__b3d.renderer.town.items[0].roof.visible);
  if (roofA) bad('крыша не скрылась, когда герой в доме');
  // контейнер, сумка, экипировка в браузере
  await page.evaluate(() => { const w = window.__b3d.W, b = w.map.buildings[1], c = b.chests[0]; w.player.hp = 40; w.player.x = c.x; w.player.z = c.z; });
  await page.waitForTimeout(600); await page.screenshot({ path: join(out, '3d-chest.png') });
  if (await page.evaluate(() => window.__b3d.W.map.buildings[1].chests[0].ready)) bad('контейнер не открылся от касания');
  if (!(await page.evaluate(() => window.__b3d.W.inv.bag.length))) bad('добыча не попала в сумку');
  if ((await page.$$eval('#toasts .toast', a => a.length)) < 1) bad('нет уведомлений о добыче');
  await page.evaluate(() => { const W = window.__b3d.W; for (const id of ['w_greatsword_black', 'a_body_plate_black', 'p_heal2', 'f_rye', 'r_ring_might', 'k_goblet', 'b_diary_scrap']) W.inv.bag.push({ id, n: 1 }); });
  await page.tap('#bagBtn'); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.getElementById('bag').hidden)) bad('сумка не открылась');
  await page.screenshot({ path: join(out, '3d-bag.png') });
  { const geoB = await page.evaluate(() => [...document.querySelectorAll('#bag button')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 14), w: r.width, h: r.height }; }));
    const small = geoB.filter(b => b.h < 40 || b.w < 40); if (small.length) bad('кнопки сумки меньше 40px: ' + JSON.stringify(small.slice(0, 3))); }
  await page.tap('#bagList .tile[title^="Чёрный двуручник"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: join(out, '3d-bag-card.png') });
  await page.tap('#bagCard .acts .main'); await page.waitForTimeout(150);
  if (await page.evaluate(() => window.__b3d.W.inv.eq.weapon) !== 'w_greatsword_black') bad('предмет не надет');
  await page.waitForTimeout(120);
  if (!(await page.evaluate(() => window.__b3d.W.gear.dmg >= 20))) bad('надетое оружие не влияет на урон');
  await page.tap('.tab[data-tab="use"]'); await page.tap('#bagList .tile[title^="Зелье лечения"]'); await page.tap('#bagCard .acts .main'); await page.waitForTimeout(150);
  if (await page.evaluate(() => window.__b3d.W.inv.bag.some(s => s.id === 'p_heal2'))) bad('зелье не выпито');
  if (!(await page.evaluate(() => window.__b3d.W.player.hp > 40))) bad('зелье не лечит');
  await page.tap('#bagClose'); await page.waitForTimeout(100);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('berserk3d.save') || 'null'));
  if (!saved || saved.inv.eq.weapon !== 'w_greatsword_black') bad('сохранение не записалось');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForFunction(() => window.__b3d && window.__b3d.W, null, { timeout: 120000 }); await page.waitForTimeout(900);
  if (await page.evaluate(() => window.__b3d.W.inv.eq.weapon) !== 'w_greatsword_black') bad('надетое не пережило перезагрузку');
  await page.evaluate(() => { window.__b3d.W.inv.eq.weapon = null; window.__b3d.saver.write(true); });
  await page.evaluate(() => { const w = window.__b3d.W, c = window.__b3d.cfg; w.player.x = -4; w.player.z = 2; c.view.camDist = 32; });
  await page.waitForTimeout(1200); await page.screenshot({ path: join(out, '3d-town.png') });
  await page.evaluate(() => { const w = window.__b3d.W; w.player.x = 0; w.player.z = 4; window.__b3d.cfg.view.camDist = 19; });

  // погреб: кнопка у люка, спуск, лестница, подъём
  await page.evaluate(() => { const w = window.__b3d.W, d = window.__b3d.cfg.dungeons.list[0]; w.player.x = d.at.x + .6; w.player.z = d.at.z; });
  await page.waitForTimeout(400); await page.screenshot({ path: join(out, '3d-hatch.png') });
  const pb = await page.evaluate(() => { const b = document.getElementById('portalBtn'), r = b.getBoundingClientRect(); return { hidden: b.hidden, text: b.textContent, h: r.height, w: r.width, l: r.left, rt: r.right }; });
  if (pb.hidden || !/Спуститься/.test(pb.text)) bad('у люка нет кнопки «Спуститься»: ' + JSON.stringify(pb));
  if (pb.h < 44 || pb.l < 0 || pb.rt > 390) bad('кнопка люка мала или вылезает за экран: ' + JSON.stringify(pb));
  await page.tap('#portalBtn'); await page.waitForTimeout(900);
  if (await page.evaluate(() => window.__b3d.W.lvl) !== 'cellar_cooper') bad('по кнопке не спустились в погреб');
  await page.screenshot({ path: join(out, '3d-cellar.png') });
  await page.tap('#miniBtn'); await page.waitForTimeout(250); await page.screenshot({ path: join(out, '3d-cellar-map.png') }); await page.tap('#mapClose');
  // дверь кладовой заперта: без ключа не открывается (замок на створке, напоминание); с ключом на связке — отпирается
  await page.evaluate(() => { const w = window.__b3d.W, d = w.map.doors[0]; w.keys = {}; w.player.x = d.x - 1.2; w.player.z = d.z; });
  await page.waitForTimeout(600); await page.screenshot({ path: join(out, '3d-cellar-locked.png') });
  { const r = await page.evaluate(() => ({ open: window.__b3d.W.map.doors[0].open, locked: window.__b3d.W.map.doors[0].locked, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') }));
    if (!r.locked || r.open > .1 || !/Заперто/.test(r.toast)) bad('дверь кладовой не заперта или нет напоминания: ' + JSON.stringify(r)); }
  await page.evaluate(() => { window.__b3d.W.keys.cellar_cooper = true; });
  await page.waitForTimeout(600); await page.screenshot({ path: join(out, '3d-cellar-door.png') });
  if (!(await page.evaluate(() => window.__b3d.W.map.doors[0].open > .9 && !window.__b3d.W.map.doors[0].locked))) bad('с ключом дверь в погребе не открылась');
  // скрытый склеп: собирается и рисуется (вход пока только для проверки)
  const crypt = await page.evaluate(() => { const b = window.__b3d, d = b.cfg.dungeons.list.find(q => q.hidden); if (!d) return null; b.travel(d.id, 17, 0); return d.id; });
  if (crypt) {
    await page.waitForTimeout(700); await page.screenshot({ path: join(out, '3d-crypt.png') });
    await page.tap('#miniBtn'); await page.waitForTimeout(250); await page.screenshot({ path: join(out, '3d-crypt-map.png') }); await page.tap('#mapClose');
    if (await page.evaluate(() => window.__b3d.W.lvl) !== crypt) bad('склеп не открылся');
    await page.evaluate(() => { const b = window.__b3d, d = b.cfg.dungeons.list[0]; b.travel(d.id, d.entry.x, d.entry.z); });
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => { const w = window.__b3d.W, d = window.__b3d.cfg.dungeons.list[0]; w.player.x = d.exit.x + .3; w.player.z = d.exit.z; });
  await page.waitForTimeout(300);
  if (!/Подняться/.test(await page.textContent('#portalBtn'))) bad('у лестницы нет кнопки «Подняться»');
  await page.tap('#portalBtn'); await page.waitForTimeout(700);
  if (await page.evaluate(() => window.__b3d.W.lvl) !== 'surface') bad('по кнопке не поднялись наверх');
  await page.evaluate(() => { const w = window.__b3d.W; w.player.x = 0; w.player.z = 4; });

  // ползунки: свёрнуты, раскрываются по «Настройка прототипа»
  await page.tap('#gear'); await page.waitForTimeout(200);
  if (await page.evaluate(() => document.getElementById('tweakBox').open)) bad('ползунки прототипа не свёрнуты');
  await page.tap('#tweakBox summary'); await page.waitForTimeout(150);
  const rows = await page.$$eval('#tweaks input', a => a.length);
  if (rows < 10) bad('ползунков мало: ' + rows);
  const before = await page.evaluate(() => window.__b3d.cfg.view.camPitch);
  await page.evaluate(() => { const i = [...document.querySelectorAll('#tweaks input')][0]; i.value = i.min; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
  const after = await page.evaluate(() => window.__b3d.cfg.view.camPitch);
  if (before === after) bad('ползунок не меняет настройку');
  await page.screenshot({ path: join(out, '3d-panel.png') });
  const frozen = await st(); await page.waitForTimeout(400); const f2 = await st();
  if (f2.t !== frozen.t) bad('мир идёт при открытой панели');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }); await page.waitForFunction(() => window.__b3d && window.__b3d.W, null, { timeout: 120000 }); await page.waitForTimeout(800);
  const persisted = await page.evaluate(() => window.__b3d.cfg.view.camPitch);
  if (persisted !== after) bad(`настройка не пережила перезагрузку ${persisted} ≠ ${after}`);
  await page.tap('#gear'); await page.waitForTimeout(150); if (!(await page.evaluate(() => document.getElementById('tweakBox').open))) await page.tap('#tweakBox summary'); await page.tap('#tweakReset');
  if (await page.evaluate(() => window.__b3d.cfg.view.camPitch) !== before) bad('«Сбросить» не вернул значение');
  await page.tap('#tweakClose');

  // смерть и возрождение
  await page.evaluate(() => { const p = window.__b3d.W.player; p.inv = 0; p.hp = 1; window.__b3d.W.inv.eq = { weapon: null, head: null, body: null, cloak: null, boots: null, ring: null, amulet: null }; window.__b3d.W.inv.up = {}; window.__b3d.W.enemies.push({ id: 1000, type: 'brute', x: p.x + .5, z: p.z, vx: 0, vz: 0, hp: 50, maxhp: 50, face: 0, state: 'wind', t: .99, cd: 0, flash: 0, dead: false, deadT: 0, hitMe: false }); });
  await page.waitForFunction(() => !document.getElementById('dead').hidden, null, { timeout: 8000 }).catch(() => {});     // экран ждёт 0,9 с игры — при 12 кадр/с дольше
  if (await page.evaluate(() => document.getElementById('dead').hidden)) bad('экран смерти не показан');
  else { await page.screenshot({ path: join(out, '3d-dead.png') }); await page.tap('#again'); if (await page.evaluate(() => window.__b3d.W.player.dead)) bad('не возродился'); }

  // горизонтальный экран
  await page.setViewportSize({ width: 664, height: 390 }); await page.waitForTimeout(400);
  { const t0 = await page.evaluate(() => window.__b3d.W.t); await page.waitForTimeout(800);     // телефон боком — тоже играем (3.92): без подсказки «поверните», игра идёт, раскладка data-land
    const L = await page.evaluate(t => ({ rot: !document.getElementById('rotate').hidden, land: document.documentElement.hasAttribute('data-land'), runs: window.__b3d.W.t > t }), t0);
    if (L.rot || !L.land || !L.runs) bad('горизонтальный экран: ' + JSON.stringify(L)); }
  await page.setViewportSize({ width: 390, height: 664 });

  // кадры
  await page.waitForTimeout(500);
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 1500 ? requestAnimationFrame(f) : r(n / 1.5); }; f(); }));
  console.log('кадров/с (программный GL, для справки)', fps.toFixed(0));
  // гладкий вид (шаг 2 аудита) — в конце: переключение тональной кривой перекомпилирует все шейдеры, в Chromium без видеокарты это секунды
  { const sm = await page.evaluate(() => { const r = window.__b3d.renderer; r.setRetro(false); const c = document.getElementById('gl'), o = { w: c.width, ir: getComputedStyle(c).imageRendering, tone: r.look().tone }; r.setRetro(true); return o; });
    if (sm.w !== Math.round(390 * 1.5) || /pixelated|crisp/.test(sm.ir) || !sm.tone) bad('гладкий вид на телефоне: холст не в плотность экономии заряда (×1,5, 3.92) или без тональной кривой ' + JSON.stringify(sm)); }
} catch (e) { bad('исключение: ' + e.message); }
await browser.close(); await dev.close();
const fatal = logs.filter(l => !/GPU stall|swiftshader|GL Driver Message|ReadPixels/i.test(l));
if (fatal.length) bad('консоль: ' + fatal.slice(0, 5).join(' | '));
if (problems.length) { console.log('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('3D в браузере: OK');
