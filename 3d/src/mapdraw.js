// Рисование карты на 2D-холсте: миникарта (окно вокруг героя) и большая карта (весь мир) с «туманом войны».
import { isSeen } from './sim.js';

const KIND = { house: '#8a6a52', shop: '#d8b04a', smithy: '#e0722c', tavern: '#c88a3a', chapel: '#9a94b8', barracks: '#6a8aa8', warehouse: '#8a7a52', hut: '#6a5a48' };
const NPC = { merchant: '#ffd45a', smith: '#ff8a3a', captain: '#6ab0ff' };

export function drawMap(ctx, W, v) {
  const { w, h, scale: sc, cx, cz, full } = v, R = W.cfg.world.radius, p = W.player, M = W.map;
  const X = x => w / 2 + (x - cx) * sc, Y = z => h / 2 + (z - cz) * sc;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0c0807'; ctx.fillRect(0, 0, w, h);
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
  // костёр
  ctx.fillStyle = '#ff7a30'; ctx.beginPath(); ctx.arc(X(0), Y(0), Math.max(2, sc * .9), 0, 6.2832); ctx.fill();
  // торговцы и прочие NPC
  for (const b of M.buildings) if (b.npc) { ctx.fillStyle = NPC[b.npc.kind] || '#fff'; ctx.beginPath(); ctx.arc(X(b.npc.x), Y(b.npc.z), Math.max(2.5, sc * 1.1), 0, 6.2832); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }
  // непустые контейнеры в открытых клетках
  ctx.fillStyle = '#ffc860';
  for (const c of M.containers) if (c.ready && isSeen(W, c.x, c.z)) ctx.fillRect(X(c.x) - 1.5, Y(c.z) - 1.5, 3, 3);
  // логова боссов (видны в открытых клетках; серые — убитые и ещё не вернувшиеся)
  for (const d of W.cfg.bosses.list) { if (!isSeen(W, d.x, d.z)) continue; const dead = W.bossDead[d.type] !== undefined; ctx.save(); ctx.translate(X(d.x), Y(d.z)); ctx.rotate(Math.PI / 4); ctx.fillStyle = dead ? '#6a6a6a' : '#ff3a2a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; const r = Math.max(3.5, sc * 1.6); ctx.fillRect(-r, -r, r * 2, r * 2); ctx.strokeRect(-r, -r, r * 2, r * 2); ctx.restore(); }
  // туман войны
  const cell = W.cfg.map.cell, n = W.seenN;
  ctx.fillStyle = full ? 'rgba(6,4,3,.94)' : 'rgba(6,4,3,.9)';
  const i0 = Math.max(0, Math.floor((cx - w / 2 / sc + R) / cell)), i1 = Math.min(n - 1, Math.floor((cx + w / 2 / sc + R) / cell));
  const j0 = Math.max(0, Math.floor((cz - h / 2 / sc + R) / cell)), j1 = Math.min(n - 1, Math.floor((cz + h / 2 / sc + R) / cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!W.seen[j * n + i]) ctx.fillRect(X(i * cell - R) - .5, Y(j * cell - R) - .5, cell * sc + 1, cell * sc + 1);
  // подписи мест (только найденных)
  if (full) {
    ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
    for (const pl of W.cfg.map.places || []) if (isSeen(W, pl.x, pl.z)) { const y = Y(pl.z) - pl.r * sc * .35; ctx.strokeText(pl.name, X(pl.x), y); ctx.fillStyle = pl.safe ? '#a8e0a0' : '#ff9a8a'; ctx.fillText(pl.name, X(pl.x), y); }
  }
  // враги рядом (на большой карте не показываем: туман — это неизвестность)
  if (!full) { ctx.fillStyle = '#ff3a30'; for (const e of W.enemies) if (!e.dead) { const x = X(e.x), y = Y(e.z); if (x > 0 && x < w && y > 0 && y < h) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.2832); ctx.fill(); } } }
  // свои бойцы
  ctx.fillStyle = '#6ab0ff'; for (const a of W.allies || []) if (!a.dead) { ctx.beginPath(); ctx.arc(X(a.x), Y(a.z), 2.6, 0, 6.2832); ctx.fill(); }
  // герой: стрелка по направлению
  ctx.save(); ctx.translate(X(p.x), Y(p.z)); ctx.rotate(Math.atan2(Math.sin(p.face), -Math.cos(p.face)) + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
