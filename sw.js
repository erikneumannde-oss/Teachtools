// Service Worker: Netzwerk zuerst, damit Änderungen sofort ankommen.
// Ohne Netz kommt die zuletzt geladene Fassung aus dem Zwischenspeicher.
const CACHE = 'teachtools-v18';
const START = [
  './', './index.html', './impressum.html', './manifest.webmanifest',
  './pinnwand.css', './theme.css', './schule-hell.png', './pinnwand.js', './pinnwand.jpg', './logo-start.svg', './install.js', './sw-register.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './pdf-werkzeuge/', './pdf-werkzeuge/index.html', './pdf-werkzeuge/app.js',
  './sitzplan/', './sitzplan/index.html', './sitzplan/app.js', './sitzplan/style.css',
  './notenrechner/', './notenrechner/index.html', './notenrechner/app.js', './notenrechner/calc.js',
  './notenrechner/export.js', './notenrechner/style.css',
  './klassenarbeit/', './klassenarbeit/index.html', './klassenarbeit/app.js', './klassenarbeit/calc.js',
  './klassenarbeit/export.js', './klassenarbeit/style.css',
  './gruppen/', './gruppen/index.html', './gruppen/app.js', './gruppen/style.css',
  './timer/', './timer/index.html', './timer/app.js', './timer/style.css',
  './brief/', './brief/index.html', './brief/app.js', './brief/letter.js', './brief/layout.js', './brief/docx.js', './brief/pdf.js',
  './brief/style.css', './brief/vorlage.docx',
  './lib/fonts/Carlito-Regular.ttf', './lib/fonts/Carlito-Bold.ttf', './lib/fonts/LiberationSans-Regular.ttf',
  './lib/pdf-lib.min.js', './lib/pdf.min.js', './lib/pdf.worker.min.js', './lib/fflate.js',
  './lib/fontkit.umd.min.js', './lib/fonts/DejaVuSans.ttf', './lib/fonts/DejaVuSans-Bold.ttf'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // Jede Datei einzeln, damit eine fehlende Datei die Installation nicht verhindert
      Promise.all(START.map(url => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Weitergeleitete Antworten dürfen bei Seitenaufrufen nicht direkt zurückgegeben werden
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  if (new URL(req.url).origin !== location.origin) return;

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return req.mode === 'navigate' ? await clean(res) : res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
