// Треки оркестра (2026-10-21, выбор владельца; авторы — в 3d/ART-CREDITS.md и в меню): вступление — один раз при начале игры.
// Музыка по местам (2026-10-27, вариант А владельца): у места свой трек — лагерь и сёла, дикие земли, подземелье, босс (по кругу);
// один трек за раз, без наложения; между проигрываниями пауза; смена места — затихание и новый трек; в бою и ночью тише.
// Своя музыка игрока или выключенный звук — треки молчат. Громкость плавно идёт к цели. Только браузер (выбор места — и в Node).
import { routeMedia } from './audio3d.js';
let URLS = {}; try { URLS = import.meta.glob('../music/*.mp3', { query: '?url', import: 'default', eager: true }); } catch (e) { /* Node-тесты: без музыки */ }
const url = n => URLS[`../music/${n}.mp3`] || null;

// место для музыки: босс в бою — 'boss', иначе зона героя из mixOf: 'camp' | 'wild' | 'dungeon'
export const trackPlace = (mix, T) => (mix.boss && T.boss ? 'boss' : mix.zone || (mix.under ? 'dungeon' : 'wild'));
export const trackPool = (place, T) => (place === 'boss' ? [T.boss] : (T.places && T.places[place]) || T.roam || []);
// следующий трек места: не тот, что звучал только что (если есть выбор)
export function nextTrack(place, T, last, rnd = Math.random) { const pool = trackPool(place, T), fresh = pool.filter(n => n !== last), p = fresh.length ? fresh : pool; return p.length ? p[(rnd() * p.length) | 0] : null; }

export function createTracks(cfg, setQuiet) {
  const T = cfg.audio.tracks; if (!T || !T.on || typeof Audio === 'undefined') return { tick() {}, intro() {}, stop() {} };
  let el = null, cur = null, vol = 0, target = 0, last = '', nextAt = -1, introDone = false, gain = null, ended = false;
  const level = v => { if (!el) return; if (!gain) gain = routeMedia(el); if (gain) gain(v); else el.volume = v; };     // громкость через Web Audio (iPhone), иначе el.volume
  const play = (name, kind, place) => { const u = url(name); if (!u) return; if (!el) { el = new Audio(); el.addEventListener('ended', () => { cur = null; target = 0; ended = true; }); el.addEventListener('error', () => { cur = null; }); }
    el.src = u; vol = 0; level(0); el.loop = kind === 'boss'; cur = { name, kind, place }; last = name; el.play().catch(() => { cur = null; }); };
  const stop = () => { cur = null; target = 0; if (el) el.pause(); };
  const pause = () => T.gap[0] + Math.random() * (T.gap[1] - T.gap[0]);
  // зовётся раз в 0,2 с: mix — из soundscape3d.mixOf; off — своя музыка игрока или звук выключен; now — секунды
  function tick(mix, off, now, musicVol) {
    if (off) { if (cur || (el && !el.paused)) stop(); setQuiet(false); return; }
    if (nextAt < 0) nextAt = now + T.first;     // первый трек места — не сразу после входа
    if (ended) { ended = false; nextAt = now + pause(); }     // трек доиграл — пауза
    const want = trackPlace(mix, T), away = cur && cur.kind !== 'intro' && cur.place !== want;     // вступление доигрывает до конца
    if (away) { target = 0; if (vol < .02) { stop(); nextAt = now + (want === 'boss' ? 0 : T.switch); } }
    else if (!cur && (now >= nextAt || want === 'boss')) { const n = nextTrack(want, T, last); if (n) play(n, want === 'boss' ? 'boss' : 'place', want); }
    if (cur && !away) target = musicVol * T.vol * (cur.kind === 'boss' || cur.kind === 'intro' ? 1 : (mix.fight ? T.duck : 1) * (mix.night ? T.night : 1)) * (mix.dead ? .3 : 1);
    vol += (target - vol) * (T.fade > 0 ? Math.min(1, .2 / T.fade) : 1); level(Math.max(0, Math.min(1, vol)));
    if (!cur && el && !el.paused && vol < .02) el.pause();
    setQuiet(!!cur);
  }
  // вступление: один раз за запуск, по первому жесту игрока (браузер не играет звук без него)
  function intro(k = 1) { if (introDone || !T.intro) return; introDone = true; play(T.intro, 'intro'); target = vol = .9 * k; level(vol); }     // k — ползунки игрока
  return { tick, intro, stop, playing: () => cur && cur.name };
}
