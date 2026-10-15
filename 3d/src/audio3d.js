// Звук 3D: всё синтезируется (осцилляторы и шум), файлов нет. Контекст создаётся по первому касанию (правило iOS).
let ac = null, master = null, noiseBuf = null, amb = null, volume = .7, muted = false, lastT = {};

export function ensureAudio() {
  if (!ac) {
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return;
      ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : volume; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // фон: ветер (шум через фильтр с медленным качанием) и низкий гул затмения
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = .6; g.gain.value = 0;
      lfo.frequency.value = .11; lg.gain.value = 140; lfo.connect(lg).connect(f.frequency); src.connect(f).connect(g).connect(master); src.start(); lfo.start();
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lf = ac.createBiquadFilter(), dg = ac.createGain();
      o1.type = o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 55.7; lf.type = 'lowpass'; lf.frequency.value = 150; dg.gain.value = 0;
      o1.connect(lf); o2.connect(lf); lf.connect(dg).connect(master); o1.start(); o2.start();
      amb = { wind: g, drone: dg };
    } catch (e) { ac = null; }
  }
  if (ac && ac.state !== 'running') { try { ac.resume(); } catch (e) { /* без звука */ } }
}
export const setVolume = v => { volume = Math.min(1, Math.max(0, Number(v) || 0)); if (master) master.gain.value = muted ? 0 : volume; };
export const setMuted = m => { muted = !!m; if (master) master.gain.value = muted ? 0 : volume; };
export const isMuted = () => muted;
export function suspendAudio(on) { if (!ac) return; try { if (on) ac.suspend(); else ac.resume(); } catch (e) { /* без звука */ } }

// фон по времени суток: ночью ветер сильнее и гул громче; light 0..1
export function setAmbient(light, danger = 0) {
  if (!amb || !ac) return;
  const t = ac.currentTime;
  amb.wind.gain.setTargetAtTime(.018 + (1 - light) * .03, t, .8);
  amb.drone.gain.setTargetAtTime(.012 + (1 - light) * .02 + danger * .01, t, .8);
}

function tone(f, dur, type = 'square', vol = .05, to = 0, delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, vol, fc, fc2, type = 'lowpass', delay = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(fc, t); if (fc2) f.frequency.exponentialRampToValueAtTime(fc2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + .02);
}

