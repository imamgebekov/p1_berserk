// Рисование карты на 2D-холсте: миникарта (окно вокруг героя) и большая карта (весь мир) с «туманом войны».
import { isSeen } from './sim.js';
import { makeRelief } from './maprelief.js';

// подложка с рельефом и мягкая дымка (шаг 10б): одна подложка на мир; дымка — маленькая картинка из клеток тумана, растянутая со сглаживанием
const RELIEF = new WeakMap(), FOG = new WeakMap();
const reliefOf = (doc, W) => { if (W.map.bounds || !doc) return null; let r = RELIEF.get(W.cfg); if (!r) { r = makeRelief(doc, W.cfg, W.map); RELIEF.set(W.cfg, r); } return r; };
// вызывать каждый кадр: достраивает подложку по нескольку рядов (быстро, без рывка)
export function tickRelief(doc, W) { const r = reliefOf(doc, W); if (r && !r.done) r.step(); return r ? r.done : false; }
function fogOf(doc, W, full) {
  const n = W.seenN, V = W.cfg.mapView; let f = FOG.get(W.seen);
  if (!f) { const cv = doc.createElement('canvas'); cv.width = cv.height = n; f = { cv, ctx: cv.getContext('2d'), t: -1e9, a: -1 }; FOG.set(W.seen, f); }
  const a = full ? V.hazeFull : V.hazeMini, now = performance.now();
  if (now - f.t > (full ? 0 : 400) || f.a !== a) {
    f.t = now; f.a = a; const img = f.ctx.createImageData(n, n), d = img.data, A = Math.round(a * 255);
    for (let i = 0; i < n * n; i++) if (!W.seen[i]) { d[i * 4] = V.haze[0]; d[i * 4 + 1] = V.haze[1]; d[i * 4 + 2] = V.haze[2]; d[i * 4 + 3] = A; }
    f.ctx.putImageData(img, 0, 0);
  }
  return f.cv;
}

const KIND = { house: '#8a6a52', shop: '#d8b04a', smithy: '#e0722c', tavern: '#c88a3a', chapel: '#9a94b8', barracks: '#6a8aa8', warehouse: '#8a7a52', hut: '#6a5a48' };
const NPC = { merchant: '#ffd45a', smith: '#ff8a3a', captain: '#6ab0ff' };

