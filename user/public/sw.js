/* Bullet Rani — cache audio / images only (never HTML/JS so Vite stays fresh) */
const CACHE = 'bulletrani-static-v17';

const PRECACHE = [
  '/riksha.png?v=8',
  '/riksha-wheel.png?v=2',
  '/riksha-head.png?v=6',
  '/riksha-sign.png?v=1',
  '/indian-city-bg.jpg',
  '/maari-logo.png',
  '/favicon.svg',
  '/icons.svg',
  '/sounds/bgm-maari.mp3',
  '/sounds/riksha-engine.mp3',
  '/sounds/car-crash.mp3',
  '/sounds/waiting-dialogue.mp3',
  '/sounds/waiting-dialogue-2.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE.map((url) =>
            fetch(url).then((res) => (res && res.ok ? cache.put(url, res) : null))
          )
        )
      )
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[sw] precache failed', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isMediaPath(pathname) {
  return (
    pathname.startsWith('/sounds/') ||
    /\.(mp3|png|svg|webp|jpg|jpeg|woff2)$/i.test(pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (!isMediaPath(url.pathname)) return;

  // Cache-first for media — fast repeat loads, offline-capable assets
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return hit || Response.error();
      }
    })
  );
});
