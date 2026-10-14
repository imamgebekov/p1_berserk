// Строгие заглушки холста и звука: падают на NaN/Infinity в координатах и на запрещённые вызовы WebAudio.
export const stats = { fillRect: 0, fillText: 0, drawImage: 0 };

const bad = (name, args) => { throw new Error(`${name}: нечисловой аргумент ${JSON.stringify(args)}`); };
const finite = (name, args) => { for (const a of args) if (typeof a !== 'number' || !Number.isFinite(a)) bad(name, args); };

export function fakeCtx() {
  const state = {};
  const grad = () => ({ addColorStop(o, c) { if (!(o >= 0 && o <= 1) || typeof c !== 'string') bad('addColorStop', [o, c]); } });
  const methods = {
    fillRect: (...a) => { finite('fillRect', a); stats.fillRect++; },
    drawImage: (img, ...a) => { finite('drawImage', a); stats.drawImage++; },
    setTransform: (...a) => finite('setTransform', a),
    measureText: t => { if (typeof t !== 'string') bad('measureText', [t]); return { width: t.length * 6 }; },
    fillText: (t, x, y) => { finite('fillText', [x, y]); stats.fillText++; },
    createRadialGradient: (...a) => { finite('createRadialGradient', a); return grad(); }
  };
  return new Proxy(state, {
    get: (t, k) => k in methods ? methods[k] : t[k],
    set: (t, k, v) => {
      if (k === 'globalAlpha' && !(v >= 0 && v <= 1)) bad('globalAlpha', [v]);
      t[k] = v; return true;
    }
  });
}

export function fakeCanvas() {
  const c = { width: 0, height: 0, _ctx: null, getContext() { return this._ctx ||= fakeCtx(); } };
  return c;
}

// --- WebAudio ---
export const audioStats = { tones: 0, noises: 0 };
function param(name) {
  return {
    value: 0,
    setValueAtTime(v) { if (!Number.isFinite(v)) bad(name, [v]); },
    exponentialRampToValueAtTime(v, t) { if (!(v > 0) || !Number.isFinite(t)) throw new RangeError(`${name}: exponentialRamp к ${v}`); }
  };
}
function node(extra = {}) { return Object.assign({ connect(n) { return n; }, start() {}, stop() {} }, extra); }
export class FakeAudioContext {
  constructor() { this.state = 'suspended'; this.sampleRate = 44100; this.currentTime = 0; this.destination = node(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
  createBufferSource() { audioStats.noises++; return node({ buffer: null }); }
  createOscillator() { audioStats.tones++; return node({ type: 'sine', frequency: param('frequency') }); }
  createGain() { return node({ gain: param('gain') }); }
  createBiquadFilter() { return node({ type: 'lowpass', frequency: param('filter.frequency') }); }
}
