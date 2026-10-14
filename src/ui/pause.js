// Пауза и настройки. Автопауза при сворачивании страницы, экран «поверните телефон».
import { W } from '../state.js';
import { S, applySettings, saveSettings } from '../settings.js';
import { addHold, removeHold, hasHold } from '../hold.js';
import { ensureAudio, sfx, suspendAudio } from '../audio.js';

export function createPauseUI(doc, win) {
  const $ = id => doc.getElementById(id);
  const root = $('pause'), rotate = $('rotate');
  let mode = null;     // 'pause' (игра на паузе) | 'settings' (с экрана входа, без паузы)

  const onoff = v => v ? 'вкл' : 'выкл';
  function render() {
    $('setVol').value = String(Math.round(S.volume * 100));
    $('volVal').textContent = Math.round(S.volume * 100) + '%';
    const set = (id, label, val, on) => { const b = $(id); b.textContent = ''; b.append(label + ' '); const x = doc.createElement('b'); x.textContent = val; b.appendChild(x); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); };
    set('setMute', 'Звук:', onoff(!S.muted), !S.muted);
    set('setLefty', 'Режим левши:', onoff(S.lefty), S.lefty);
    set('setReduce', 'Меньше движения:', S.reduce === 'on' ? 'вкл' : 'авто', S.reduce === 'on');
  }

  function open(m = 'pause') {
    if (!root.hidden) return;
    mode = m;
    $('pauseTitle').textContent = m === 'pause' ? 'Пауза' : 'Настройки';
    $('resume').textContent = m === 'pause' ? 'Продолжить' : 'Назад';
    if (m === 'pause') { addHold('pause'); suspendAudio(true); }
    root.hidden = false; render();
  }
  function close() {
    if (root.hidden) return;
    root.hidden = true;
    if (mode === 'pause') { removeHold('pause'); if (!hasHold('rotate')) suspendAudio(false); }
    mode = null;
  }

  $('pauseBtn').addEventListener('click', () => { if (W.started && !W.paused) open('pause'); });
  $('startSettings').addEventListener('click', () => open('settings'));
  $('resume').addEventListener('click', close);
  const blip = () => { ensureAudio(); sfx.loot(); };
  $('setVol').addEventListener('input', e => { S.volume = Number(e.target.value) / 100; applySettings(doc); $('volVal').textContent = e.target.value + '%'; });
  $('setVol').addEventListener('change', () => { saveSettings(); blip(); });
  $('setMute').addEventListener('click', () => { S.muted = !S.muted; applySettings(doc); saveSettings(); render(); if (!S.muted) blip(); });
  $('setLefty').addEventListener('click', () => { S.lefty = !S.lefty; applySettings(doc); saveSettings(); render(); });
  $('setReduce').addEventListener('click', () => { S.reduce = S.reduce === 'on' ? 'auto' : 'on'; applySettings(doc); saveSettings(); render(); });

  // автопауза: страница ушла в фон (iOS убирает вкладку, звонок, переключение приложений)
  const auto = () => { if (W.started && !W.paused && root.hidden) open('pause'); };
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) auto(); });
  win.addEventListener('pagehide', auto);
  win.addEventListener('keydown', e => { if ((e.key === 'p' || e.key === 'P') && W.started && !W.paused) { root.hidden ? open('pause') : close(); } });

  // телефон в горизонтальном положении: игра рассчитана на вертикаль
  function checkOrientation() {
    const land = win.innerWidth > win.innerHeight && win.innerHeight < 560;
    if (land && !hasHold('rotate')) { addHold('rotate'); rotate.hidden = false; suspendAudio(true); }
    else if (!land && hasHold('rotate')) { removeHold('rotate'); rotate.hidden = true; if (!hasHold('pause')) suspendAudio(false); }
  }
  win.addEventListener('resize', checkOrientation);
  win.addEventListener('orientationchange', () => setTimeout(checkOrientation, 250));
  checkOrientation();

  return { open, close, render, checkOrientation, isOpen: () => !root.hidden };
}
