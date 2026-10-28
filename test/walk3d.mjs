// Тест-прогулка 3D (шаг C5): бот идёт по маршруту через большой мир — лагерь, мост, лес, горы у плато, ворота замка,
// побережье, этаж замка. На каждом отрезке: перенос к началу, секунда на подгрузку, затем WALK с реального бега к цели
// (участки земли подгружаются на ходу, враги есть, герой неуязвим). Меряется время кадра на процессоре (симуляция +
// подготовка отрисовки), самый долгий кадр, вызовы отрисовки и треугольники. Движки: Chromium и WebKit (если установлен).
// Частота кадров в безголовом браузере — не Мак (WebKit упирается в 60, Chromium без видеокарты рисует процессором),
// поэтому пороги — на время процессора и объём отрисовки. Скриншоты: test/out/3d-walk-*.png
import { createServer } from 'vite';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'test', 'out'); mkdirSync(out, { recursive: true });
// пороги — по замеру с запасом: Chromium p95 2–3,6 мс, WebKit 4–6 мс (таймер грубее, 1 мс), долгий кадр до 11 мс; вызовов до ~250
// (материалы и детали мира 3.56–3.61, замер WebKit 249 — 2026-10-20)
// Chromium рисует процессором (swiftshader): с материалами 3.56+ отрисовка 4–9 мс — это не Мак, скорость на видеокарте меряет bench:gpu
const LIM = { p95: { Chromium: 10, WebKit: 8 }, max: Number(process.env.WALK_MAX || 30), calls: 260, tris: 400000 }, WALK = 6;
let pw; try { pw = await import('playwright'); } catch { console.log('Playwright не найден — прогулка пропущена'); process.exit(0); }
const dev = await createServer({ root, server: { port: 5219, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const url = `http://127.0.0.1:${dev.config.server.port}/3d/index.html?shot&hero=thorn`,     // герой — сразу из адреса: нажатие «1» может прийти раньше, чем откроется выбор
  problems = [], bad = m => problems.push(m);

async function walk(engine, soft) {
  const b = await engine.launch(), pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url + (soft ? '&retro' : ''), { timeout: 30000 }); await pg.waitForTimeout(1500); await pg.keyboard.press('Digit1'); await pg.waitForTimeout(500);     // Chromium без видеокарты — в «Ретро» (меряем процессор); WebKit — гладкий вид, как на Маке
  // маршрут: [имя, откуда, куда, уровень]
  const route = await pg.evaluate(async () => {
    const { biomeAt } = await import('/3d/src/worldgen3d.js'); const b = window.__b3d, C = b.cfg, W = b.W, br = W.map.river.bridges[0];
    const at = (bio, r) => { for (let a = 0; a < 6.28; a += .03) { const x = Math.sin(a) * r, z = Math.cos(a) * r; if (biomeAt(C, x, z) === bio) return { x, z }; } return { x: r, z: 0 }; };
    const P = W.map.plateaus[0], Cs = C.map.castles[0], f1 = C.dungeons.list.find(d => d.castle), coast = at('coast', 540), forest = at('forest', 260);
    const g = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[Cs.gate || 's'];
    return [['лагерь', { x: 0, z: 8 }, { x: 0, z: -25 }], ['мост', { x: br.x - Math.sin(br.ang) * (br.len / 2 + 9), z: br.z - Math.cos(br.ang) * (br.len / 2 + 9) }, { x: br.x + Math.sin(br.ang) * (br.len / 2 + 9), z: br.z + Math.cos(br.ang) * (br.len / 2 + 9) }], ['лес', forest, { x: forest.x * 1.15, z: forest.z * 1.15 }],
      ['горы', { x: P.x + Math.sin(P.ramps[0]) * (P.r + 20), z: P.z + Math.cos(P.ramps[0]) * (P.r + 20) }, { x: P.x, z: P.z }], ['замок', { x: Cs.x + g[0] * 40, z: Cs.z + g[1] * 40 }, { x: Cs.x, z: Cs.z }],
      ['берег', { x: coast.x * .9, z: coast.z * .9 }, { x: coast.x, z: coast.z }], ['этаж замка', { x: f1.entry.x, z: f1.entry.z }, { x: f1.entry.x + 6, z: f1.entry.z }, f1.id], ['лес ASCII', forest, { x: forest.x * 1.15, z: forest.z * 1.15 }, null, true]];
  });
  const rows = [];
  for (let ri = 0, again = false; ri < route.length; ri++) {
    const [name, from, to, lvl, ascii] = route[ri];
    if (ascii && soft) continue;                                                   // ASCII на весь экран без видеокарты меряет процессор, а не Мак
    if (ascii) await pg.evaluate(() => window.__b3d.renderer.setAscii(true));
    await pg.evaluate(([from, lvl]) => { const b = window.__b3d, W = b.W; W.player.inv = 1e9; W.player.hp = W.player.maxhp; W.t = 0; if (lvl && W.lvl !== lvl) b.travel(lvl, from.x, from.z); else if (!lvl && W.lvl !== 'surface') b.travel('surface', from.x, from.z); W.player.x = from.x; W.player.z = from.z; }, [from, lvl]);
    await pg.waitForTimeout(1000); await pg.evaluate(() => window.__b3d.perfReset());
    // бот: держит направление к цели (клавиши со стрелками нельзя — пишем ввод напрямую)
    const t0 = Date.now(); let calls = 0, tris = 0; const s0 = await pg.evaluate(() => ({ x: window.__b3d.W.player.x, z: window.__b3d.W.player.z, n: window.__b3d.perf().n }));
    while (Date.now() - t0 < WALK * 1000) {
      const r = await pg.evaluate(to => { const b = window.__b3d, W = b.W, p = W.player, d = Math.hypot(to.x - p.x, to.z - p.z); p.inv = 1e9; p.hp = p.maxhp; const i = b.input; const a = -b.cfg.view.camYaw * Math.PI / 180, wx = d > 1 ? (to.x - p.x) / d : 0, wz = d > 1 ? (to.z - p.z) / d : 0; i.read = () => ({ mx: wx * Math.cos(a) + wz * Math.sin(a), mz: -wx * Math.sin(a) + wz * Math.cos(a), attack: false, roll: false }); return { ...b.perf(), x: p.x, z: p.z }; }, to);
      calls = Math.max(calls, r.calls); tris = Math.max(tris, r.tris); await pg.waitForTimeout(250);
    }
    const r = await pg.evaluate(() => ({ ...window.__b3d.perf(), x: window.__b3d.W.player.x, z: window.__b3d.W.player.z, simT: window.__b3d.W.t, spd: window.__b3d.cfg.player.speed }));     // W.t — игровое время отрезка (обнулено в начале)
    const row = { name, ...r, n: r.n - s0.n, moved: Math.hypot(r.x - s0.x, r.z - s0.z), want: Math.hypot(to.x - s0.x, to.z - s0.z), calls, tris };
    // время кадра на чужой нагрузке (полный прогон тестов) бывает выше порога: отрезок повторяется один раз, берётся повтор
    if (!again && (row.p95 > LIM.p95[engine === pw.webkit ? 'WebKit' : 'Chromium'] || row.max > LIM.max)) { again = true; ri--; continue; }
    again = false; rows.push(row); await pg.screenshot({ path: join(out, `3d-walk-${name.replace(/ /g, '_')}.png`) });
  }
  await b.close(); return { rows, errs };
}

try {
  const engines = [['Chromium', pw.chromium]]; if (existsSync(pw.webkit.executablePath())) engines.push(['WebKit', pw.webkit]);
  for (const [nm, eng] of engines) {
    const { rows, errs } = await walk(eng, nm === 'Chromium');
    console.log(`${nm}:`); for (const r of rows) console.log('  ' + r.name.padEnd(12), `путь ${r.moved.toFixed(0).padStart(3)} м  кадров ${String(r.n).padStart(4)}  p50 ${r.p50.toFixed(1)}  p95 ${r.p95.toFixed(1)} (сим ${r.sim95.toFixed(1)}, отрисовка ${r.draw95.toFixed(1)})  макс ${r.max.toFixed(0)} мс  вызовов ${r.calls}  △ ${Math.round(r.tris / 1000)} тыс`);
    for (const r of rows) {
      const can = Math.min(r.want, r.spd * r.simT);     // без видеокарты кадры редкие: за 6 с проходит мало игрового времени — ждём путь по нему
      if (r.moved < Math.min(15, can * .6) && r.moved < can - 1.5) bad(`${nm}, ${r.name}: бот почти не шёл (${r.moved.toFixed(1)} м)`);
      const slow = process.env.WALK_STRICT ? bad : m => console.log('  предупреждение: ' + m);     // время кадра на загруженной машине шумит: падение — только по WALK_STRICT=1
      if (r.p95 > LIM.p95[nm] * Number(process.env.WALK_SLACK || 1)) slow(`${nm}, ${r.name}: p95 кадра ${r.p95.toFixed(1)} мс > ${LIM.p95[nm]}`);
      if (r.max > LIM.max) slow(`${nm}, ${r.name}: самый долгий кадр ${r.max.toFixed(0)} мс > ${LIM.max}`);
      if (r.calls > LIM.calls) bad(`${nm}, ${r.name}: вызовов ${r.calls} > ${LIM.calls}`);
      if (r.tris > LIM.tris) bad(`${nm}, ${r.name}: треугольников ${r.tris} > ${LIM.tris}`);
    }
    for (const e of errs) bad(`${nm}: ${e}`);
  }
} finally { await dev.close(); }
if (problems.length) { console.error('\nПРОВАЛ:\n' + problems.join('\n')); process.exit(1); }
console.log('Прогулка 3D: OK');
