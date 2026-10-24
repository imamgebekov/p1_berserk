// Ощущение боя в браузере (этап 1 «круче»): убийство босса — вспышка и замедление, потом гаснет; серия — надпись «Серия ×3»;
// новый уровень — карточка с открытым умением; низкое здоровье — красная кайма. Снимки — test/out/feel-*.png.
import { createServer } from 'vite';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = process.env.FEEL_OUT || join(root, 'test', 'out'); mkdirSync(out, { recursive: true });
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { try { ({ chromium } = await import(join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'))); } catch { console.log('Playwright не найден — тест пропущен'); process.exit(0); } }
const problems = [], bad = m => problems.push(m), tag = process.argv[2] || 'feel';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5187, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html?shot&hero=thorn` + (process.env.FEEL_SMOOTH ? '' : '&retro') + (tag === 'nofeel' ? '&nofeel' : '');
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => bad('pageerror: ' + e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForFunction(() => window.__b3d && window.__b3d.W, null, { timeout: 180000 });     // холодный vite собирает модули дольше 30 с
  const ev = (f, a) => page.evaluate(f, a), op = id => ev(id => { const e = document.getElementById(id); return e.hidden ? 0 : Number(getComputedStyle(e).opacity); }, id);     // скрытый слой — 0
  await ev(() => { const W = window.__b3d.W; W.player.maxhp = W.player.hp = 1e6; W.enemies.forEach(e => { e.dead = true; }); });
  await page.waitForTimeout(1500);
  const push = v => ev(v => { const b = window.__b3d, W = b.W; b.emit({ ...v, x: W.player.x + 2, z: W.player.z }); }, v);     // прямо в обработчик: очередь мира шаг может стереть раньше рендера
  // босс: вспышка, замедление и наезд сразу, потом гаснет (пики копит игра — кадр без видеокарты длинный)
  await ev(() => window.__b3d.feelPeak()); await push({ k: 'die', boss: true, type: 'devourer' });
  let p1 = { scale: 1, flash: 0, zoom: 0 }; for (let k = 0; k < 26 && !(p1.flash > .2 && p1.scale < .5 && p1.zoom > .05); k++) { await page.waitForTimeout(300); const q = await ev(() => window.__b3d.feelPeak()); p1 = { scale: Math.min(p1.scale, q.scale), flash: Math.max(p1.flash, q.flash), zoom: Math.max(p1.zoom, q.zoom), now: q.now }; if (tag === 'nofeel' && k >= 1) break; }     // ждём кадров: без видеокарты их мало
  await page.screenshot({ path: join(out, `${tag}-boss.png`) });
  await page.waitForTimeout(3500); ev(() => window.__b3d.feelPeak()); await page.waitForTimeout(300); const p2 = await ev(() => window.__b3d.feelPeak());
  if (tag === 'feel') { if (!(p1.flash > .2 && p1.scale < .5 && p1.zoom > .05)) bad('нет отклика на убийство босса: ' + JSON.stringify(p1)); if (!(p2.flash < .02 && p2.scale === 1 && p2.zoom < .02)) bad('отклик босса не погас: ' + JSON.stringify(p2)); }
  else if (p1.flash > .02 || p1.scale < 1) bad('?nofeel: отклик есть ' + JSON.stringify(p1));
  // серия
  for (let i = 0; i < 3; i++) { await push({ k: 'die', type: 'imp' }); await page.waitForTimeout(250); }
  const st = await ev(() => { const e = document.getElementById('streak'); return { on: !e.hidden, t: e.textContent }; });
  await page.screenshot({ path: join(out, `${tag}-streak.png`) });
  if (tag === 'feel' && !(st.on && /×3/.test(st.t))) bad('нет надписи серии: ' + JSON.stringify(st));
  // новый уровень: карточка
  await push({ k: 'level', lv: 3 }); await page.waitForTimeout(400);
  const lc = await ev(() => { const e = document.getElementById('lvlCard'); return { on: !e.hidden, t: e.textContent }; });
  await page.screenshot({ path: join(out, `${tag}-level.png`) });
  if (!(lc.on && /Уровень 3/.test(lc.t) && /Новое умение/.test(lc.t))) bad('нет карточки уровня с умением: ' + JSON.stringify(lc));
  await page.waitForTimeout(3500); if (!(await ev(() => document.getElementById('lvlCard').hidden))) bad('карточка уровня не скрылась');
  // низкое здоровье: кайма
  for (let i = 0; i < 12; i++) { await ev(() => { const p = window.__b3d.W.player; p.hp = p.maxhp * .08; }); await page.waitForTimeout(50); }     // 8% от настоящего запаса: лагерь лечит, запас считают вещи
  const v1 = await op('feelVig'); await page.screenshot({ path: join(out, `${tag}-lowhp.png`) });
  await ev(() => { const p = window.__b3d.W.player; p.hp = p.maxhp; }); await page.waitForTimeout(400); const v2 = await op('feelVig');
  if (tag === 'feel') { if (!(v1 > .2)) bad('нет красной каймы при 8% здоровья: ' + v1); if (!(v2 < .01)) bad('кайма не ушла при полном здоровье: ' + v2); }
  // боевая музыка: звук включается после нажатия клавиши; два встревоженных врага рядом — играют боевые такты
  if (tag === 'feel') {
    await page.keyboard.press('KeyM'); await page.keyboard.press('KeyM'); await page.waitForTimeout(300);
    await ev(() => { const p = window.__b3d.W.player; p.x = 0; p.z = 48; window.__b3d.cfg.audio.fight.on = true; }); await page.waitForTimeout(800);     // за воротами: в лагере враги не живут; боевую музыку в игре выключили (5.04) — тест включает её и проверяет код
    await ev(() => { const b = window.__b3d, W = b.W, p = W.player; p.hp = p.maxhp; for (let i = 0; i < 2; i++) { const e = b.spawn('brute', p.x + 4 + i, p.z); e.alert = true; e.hp = e.maxhp = 1e7; } b.cfg.enemies.brute.damage = 0; });
    let n = 0; for (let k = 0; k < 40 && !n; k++) { await page.waitForTimeout(250); n = await ev(() => window.__b3d.audioStats().fightNotes || 0); }
    const st = await ev(() => window.__b3d.audioStats().state);
    if (st === 'running' && !(n > 0)) bad('в бою нет боевой музыки (нот ' + n + ')'); else if (st !== 'running') console.log('  звук не запустился в этом браузере (' + st + ') — музыку не проверить');
  }
  await ctx.close();
} finally { await browser.close(); await dev.close(); }
if (problems.length) { console.log('Ощущение боя в браузере: ПРОВАЛ\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('Ощущение боя в браузере: OK' + (tag === 'nofeel' ? ' (?nofeel — без эффектов)' : ''));
