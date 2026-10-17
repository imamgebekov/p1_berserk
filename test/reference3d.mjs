// Эталонная сцена (шаг 1 плана аудита): три закреплённых кадра лагеря — день, ночь, бой — в Safari (WebKit), Мак 1440×900 Retina.
// Запуск: npm run ref [метка], по умолчанию метка «now». Кадры — test/out/ref/<кадр>-<метка>.png; страница сравнения всех меток —
// test/out/ref/index.html. Цифры на странице: тонов в кадре (уровни яркости, занимающие ≥1,5% кадра) и контраст героя к фону вокруг.
// Цель «мягко и просто»: тонов ≤5–6, герой — самое контрастное пятно, края без лесенки (смотреть глазами).
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'test', 'out', 'ref'), tag = process.argv[2] || 'now';
mkdirSync(out, { recursive: true });
let pw; try { pw = await import('playwright'); } catch { console.log('Playwright не найден — эталон не снят'); process.exit(0); }
const eng = pw.webkit; try { pw.webkit.executablePath(); } catch { console.log('нет WebKit'); process.exit(0); }
const dev = await createServer({ root, server: { port: 5231, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const SHOTS = [['day', 'день'], ['night', 'ночь'], ['fight', 'бой']], metrics = {};
try {
  const b = await eng.launch(), pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(`http://127.0.0.1:${dev.config.server.port}/3d/index.html?shot&hero=thorn`); await pg.waitForTimeout(1800);
  await pg.evaluate(() => { const b = window.__b3d, c = b.cfg; c.weather.force = 'clear'; c.enemies.count = 0; c.enemies.roam.on = false; c.enemies.garrison = null; c.events.on = false; c.wanderer.on = false; Object.assign(c.wind, { calm: 0, breeze: 0, gust: 0 }); c.sunlight.wind = [0, 0]; });
  for (const [id] of SHOTS) {
    await pg.evaluate(async id => {
      const { isNight } = await import('/3d/src/daynight.js'); const b = window.__b3d, W = b.W, p = W.player;
      W.enemies.length = 0; W.t = 30; if (id === 'night') { while (!isNight(W.t, W.cfg.daynight)) W.t += 5; W.t += 40; }
      p.x = 3; p.z = 9; p.face = Math.PI * .85; p.inv = 0; p.hp = p.maxhp; W.inside = -1;
      if (id === 'fight') { for (const [dx, dz, t] of [[1.2, -1.8, 'brute'], [-1.6, -1.4, 'imp'], [2.6, .4, 'hound']]) { const e = b.spawn(t, p.x + dx, p.z + dz); e.hp = e.maxhp = 1e6; e.cd = 99; e.mode = 'guard'; e.home = { x: e.x, z: e.z }; } }
    }, id);
    await pg.waitForTimeout(1600);
    if (id === 'fight') { await pg.evaluate(() => { const i = window.__b3d.input, r = i.read; i.read = () => ({ ...r.call(i), attackPress: true }); setTimeout(() => { i.read = r; }, 40); }); await pg.waitForTimeout(150); }
    await pg.screenshot({ path: join(out, `${id}-${tag}.png`) });
    metrics[id] = await pg.evaluate(() => {
      const c = document.getElementById('gl'), g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d'); x.drawImage(c, 0, 0);
      const d = x.getImageData(0, 0, g.width, g.height).data, L = i => .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2], bins = new Array(16).fill(0); let n = 0;
      for (let i = 0; i < d.length; i += 16) { bins[Math.min(15, (L(i) / 16) | 0)]++; n++; }
      const tones = bins.filter(v => v / n >= .015).length;
      const b = window.__b3d, p = b.W.player, s = b.renderer.project(p.x, 1, p.z), kx = g.width / innerWidth, ky = g.height / innerHeight, cx = s.x * kx, cy = s.y * ky, r = 26 * kx;
      let hin = 0, hn = 0, hout = 0, ho = 0;
      for (let yy = Math.max(0, cy - 3 * r); yy < Math.min(g.height, cy + 3 * r); yy += 2) for (let xx = Math.max(0, cx - 3 * r); xx < Math.min(g.width, cx + 3 * r); xx += 2) {
        const dd = Math.hypot(xx - cx, yy - cy), l = L(((yy | 0) * g.width + (xx | 0)) * 4); if (dd < r) { hin += l; hn++; } else if (dd < 3 * r) { hout += l; ho++; } }
      return { tones, hero: Math.abs(hin / Math.max(1, hn) - hout / Math.max(1, ho)) / 255 };
    });
  }
  console.log(JSON.stringify({ tag, metrics, errs }));
  writeFileSync(join(out, `metrics-${tag}.json`), JSON.stringify(metrics));
  await b.close();
} finally { await dev.close(); }
// страница сравнения: все метки рядом по каждому кадру
const tags = [...new Set(readdirSync(out).filter(f => /^metrics-.+\.json$/.test(f)).map(f => f.slice(8, -5)))].sort();
const M = Object.fromEntries(tags.map(t => [t, JSON.parse(readFileSync(join(out, `metrics-${t}.json`), 'utf8'))]));
const cell = (id, t) => `<figure><img src="${id}-${t}.png" alt="${id} ${t}"><figcaption><b>${t}</b> · тонов ${M[t][id] ? M[t][id].tones : '?'} · контраст героя ${M[t][id] ? M[t][id].hero.toFixed(2) : '?'}</figcaption></figure>`;
writeFileSync(join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Эталон «Берсерк 3D»</title><style>body{font:14px system-ui;background:#1a1d1b;color:#e4e8e2;margin:16px}section{margin-bottom:28px}div{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:12px}img{width:100%;border-radius:6px}figure{margin:0}</style>
<h1>Эталонная сцена</h1><p>Цель: края без лесенки, тонов ≤5–6, герой — самое контрастное пятно.</p>${SHOTS.map(([id, nm]) => `<section><h2>${nm}</h2><div>${tags.map(t => cell(id, t)).join('')}</div></section>`).join('')}`);
console.log('страница: ' + join(out, 'index.html'));
