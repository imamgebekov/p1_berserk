// Service worker: кэширует всю сборку при установке, дальше игра работает без сети.
// Файл собирается плагином из vite.config.js: подставляются версия и список файлов.
const CACHE = 'berserk-__VERSION__';
const ASSETS = __ASSETS__;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('berserk-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ignoreVary: сервер может ответить с Vary: Origin, а модульные скрипты шлют Origin — без этого кэш промахивается и офлайн отдаётся index.html
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(hit => hit || fetch(req).then(r => {
      if (r.ok && url.pathname.endsWith('.glb')) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }     // 3D-модели (8 МБ) не качаются при установке — кэшируются, когда понадобились
      return r;
    }).catch(() => caches.match('./index.html')))
  );
});
