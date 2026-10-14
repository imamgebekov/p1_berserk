// Браузерный тест прогресса: навыки, задания, сохранение между перезагрузками, сброс, повреждённые данные, недоступное хранилище.
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
const server = await createServer({ root, server: { port: 5188, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.config.server.port}/`;
const problems = [];
const bad = (m) => problems.push(m);
const browser = await chromium.launch();
const device = { viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(ctx, label, logs) {
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(label + ' ' + m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push(label + ' pageerror: ' + e.message));
  await page.goto(url); await page.waitForSelector('#go');
  return page;
}
const st = page => page.evaluate(() => { const B = window.__berserk, P = B.P; return { lv: P.lv, ash: P.ash, sp: P.sp, skills: JSON.stringify(P.skills), bag: P.bag.map(i => i.id + ':' + i.up).join(), weapon: P.eq.weapon ? P.eq.weapon.id + ':' + P.eq.weapon.up : '-', quests: JSON.stringify(P.quests), cycle: B.W.cycle }; });

try {
  // ---------- 1. чистый старт: навыки и задания ----------
  {
    const logs = []; const ctx = await browser.newContext(device); const page = await open(ctx, 'чистый', logs);
    if (!(await page.locator('#saveBox').isHidden())) bad('чистый старт: блок сохранения виден');
    if ((await page.locator('#go').textContent()) !== 'Войти в мир') bad('чистый старт: кнопка входа «' + await page.locator('#go').textContent() + '»');
    await page.tap('#go');
    await page.evaluate(() => { const B = window.__berserk; B.P.sp = 3; B.P.lv = 4; B.recalc(); B.W.spawnT = 999; });
    const geo = await page.evaluate(() => [...document.querySelectorAll('.mbtn, .btn, #talk')].filter(e => e.offsetParent !== null).map(e => { const r = e.getBoundingClientRect(); return { id: e.id, x: r.x, y: r.y, w: r.width, h: r.height }; }));
    for (const g of geo) if (g.w < 44 || g.h < 44) bad(`кнопка #${g.id} ${g.w}×${g.h} < 44px`);
    const pad = geo.filter(g => ['bl', 'br', 'batk', 'bjump', 'bbrand', 'mhero', 'mbag', 'mskills'].includes(g.id));
    for (let i = 0; i < pad.length; i++) for (let j = i + 1; j < pad.length; j++) { const a = pad[i], c = pad[j]; if (a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h) bad(`кнопки #${a.id} и #${c.id} пересекаются`); }
    if (!pad.some(g => g.id === 'mskills')) bad('нет кнопки «Навыки»');
    await page.waitForFunction(() => !document.getElementById('spBadge').hidden, null, { timeout: 3000 }).catch(() => bad('нет значка очков навыков на кнопке'));
    await page.tap('#mskills'); await page.waitForSelector('#skillsTab:not([hidden])');
    const sk = await page.evaluate(() => ({ nodes: document.querySelectorAll('.sknode').length, small: [...document.querySelectorAll('.sknode, #bag .tab, #skFoot .cbtn')].filter(e => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height) < 44).length,
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight, paused: window.__berserk.W.paused, sp: document.getElementById('bagSp').textContent }));
    if (sk.nodes !== 8) bad('узлов навыков ' + sk.nodes); if (sk.small) bad(`навыки: ${sk.small} элементов < 44px`); if (sk.overflow) bad('навыки выходят за экран'); if (!sk.paused) bad('навыки без паузы');
    if (!sk.sp.includes('3')) bad('нет счётчика очков: «' + sk.sp + '»');
    await page.tap('.sknode[data-id=vigor]'); await page.waitForSelector('#skWrap:not([hidden])');
    const maxhp0 = await page.evaluate(() => window.__berserk.P.maxhp);
    await page.tap('#skCard .cbtn.main');
    const after = await page.evaluate(() => ({ sp: window.__berserk.P.sp, maxhp: window.__berserk.P.maxhp, rank: window.__berserk.P.skills.vigor }));
    if (after.sp !== 2 || after.rank !== 1 || after.maxhp <= maxhp0) bad('изучение навыка: ' + JSON.stringify(after));
    await page.screenshot({ path: join(out, 'progress_skills.png') });
    await page.tap('#skCard .cbtn.close').catch(() => {});
    // сброс навыков (два тапа)
    await page.evaluate(() => { window.__berserk.P.ash = 500; });
    await page.tap('#skFoot .cbtn'); await page.tap('#skFoot .cbtn');
    const rs = await page.evaluate(() => ({ sp: window.__berserk.P.sp, skills: JSON.stringify(window.__berserk.P.skills), ash: window.__berserk.P.ash }));
    if (rs.sp !== 3 || rs.skills !== '{}' || rs.ash >= 500) bad('сброс навыков: ' + JSON.stringify(rs));
    await page.tap('#bagClose');

    // хранитель
    await page.evaluate(() => { window.__berserk.P.x = 128; });
    await page.waitForFunction(() => document.getElementById('talk').textContent === 'Хранитель');
    await page.tap('#talk'); await page.waitForSelector('#town:not([hidden])');
    const kq = await page.evaluate(() => ({ title: document.getElementById('tTitle').textContent, n: document.querySelectorAll('#tList .quest').length, list: !document.getElementById('tList').hidden, grid: !document.getElementById('tGrid').hidden,
      small: [...document.querySelectorAll('#tList .cbtn, #tClose')].filter(e => e.getBoundingClientRect().height < 44).length }));
    if (!kq.list || kq.grid || kq.n < 3) bad('доска заданий: ' + JSON.stringify(kq)); if (kq.small) bad('кнопки заданий < 44px');
    await page.locator('#tList .quest .cbtn', { hasText: 'Взять' }).first().tap();
    await page.locator('#tList .quest .cbtn', { hasText: 'Взять' }).first().tap();
    await page.locator('#tList .quest .cbtn', { hasText: 'Взять' }).first().tap();
    const lim = await page.evaluate(() => ({ active: Object.values(window.__berserk.P.quests).filter(q => q.st === 'active').length, blocked: [...document.querySelectorAll('#tList .quest .cbtn')].some(b => b.disabled && b.textContent.includes('Лимит')) }));
    if (lim.active !== 3) bad('взято заданий ' + lim.active);
    await page.screenshot({ path: join(out, 'progress_quests.png') });
    await page.tap('#tClose');
    if ((await page.locator('#quest').isHidden())) bad('нет строки задания в HUD');
    await ctx.close();
    for (const l of logs) bad(l);
  }

  // ---------- 2. сохранение переживает перезагрузку, потом сброс ----------
  {
    const logs = []; const ctx = await browser.newContext(device); let page = await open(ctx, 'сохранение', logs);
    await page.tap('#go');
    await page.evaluate(() => { const B = window.__berserk; B.P.lv = 7; B.P.xp = 5; B.P.ash = 777; B.P.sp = 2; B.P.skills = { heavy: 1, vigor: 2 };
      for (const id of ['w_bone_edge', 'h_horned_helm', 'r_silver']) B.giveItem(B.newItem(id));
      B.P.bag[0].up = 3; B.P.quests = { q_brutes: { st: 'active', n: 4 } }; B.W.cycle = 2; B.recalc(); B.saver.write(); });
    const before = await st(page);
    page = (await (async () => { await page.reload(); await page.waitForSelector('#go'); return page; })());
    const veil = await page.evaluate(() => ({ go: document.getElementById('go').textContent, box: !document.getElementById('saveBox').hidden, txt: document.getElementById('saveTxt').textContent }));
    if (veil.go !== 'Продолжить' || !veil.box || !veil.txt.includes('ур. 7') || !veil.txt.includes('777')) bad('экран входа после перезагрузки: ' + JSON.stringify(veil));
    const afterLoad = await st(page);
    for (const k of Object.keys(before)) if (before[k] !== afterLoad[k]) bad(`после перезагрузки ${k}: ${before[k]} ≠ ${afterLoad[k]}`);
    await page.tap('#go');
    const run = await page.evaluate(() => { const B = window.__berserk; return { hp: B.P.hp === B.P.maxhp, started: B.W.started }; });
    if (!run.hp || !run.started) bad('игра после загрузки не стартовала: ' + JSON.stringify(run));
    // автосохранение по таймеру: меняем состояние и ждём (interval из конфига ~10 с слишком долго — просим сохранение событием)
    await page.evaluate(() => { const B = window.__berserk; B.P.ash = 1001; B.saver.request(); });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('berserk.save')).P.ash === 1001, null, { timeout: 6000 }).catch(() => bad('сохранение по запросу не сработало за 6 с'));
    // сворачивание вкладки сохраняет
    await page.evaluate(() => { window.__berserk.P.ash = 1002; window.dispatchEvent(new Event('pagehide')); });
    if ((await page.evaluate(() => JSON.parse(localStorage.getItem('berserk.save')).P.ash)) !== 1002) bad('pagehide не сохранил');
    // сброс прогресса из вкладки «Герой»
    await page.tap('#mhero'); await page.waitForSelector('#heroTab:not([hidden])');
    const info = await page.locator('#saveInfo').textContent(); if (!info.includes('Автосохранение')) bad('нет статуса автосохранения: «' + info + '»');
    const rh = await page.locator('#resetBtn').boundingBox(); if (rh.height < 44) bad('кнопка сброса < 44px');
    await page.screenshot({ path: join(out, 'progress_hero_save.png') });
    await page.tap('#resetBtn');
    if (!(await page.locator('#resetBtn').textContent()).includes('Точно')) bad('сброс без подтверждения');
    await Promise.all([page.waitForNavigation(), page.tap('#resetBtn')]);
    await page.waitForSelector('#go');
    const fresh = await page.evaluate(() => ({ save: localStorage.getItem('berserk.save'), bak: localStorage.getItem('berserk.save.bak'), lv: window.__berserk.P.lv, go: document.getElementById('go').textContent }));
    if (fresh.save !== null || fresh.lv !== 1 || fresh.go !== 'Войти в мир') bad('после сброса: ' + JSON.stringify(fresh));
    // после сброса pagehide не должен воскресить сохранение
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    if ((await page.evaluate(() => localStorage.getItem('berserk.save'))) !== null) bad('сохранение воскресло после сброса');
    await ctx.close();
    for (const l of logs) bad(l);
  }

  // ---------- 3. «Начать заново» на экране входа ----------
  {
    const logs = []; const ctx = await browser.newContext(device); let page = await open(ctx, 'новая игра', logs);
    await page.evaluate(() => { window.__berserk.P.lv = 5; window.__berserk.W.started = true; window.__berserk.saver.write(); });
    await page.reload(); await page.waitForSelector('#go');
    if (await page.locator('#newGame').isHidden()) bad('нет кнопки «Начать заново»');
    const nb = await page.locator('#newGame').boundingBox(); if (nb.height < 44) bad('«Начать заново» < 44px');
    await page.tap('#newGame'); if (!(await page.locator('#newGame').textContent()).includes('Точно')) bad('«Начать заново» без подтверждения');
    await Promise.all([page.waitForNavigation(), page.tap('#newGame')]); await page.waitForSelector('#go');
    if ((await page.evaluate(() => window.__berserk.P.lv)) !== 1) bad('новая игра не сбросила уровень');
    await ctx.close(); for (const l of logs) bad(l);
  }

  // ---------- 4. повреждённое сохранение ----------
  {
    const logs = []; const ctx = await browser.newContext(device); let page = await open(ctx, 'повреждение', logs);
    await page.evaluate(() => localStorage.setItem('berserk.save', '{"v":1,"P":{broken'));
    await page.reload(); await page.waitForSelector('#go');
    const v = await page.evaluate(() => ({ txt: document.getElementById('saveTxt').textContent, bak: localStorage.getItem('berserk.save.bak'), lv: window.__berserk.P.lv }));
    if (!v.txt.includes('повреждено') || v.bak !== '{"v":1,"P":{broken' || v.lv !== 1) bad('повреждённое сохранение: ' + JSON.stringify(v));
    await page.tap('#go'); await page.waitForTimeout(500);
    if (!(await page.evaluate(() => window.__berserk.W.started))) bad('игра не стартовала при повреждённом сохранении');
    // сохранение из будущей версии (игра не запущена, поэтому pagehide ничего не перезапишет)
    await page.reload(); await page.waitForSelector('#go');
    await page.evaluate(() => localStorage.setItem('berserk.save', JSON.stringify({ v: 99, P: { lv: 50 } })));
    await page.reload(); await page.waitForSelector('#go');
    const f = await page.evaluate(() => ({ txt: document.getElementById('saveTxt').textContent, lv: window.__berserk.P.lv, bak: !!localStorage.getItem('berserk.save.bak') }));
    if (!f.txt.includes('повреждено') || f.lv !== 1 || !f.bak) bad('сохранение из будущего: ' + JSON.stringify(f));
    await ctx.close(); for (const l of logs) bad(l);
  }

  // ---------- 5. хранилище недоступно (приватный режим) ----------
  {
    const logs = []; const ctx = await browser.newContext(device);
    await ctx.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('denied', 'SecurityError'); }; });
    const page = await open(ctx, 'без хранилища', logs);
    const v = await page.evaluate(() => ({ txt: document.getElementById('saveTxt').textContent, box: !document.getElementById('saveBox').hidden }));
    if (!v.box || !v.txt.includes('недоступно')) bad('нет предупреждения о недоступном сохранении: ' + JSON.stringify(v));
    await page.tap('#go'); await page.waitForTimeout(600);
    await page.evaluate(() => window.__berserk.saver.request());
    await page.tap('#mhero'); await page.waitForSelector('#heroTab:not([hidden])');
    const info = await page.locator('#saveInfo').textContent(); if (!info.includes('недоступно')) bad('вкладка «Герой» не предупреждает: «' + info + '»');
    await ctx.close(); for (const l of logs) bad(l);
  }
} finally { await browser.close(); await server.close(); }

if (problems.length) { console.error('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('Браузерный тест прогресса: OK');
