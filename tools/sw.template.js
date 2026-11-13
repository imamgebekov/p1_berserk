// Service worker (2026-11-13): код и мелкие файлы кэшируются при установке (кэш версии), тяжёлые модели и музыка — в отдельный кэш media,
// который переживает обновления: перекачивается только то, у чего поменялся хэш. Кнопка «Скачать игру на устройство» просит скачать всё сразу;
// без неё модели докачиваются по мере надобности и тоже остаются. Файл собирается плагином из vite.config.js: подставляются версия и списки.
const VERSION = '__VERSION__';
const CORE = 'berserk-core-' + VERSION, MEDIA_CACHE = 'berserk-media';
const ASSETS = __ASSETS__;
const MEDIA = __MEDIA__;     // [[путь, размер, хэш]] — все .glb и .mp3
const scopeUrl = p => new URL(p, self.registration.scope);
const mediaInfo = new Map(MEDIA.map(([p, size, hash]) => [scopeUrl(p).pathname, { path: p, size, key: scopeUrl(p).pathname + '?v=' + hash }]));
const keyReq = key => new Request(new URL(key, self.location.origin).href);
const TOTAL = MEDIA.reduce((s, m) => s + m[1], 0);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('berserk-core-') && k !== CORE || k === 'berserk-' + VERSION) await caches.delete(k);     // старые кэши версий (в том числе формата до 2026-11-13)
    const mc = await caches.open(MEDIA_CACHE), live = new Set([...mediaInfo.values()].map(v => v.key));
    for (const r of await mc.keys()) { const u = new URL(r.url); if (!live.has(u.pathname + u.search)) await mc.delete(r); }     // файлы прежних версий — прочь
    await self.clients.claim();
  })());
});

// Range: аудио в Safari просит куски; отдаём кусок из целого ответа, лежащего в кэше
async function ranged(req, res) {
  const h = req.headers.get('range'); if (!h || !res) return res;
  const m = /bytes=(\d*)-(\d*)/.exec(h); if (!m) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength, a = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]), b = m[1] === '' || m[2] === '' ? size - 1 : Math.min(size - 1, Number(m[2]));
  if (a >= size) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(buf.slice(a, b + 1), { status: 206, headers: { 'Content-Type': res.headers.get('content-type') || 'application/octet-stream', 'Content-Length': String(b - a + 1), 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes' } });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const mi = mediaInfo.get(url.pathname);
  if (mi) {
    e.respondWith((async () => {
      const mc = await caches.open(MEDIA_CACHE), hit = await mc.match(keyReq(mi.key));
      if (hit) return ranged(req, hit);
      const plain = new Request(req.url), r = await fetch(plain);
      if (r.ok && r.status === 200) { await mc.put(keyReq(mi.key), r.clone()); return ranged(req, r); }
      return r;
    })());
    return;
  }
  // ignoreVary: сервер может ответить с Vary: Origin, а модульные скрипты шлют Origin — без этого кэш промахивается и офлайн отдаётся index
  e.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(hit => hit || fetch(req).catch(() => caches.match('./index.html'))));
});

// ---- скачать всё: сообщения от страницы ----
async function status() {
  const mc = await caches.open(MEDIA_CACHE), have = new Set((await mc.keys()).map(r => { const u = new URL(r.url); return u.pathname + u.search; }));
  let n = 0, bytes = 0; for (const v of mediaInfo.values()) if (have.has(v.key)) { n++; bytes += v.size; }
  return { have: n, total: MEDIA.length, bytes, bytesTotal: TOTAL, version: VERSION };
}
let busy = false;
async function downloadAll(reply) {
  if (busy) return; busy = true;
  try {
    const mc = await caches.open(MEDIA_CACHE), st0 = await status(); let done = st0.have, bytes = st0.bytes, failed = 0;
    const todo = []; for (const v of mediaInfo.values()) if (!(await mc.match(keyReq(v.key)))) todo.push(v);
    reply({ type: 'media-progress', have: done, total: MEDIA.length, bytes, bytesTotal: TOTAL, failed });
    let i = 0;
    const worker = async () => { while (i < todo.length) { const v = todo[i++]; let ok = false;
      for (let t = 0; t < 3 && !ok; t++) { try { const r = await fetch(new Request(scopeUrl(v.path).href)); if (r.ok && r.status === 200) { await mc.put(keyReq(v.key), r); ok = true; } } catch (err) { /* повтор */ } }
      if (ok) { done++; bytes += v.size; } else failed++;
      reply({ type: 'media-progress', have: done, total: MEDIA.length, bytes, bytesTotal: TOTAL, failed }); } };
    await Promise.all([worker(), worker(), worker()]);
    reply({ type: 'media-done', ...(await status()), failed });
  } finally { busy = false; }
}
self.addEventListener('message', e => {
  const d = e.data || {}, src = e.source, reply = m => { try { src && src.postMessage(m); } catch (err) { /* окно закрыто */ } };
  if (d.type === 'media-status') e.waitUntil(status().then(s => reply({ type: 'media-status', ...s })));
  else if (d.type === 'media-download') e.waitUntil(downloadAll(reply));
  else if (d.type === 'skip') self.skipWaiting();
});
