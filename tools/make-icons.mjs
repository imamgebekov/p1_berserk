// Рисует иконки приложения кодом (пиксель-арт 64×64: затмение и гигантский меч) и пишет PNG в public/.
// Запуск: node tools/make-icons.mjs   (никаких внешних картинок и зависимостей)
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const N = 64;
const px = new Uint8Array(N * N * 4);
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const put = (x, y, c, a = 1) => {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = (y * N + x) * 4, [r, g, b] = hex(c);
  px[i] = px[i] * (1 - a) + r * a; px[i + 1] = px[i + 1] * (1 - a) + g * a; px[i + 2] = px[i + 2] * (1 - a) + b * a; px[i + 3] = 255;
};
const rect = (x, y, w, h, c, a) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c, a); };
const disc = (cx, cy, r, c, a) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .5) put(cx + x, cy + y, c, a); };

rect(0, 0, N, N, '#0b0908');
// тёмное небо с красным свечением у горизонта
for (let y = 0; y < N; y++) rect(0, y, N, 1, '#3a0a0c', Math.pow(y / N, 2.2) * .55);
// затмение: тёмный диск, багровая корона
disc(32, 27, 22, '#a1121f', .25); disc(32, 27, 19, '#c4161c', .55); disc(32, 27, 17, '#050203');
// земля
rect(0, 52, N, 12, '#17110f'); rect(0, 52, N, 1, '#5a4a3d');
// гигантский меч, воткнутый в землю
rect(30, 6, 4, 38, '#cfc9bb'); rect(30, 6, 1, 38, '#f4efe2'); rect(33, 8, 1, 36, '#7d776b');
rect(31, 3, 2, 3, '#cfc9bb'); rect(31, 2, 2, 1, '#f4efe2');
rect(22, 44, 20, 3, '#8a7a62'); rect(22, 44, 20, 1, '#b5a285');
rect(30, 47, 4, 9, '#2a1a12'); rect(29, 56, 6, 2, '#8a7a62');
// клеймо у основания
for (let i = 0; i < 9; i++) { rect(12 + i, 51 + i, 2, 2, '#a1121f'); rect(20 - i, 51 + i, 2, 2, '#a1121f'); }
for (const [x, y] of [[10, 12], [52, 9], [47, 20], [14, 26], [56, 30], [8, 40]]) put(x, y, '#bfb5a0', .5);

const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
};
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const sx = Math.min(N - 1, Math.floor(x * N / size)), sy = Math.min(N - 1, Math.floor(y * N / size));
      const i = (sy * N + sx) * 4, o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = px[i]; raw[o + 1] = px[i + 1]; raw[o + 2] = px[i + 2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(dir, { recursive: true });
for (const s of [180, 192, 512]) { writeFileSync(join(dir, `icon-${s}.png`), png(s)); console.log('icon-' + s + '.png'); }
