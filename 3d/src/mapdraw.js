// Рисование карты на 2D-холсте: миникарта (окно вокруг героя) и большая карта (весь мир) с «туманом войны».
import { isSeen } from './sim.js';
import { makeRelief } from './maprelief.js';
import { GI } from './data/gicons.js';
// значок game-icons в круге (2026-10-20, просьба владельца: значки на карте): фон, тёмная кайма, белая фигура
const P2D = new Map(), pathOf = k => { let p = P2D.get(k); if (!p && GI[k] && typeof Path2D !== 'undefined') { p = new Path2D(GI[k]); P2D.set(k, p); } return p; };
function badge(ctx, key, x, y, r, bg) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * .16); ctx.strokeStyle = '#1a0e08'; ctx.stroke(); const p = pathOf(key); if (!p) return; const s = r * 1.3 / 512; ctx.save(); ctx.translate(x - r * .65, y - r * .65); ctx.scale(s, s); ctx.fillStyle = '#fff8e8'; ctx.fill(p); ctx.restore(); }

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
const NPC = { keeper: '#e8405a', merchant: '#ffd45a', smith: '#ff8a3a', captain: '#6ab0ff', scribe: '#b48aff' };

export function drawMap(ctx, W, v) {
  const { w, h, scale: sc, cx, cz, full } = v, U = v.ui || 1, zs = sc / (v.dpr || 1), R = W.seenR || W.cfg.world.radius, OX = W.seenX || 0, OZ = W.seenZ || 0, p = W.player, M = W.map, under = !!M.bounds;     // OX/OZ — центр круга мира и сетки тумана (Мир 5.0)
  const X = x => w / 2 + (x - cx) * sc, Y = z => h / 2 + (z - cz) * sc;
  ctx.clearRect(0, 0, w, h);
  const V = W.cfg.mapView, doc = ctx.canvas && ctx.canvas.ownerDocument, RL = !under && V ? reliefOf(doc, W) : null;
  ctx.fillStyle = under || !V ? '#0c0807' : V.bg; ctx.fillRect(0, 0, w, h);
  if (under) {
    // подземелье: пол комнат, стены, лестница
    ctx.fillStyle = '#2a221d'; for (const r of M.rooms) ctx.fillRect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
    for (const d of M.doors) if (d.open < .6) { ctx.fillStyle = d.locked ? '#d03a2a' : '#7a5030'; ctx.fillRect(X(d.rect.x0), Y(d.rect.z0), Math.max(2, (d.rect.x1 - d.rect.x0) * sc), Math.max(2, (d.rect.z1 - d.rect.z0) * sc)); }      // запертая — красная
    ctx.fillStyle = '#6a5a4c'; for (const b of M.blocks) if (!b.pit) ctx.fillRect(X(b.x0), Y(b.z0), Math.max(1, (b.x1 - b.x0) * sc), Math.max(1, (b.z1 - b.z0) * sc));
    ctx.fillStyle = '#050303'; for (const q of M.pits || []) ctx.fillRect(X(q.x0), Y(q.z0), (q.x1 - q.x0) * sc, (q.z1 - q.z0) * sc);     // провалы
    ctx.fillStyle = '#6a5a4c'; for (const c of M.pillars || []) ctx.fillRect(X(c.x - c.r), Y(c.z - c.r), Math.max(2, c.r * 2 * sc), Math.max(2, c.r * 2 * sc));
  } else {
    // мир: подложка с рельефом (пока строится — ровная земля), край мира
    if (RL) { ctx.imageSmoothingEnabled = true; ctx.fillStyle = '#7a8a5a'; ctx.beginPath(); ctx.arc(X(OX), Y(OZ), R * sc, 0, 6.2832); ctx.fill(); ctx.drawImage(RL.canvas, X(RL.X0), Y(RL.Z0), RL.W * sc, RL.H * sc); }     // 4.05: подложка шире круга мира
    else { ctx.fillStyle = '#2a1e17'; ctx.beginPath(); ctx.arc(X(OX), Y(OZ), R * sc, 0, 6.2832); ctx.fill(); }
    ctx.strokeStyle = RL ? 'rgba(70,52,34,.7)' : '#6a2a24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(OX), Y(OZ), R * sc, 0, 6.2832); ctx.stroke();
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
  // вражеские лагеря (частокол — бурый) и павшие города (каменные стены, башни) — квадратом с проёмами ворот (2026-10-18)
  if (!under) for (const [list, col, w0] of [[M.cfg.forts || [], '#7a4a2a', 1], [M.cfg.cities || [], '#b0a898', 1.4]]) for (const c of list) { if (!isSeen(W, c.x, c.z)) continue;
    const H = c.H, G = c.gate / 2, gates = c.gates || ['s', 'n', 'e', 'w']; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, sc * w0 * 1.2); ctx.lineCap = 'butt';
    for (const [side, sx, sz] of [['s', 0, 1], ['n', 0, -1], ['e', 1, 0], ['w', -1, 0]]) { const segs = gates.includes(side) ? [[-H, -G], [G, H]] : [[-H, H]];
      for (const [a, b] of segs) { ctx.beginPath(); if (sx) { ctx.moveTo(X(c.x + sx * H), Y(c.z + a)); ctx.lineTo(X(c.x + sx * H), Y(c.z + b)); } else { ctx.moveTo(X(c.x + a), Y(c.z + sz * H)); ctx.lineTo(X(c.x + b), Y(c.z + sz * H)); } ctx.stroke(); } }
    ctx.fillStyle = col; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(X(c.x + sx * H) - 3, Y(c.z + sz * H) - 3, 6, 6); ctx.lineCap = 'round'; }
  // ориентиры (C3b): башня — серый треугольник, мельница — бурый крест, руины крепости — серый квадрат
  if (!under) for (const l of M.cfg.landmarks || []) { if (!isSeen(W, l.x, l.z)) continue; const x = X(l.x), y = Y(l.z), s = Math.max(3, Math.min(5, sc * 1.6)); ctx.lineWidth = 1.5; ctx.strokeStyle = '#2a2018';
    if (l.t === 'tower') { ctx.fillStyle = '#9a968c'; ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.lineTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else if (l.t === 'mill') { ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); }
    else { ctx.fillStyle = '#7e7a70'; ctx.fillRect(x - s, y - s, s * 2, s * 2); ctx.strokeRect(x - s, y - s, s * 2, s * 2); } }
  // точки интереса (G2): маленькие значки цвета вида; святилище, использованное недавно, — тусклое
  if (!under) { const PC = { bandits: '#e05a3a', shrine: '#9ad8ff', wagon: '#c8a46c', barrow: '#9a8ab0', hut: '#c89a5a', pond: '#5a9ac8', stones: '#b8b4a8' }, s = Math.max(2, Math.min(4, sc * 1.4));
    for (const q of M.cfg.pois || []) { if (!isSeen(W, q.x, q.z) || (full && zs < 1.2)) continue; const x = X(q.x), y = Y(q.z);
      ctx.fillStyle = q.t === 'shrine' && W.shrines && W.shrines[q.id] > W.t ? '#4a6a7a' : PC[q.t]; ctx.beginPath(); if (q.t === 'pond') ctx.arc(x, y, s * 1.2, 0, Math.PI * 2); else { ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.3); ctx.lineTo(x - s, y); ctx.closePath(); } ctx.fill(); } }
  // костры (C3d): открытые — оранжевые, увиденные, но не открытые — серые
  if (!under) for (const f of M.fires || []) { const known = W.fires && W.fires[f.id]; if (!known && !isSeen(W, f.x, f.z)) continue; const x = X(f.x), y = Y(f.z), s = Math.max(3, Math.min(6, sc * 2));
    if (full && zs >= .8) { badge(ctx, 'map:fire', x, y, 8 * U, known ? '#d8701c' : '#6a5a4a'); continue; }
    if (full) { ctx.beginPath(); ctx.arc(x, y, 3 * U, 0, 6.2832); ctx.fillStyle = known ? '#e8801c' : '#7a6a5a'; ctx.fill(); continue; }
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
  const NPC_IC = { keeper: ['ui:sparkle', '#a8203a'], merchant: ['map:shop', '#b8901c'], smith: ['map:smith', '#c05a1c'], captain: ['map:fight', '#2a6ab8'], scribe: ['ui:book', '#6a4ab8'] };
  for (const b of M.buildings) if (b.npc) { if (full && NPC_IC[b.npc.kind]) { if (zs >= 1.2) badge(ctx, NPC_IC[b.npc.kind][0], X(b.npc.x), Y(b.npc.z), 7 * U, NPC_IC[b.npc.kind][1]); continue; } ctx.fillStyle = NPC[b.npc.kind] || '#fff'; ctx.beginPath(); ctx.arc(X(b.npc.x), Y(b.npc.z), Math.max(2.5, sc * 1.1), 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }
  }
  // люки и лестницы
  for (const q of M.portals || []) { if (!under && (q.stair || !isSeen(W, q.x, q.z))) continue; const r = Math.max(2.5, sc * .8); ctx.fillStyle = q.up ? '#e8d0a0' : '#8a5a30'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.fillRect(X(q.x) - r, Y(q.z) - r, r * 2, r * 2); ctx.strokeRect(X(q.x) - r, Y(q.z) - r, r * 2, r * 2); }     // лестницы в домах — не входы в подземелья
  // непустые контейнеры в открытых клетках
  ctx.fillStyle = '#ffc860';
  for (const c of M.containers) if (c.ready && isSeen(W, c.x, c.z) && !(full && zs < 2 && !under)) ctx.fillRect(X(c.x) - 1.5, Y(c.z) - 1.5, 3, 3);
  // логова боссов (видны в открытых клетках; серые — убитые и ещё не вернувшиеся)
  // логова боссов — поверх дымки, ниже (блок «боссы и мини-боссы»)
  // могила с потерянным пеплом
  if (W.tomb && (W.tomb.lvl || 'surface') === (W.lvl || 'surface')) { ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd45a'; ctx.lineWidth = 1.5; const tx = X(W.tomb.x), ty = Y(W.tomb.z); ctx.fillRect(tx - 1.5, ty - 5, 3, 10); ctx.fillRect(tx - 4, ty - 2, 8, 3); ctx.strokeRect(tx - 1.5, ty - 5, 3, 10); }
  // туман войны: на земле — светлая дымка с мягким краем (сквозь неё виден рельеф); в подземелье — тёмный
  const cell = W.seenC || W.cfg.map.cell, n = W.seenN;
  if (!under && V && doc) { ctx.imageSmoothingEnabled = true; ctx.drawImage(fogOf(doc, W, full), X(OX - R), Y(OZ - R), n * cell * sc, n * cell * sc);
    if (full) { const q = n * cell * sc, hz = V.haze; ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.rect(X(OX - R), Y(OZ - R), q, q); ctx.fillStyle = `rgba(${hz[0]},${hz[1]},${hz[2]},${V.hazeFull})`; ctx.fill('evenodd'); }     // 4.08: за краем мира — та же дымка, без шва
  }
  else {
    ctx.fillStyle = full ? 'rgba(6,4,3,.94)' : 'rgba(6,4,3,.9)';
    const i0 = Math.max(0, Math.floor((cx - OX - w / 2 / sc + R) / cell)), i1 = Math.min(n - 1, Math.floor((cx - OX + w / 2 / sc + R) / cell));
    const j0 = Math.max(0, Math.floor((cz - OZ - h / 2 / sc + R) / cell)), j1 = Math.min(n - 1, Math.floor((cz - OZ + h / 2 / sc + R) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!W.seen[j * n + i]) ctx.fillRect(X(OX + i * cell - R) - .5, Y(OZ + j * cell - R) - .5, cell * sc + 1, cell * sc + 1);
  }
  // подписи мест (только найденных)
  if (full) {
    const SERIF = '"Iowan Old Style", Palatino, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // области (шаг 10б): крупно, разрядкой, видны и под дымкой
    if (!under && RL) { ctx.font = `600 ${Math.round(Math.max(14, Math.min(26, 60 * sc)) * U)}px ${SERIF}`; ctx.fillStyle = 'rgba(52,38,24,.55)'; ctx.strokeStyle = 'rgba(240,230,205,.5)'; ctx.lineWidth = 3;
      const boxes = [], shown = RL.labels.filter(L => { const t = L.name.toUpperCase().split('').join('\u2009'), wd = ctx.measureText(t).width, hh = parseFloat(ctx.font.split(' ')[1]) * 2.4, b = [X(L.x) - wd / 2, Y(L.z) - hh / 2, X(L.x) + wd / 2, Y(L.z) + hh / 2];     // мир ×2: подписи, что налезают на уже выведенные, на отдалении не выводятся
        if (boxes.some(q => b[0] < q[2] && q[0] < b[2] && b[1] < q[3] && q[1] < b[3])) return false; boxes.push(b); ctx.strokeText(t, X(L.x), Y(L.z)); ctx.fillText(t, X(L.x), Y(L.z)); return true; });
      if (W.cfg.zones) { const fs = Math.round(Math.max(11, Math.min(16, 34 * sc)) * U); ctx.font = `600 ${fs}px ${SERIF}`; for (const L of shown) if (L.sub) { ctx.strokeText(L.sub, X(L.x), Y(L.z) + fs * 1.3); ctx.fillText(L.sub, X(L.x), Y(L.z) + fs * 1.3); }     // пояс уровней под именем зоны
        const Z = W.cfg.zones; ctx.save(); ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(52,38,24,.45)'; ctx.beginPath();     // граница колец зон
        for (let a = 0; a <= 360; a += 3) { const t = a * Math.PI / 180, r = Z.split + Z.wobble * Math.sin(t * 5 + 1.7), x = X(Math.sin(t) * r), y = Y(Math.cos(t) * r); a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore(); } }
    // места: тёмные подписи со светлой обводкой; наползающие пропускаем
    const fsP = Math.round(14 * U); ctx.font = `700 ${fsP}px ${SERIF}`; ctx.lineWidth = 4 * U; ctx.strokeStyle = under ? '#000' : 'rgba(244,236,214,.92)';
    const put = []; if (!under) for (const pl of W.cfg.map.places || []) if (isSeen(W, pl.x, pl.z) && (zs >= 1.6 || pl.hub || pl.city || pl.id === (M.camp && M.camp.place))) { const y = Y(pl.z) - pl.r * sc * .35; if (put.some(q => Math.abs(q[0] - X(pl.x)) < 8 * fsP && Math.abs(q[1] - y) < fsP * 1.3)) continue; put.push([X(pl.x), y]); ctx.strokeText(pl.name, X(pl.x), y); ctx.fillStyle = pl.safe ? '#2e5a26' : '#8a2418'; ctx.fillText(pl.name, X(pl.x), y); }     // мелкий масштаб — только узлы зон, города и замки (этап 1)
    ctx.textBaseline = 'alphabetic';
  }
  // враги рядом (на большой карте не показываем: туман — это неизвестность)
  if (!full) { ctx.fillStyle = '#ff3a30'; for (const e of W.enemies) if (!e.dead) { const x = X(e.x), y = Y(e.z); if (x > 0 && x < w && y > 0 && y < h) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.2832); ctx.fill(); } } }
  // боссы и мини-боссы (2026-10-18): логова и замки видны всегда, даже под дымкой; на большой карте — с именем; серые — убитые и ещё не вернувшиеся, тусклые — веха пройдена
  // мини-боссы (элита и стражи замков) — оранжевые ромбы: на миникарте рядом, на большой карте — в открытых местах
  { const mark = (x, y, r, col, crown) => { ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (crown) { ctx.fillStyle = '#1a0a06'; ctx.fillRect(-r * .45, -r * .05, r * .9, r * .35); for (const k of [-1, 0, 1]) ctx.fillRect(k * r * .33 - r * .1, -r * .4, r * .2, r * .4); } ctx.restore(); };
    const named = (x, y, txt) => { if (!full) return; ctx.font = `700 ${Math.round(13 * U)}px "Iowan Old Style", Palatino, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3.5 * U; ctx.strokeStyle = 'rgba(244,236,214,.92)'; ctx.fillStyle = '#5a1a10'; ctx.strokeText(txt, x, y); ctx.fillText(txt, x, y); ctx.textBaseline = 'alphabetic'; };
    const inMap = (x, y) => x > -8 && x < w + 8 && y > -8 && y < h + 8, BR = full ? 7 : 5;
    if (!under) {
      for (const d of W.cfg.bosses.list) { if (d.level) continue; const x = X(d.x), y = Y(d.z); if (!inMap(x, y)) continue; const dead = W.bossDead[d.type] !== undefined, slain = W.path && W.path.slain[d.type]; const col = slain ? '#8a7a5a' : dead ? '#6a6a6a' : '#c8281c'; if (full) { badge(ctx, 'map:boss', x, y, 9 * U, col); if (zs >= 1.2) named(x, y + 17 * U, W.cfg.enemies[d.type].name); } else mark(x, y, BR, col === '#c8281c' ? '#ff3a2a' : col, true); }     // имя босса — только вблизи     // боссы замков — внутри, на поверхности их место — замок
      for (const d of W.cfg.dungeons.list) { if (!d.inst || !d.at) continue; const x = X(d.at.x), y = Y(d.at.z); if (!inMap(x, y)) continue; const ab = W.cfg.bosses.list.filter(b => b.level === d.id), done = ab.length && ab.every(b => W.bossDead[b.type] !== undefined);     // подземелья зон (этап 5): видны всегда, как замки
        const cl = done ? '#6a6a6a' : d.raid ? '#2a8a4a' : '#2a6ab8';     // 4.18в: синий — подземелье, зелёный — рейд; вокруг — кружок
        ctx.beginPath(); ctx.arc(x, y, (full ? 15 : 9) * (full ? U : 1), 0, 6.2832); ctx.lineWidth = (full ? 3 : 2) * (full ? U : 1); ctx.strokeStyle = done ? '#8a8a8a' : d.raid ? '#4adf6a' : '#4a9aff'; ctx.stroke();
        if (full) { badge(ctx, 'map:dungeon', x, y, 10 * U, cl); if (zs >= .45) named(x, y + 21 * U, (d.raid ? 'Рейд: ' : '') + (zs >= 1.5 ? `${d.name} · ур. ${d.level}` : d.name)); } else mark(x, y, BR + 1, done ? '#6a6a6a' : d.raid ? '#4adf6a' : '#3a8adf', true); }
      for (const c of M.cfg.castles || []) { if (!Number.isFinite(c.x)) continue; const x = X(c.x), y = Y(c.z), t = c.boss && c.boss.type; if (!inMap(x, y)) continue; const col = t && W.bossDead[t] !== undefined ? '#6a6a6a' : '#9a2ab8'; if (full) { badge(ctx, 'map:castle', x, y, 11 * U, col); if (zs >= .45) named(x, y + 20 * U, c.name); } else mark(x, y, BR + 1, col, true); }
    }
    for (const e of W.enemies) if (!e.dead && !e.boss && (e.elite || e.guard) && (under || !full || isSeen(W, e.x, e.z))) { const x = X(e.x), y = Y(e.z); if (x > 0 && x < w && y > 0 && y < h) { if (full) badge(ctx, 'map:mini', x, y, 6.5 * U, '#d8741a'); else mark(x, y, 3.5, '#ff9a2a', false); } } }
  // свои бойцы
  ctx.fillStyle = '#6ab0ff'; for (const a of W.allies || []) if (!a.dead && !a.guest) { ctx.beginPath(); ctx.arc(X(a.x), Y(a.z), 2.6, 0, 6.2832); ctx.fill(); }
  // повозка сказочного торговца: видна и сквозь туман; на миникарте прижимается к краю, показывая направление
  if (!under && W.wanderer) { const m = 6, x = Math.min(w - m, Math.max(m, X(W.wanderer.x))), y = Math.min(h - m, Math.max(m, Y(W.wanderer.z))); if (full) badge(ctx, 'map:coach', x, y, 8 * U, '#7a4ab8'); else { ctx.fillStyle = '#c8a0ff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 2, 2); } }
  // событие: золотой «!» над подопечным или местом засады; на миникарте прижимается к краю
  if (!under && W.event) { const ev = W.event, g = ev.guest && W.allies.find(a => a.id === ev.guest), ex = g ? g.x : ev.x, ez = g ? g.z : ev.z, m = 7, x = Math.min(w - m, Math.max(m, X(ex))), y = Math.min(h - m, Math.max(m, Y(ez)));
    ctx.fillStyle = '#ffc040'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1a1008'; ctx.fillRect(x - 1, y - 3.5, 2, 4.5); ctx.fillRect(x - 1, y + 2, 2, 1.6); }
  // метки взятых заданий (этап 5 «круче»): ромб — цель, зелёный — пора сдавать; на миникарте прижимаются к краю
  if (!under) for (const q of W.qmarks || []) { if (W.goal && q.x === W.goal.x && q.z === W.goal.z) continue; const m = 6, x = Math.min(w - m, Math.max(m, X(q.x))), y = Math.min(h - m, Math.max(m, Y(q.z))), r = full ? 5 : 4;
    if (full) { badge(ctx, 'map:quest', x, y, 8 * U, q.ready ? '#3a9a3a' : '#b8901c'); continue; }
    ctx.fillStyle = q.ready ? '#8fe08a' : '#e8d07a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  // цель (шаг 12): золотое кольцо с точкой; на миникарте за краем — прижимается к краю, показывая направление
  if (W.goal && Number.isFinite(W.goal.x)) { const m = 7, gx = X(W.goal.x), gy = Y(W.goal.z), x = Math.min(w - m, Math.max(m, gx)), y = Math.min(h - m, Math.max(m, gy)), t = performance.now() / 1000, r = (5 + (full ? 0 : Math.sin(t * 4) * .8)) * (full ? U * 1.4 : 1);
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, 6.2832); ctx.stroke(); ctx.strokeStyle = '#ffd45a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke(); ctx.fillStyle = '#ffd45a'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.2832); ctx.fill(); }
  // герой: стрелка по направлению
  ctx.save(); ctx.translate(X(p.x), Y(p.z)); if (full) ctx.scale(U * 1.3, U * 1.3); ctx.rotate(Math.atan2(Math.sin(p.face), -Math.cos(p.face)) + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
