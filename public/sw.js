/**
 * Service Worker for Offline File Converter
 * Provides 100% offline functionality, cache-first resource delivery,
 * pre-caching of application shell, and offline fallback.
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `offline-converter-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `offline-converter-runtime-${CACHE_VERSION}`;

// Pre-cached core application shell assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg'
];

/**
 * Service Worker Installation
 * Pre-caches shell assets and activates immediately
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

/**
 * Service Worker Activation
 * Cleans up stale caches from previous versions and claims clients
 */
self.addEventListener('activate', (event) => {
  const allowedCaches = new Set([STATIC_CACHE, RUNTIME_CACHE]);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !allowedCaches.has(name))
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

/**
 * Fetch Strategy: Cache-First with Runtime Caching
 * Ensures fast load times and guarantees complete offline availability.
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignore non-http/https requests (e.g. chrome-extension:)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle navigation requests (SPA index.html fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html', { cacheName: STATIC_CACHE })
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Fetch fresh in background when online, otherwise return cached immediately
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(STATIC_CACHE).then((cache) => {
                  cache.put('/index.html', networkResponse.clone());
                });
              }
            }).catch(() => {
              // Ignore offline error
            });
            return cachedResponse;
          }
          return fetch(request).catch(() => caches.match('/index.html'));
        })
    );
    return;
  }

  // Cache-first strategy for all other local assets (JS, CSS, WASM, SVG, etc.)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Not in cache, fetch from network/server and cache in runtime cache
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch((fetchErr) => {
        // If offline and request is an asset, check if a similar cached file exists
        return caches.match(url.pathname);
      });
    })
  );
});

/**
 * Message Event Listener
 * Allows main thread communication (e.g. skipWaiting)
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
