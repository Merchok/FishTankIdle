/* Finlings service worker: saves the game on the device so it opens with no internet.
   Online: you always get the newest version. Offline (or very slow): the saved copy.
   365149562 is replaced by build.sh, so every new build refreshes the saved copy. */
const CACHE = 'finlings-365149562';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('finlings-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then(res => { if (res.ok && !res.redirected) cache.put(req, res.clone()); return res; });
    const quiet = net.catch(() => {});
    e.waitUntil(quiet);
    try {
      // online: the newest copy (but give up after 3 seconds on a bad connection)
      return await Promise.race([net, new Promise((_, no) => setTimeout(no, 3000))]);
    } catch (err) {
      const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
      return hit || net;
    }
  })());
});
