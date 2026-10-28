// Атлас значков оружия Meshy → 3d/models/mw_icons.webp. Запуск: node tools/mw-icons.mjs (после tools/meshy-import.mjs). ONLY=id1,id2 PNG=1 — пробный снимок.
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5197, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
try {
  const page = await browser.newPage(); page.setDefaultTimeout(600000); page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto(`http://127.0.0.1:${dev.config.server.port}/tools/mw-icons.html`);
  const r = await page.evaluate(async only => (await import('/tools/mw-icons-page.js')).run(96, only), process.env.ONLY ? process.env.ONLY.split(',') : null);
  const out = process.env.ONLY ? join(process.env.OUT || '.', 'mw_icons_try.webp') : join(root, '3d/models/mw_icons.webp');
  writeFileSync(out, Buffer.from(r.url.split(',')[1], 'base64')); console.log('атлас:', out, r.cols + '×' + r.cols, 'ячейка', r.cell, 'вещей', r.n);
} finally { await browser.close(); await dev.close(); }
