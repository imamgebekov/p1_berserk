// Полный прогон тестов параллельно (4.14): те же команды, что в `npm test`, но по ядрам Мака. Тесты с замером времени и
// браузерные идут после, по одному — под нагрузкой они дают ложные провалы. Самые долгие (по прошлому прогону) — первыми.
// Время каждого теста — test/out/times.json. Запуск: npm run test:par [число потоков]
// --fast (4.18б): без тестов дольше FAST с по прошлому прогону (боты боёв и обходы мира); --with=имя,имя — их всё же взять. Новые тесты — всегда
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { exec } from 'node:child_process';
import { cpus } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), TF = join(root, 'test/out/times.json');
const SERIAL = /maprelief3d|cliffs3d|chunks3d|sleep3d|walk3d|layout3d|browser|headless/;
const cmds = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts.test.split('&&').map(s => s.trim()).filter(Boolean);
const FAST = 45, args = process.argv.slice(2), fast = args.includes('--fast'), withT = (args.find(a => a.startsWith('--with=')) || '').slice(7).split(',').filter(Boolean);
let times = {}; try { times = JSON.parse(readFileSync(TF, 'utf8')); } catch (e) { /* первый прогон */ }
const skip = fast ? cmds.filter(c => times[c] > FAST && !withT.some(w => c.includes(w))) : [], run = cmds.filter(c => !skip.includes(c));
const par = run.filter(c => !SERIAL.test(c)).sort((a, b) => (times[b] || 60) - (times[a] || 60)), ser = run.filter(c => SERIAL.test(c));
const N = +(args.find(a => /^\d+$/.test(a)) || 0) || Math.max(2, cpus().length - 2), bad = [], t0 = Date.now();
const one = c => new Promise(res => { const s = Date.now(); exec(c, { cwd: root, maxBuffer: 1 << 26 }, (e, out, err) => { times[c] = (Date.now() - s) / 1000; const last = (out + err).trim().split('\n').slice(-1)[0] || ''; console.log(`${e ? 'ПРОВАЛ' : 'ок    '} ${times[c].toFixed(0).padStart(4)} с  ${c.replace('node test/', '')}  ${e ? '' : '· ' + last.slice(0, 70)}`); if (e) bad.push(c + '\n' + (out + err).trim().split('\n').slice(-8).join('\n')); res(); }); });
let i = 0; const worker = async () => { while (i < par.length) await one(par[i++]); };
await Promise.all(Array.from({ length: N }, worker));
for (const c of ser) await one(c);
if (!fast) try { mkdirSync(dirname(TF), { recursive: true }); writeFileSync(TF, JSON.stringify(times, null, 1)); } catch (e) { /* без записи */ }     // время пишет только полный прогон: под нагрузкой быстрый набор иначе сам себя сужает
console.log(`\nтестов ${run.length}${skip.length ? ` (быстрый набор: пропущено долгих ${skip.length} — npm run check:full)` : ''} (параллельно ${par.length} в ${N} потоков, по одному ${ser.length}), упало ${bad.length}, время ${((Date.now() - t0) / 60000).toFixed(1)} мин`);
for (const b of bad) console.log('\n--- ' + b);
process.exit(bad.length ? 1 : 0);
