const version = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `kitt-cues-v${version}`;

// Detect base path (important for GitHub Pages under /Kitt-Cues/)
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const BASE = SCOPE_PATH === '' ? '/' : SCOPE_PATH + '/';

// Only cache URLs that certainly exist after build/deploy
const ASSETS = [
    `${BASE}`,
    `${BASE}index.html`,
    `${BASE}manifest.json`,
    `${BASE}browserconfig.xml`,
    `${BASE}icons/icon-72x72.png`,
    `${BASE}icons/icon-192x192.png`,
    `${BASE}icons/icon-512x512.png`
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
            .catch(error => console.error('Service Worker: install failed', error))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(cacheNames =>
                Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                        return null;
                    })
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    if (
        requestUrl.origin !== self.location.origin &&
        !requestUrl.hostname.includes('fonts.googleapis.com') &&
        !requestUrl.hostname.includes('fonts.gstatic.com') &&
        !requestUrl.hostname.includes('cdn.tailwindcss.com')
    ) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request)
                .then(response => {
                    // Check if we received a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        // If 404 for a document (navigation), allow fallback to index.html (SPA routing)
                        if (response && response.status === 404 && event.request.destination === 'document') {
                            return caches.match(`${BASE}index.html`);
                        }
                        return response;
                    }

                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                })
                .catch(error => {
                    console.error('Fetch failed; returning offline page instead.', error);
                    if (event.request.destination === 'document') {
                        return caches.match(`${BASE}index.html`);
                    }
                    throw error;
                });
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Background sync');
    }
});

console.log('Service Worker: loaded version', CACHE_NAME);
