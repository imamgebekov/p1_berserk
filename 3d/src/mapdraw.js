// Рисование карты на 2D-холсте: миникарта (окно вокруг героя) и большая карта (весь мир) с «туманом войны».
import { isSeen } from './sim.js';

const KIND = { house: '#8a6a52', shop: '#d8b04a', smithy: '#e0722c', tavern: '#c88a3a', chapel: '#9a94b8', barracks: '#6a8aa8', warehouse: '#8a7a52', hut: '#6a5a48' };
const NPC = { merchant: '#ffd45a', smith: '#ff8a3a', captain: '#6ab0ff' };

export function drawMap(ctx, W, v) {
  const { w, h, scale: sc, cx, cz, full } = v, R = W.seenR || W.cfg.world.radius, p = W.player, M = W.map, under = !!M.bounds;
  const X = x => w / 2 + (x - cx) * sc, Y = z => h / 2 + (z - cz) * sc;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0c0807'; ctx.fillRect(0, 0, w, h);
  if (under) {
    // подземелье: пол комнат, стены, лестница
    ctx.fillStyle = '#2a221d'; for (const r of M.rooms) ctx.fillRect(X(r.x0), Y(r.z0), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc);
    for (const d of M.doors) if (d.open < .6) { ctx.fillStyle = d.locked ? '#d03a2a' : '#7a5030'; ctx.fillRect(X(d.rect.x0), Y(d.rect.z0), Math.max(2, (d.rect.x1 - d.rect.x0) * sc), Math.max(2, (d.rect.z1 - d.rect.z0) * sc)); }      // запертая — красная
    ctx.fillStyle = '#6a5a4c'; for (const b of M.blocks) ctx.fillRect(X(b.x0), Y(b.z0), Math.max(1, (b.x1 - b.x0) * sc), Math.max(1, (b.z1 - b.z0) * sc));
  } else {
    // мир
    ctx.fillStyle = '#2a1e17'; ctx.beginPath(); ctx.arc(X(0), Y(0), R * sc, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#6a2a24'; ctx.lineWidth = 2; ctx.stroke();
    // места
    for (const pl of W.cfg.map.places || []) {
      ctx.beginPath(); ctx.arc(X(pl.x), Y(pl.z), pl.r * sc, 0, 6.2832);
      ctx.fillStyle = pl.safe ? 'rgba(110,170,100,.13)' : `rgba(200,40,30,${.07 + .05 * (pl.danger || 0)})`; ctx.fill();
      ctx.strokeStyle = pl.safe ? 'rgba(130,200,120,.55)' : 'rgba(220,70,50,.6)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
  }
  // дороги
  ctx.strokeStyle = '#4a3a2c'; ctx.lineWidth = Math.max(1, sc * 1.4); ctx.lineCap = 'round';
  for (const [a, b] of M.roads) { ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.z)); ctx.lineTo(X(b.x), Y(b.z)); ctx.stroke(); }
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
  if (!under) for (const d of W.cfg.bosses.list) { if (!isSeen(W, d.x, d.z)) continue; const dead = W.bossDead[d.type] !== undefined; ctx.save(); ctx.translate(X(d.x), Y(d.z)); ctx.rotate(Math.PI / 4); ctx.fillStyle = dead ? '#6a6a6a' : '#ff3a2a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; const r = Math.max(3.5, sc * 1.6); ctx.fillRect(-r, -r, r * 2, r * 2); ctx.strokeRect(-r, -r, r * 2, r * 2); ctx.restore(); }
  // могила с потерянным пеплом
  if (W.tomb && (W.tomb.lvl || 'surface') === (W.lvl || 'surface')) { ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffd45a'; ctx.lineWidth = 1.5; const tx = X(W.tomb.x), ty = Y(W.tomb.z); ctx.fillRect(tx - 1.5, ty - 5, 3, 10); ctx.fillRect(tx - 4, ty - 2, 8, 3); ctx.strokeRect(tx - 1.5, ty - 5, 3, 10); }
  // туман войны
  const cell = W.seenC || W.cfg.map.cell, n = W.seenN;
  ctx.fillStyle = full ? 'rgba(6,4,3,.94)' : 'rgba(6,4,3,.9)';
  const i0 = Math.max(0, Math.floor((cx - w / 2 / sc + R) / cell)), i1 = Math.min(n - 1, Math.floor((cx + w / 2 / sc + R) / cell));
  const j0 = Math.max(0, Math.floor((cz - h / 2 / sc + R) / cell)), j1 = Math.min(n - 1, Math.floor((cz + h / 2 / sc + R) / cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!W.seen[j * n + i]) ctx.fillRect(X(i * cell - R) - .5, Y(j * cell - R) - .5, cell * sc + 1, cell * sc + 1);
  // подписи мест (только найденных)
  if (full) {
    ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
    if (!under) for (const pl of W.cfg.map.places || []) if (isSeen(W, pl.x, pl.z)) { const y = Y(pl.z) - pl.r * sc * .35; ctx.strokeText(pl.name, X(pl.x), y); ctx.fillStyle = pl.safe ? '#a8e0a0' : '#ff9a8a'; ctx.fillText(pl.name, X(pl.x), y); }
  }
  // враги рядом (на большой карте не показываем: туман — это неизвестность)
  if (!full) { ctx.fillStyle = '#ff3a30'; for (const e of W.enemies) if (!e.dead) { const x = X(e.x), y = Y(e.z); if (x > 0 && x < w && y > 0 && y < h) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.2832); ctx.fill(); } } }
  // свои бойцы
  ctx.fillStyle = '#6ab0ff'; for (const a of W.allies || []) if (!a.dead) { ctx.beginPath(); ctx.arc(X(a.x), Y(a.z), 2.6, 0, 6.2832); ctx.fill(); }
  // герой: стрелка по направлению
  ctx.save(); ctx.translate(X(p.x), Y(p.z)); ctx.rotate(Math.atan2(Math.sin(p.face), -Math.cos(p.face)) + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
