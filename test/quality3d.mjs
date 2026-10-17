// Тест пресетов качества 3D (шаг 14 аудита): тени только на «Высоком» и только на компьютере; «Низкое» — меньше разрешение,
// реже трава, без столбов света; «Авто» = «Среднее» + подстройка разрешения: тяжёлые кадры — ниже (не ниже lo), лёгкие — выше
// (не выше hi), в коридоре — без изменений, первые warm с и рывки не считаются; настройка «quality» чистится.
import { CFG3 } from '../3d/src/config3d.js';
import { QUALITY_IDS, qualityOf, makeAutoRes } from '../3d/src/quality3d.js';
import { sanitizePrefs } from '../3d/src/prefs3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const A = CFG3.view.quality.auto;
ok(QUALITY_IDS.join() === 'auto,low,mid,high', 'пресеты: ' + QUALITY_IDS.join());
{ const hi = qualityOf(CFG3, 'high', true), hp = qualityOf(CFG3, 'high', false), lo = qualityOf(CFG3, 'low', true), au = qualityOf(CFG3, 'auto', true), mid = qualityOf(CFG3, 'mid', true);
  ok(hi.shadows && !hp.shadows && !mid.shadows && !au.shadows && !lo.shadows, 'тени не только на «Высоком» компьютера');
  ok(lo.scale < 1 && lo.grass < 1 && !lo.shafts && mid.scale === 1 && mid.grass === 1 && mid.shafts, '«Низкое» или «Среднее» не такие');
  ok(au.auto && !mid.auto && au.scale === mid.scale, '«Авто» не от «Среднего»'); }
// «Авто»: кадры по 30 мс — вниз до lo; по 8 мс — вверх до hi; по 15 мс — без изменений
const run = (ms, sec, s0) => { const r = makeAutoRes(A); let s = s0; for (let t = 0; t < sec; t += ms / 1000) s = r.frame(ms / 1000, s); return s; };
ok(run(30, A.warm - .5, 1) === 1, '«Авто» сработало во время разогрева');
ok(run(30, A.warm + A.every * 10, 1) === A.lo, 'тяжёлые кадры не опустили разрешение до ' + A.lo + ': ' + run(30, A.warm + A.every * 10, 1));
ok(run(8, A.warm + A.every * 10, .6) === A.hi, 'лёгкие кадры не подняли разрешение до ' + A.hi);
ok(run(15, A.warm + A.every * 10, .8) === .8, 'кадры в коридоре сдвинули разрешение');
{ const r = makeAutoRes(A); let s = 1; for (let t = 0; t < A.warm + A.every * 6; t += .016) s = r.frame(Math.random() < .03 ? .5 : .016, s); ok(s === 1, 'редкие рывки опустили разрешение: ' + s); }
{ const r = makeAutoRes(A); let s = 1, steps = 0; for (let t = 0; t < A.warm + A.every * 3; t += .03) { const n = r.frame(.03, s); if (n !== s) steps++; s = n; } ok(steps <= 3, 'разрешение прыгает чаще раза в окно: ' + steps); }
// настройка
ok(sanitizePrefs({ quality: 'ultra' }).quality === 'auto' && sanitizePrefs({ quality: 'high' }).quality === 'high' && sanitizePrefs(null).quality === 'auto', 'настройка качества не чистится');

if (fails.length) { console.log('quality3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Качество 3D: OK');
