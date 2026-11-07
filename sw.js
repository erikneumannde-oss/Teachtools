// Netzwerk zuerst, damit Änderungen sofort ankommen; ohne Netz kommt die zuletzt geladene Fassung aus dem Zwischenspeicher.
const CACHE = 'teachtools-v2';
const START = [
  './', './index.html', './impressum.html', './manifest.webmanifest', './icons/icon-192.png',
  './pdf-werkzeuge/', './pdf-werkzeuge/index.html', './pdf-werkzeuge/app.js', './sw-register.js',
  './sitzplan/', './sitzplan/index.html', './sitzplan/app.js', './sitzplan/style.css',
  './lib/pdf-lib.min.js', './lib/pdf.min.js', './lib/pdf.worker.min.js', './lib/fflate.js'
];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(START)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith('http')) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok && new URL(r.url).origin === location.origin) { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(r, c)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('./index.html')))
  );
});
