// Треки оркестра (2026-10-21, выбор владельца; авторы — в 3d/ART-CREDITS.md и в меню): вступление — один раз при начале игры;
// спокойные — в паузах между пьесами своей музыки игры (вперемешку, не подряд один и тот же); на босса — свой трек.
// Пока трек звучит, музыка игры молчит (audio3d.setOwnMusicOn). Громкость плавно идёт к цели, в бою тише. Только браузер.
let URLS = {}; try { URLS = import.meta.glob('../music/*.mp3', { query: '?url', import: 'default', eager: true }); } catch (e) { /* Node-тесты: без музыки */ }
const url = n => URLS[`../music/${n}.mp3`] || null;

export function createTracks(cfg, setQuiet) {
  const T = cfg.audio.tracks; if (!T || !T.on || typeof Audio === 'undefined') return { tick() {}, intro() {}, stop() {} };
  let el = null, cur = null, vol = 0, target = 0, last = '', nextAt = -1, introDone = false;
  const play = (name, kind) => { const u = url(name); if (!u) return; if (!el) { el = new Audio(); el.addEventListener('ended', () => { cur = null; target = 0; }); el.addEventListener('error', () => { cur = null; }); }
    el.src = u; el.volume = vol = 0; el.loop = kind === 'boss'; cur = { name, kind }; last = name; el.play().catch(() => { cur = null; }); };
  const stop = () => { cur = null; target = 0; if (el) el.pause(); };
  // зовётся раз в 0,2 с: mix — из soundscape3d.mixOf; off — своя музыка игрока или звук выключен; now — секунды
  function tick(mix, off, now, musicVol) {
    if (off) { if (cur || (el && !el.paused)) stop(); setQuiet(false); return; }
    if (nextAt < 0) nextAt = now + T.first;     // первый спокойный трек — не сразу после входа
    if (mix.boss && T.boss && (!cur || cur.kind !== 'boss')) play(T.boss, 'boss');
    else if (cur && cur.kind === 'boss' && !mix.boss) { target = 0; if (vol < .02) { stop(); nextAt = now + T.gap[0]; } }
    else if (!cur && mix.music > .5 && !mix.fight && now >= nextAt && Math.random() < T.chance) {     // пауза в музыке игры: иногда — спокойный трек
      const pool = T.roam.filter(n => n !== last); play(pool[(Math.random() * pool.length) | 0] || T.roam[0], 'roam');
      nextAt = now + T.gap[0] + Math.random() * (T.gap[1] - T.gap[0]);
    } else if (!cur && now >= nextAt) nextAt = now + T.gap[0] / 2;
    if (cur && !(cur.kind === 'boss' && !mix.boss)) target = musicVol * T.vol * (cur.kind === 'boss' ? 1 : mix.fight ? T.duck : Math.max(.2, mix.music));
    vol += (target - vol) * (T.fade > 0 ? Math.min(1, .2 / T.fade) : 1); if (el) el.volume = Math.max(0, Math.min(1, vol));
    if (!cur && el && !el.paused && vol < .02) el.pause();
    setQuiet(!!cur);
  }
  // вступление: один раз за запуск, по первому жесту игрока (браузер не играет звук без него)
  function intro() { if (introDone || !T.intro) return; introDone = true; play(T.intro, 'intro'); target = .9; vol = .9; if (el) el.volume = .9; }
  return { tick, intro, stop, playing: () => cur && cur.name };
}
