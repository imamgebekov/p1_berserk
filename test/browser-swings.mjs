// Браузерный тест ударов 3D (шаг P1): у героя в руке модель надетого оружия, у каждого семейства движений свои замахи и след клинка.
// Снимает галерею test/out/3d-swing-<семейство>-<шаг>.png (замах заморожен в момент попадания) и проверяет, что нет ошибок.
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
  catch { console.log('Playwright не найден — браузерный тест ударов пропущен'); process.exit(0); }
}
const problems = [], bad = m => problems.push(m), logs = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5185, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;
const SHOW = { slash: 'sword', thrust: 'spear', smash: 'hammer', spin: 'greatsword', flail: 'chain_ball', fists: 'fists' };

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/GPU stall due to ReadPixels/.test(m.text())) logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  await page.goto(url + '?shot'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const W = window.__b3d.W; W.enemies.forEach(e => { if (!e.boss) e.dead = true; }); W.player.x = 0; W.player.z = 8; W.player.face = Math.PI * .75; });

  for (const [fam, kind] of Object.entries(SHOW)) for (const step of ['a', 'b', 'fin']) {
    const r = await page.evaluate(async ({ kind, step }) => {
      const b = window.__b3d, W = b.W, p = W.player, cfg = b.cfg;
      const { BY_ID } = await import('/3d/src/data/items.js'), { refreshGear } = await import('/3d/src/sim.js');
      const id = kind === 'fists' ? null : Object.keys(BY_ID).find(k => BY_ID[k].kind === kind && BY_ID[k].mat === 'steel' && BY_ID[k].cat === 'weapon');
      W.inv.eq.weapon = id; refreshGear(W);
      W.freeze = 999; p.state = 'atk'; p.chain = step === 'a' ? 1 : step === 'b' ? 2 : 3; p.fin = step === 'fin'; p.atkT = 0;
      const hitT = cfg.player.attackHitAt * (W.gear.swing || 1);
      await new Promise(res => { const tick = () => { p.atkT = Math.min(hitT * 1.08, p.atkT + hitT / 14); if (p.atkT >= hitT * 1.08) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const h = b.renderer.hero;
      return { id, kind: W.wp.kind, wkind: h.weapon ? h.weapon.kind : 'fists', family: h.family };
    }, { kind, step });
    if (r.kind !== kind || r.wkind !== kind || r.family !== fam) bad(`${fam}/${step}: в руке не то оружие ${JSON.stringify(r)}`);
    await page.screenshot({ path: join(out, `3d-swing-${fam}-${step}.png`), clip: { x: 45, y: 150, width: 300, height: 330 } });
  }
  await page.evaluate(() => { const W = window.__b3d.W; W.freeze = 0; W.player.state = 'idle'; });
  // попадания и смерть: брызги прочь от героя, искры, вспышка, пятна, пепел; цифры крита и завершающего крупнее
  const hits = await page.evaluate(async () => {
    const b = window.__b3d, W = b.W, p = W.player;
    const { BY_ID } = await import('/3d/src/data/items.js'), { refreshGear } = await import('/3d/src/sim.js');
    W.inv.eq.weapon = Object.keys(BY_ID).find(k => BY_ID[k].kind === 'sword' && BY_ID[k].mat === 'steel'); refreshGear(W);
    p.face = Math.PI * .75; const fx = Math.sin(p.face), fz = Math.cos(p.face);
    const e1 = b.spawn('imp', p.x + fx * 1.8, p.z + fz * 1.8), e2 = b.spawn('ghoul', p.x + fx * 2.2 + fz, p.z + fz * 2.2 - fx);
    W.freeze = 999;
    W.ev.push({ k: 'hit', x: e1.x, z: e1.z, dmg: 23, crit: true, id: e1.id }, { k: 'hit', x: e2.x, z: e2.z, dmg: 31, fin: true, id: e2.id }, { k: 'hit', x: e2.x, z: e2.z, dmg: 4, fx: 'burn', id: e2.id });
    e2.hp = 0; e2.dead = true; e2.deadT = 0; W.ev.push({ k: 'die', x: e2.x, z: e2.z, type: e2.type, id: e2.id });
    await new Promise(r => setTimeout(r, 160));
    const live = b.renderer.fx.live(), nums = [...document.querySelectorAll('#dmg .num')].map(d => d.className + ':' + d.textContent);
    return { live, nums };
  });
  await page.screenshot({ path: join(out, '3d-hits.png'), clip: { x: 20, y: 120, width: 350, height: 380 } });
  if (hits.live.parts < 20) bad('мало частиц после попаданий: ' + JSON.stringify(hits.live));
  if (hits.live.decals < 2) bad('нет пятен на земле: ' + JSON.stringify(hits.live));
  if (!hits.nums.some(n => /crit/.test(n) && /!$/.test(n)) || !hits.nums.some(n => /\bfin\b/.test(n))) bad('цифры крита и завершающего не выделены: ' + hits.nums.join(' | '));
  await page.evaluate(() => { const W = window.__b3d.W; W.freeze = 0; });
  // новые враги: щитоносец, тлеющий с фитилём, копейщик целится (полоса), тень
  const beasts = await page.evaluate(async () => {
    const b = window.__b3d, W = b.W, p = W.player; W.freeze = 0; W.enemies.forEach(e => { if (!e.boss) e.dead = true; }); p.face = Math.PI * .75;
    const at = (t, ang, d) => { const e = b.spawn(t, p.x + Math.sin(p.face + ang) * d, p.z + Math.cos(p.face + ang) * d); e.cd = 99; e.face = Math.atan2(p.x - e.x, p.z - e.z); return e; };
    const sh = at('shield', -.5, 3.2), bo = at('bomber', .45, 2.6), lu = at('lunger', 1.3, 4.5), sd = at('shade', -1.4, 3);
    const C = b.cfg.enemies;
    bo.state = 'fuse'; bo.t = .6; W.haz.push({ x: bo.x, z: bo.z, r: C.bomber.fuse.r, t: .6, delay: 99, dmg: 0, by: bo.id, bomber: true });
    lu.state = 'aim'; lu.t = .6; lu.tele = { len: C.lunger.lunge.len, w: C.lunger.lunge.w, aim: C.lunger.lunge.aim };
    W.freeze = 999; await new Promise(r => setTimeout(r, 400));
    return W.enemies.filter(e => !e.dead && !e.boss).map(e => e.type).sort().join(',');
  });
  await page.screenshot({ path: join(out, '3d-beasts.png'), clip: { x: 0, y: 100, width: 390, height: 460 } });
  if (beasts !== 'bomber,lunger,shade,shield') bad('новые враги не появились: ' + beasts);
  await page.evaluate(() => { const W = window.__b3d.W; W.freeze = 0; W.haz.length = 0; });
  await ctx.close();
  for (const l of logs) bad(l);
} finally { await browser.close(); await dev.close(); }

if (problems.length) { console.error('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('Удары 3D в браузере: OK');
