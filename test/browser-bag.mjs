// Браузерный тест сумки 3D (шаг P5): сетка плиток со значками и рамкой редкости, надетое со значками, карточка с построчным сравнением,
// на телефоне плитки не меньше 44 px и без горизонтальной прокрутки, на компьютере — две колонки. Скриншоты test/out/3d-bag-*.png.
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
  catch { console.log('Playwright не найден — браузерный тест сумки пропущен'); process.exit(0); }
}
const problems = [], bad = m => problems.push(m), logs = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5187, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;
const ITEMS = ['w_greatsword_black', 'w_spear_steel', 'w_hammer_bone', 'wu_ember', 'a_head_helm_mail', 'a_body_cuirass_plate', 'a_cloak_cloak_rag', 'a_boots_boots_studded', 'r_ring_thirst', 'm_amulet_might',
  ['p_heal1', 4], ['f_crust', 3], ['m_ore', 7], 'm_tempered_sinew', 'tome_smelting', 'key_rust', 'k_brooch', 'm_devourer_heart', ['h_rag_bandage', 2], 'u_pouch_small', 'w_sword_steel'];

async function fill(page) {
  return page.evaluate(async items => {
    const b = window.__b3d, W = b.W, { addItem } = await import('/3d/src/inv.js');
    W.inv.bag.length = 0; W.inv.eq.weapon = 'w_sword_iron'; W.inv.eq.head = 'a_head_cap_leather'; W.inv.up.weapon = 2;
    for (const x of items) { const [id, n] = Array.isArray(x) ? x : [x, 1]; addItem(W.inv, id, n, 99); }
    W.inv.bag.find(s => s.id === 'w_hammer_bone').up = 3;
    W.enemies.forEach(e => { if (!e.boss) e.dead = true; }); W.player.inv = 1e9;
    return W.inv.bag.length;
  }, ITEMS);
}
const bagInfo = page => page.evaluate(() => {
  const L = document.getElementById('bagList'), tiles = [...L.querySelectorAll('.tile')];
  return { n: tiles.length, minW: Math.min(...tiles.map(t => t.getBoundingClientRect().width)), over: L.scrollWidth - L.clientWidth,
    icons: tiles.every(t => { const i = t.querySelector('img.ic'); return i && i.naturalWidth === 16; }), rar: tiles.filter(t => /\br[34]\b/.test(t.className)).length,
    eqIcons: [...document.querySelectorAll('#bagEq .slot img.ic')].length, cnt: tiles.filter(t => t.querySelector('.cnt')).length, upg: tiles.filter(t => t.querySelector('.upg')).length, bt: tiles.filter(t => t.querySelector('.bt')).length,
    bagN: window.__b3d.W.inv.bag.length };
});

try {
  // ---- телефон ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/GPU stall due to ReadPixels/.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await page.goto(url + '?shot'); await page.waitForTimeout(1200);
    await fill(page);
    await page.tap('#bagBtn'); await page.waitForTimeout(300);
    const r = await bagInfo(page);
    if (r.n !== r.bagN) bad(`плиток ${r.n}, вещей ${r.bagN}`);
    { const f = await page.evaluate(() => { const e = document.getElementById('bagFill'); return { t: e.textContent, c: e.className }; });
      if (f.t !== r.bagN + '/30' || f.c !== '') bad('бирка сумки: ' + JSON.stringify(f));
      await page.evaluate(async () => { const { addItem } = await import('/3d/src/inv.js'), W = window.__b3d.W, ids = ['a_head_cap_leather', 'a_body_jerkin_leather', 'a_boots_boots_leather', 'w_sword_iron']; for (let i = 0; W.inv.bag.length < 30; i++) addItem(W.inv, ids[i % 4], 1, 30); });
      await page.waitForFunction(() => document.getElementById('bagFill').textContent === '30/30', null, { timeout: 3000 }).catch(() => {});      // кадры в безголовом браузере редкие
      const g = await page.evaluate(() => { const e = document.getElementById('bagFill'); return { t: e.textContent, c: e.className }; });
      if (g.t !== '30/30' || g.c !== 'full') bad('полная сумка не отмечена: ' + JSON.stringify(g)); }
    if (r.minW < 44) bad('плитка уже 44 px: ' + r.minW);
    if (r.over > 0) bad('сумка прокручивается вбок на ' + r.over + ' px');
    if (!r.icons) bad('не у всех плиток загружен значок 16×16');
    if (r.eqIcons !== 7) bad('у надетого не 7 значков: ' + r.eqIcons);
    if (r.rar < 2) bad('нет рамок великих и клеймёных вещей');
    if (r.cnt < 3 || r.upg < 1 || r.bt < 1) bad('нет пометок числа, улучшения или «лучше надетого»: ' + JSON.stringify(r));
    await page.screenshot({ path: join(out, '3d-bag-phone.png') });
    // карточка: стальной меч против надетого железного — построчное сравнение со стрелками вверх
    const i = await page.evaluate(() => { const W = window.__b3d.W, sorted = [...document.querySelectorAll('#bagList .tile')]; return sorted.findIndex(t => /Стальн[а-я]* меч/i.test(t.title)); });
    if (i < 0) bad('нет плитки стального меча');
    else {
      await page.locator('#bagList .tile').nth(i).tap(); await page.waitForTimeout(200);
      const c = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#bagCard .str')].map(r => r.className + ':' + r.textContent), big: !!document.querySelector('#bagCard img.ic.big') }));
      if (!c.big || !c.rows.some(x => /\bup\b/.test(x) && /урон/.test(x) && /→/.test(x))) bad('в карточке нет сравнения «было → стало»: ' + c.rows.join(' | '));
      await page.screenshot({ path: join(out, '3d-bag-card.png') });
    }
    await ctx.close();
  }
  // ---- компьютер: две колонки ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/GPU stall due to ReadPixels/.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => logs.push('pageerror: ' + e.message));
    await page.goto(url + '?shot'); await page.waitForTimeout(1200);
    await fill(page);
    await page.keyboard.press('KeyI'); await page.waitForTimeout(300);
    await page.locator('#bagList .tile').first().click(); await page.waitForTimeout(200);
    const L = await page.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); const e = r('bagEq'), l = r('bagList'), c = r('bagCard'); return { eqR: e.right, listL: l.left, cardR: c.right, listTop: l.top, eqTop: e.top }; });
    if (!(L.listL >= L.eqR && L.listL >= L.cardR)) bad('на компьютере не две колонки: ' + JSON.stringify(L));
    if (L.listTop > L.eqTop + 4) bad('на компьютере сетка начинается ниже надетого (дыра под вкладками): ' + JSON.stringify(L));
    const r = await bagInfo(page);
    if (r.n !== r.bagN || !r.icons || r.over > 0) bad('сумка на компьютере: ' + JSON.stringify(r));
    await page.screenshot({ path: join(out, '3d-bag-desk.png') });
    await ctx.close();
  }
  for (const l of logs) bad(l);
} finally { await browser.close(); await dev.close(); }

if (problems.length) { console.error('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('Сумка 3D в браузере: OK');
