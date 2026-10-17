// Тест сведения звука 3D (шаг 8 аудита): громкость → мягкий ограничитель → выход; тон начинается с нуля (без щелчка) и идёт
// через фильтр; квадратная волна — только у элиты; у каждого звука разброс высоты и громкости; звук мира тише вдали и
// с панорамой по экрану; гул — только ночью и в опасном месте. Поддельный AudioContext записывает узлы и вызовы.
import { CFG3 } from '../3d/src/config3d.js';

const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const X = CFG3.audio.fx;
let clock = 0; const oscs = [], gains = [], shapers = [];
class Param { constructor(v = 0) { this.value = v; this.calls = []; } setValueAtTime(v, t) { this.calls.push(['set', v, t]); } linearRampToValueAtTime(v, t) { this.calls.push(['lin', v, t]); } exponentialRampToValueAtTime(v, t) { this.calls.push(['exp', v, t]); } setTargetAtTime(v, t) { this.calls.push(['target', v, t]); } }
class Node { constructor(kind) { this.kind = kind; this.out = []; } connect(n) { this.out.push(n); return n || this; } }
class Osc extends Node { constructor() { super('osc'); this.frequency = new Param(440); this.detune = new Param(); oscs.push(this); } start() {} stop() {} }
class Src extends Node { constructor() { super('src'); this.playbackRate = new Param(1); } start() {} stop() {} }
class FakeAC { constructor() { this.state = 'running'; this.sampleRate = 8000; this.destination = new Node('dest'); } get currentTime() { return clock; }
  createGain() { const n = new Node('gain'); n.gain = new Param(1); gains.push(n); return n; } createOscillator() { return new Osc(); } createBufferSource() { return new Src(); }
  createBiquadFilter() { const n = new Node('filter'); n.frequency = new Param(); n.Q = new Param(); return n; } createDelay() { const n = new Node('delay'); n.delayTime = new Param(); return n; }
  createWaveShaper() { const n = new Node('shaper'); shapers.push(n); return n; } createStereoPanner() { const n = new Node('pan'); n.pan = new Param(); return n; }
  createBuffer(c, len) { const d = new Float32Array(len); return { getChannelData: () => d }; } resume() {} suspend() {} }
globalThis.AudioContext = FakeAC;
const au = await import('../3d/src/audio3d.js');
au.ensureAudio(); const ac = au.__ctx();

// ---------- цепочка и ограничитель ----------
{ const w = shapers[0]; ok(w && w.out.includes(ac.destination), 'ограничитель не стоит перед выходом');
  const c = w ? w.curve : au.limitCurve(X.limit), n = c.length, at = x => c[Math.round((x + 1) / 2 * (n - 1))];
  ok(Math.abs(at(.3) - .3) < .002 && Math.abs(at(X.limit * .95) - X.limit * .95) < .002, 'ограничитель меняет тихий звук');
  ok(c.every(v => Math.abs(v) <= 1) && at(1) > X.limit && at(1) < 1, 'ограничитель не держит пик ниже 1');
  let mono = true; for (let i = 1; i < n; i++) if (c[i] < c[i - 1]) mono = false; ok(mono, 'кривая ограничителя не монотонная'); }

// ---------- тон: с нуля, через фильтр; квадратная волна только у элиты ----------
const play = (name, at = null) => { clock += 5; const o0 = oscs.length, g0 = gains.length; au.sfx(name, at); return { o: oscs.slice(o0), g: gains.slice(g0) }; };
{ const r = play('pickup'), env = r.g.filter(g => g.gain.calls.length && g.gain.calls[0][0] === 'set');
  ok(env.length >= 2 && env.every(g => g.gain.calls[0][1] === 0 && g.gain.calls[1][0] === 'lin'), 'тон начинается не с нуля — будет щелчок');
  ok(r.o.every(o => o.out[0] && o.out[0].kind === 'filter'), 'тон идёт мимо фильтра'); }
for (const n of au.SFX_NAMES) { const r = play(n); if (n !== 'elite') ok(!r.o.some(o => o.type === 'square'), 'квадратная волна у ' + n); }

// ---------- разброс ----------
{ const f = [], v = []; for (let i = 0; i < 30; i++) { const r = play('hit'); f.push(r.o[0].frequency.calls[0][1]); v.push(r.g[0].gain.value); }
  ok(new Set(f.map(x => x.toFixed(2))).size > 10 && f.every(x => Math.abs(x / 150 - 1) <= X.vary.pitch + 1e-9), 'удары одной высоты или разброс шире ±' + X.vary.pitch);
  ok(new Set(v.map(x => x.toFixed(3))).size > 10 && v.every(x => Math.abs(x - 1) <= X.vary.vol + 1e-9), 'удары одной громкости или разброс шире ±' + X.vary.vol); }

// ---------- пространство ----------
{ const S = X.space, at = (x, z) => ({ x, z, px: 0, pz: 0, yaw: 0 });
  ok(au.spatial(null, S).g === 1 && au.spatial(null, S).pan === 0, 'звук героя не по центру');
  ok(au.spatial(at(S.far + 1, 0), S) === null, 'звук дальше far слышен');
  ok(au.spatial(at(2, 0), S).g > au.spatial(at(10, 0), S).g && au.spatial(at(10, 0), S).g > au.spatial(at(30, 0), S).g, 'вдали не тише');
  ok(au.spatial(at(6, 0), S).pan > 0 && au.spatial(at(-6, 0), S).pan < 0 && Math.abs(au.spatial(at(0, 6), S).pan) < 1e-9, 'панорама не по экрану');
  ok(Math.abs(au.spatial(at(S.far - 1, 0), S).pan) <= S.pan + 1e-9, 'панорама шире предела');
  { const y = { x: 0, z: -6, px: 0, pz: 0, yaw: 90 }; ok(au.spatial(y, S).pan > 0, 'поворот камеры не учтён в панораме'); }
  const r = play('hit', at(30, 0)); ok(r.g[0].gain.value < .4, 'звук мира в 30 м звучит громко: ' + r.g[0].gain.value.toFixed(2)); }

// ---------- гул только ночью и в опасном месте ----------
{ const last = () => gains.filter(g => g.gain.calls.some(c => c[0] === 'target')).map(g => g.gain.calls.filter(c => c[0] === 'target').pop()[1]);
  au.setAmbient(1, 0); const day = last(); au.setAmbient(0, 0); const night = last(); au.setAmbient(1, 1); const danger = last();
  ok(day.length === 2 && Math.min(...day) === 0, 'днём без опасности звучит гул: ' + JSON.stringify(day));
  ok(Math.min(...night) > 0 && Math.min(...danger) > 0, 'ночью или в опасном месте гула нет'); }

if (fails.length) { console.log('mix3d FAIL\n' + [...new Set(fails)].join('\n')); process.exit(1); }
console.log('Сведение звука 3D: OK');
