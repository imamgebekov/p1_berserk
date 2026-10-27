// Громкость (2026-10-25): ветер и ночной гул слушаются ползунка «Звуки» (раньше шли мимо ползунков);
// тег <audio> через routeMedia управляется громкостью (на iPhone el.volume не действует); записи 3d/sfx грузятся, петля птиц и шаг звучат; музыка по местам меняет трек.
// Слушаем общий выход анализатором.
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
    const rms = async () => { await wait(1500); let s = 0, n = 0; for (let k = 0; k < 10; k++) { an.getFloatTimeDomainData(buf); for (const v of buf) s += v * v; n += buf.length; await wait(100); } return Math.sqrt(s / n); };     // 10 окон за секунду: петля природы не попадёт в паузу
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
    el.pause();
    // записи: все файлы загрузились; петля птиц слышна поверх тишины; шаг по траве звучит
    const Smp = await import('/3d/src/samples3d.js'), { CFG3 } = await import('/3d/src/config3d.js');
    for (let k = 0; k < 120 && Smp.loadedCount() < Smp.sampleNames().length; k++) await wait(250);
    const zero = { water: 0, birds: 0, owl: 0, frog: 0, music: 0, combat: 0, fight: 0, rustle: 0, rain: 0, fire: 0, smith: 0, crickets: 0, under: false, night: false };
    A.setUserMix(0, 1); A.setAmbient(1, 0, null, { s: 0, gust: 0 }); A.setScene(zero, CFG3.audio); const base = await rms();
    A.setScene({ ...zero, birds: 1 }, CFG3.audio); const birds = await rms(); A.setScene(zero, CFG3.audio); await rms();
    A.stepSound('grass'); await wait(60); an.getFloatTimeDomainData(buf); let st = 0; for (const v of buf) st = Math.max(st, Math.abs(v));
    // музыка по местам: дикие земли → трек диких земель; спуск под землю → затихание и трек подземелья; своя музыка → тишина
    const Mu = await import('/3d/src/music3d.js'), cfg = JSON.parse(JSON.stringify(CFG3)), Tc = cfg.audio.tracks;
    const tr = Mu.createTracks(cfg, () => {}); let now = 100;
    const step = async (mix, n, off = false) => { for (let i = 0; i < n; i++) { tr.tick(mix, off, now, 1); now += .2; } await wait(50); };
    await step({ zone: 'wild' }, 150); const wildT = tr.playing();
    await step({ zone: 'dungeon' }, 150); const gapT = tr.playing();     // 30 с после смены места — тишина (пауза ~5 мин, 2026-10-27)
    await step({ zone: 'dungeon' }, 1700); const dunT = tr.playing();
    await step({ zone: 'wild', biome: 'forest' }, 1900); const forT = tr.playing();
    await step({ zone: 'wild', biome: 'coast' }, 1900); const coaT = tr.playing();
    await step({ zone: 'dungeon' }, 5, true); const offT = tr.playing();
    return { loud, quiet, sfx0, routed: !!set, vol1: el.volume, med0, medOn, loaded: Smp.loadedCount(), files: Smp.sampleNames().length, base, birds, step: st,
      wildT, gapT, dunT, offT, forT, coaT, wildOk: Tc.places.wild.includes(wildT), dunOk: Tc.places.dungeon.includes(dunT), forOk: Tc.biomes.forest.includes(forT), coaOk: Tc.biomes.coast.includes(coaT) };
  });
  console.log('  ' + JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(5) : v]))));
  ok(r.loud > .002, 'ночью ветер и гул не слышны вовсе — проверка не работает');
  ok(r.quiet < r.loud * .02, 'при ползунках на нуле ветер и гул звучат');
  ok(r.sfx0 < r.loud * .02, 'при «Звуках» на нуле ветер и гул звучат');
  ok(r.routed && r.vol1 === 1, 'тег <audio> не пошёл через Web Audio');
  ok(r.medOn > .005 && r.med0 < r.medOn * .02, 'громкость тега <audio> через Web Audio не управляется');
  ok(r.files >= 40 && r.loaded === r.files, `записи загрузились не все: ${r.loaded} из ${r.files}`);
  ok(r.birds > r.base * 3 && r.birds > .002, 'петля птиц не слышна');
  ok(r.step > .005, 'шаг по траве не звучит');
  ok(r.wildOk, 'в диких землях не трек диких земель: ' + r.wildT);
  ok(r.dunOk, 'под землёй не сменился на трек подземелья: ' + r.dunT);
  ok(!r.offT, 'при своей музыке трек игры не замолчал');
  ok(r.forOk && r.coaOk, `биомы: в лесу ${r.forT}, на берегу ${r.coaT}`);
  ok(!r.gapT, 'после смены места трек играет без паузы: ' + r.gapT);
} finally { await browser.close(); await dev.close(); }
if (bad.length) { console.error('Громкость в браузере: ПРОВАЛ\n- ' + bad.join('\n- ')); process.exit(1); }
console.log('Громкость в браузере: OK');
