// Управление: плавающий джойстик слева (появляется там, где коснулись), кнопки справа; на компьютере — клавиатура и мышь.
export function createInput(doc, win) {
  const $ = id => doc.getElementById(id);
  const zone = $('zone'), stick = $('stick'), knob = $('knob'), bAtk = $('bAtk'), bRoll = $('bRoll');
  const S = { mx: 0, mz: 0, attackBtn: false, mouseAtk: false, rollQ: false, atkQ: false };       // atkQ — нажатие удара, ждёт чтения
  const keys = new Set();
  const R = 56;                       // радиус хода джойстика, px
  let pid = null, ox = 0, oy = 0;

  function move(e) {
    const dx = e.clientX - ox, dy = e.clientY - oy, l = Math.hypot(dx, dy) || 1, m = Math.min(1, l / R);
    S.mx = dx / l * m; S.mz = dy / l * m;                                // экран вверх = вперёд по миру (−z)
    const k = Math.min(l, R) / l;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
  function endStick() { pid = null; S.mx = S.mz = 0; stick.classList.remove('on'); stick.style.left = stick.style.top = ''; knob.style.transform = ''; }

  zone.addEventListener('pointerdown', e => {
    if (pid !== null) return;
    e.preventDefault(); pid = e.pointerId; try { zone.setPointerCapture(pid); } catch (_) { /* не критично */ }
    ox = e.clientX; oy = e.clientY; stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; stick.classList.add('on'); move(e);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === pid) move(e); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(t, e => { if (e.pointerId === pid || pid === null) endStick(); });

  const hold = (btn, on, off) => {
    btn.addEventListener('pointerdown', e => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ок */ } btn.classList.add('on'); on(); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(t, () => { btn.classList.remove('on'); off(); });
  };
  hold(bAtk, () => { S.attackBtn = true; S.atkQ = true; }, () => { S.attackBtn = false; });
  hold(bRoll, () => { S.rollQ = true; }, () => {});

  // физические клавиши (e.code): WASD работает и на русской раскладке
  const KM = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', Space: 'atk', KeyJ: 'atk', KeyK: 'roll', ShiftLeft: 'roll', ShiftRight: 'roll', KeyL: 'roll' };
  const code = e => KM[e.code] || (e.key === ' ' ? 'atk' : null);
  win.addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey) return; const k = code(e); if (!k) return; if (k === 'roll') { if (!keys.has('roll')) S.rollQ = true; } if (k === 'atk' && !keys.has('atk')) S.atkQ = true; keys.add(k); if (k === 'atk' || e.code.startsWith('Arrow')) e.preventDefault(); });
  win.addEventListener('keyup', e => { const k = code(e); if (k) keys.delete(k); });
  // мышь (компьютер): левая кнопка по полю — удар (держать — серия), правая — перекат
  const gl = $('gl');
  gl.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; e.preventDefault(); if (e.button === 0) { S.mouseAtk = true; S.atkQ = true; } else if (e.button === 2) S.rollQ = true; });
  win.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) S.mouseAtk = false; });
  gl.addEventListener('contextmenu', e => e.preventDefault());
  const release = () => { keys.clear(); S.attackBtn = false; S.mouseAtk = false; S.rollQ = false; S.atkQ = false; endStick(); bAtk.classList.remove('on'); bRoll.classList.remove('on'); };
  win.addEventListener('blur', release);

  return {
    release,
    // вход для симуляции
    read() {
      let mx = S.mx, mz = S.mz;
      if (!mx && !mz) { mx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0); mz = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0); }
      const roll = S.rollQ, attackPress = S.atkQ; S.rollQ = false; S.atkQ = false;
      return { mx, mz, attack: S.attackBtn || S.mouseAtk || keys.has('atk'), attackPress, roll };
    },
    state: S
  };
}
