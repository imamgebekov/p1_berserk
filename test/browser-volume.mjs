// Громкость (2026-10-25): ветер и ночной гул слушаются ползунка «Звуки» (раньше шли мимо ползунков);
// тег <audio> через routeMedia управляется громкостью (на iPhone el.volume не действует). Слушаем общий выход анализатором.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), bad = [], ok = (c, m) => { if (!c) bad.push(m); };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const dev = await createServer({ root, server: { port: 5191, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
try {
  const page = await browser.newPage(); page.setDefaultTimeout(90000);
  await page.goto(`http://127.0.0.1:${dev.config.server.port}/3d/ART-CREDITS.md`, { waitUntil: 'domcontentloaded' });     // лёгкая страница того же сервера: модули грузим сами
  const r = await page.evaluate(async () => {
    const A = await import('/3d/src/audio3d.js');
    A.ensureAudio(); const ac = A.__ctx(); await ac.resume();
    const an = ac.createAnalyser(); an.fftSize = 2048; A.__master().connect(an); const buf = new Float32Array(an.fftSize);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const rms = async () => { await wait(1500); an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); };
    A.setVolume(.7);
    A.setUserMix(1, 1); A.setAmbient(0, 1); const loud = await rms();     // ночь, опасно: ветер и гул звучат
    A.setUserMix(0, 0); const quiet = await rms();                        // оба ползунка на нуле
    A.setUserMix(1, 1); A.setAmbient(1, 0); A.setUserMix(1, 0); A.setAmbient(0, 1); const sfx0 = await rms();     // «Звуки» на нуле, «Музыка» — нет
    // тег <audio>: синус 440 Гц в WAV, громкость через routeMedia
    const n = 44100, d = new DataView(new ArrayBuffer(44 + n * 2)), str = (o, t) => { for (let i = 0; i < t.length; i++) d.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, 44100, true); d.setUint32(28, 88200, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); str(36, 'data'); d.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) d.setInt16(44 + i * 2, Math.sin(i / 44100 * 2 * Math.PI * 440) * 12000, true);
    A.setUserMix(0, 0); A.setAmbient(1, 0);
    const el = new Audio(URL.createObjectURL(new Blob([d.buffer], { type: 'audio/wav' }))); el.loop = true; const set = A.routeMedia(el); await el.play();
    set(0); const med0 = await rms(); set(.5); const medOn = await rms();
    el.pause(); return { loud, quiet, sfx0, routed: !!set, vol1: el.volume, med0, medOn };
  });
  console.log('  ' + JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v]))));
  ok(r.loud > .002, 'ночью ветер и гул не слышны вовсе — проверка не работает');
  ok(r.quiet < r.loud * .02, 'при ползунках на нуле ветер и гул звучат');
  ok(r.sfx0 < r.loud * .02, 'при «Звуках» на нуле ветер и гул звучат');
  ok(r.routed && r.vol1 === 1, 'тег <audio> не пошёл через Web Audio');
  ok(r.medOn > .005 && r.med0 < r.medOn * .02, 'громкость тега <audio> через Web Audio не управляется');
} finally { await browser.close(); await dev.close(); }
if (bad.length) { console.error('Громкость в браузере: ПРОВАЛ\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('Громкость в браузере: OK');
