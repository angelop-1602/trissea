const CACHE_NAME = 'mobility-shell-v4';
const OFFLINE_URL = '/offline';
const APP_SHELL = [
  '/',
  '/landing',
  '/passenger',
  '/driver',
  '/login',
  '/signup',
  '/admin-login',
  '/manifest-passenger.webmanifest',
  '/manifest-driver.webmanifest',
  OFFLINE_URL,
  '/mobility-logo.png',
  '/mobility-logo.svg',
  '/mobilit-logo-white.png',
  '/icon-light-32x32.png',
  '/icon-dark-32x32.png',
  '/apple-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || null;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const response = await networkFirst(request);
        if (response) return response;
        return caches.match(OFFLINE_URL);
      })()
    );
    return;
  }

  // Never cache Next.js build assets here to avoid stale runtime bundles.
  if (isSameOrigin && url.pathname.startsWith('/_next/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (isSameOrigin && (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/bookings/'))) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({
              error: 'You appear to be offline. Please reconnect and retry.',
              code: 'OFFLINE',
            }),
            {
              status: 503,
              headers: {
                'content-type': 'application/json',
              },
            }
          )
      )
    );
    return;
  }

  if (!isSameOrigin) {
    return;
  }

  event.respondWith(
    (async () => {
      const networkPromise = fetch(request)
        .then(async (response) => {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      const response = await networkPromise;
      if (response) return response;

      const cached = await caches.match(request);
      return cached || new Response(null, { status: 504 });
    })()
  );
});
