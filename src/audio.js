// Звук: всё синтезируется (осцилляторы + шум), файлов нет.
import { after } from './clock.js';

let ac = null, muted = false, noiseBuf = null, drone = null, droneLevel = -1, master = null, volume = .8;

export function ensureAudio() {
  if (!ac) {
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain(); master.gain.value = volume; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), gn = ac.createGain();
      o1.type = o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55.8;
      f.type = 'lowpass'; f.frequency.value = 160; gn.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(gn).connect(master); o1.start(); o2.start();
      drone = gn;
    } catch (e) { ac = null; }
  }
  // iOS может перевести контекст в suspended/interrupted — будим на каждом касании
  if (ac && ac.state !== 'running') { try { ac.resume(); } catch (e) { /* без звука */ } }
}

export function isMuted() { return muted; }

// Общая громкость 0..1 (до создания контекста запоминается и применяется при создании)
export function setVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  if (master) master.gain.value = volume;
}
export const getVolume = () => volume;

// Пауза звука вместе с игрой
export function suspendAudio(on) {
  if (!ac) return;
  try { if (on) ac.suspend(); else ac.resume(); } catch (e) { /* без звука */ }
}
export function setMuted(v) { muted = v; if (drone) drone.gain.value = 0; droneLevel = -1; }

// фоновый гул затмения; level 0..1
export function setDrone(level) {
  if (!drone || !ac) return;
  const v = muted ? 0 : level * .05;
  if (Math.abs(v - droneLevel) < .0005) return;
  droneLevel = v; drone.gain.value = v;
}

function tone(f, dur, type = 'square', vol = .05, to = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(gn).connect(master); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, vol, fc, fc2) {
  if (!ac || muted) return;
  const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(fc, t);
  if (fc2) f.frequency.exponentialRampToValueAtTime(fc2, t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f).connect(gn).connect(master); s.start(t); s.stop(t + dur);
}

export const sfx = {
  whoosh: heavy => noise(heavy ? .28 : .16, heavy ? .22 : .14, 1800, 500),
  hit: heavy => { tone(heavy ? 90 : 130, .14, 'square', .09, 40); noise(.08, .12, 900, 300); },
  hurt: () => { tone(200, .22, 'sawtooth', .09, 60); noise(.15, .12, 500, 200); },
  jump: () => tone(300, .1, 'triangle', .04, 520),
  kill: () => { tone(160, .2, 'square', .06, 50); },
  level: () => { [523, 659, 784, 1046].forEach((f, i) => after(i * .09, () => tone(f, .35, 'triangle', .07))); },
  brand: () => { tone(70, .9, 'sawtooth', .12, 35); noise(.6, .14, 300, 100); },
  anvil: ok => {
    tone(ok ? 880 : 300, .25, 'square', .07, ok ? 1760 : 150); noise(.12, .15, 2500, 800);
    if (ok) after(.12, () => tone(1320, .3, 'triangle', .05));
  },
  slam: () => { tone(60, .4, 'square', .14, 25); noise(.3, .2, 400, 80); },
  loot: rarity => {
    if (!rarity || rarity === 'common') { tone(880, .12, 'triangle', .04, 1320); return; }
    const notes = rarity === 'branded' ? [523, 784, 1046, 1568] : rarity === 'cursed' ? [392, 466, 392, 311] : [659, 880, 1175];
    notes.forEach((f, i) => after(i * .07, () => tone(f, .22, rarity === 'cursed' ? 'sawtooth' : 'triangle', .05)));
  }
};
