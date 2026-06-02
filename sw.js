const CACHE_NAME = 'airbridge-v4.0.0';

// L'elenco esatto di tutti i file necessari per far girare l'app offline
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/locales.js',
    './js/app.js',
    './js/worker.js',
    './manifest.json',
    './libs/pako/pako.min.js',
    './libs/bc-ur/bc-ur.js',
    './libs/zbar/zbar.js',
    './libs/zbar/zbar.wasm',
    './libs/qrcode/qrcode.min.js',
    './libs/ggwave/ggwave.js'
];

// FASE 1: Installazione (precaching)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Precaching files');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting()) // Forza l'attivazione immediata
    );
});

// FASE 2: Attivazione (pulizia vecchie cache)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Eliminazione vecchia cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Prende il controllo di tutte le tab aperte
    );
});

// FASE 3: Fetch (Intercettazione richieste) -> Strategia "Cache-First"
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Se la risorsa è nella cache, restituisci quella (OFFLINE)
                if (response) {
                    return response;
                }
                // Altrimenti prova a scaricarla dalla rete (ONLINE)
                return fetch(event.request);
            })
    );
});