// набор звуков по событиям мира. Частые звуки не чаще раза в `gap` секунд, чтобы не превращаться в кашу.
const SFX = {
  swing: { gap: .06, f: () => noise(.14, .09, 1800, 500, 'bandpass') },
  roll: { gap: .2, f: () => noise(.2, .07, 700, 250) },
  hit: { gap: .04, f: () => { noise(.1, .12, 1500, 300); tone(150, .09, 'square', .05, 70); } },
  strike: { gap: .04, f: () => { noise(.12, .14, 1200, 250); tone(120, .12, 'sawtooth', .06, 55); } },
  finisher: { gap: .1, f: () => { tone(90, .3, 'sawtooth', .09, 40); noise(.25, .15, 900, 150); } },
  hurt: { gap: .1, f: () => { tone(200, .22, 'sawtooth', .08, 70); noise(.12, .1, 600, 200); } },
  die: { gap: .05, f: () => tone(260, .22, 'square', .04, 60) },
  dodge: { gap: .1, f: () => tone(700, .08, 'triangle', .03, 1000) },
  pickup: { gap: .05, f: () => { tone(740, .06, 'square', .035); tone(988, .08, 'square', .035, 0, .06); } },
  ash: { gap: .05, f: () => tone(1200, .05, 'triangle', .03) },
  open: { gap: .1, f: () => { noise(.18, .08, 500, 1400, 'bandpass'); tone(180, .12, 'square', .03, 120); } },
  unlock: { gap: .1, f: () => { tone(900, .05, 'square', .04); tone(1300, .08, 'square', .04, 0, .07); } },
  locked: { gap: .2, f: () => tone(110, .15, 'square', .06, 90) },
  full: { gap: .3, f: () => tone(130, .18, 'square', .05, 100) },
  heal: { gap: .3, f: () => { tone(520, .12, 'triangle', .05, 780); tone(780, .14, 'triangle', .04, 1040, .1); } },
  buff: { gap: .3, f: () => tone(330, .25, 'triangle', .05, 660) },
  level: { gap: .5, f: () => { for (let i = 0; i < 4; i++) tone([392, 494, 587, 784][i], .22, 'square', .05, 0, i * .1); } },
  questaccept: { gap: .3, f: () => { tone(330, .1, 'triangle', .05); tone(440, .14, 'triangle', .05, 0, .1); } },
  questready: { gap: .3, f: () => { tone(523, .1, 'triangle', .05); tone(784, .18, 'triangle', .05, 0, .1); } },
  questdone: { gap: .5, f: () => { for (let i = 0; i < 3; i++) tone([523, 659, 880][i], .2, 'square', .05, 0, i * .09); } },
  craft: { gap: .3, f: () => { tone(220, .06, 'square', .06); tone(330, .06, 'square', .06, 0, .08); noise(.1, .1, 2500, 800, 'bandpass', .14); } },
  upgrade: { gap: .3, f: () => { tone(180, .08, 'square', .07); noise(.16, .12, 3000, 900, 'bandpass', .06); tone(660, .2, 'triangle', .05, 990, .12); } },
  tome: { gap: .3, f: () => { noise(.25, .05, 1200, 2400, 'bandpass'); tone(440, .3, 'triangle', .04, 660, .1); } },
  hire: { gap: .3, f: () => { tone(196, .15, 'square', .05); tone(294, .2, 'square', .05, 0, .13); } },
  tomb: { gap: .3, f: () => { tone(440, .1, 'triangle', .05); tone(660, .3, 'triangle', .05, 0, .09); } },
  react: { gap: .1, f: () => { noise(.2, .12, 2200, 400); tone(300, .2, 'sawtooth', .05, 100); } },
  boom: { gap: .15, f: () => { noise(.5, .22, 700, 80); tone(70, .4, 'sawtooth', .12, 35); } },
  bossaggro: { gap: 1, f: () => { tone(60, 1, 'sawtooth', .14, 38); tone(64, 1, 'sawtooth', .1, 40); noise(.8, .08, 300, 90); } },
  bossphase: { gap: 1, f: () => { tone(80, .7, 'sawtooth', .13, 45); noise(.5, .12, 600, 100); } },
  bossblast: { gap: .3, f: () => { noise(.55, .24, 600, 70); tone(55, .5, 'sawtooth', .14, 30); } },
  bossdead: { gap: 1, f: () => { for (let i = 0; i < 5; i++) tone(330 - i * 40, .5, 'sawtooth', .07, 90, i * .12); noise(.9, .1, 500, 80); } },
  dusk: { gap: 2, f: () => { tone(110, 1.4, 'sine', .08, 82); tone(165, 1.4, 'sine', .05, 123, .05); } },
  dawn: { gap: 2, f: () => { tone(330, 1.2, 'sine', .06, 494); tone(494, 1.2, 'sine', .04, 659, .1); } },
  shot: { gap: .1, f: () => { noise(.16, .08, 900, 2600, 'bandpass'); tone(520, .1, 'triangle', .03, 880); } },
  elite: { gap: 1.5, f: () => { tone(90, .5, 'sawtooth', .09, 50); tone(135, .5, 'square', .03, 75); } },
  travel: { gap: .5, f: () => { for (let i = 0; i < 3; i++) noise(.08, .07, 400, 150, 'lowpass', i * .13); tone(70, .45, 'sine', .07, 50, .05); } },
  rare: { gap: .3, f: () => { tone(880, .12, 'triangle', .05, 1320); tone(1320, .2, 'sine', .035, 1760, .08); } },
  brand: { gap: .5, f: () => { for (let i = 0; i < 4; i++) tone(660 * (1 + i * .25), .3, 'triangle', .045, 990 * (1 + i * .25), i * .07); noise(.4, .03, 3000, 6000, 'highpass', .1); } },
  wanderer: { gap: 1, f: () => { for (let i = 0; i < 6; i++) tone([1568, 1760, 2093, 1760, 2349, 2093][i], .35, 'sine', .03, 0, i * .11); } },   // бубенцы повозки
  evStart: { gap: 1, f: () => { tone(392, .25, 'triangle', .05); tone(523, .4, 'triangle', .05, 0, .2); } },      // рожок
  ambush: { gap: .8, f: () => { for (let i = 0; i < 3; i++) noise(.12, .06, 200, 80, 'lowpass', i * .14); tone(110, .5, 'sawtooth', .04, 70, .1); } },
  evDone: { gap: 1, f: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .3, 'triangle', .045, 0, i * .1)); } },
  recall: { gap: .5, f: () => { tone(330, .5, 'sine', .05, 990); noise(.5, .03, 400, 4000, 'bandpass'); } },
  spot: { gap: .4, f: () => { tone(160, .22, 'sawtooth', .05, 260); noise(.15, .04, 900, 300); } },
  block: { gap: .08, f: () => { tone(1400, .08, 'square', .05, 900); noise(.08, .08, 3000, 1500, 'bandpass'); } },
  fuse: { gap: .3, f: () => { noise(1.1, .05, 2500, 4000, 'highpass'); tone(300, 1.1, 'square', .02, 900); } },
  blink: { gap: .3, f: () => { tone(900, .25, 'sine', .05, 200); noise(.2, .04, 1200, 400); } },
  lunge: { gap: .2, f: () => noise(.3, .1, 600, 2400) },
  charge: { gap: .3, f: () => { tone(110, .55, 'sawtooth', .035, 220); noise(.5, .03, 300, 900, 'bandpass'); } },
  chargeFull: { gap: .3, f: () => { tone(660, .12, 'triangle', .06, 990); tone(990, .2, 'sine', .04, 1320, .06); } },
  heavy: { gap: .15, f: () => { noise(.25, .14, 2200, 300); tone(70, .35, 'sine', .12, 40, .08); noise(.3, .1, 400, 120, 'lowpass', .08); } },
  step: { gap: .1, f: () => noise(.05, .035, 500 + Math.random() * 300, 200) }
};
export function sfx(name) {
  const d = SFX[name]; if (!d || !ac || muted) return;
  const now = ac.currentTime; if (now - (lastT[name] || -9) < d.gap) return; lastT[name] = now; d.f();
}
export const SFX_NAMES = Object.keys(SFX);
