// Управление: плавающий джойстик слева (появляется там, где коснулись), кнопки справа, клавиатура для компьютера.
export function createInput(doc, win) {
  const $ = id => doc.getElementById(id);
  const zone = $('zone'), stick = $('stick'), knob = $('knob'), bAtk = $('bAtk'), bRoll = $('bRoll');
  const S = { mx: 0, mz: 0, attackBtn: false, rollQ: false };
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
  hold(bAtk, () => { S.attackBtn = true; }, () => { S.attackBtn = false; });
  hold(bRoll, () => { S.rollQ = true; }, () => {});

  const KM = { w: 'u', ArrowUp: 'u', s: 'd', ArrowDown: 'd', a: 'l', ArrowLeft: 'l', d: 'r', ArrowRight: 'r', ' ': 'atk', j: 'atk', k: 'roll', Shift: 'roll', l: 'roll' };
  win.addEventListener('keydown', e => { const k = KM[e.key] || KM[e.key.toLowerCase()]; if (!k) return; if (k === 'roll') { if (!keys.has('roll')) S.rollQ = true; } keys.add(k); if (e.key === ' ') e.preventDefault(); });
  win.addEventListener('keyup', e => { const k = KM[e.key] || KM[e.key.toLowerCase()]; if (k) keys.delete(k); });
  const release = () => { keys.clear(); S.attackBtn = false; S.rollQ = false; endStick(); bAtk.classList.remove('on'); bRoll.classList.remove('on'); };
  win.addEventListener('blur', release);

  return {
    release,
    // вход для симуляции
    read() {
      let mx = S.mx, mz = S.mz;
      if (!mx && !mz) { mx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0); mz = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0); }
      const roll = S.rollQ; S.rollQ = false;
      return { mx, mz, attack: S.attackBtn || keys.has('atk'), roll };
    },
    state: S
  };
}
