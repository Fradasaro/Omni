/* Service worker: l'app funziona offline dopo la prima apertura.
   Ad ogni rilascio aumenta CACHE_VERSION, così gli utenti ricevono i file nuovi. */
const CACHE_VERSION = 'omni-v2.2.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './fonts/PlusJakartaSans-var.woff',
  './js/icons.js',
  './js/foods.js',
  './js/content.js',
  './js/core.js',
  './js/planner.js',
  './js/ui.js',
  './js/view-oggi.js',
  './js/view-piano.js',
  './js/view-scambi.js',
  './js/view-spesa.js',
  './js/view-profilo.js',
  './js/wizard.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Rete prima per le pagine (aggiornamenti immediati), cache prima per il resto. */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then(c => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE_VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