export function drawMap(ctx, W, v) {
  const { w, h, scale: sc, cx, cz, full } = v, R = W.seenR || W.cfg.world.radius, p = W.player, M = W.map, under = !!M.bounds;
  const X = x => w / 2 + (x - cx) * sc, Y = z => h / 2 + (z - cz) * sc;
  ctx.clearRect(0, 0, w, h);
  const V = W.cfg.mapView, doc = ctx.canvas && ctx.canvas.ownerDocument, RL = !under && V ? reliefOf(doc, W) : null;
  ctx.fillStyle = under || !V ? '#0c0807' : V.bg; ctx.fillRect(0, 0, w, h);
  if (under) {
    // подземелье: пол комнат, стены, лестница
    ctx.fillStyle = '#2a221d'; for (const r of M.rooms) ctx.fillRect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
    for (const d of M.doors) if (d.open < .6) { ctx.fillStyle = d.locked ? '#d03a2a' : '#7a5030'; ctx.fillRect(X(d.rect.x0), Y(d.rect.z0), Math.max(2, (d.rect.x1 - d.rect.x0) * sc), Math.max(2, (d.rect.z1 - d.rect.z0) * sc)); }      // запертая — красная
    ctx.fillStyle = '#6a5a4c'; for (const b of M.blocks) ctx.fillRect(X(b.x0), Y(b.z0), Math.max(1, (b.x1 - b.x0) * sc), Math.max(1, (b.z1 - b.z0) * sc));
  } else {
    // мир: подложка с рельефом (пока строится — ровная земля), край мира
    if (RL) { ctx.imageSmoothingEnabled = true; ctx.fillStyle = '#7a8a5a'; ctx.beginPath(); ctx.arc(X(0), Y(0), R * sc, 0, 6.2832); ctx.fill(); ctx.drawImage(RL.canvas, X(-RL.R), Y(-RL.R), 2 * RL.R * sc, 2 * RL.R * sc); }
    else { ctx.fillStyle = '#2a1e17'; ctx.beginPath(); ctx.arc(X(0), Y(0), R * sc, 0, 6.2832); ctx.fill(); }
    ctx.strokeStyle = RL ? 'rgba(70,52,34,.7)' : '#6a2a24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(0), Y(0), R * sc, 0, 6.2832); ctx.stroke();
    // места
    for (const pl of W.cfg.map.places || []) {
      if (RL && !isSeen(W, pl.x, pl.z)) continue;     // под дымкой круги мест не выдают их положение (шаг 10б)
      ctx.beginPath(); ctx.arc(X(pl.x), Y(pl.z), pl.r * sc, 0, 6.2832);
      ctx.fillStyle = pl.safe ? 'rgba(120,190,110,.14)' : `rgba(190,40,30,${.06 + .04 * (pl.danger || 0)})`; ctx.fill();
      ctx.strokeStyle = pl.safe ? 'rgba(60,120,50,.7)' : 'rgba(170,40,30,.7)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
  }
  // дороги
  ctx.strokeStyle = !under && V ? V.road : '#4a3a2c'; ctx.lineWidth = Math.max(1, sc * 1.4); ctx.lineCap = 'round';
  for (const P of M.paths || M.roads.map(pts => ({ pts }))) { ctx.beginPath(); P.pts.forEach((q, i) => (i ? ctx.lineTo(X(q.x), Y(q.z)) : ctx.moveTo(X(q.x), Y(q.z)))); ctx.stroke(); }     // тропы — кривыми
  // река и мосты
  if (!under && M.river) {
    const RV = M.river; ctx.strokeStyle = V ? V.water : '#2a4a5c'; ctx.lineWidth = Math.max(2, RV.w * sc); ctx.lineJoin = 'round'; ctx.beginPath();
    RV.pts.forEach((q, i) => (i ? ctx.lineTo(X(q.x), Y(q.z)) : ctx.moveTo(X(q.x), Y(q.z)))); ctx.stroke();
    ctx.strokeStyle = '#8a6a44'; ctx.lineCap = 'butt';
    for (const br of RV.bridges) { const s2 = Math.sin(br.ang) * br.len / 2, c2 = Math.cos(br.ang) * br.len / 2; ctx.lineWidth = Math.max(2, br.w * sc); ctx.beginPath(); ctx.moveTo(X(br.x - s2), Y(br.z - c2)); ctx.lineTo(X(br.x + s2), Y(br.z + c2)); ctx.stroke(); }
    ctx.lineCap = 'round';
  }
  // замки (C4c): стены квадратом, проём ворот
  if (!under) for (const c of M.cfg.castles || []) { if (!isSeen(W, c.x, c.z)) continue; ctx.strokeStyle = '#b0a898'; ctx.lineWidth = Math.max(2, sc * 1.2); ctx.strokeRect(X(c.x - 13), Y(c.z - 13), 26 * sc, 26 * sc); ctx.fillStyle = '#b0a898'; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(X(c.x + sx * 13) - 3, Y(c.z + sz * 13) - 3, 6, 6); }
  // точки интереса (G2): маленькие значки цвета вида; святилище, использованное недавно, — тусклое
  if (!under) { const PC = { bandits: '#e05a3a', shrine: '#9ad8ff', wagon: '#c8a46c', barrow: '#9a8ab0', hut: '#c89a5a', pond: '#5a9ac8', stones: '#b8b4a8' }, s = Math.max(2, Math.min(4, sc * 1.4));
    for (const q of M.cfg.pois || []) { if (!isSeen(W, q.x, q.z)) continue; const x = X(q.x), y = Y(q.z);
      ctx.fillStyle = q.t === 'shrine' && W.shrines && W.shrines[q.id] > W.t ? '#4a6a7a' : PC[q.t]; ctx.beginPath(); if (q.t === 'pond') ctx.arc(x, y, s * 1.2, 0, Math.PI * 2); else { ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.3); ctx.lineTo(x - s, y); ctx.closePath(); } ctx.fill(); } }
  // костры (C3d): открытые — оранжевые, увиденные, но не открытые — серые
  if (!under) for (const f of M.fires || []) { const known = W.fires && W.fires[f.id]; if (!known && !isSeen(W, f.x, f.z)) continue; const x = X(f.x), y = Y(f.z), s = Math.max(3, Math.min(6, sc * 2));
    ctx.fillStyle = known ? '#ff9a30' : '#7a6a5a'; ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s, y + s * .7); ctx.lineTo(x - s, y + s * .7); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }
  // здания
  for (const b of M.buildings) { ctx.fillStyle = KIND[b.kind] || KIND.house; ctx.fillRect(X(b.x0), Y(b.z0), Math.max(2, b.w * sc), Math.max(2, b.d * sc)); }
  // частокол лагеря: кольцо с проёмами ворот
  if (M.camp) {
    const C = M.camp, gapA = (C.gateW / 2) / C.r; ctx.strokeStyle = '#a07a4a'; ctx.lineWidth = Math.max(1.5, sc * .6);
    const gs = C.gates.map(g => g * Math.PI / 180).sort((a, b) => a - b);
    for (let i = 0; i < gs.length; i++) {
      const a0 = gs[i] + gapA, a1 = (i + 1 < gs.length ? gs[i + 1] : gs[0] + 2 * Math.PI) - gapA; ctx.beginPath();
      for (let k = 0; k <= 24; k++) { const a = a0 + (a1 - a0) * k / 24, x = X(C.x + Math.sin(a) * C.r), y = Y(C.z + Math.cos(a) * C.r); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
  }
  // костёр
  ctx.fillStyle = '#ff7a30'; ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(2, sc * .9), 0, 6.2832); ctx.fill();
  // торговцы и прочие NPC
  for (const b of M.buildings) if (b.npc) { ctx.fillStyle = NPC[b.npc.kind] || '#fff'; ctx.beginPath(); ctx.arc(X(b.npc.x), Y(b.npc.z), Math.max(2.5, sc * 1.1), 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  // люки и лестницы
  for (const q of M.portals || []) { if (!under && !isSeen(W, q.x, q.z)) continue; const r = Math.max(2.5, sc * .8); ctx.fillStyle = q.up ? '#e8d0a0' : '#8a5a30'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.fillRect(X(q.x) - r, Y(q.z) - r, r * 2, r * 2); ctx.strokeRect(X(q.x) - r, Y(q.z) - r, r * 2, r * 2); }
  // непустые контейнеры в открытых клетках
  ctx.fillStyle = '#ffc860';
  for (const c of M.containers) if (c.ready && isSeen(W, c.x, c.z)) ctx.fillRect(X(c.x) - 1.5, Y(c.z) - 1.5, 3, 3);
  // логова боссов (видны в открытых клетках; серые — убитые и ещё не вернувшиеся)
  // логова боссов — поверх дымки, ниже (блок «боссы и мини-боссы»)
  // могила с потерянным пеплом
  if (W.tomb && (W.tomb.lvl || 'surface') === (W.lvl || 'surface')) { ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd45a'; ctx.lineWidth = 1.5; const tx = X(W.tomb.x), ty = Y(W.tomb.z); ctx.fillRect(tx - 1.5, ty - 5, 3, 10); ctx.fillRect(tx - 4, ty - 2, 8, 3); ctx.strokeRect(tx - 1.5, ty - 5, 3, 10); }
  // туман войны: на земле — светлая дымка с мягким краем (сквозь неё виден рельеф); в подземелье — тёмный
  const cell = W.seenC || W.cfg.map.cell, n = W.seenN;
  if (!under && V && doc) { ctx.imageSmoothingEnabled = true; ctx.drawImage(fogOf(doc, W, full), X(-R), Y(-R), n * cell * sc, n * cell * sc); }
  else {
    ctx.fillStyle = full ? 'rgba(6,4,3,.94)' : 'rgba(6,4,3,.9)';
    const i0 = Math.max(0, Math.floor((cx - w / 2 / sc + R) / cell)), i1 = Math.min(n - 1, Math.floor((cx + w / 2 / sc + R) / cell));
    const j0 = Math.max(0, Math.floor((cz - h / 2 / sc + R) / cell)), j1 = Math.min(n - 1, Math.floor((cz + h / 2 / sc + R) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!W.seen[j * n + i]) ctx.fillRect(X(i * cell - R) - .5, Y(j * cell - R) - .5, cell * sc + 1, cell * sc + 1);
  }
  // подписи мест (только найденных)
  if (full) {
    const SERIF = '"Iowan Old Style", Palatino, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // области (шаг 10б): крупно, разрядкой, видны и под дымкой
    if (!under && RL) { ctx.font = `600 ${Math.round(Math.max(14, Math.min(26, 60 * sc)))}px ${SERIF}`; ctx.fillStyle = 'rgba(52,38,24,.55)'; ctx.strokeStyle = 'rgba(240,230,205,.5)'; ctx.lineWidth = 3;
      for (const L of RL.labels) { const t = L.name.toUpperCase().split('').join('\u2009'); ctx.strokeText(t, X(L.x), Y(L.z)); ctx.fillText(t, X(L.x), Y(L.z)); } }
    // места: тёмные подписи со светлой обводкой; наползающие пропускаем
    ctx.font = `600 12px ${SERIF}`; ctx.lineWidth = 3.5; ctx.strokeStyle = under ? '#000' : 'rgba(244,236,214,.92)';
    const put = []; if (!under) for (const pl of W.cfg.map.places || []) if (isSeen(W, pl.x, pl.z)) { const y = Y(pl.z) - pl.r * sc * .35; if (put.some(q => Math.abs(q[0] - X(pl.x)) < 90 && Math.abs(q[1] - y) < 14)) continue; put.push([X(pl.x), y]); ctx.strokeText(pl.name, X(pl.x), y); ctx.fillStyle = pl.safe ? '#2e5a26' : '#8a2418'; ctx.fillText(pl.name, X(pl.x), y); }
    ctx.textBaseline = 'alphabetic';
  }
  // враги рядом (на большой карте не показываем: туман — это неизвестность)
  if (!full) { ctx.fillStyle = '#ff3a30'; for (const e of W.enemies) if (!e.dead) { const x = X(e.x), y = Y(e.z); if (x > 0 && x < w && y > 0 && y < h) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.2832); ctx.fill(); } } }
  // боссы и мини-боссы (2026-10-18): логова и замки видны всегда, даже под дымкой; на большой карте — с именем; серые — убитые и ещё не вернувшиеся, тусклые — веха пройдена
  // мини-боссы (элита и стражи замков) — оранжевые ромбы: на миникарте рядом, на большой карте — в открытых местах
  { const mark = (x, y, r, col, crown) => { ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (crown) { ctx.fillStyle = '#1a0a06'; ctx.fillRect(-r * .45, -r * .05, r * .9, r * .35); for (const k of [-1, 0, 1]) ctx.fillRect(k * r * .33 - r * .1, -r * .4, r * .2, r * .4); } ctx.restore(); };
    const named = (x, y, txt) => { if (!full) return; ctx.font = '600 11px "Iowan Old Style", Palatino, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(244,236,214,.92)'; ctx.fillStyle = '#5a1a10'; ctx.strokeText(txt, x, y); ctx.fillText(txt, x, y); ctx.textBaseline = 'alphabetic'; };
    const inMap = (x, y) => x > -8 && x < w + 8 && y > -8 && y < h + 8, BR = full ? 7 : 5;
    if (!under) {
      for (const d of W.cfg.bosses.list) { if (d.level) continue; const x = X(d.x), y = Y(d.z); if (!inMap(x, y)) continue; const dead = W.bossDead[d.type] !== undefined, slain = W.path && W.path.slain[d.type]; mark(x, y, BR, slain ? '#8a7a5a' : dead ? '#6a6a6a' : '#ff3a2a', true); named(x, y + BR + 8, W.cfg.enemies[d.type].name); }     // боссы замков — внутри, на поверхности их место — замок
      for (const c of M.cfg.castles || []) { if (!Number.isFinite(c.x)) continue; const x = X(c.x), y = Y(c.z), t = c.boss && c.boss.type; if (!inMap(x, y)) continue; mark(x, y, BR + 1, t && W.bossDead[t] !== undefined ? '#6a6a6a' : '#c03adf', true); named(x, y + BR + 9, c.name); }
    }
    for (const e of W.enemies) if (!e.dead && !e.boss && (e.elite || e.guard) && (under || !full || isSeen(W, e.x, e.z))) { const x = X(e.x), y = Y(e.z); if (x > 0 && x < w && y > 0 && y < h) mark(x, y, full ? 4.5 : 3.5, '#ff9a2a', false); } }
  // свои бойцы
  ctx.fillStyle = '#6ab0ff'; for (const a of W.allies || []) if (!a.dead && !a.guest) { ctx.beginPath(); ctx.arc(X(a.x), Y(a.z), 2.6, 0, 6.2832); ctx.fill(); }
  // повозка сказочного торговца: видна и сквозь туман; на миникарте прижимается к краю, показывая направление
  if (!under && W.wanderer) { const m = 6, x = Math.min(w - m, Math.max(m, X(W.wanderer.x))), y = Math.min(h - m, Math.max(m, Y(W.wanderer.z))); ctx.fillStyle = '#c8a0ff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 2, 2); }
  // событие: золотой «!» над подопечным или местом засады; на миникарте прижимается к краю
  if (!under && W.event) { const ev = W.event, g = ev.guest && W.allies.find(a => a.id === ev.guest), ex = g ? g.x : ev.x, ez = g ? g.z : ev.z, m = 7, x = Math.min(w - m, Math.max(m, X(ex))), y = Math.min(h - m, Math.max(m, Y(ez)));
    ctx.fillStyle = '#ffc040'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1a1008'; ctx.fillRect(x - 1, y - 3.5, 2, 4.5); ctx.fillRect(x - 1, y + 2, 2, 1.6); }
  // цель (шаг 12): золотое кольцо с точкой; на миникарте за краем — прижимается к краю, показывая направление
  if (W.goal && Number.isFinite(W.goal.x)) { const m = 7, gx = X(W.goal.x), gy = Y(W.goal.z), x = Math.min(w - m, Math.max(m, gx)), y = Math.min(h - m, Math.max(m, gy)), t = performance.now() / 1000, r = 5 + (full ? 0 : Math.sin(t * 4) * .8);
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, 6.2832); ctx.stroke(); ctx.strokeStyle = '#ffd45a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke(); ctx.fillStyle = '#ffd45a'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.2832); ctx.fill(); }
  // герой: стрелка по направлению
  ctx.save(); ctx.translate(X(p.x), Y(p.z)); ctx.rotate(Math.atan2(Math.sin(p.face), -Math.cos(p.face)) + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
