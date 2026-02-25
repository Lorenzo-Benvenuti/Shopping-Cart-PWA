/* service-worker.js
   Cache "app shell" + data + images to work offline.
   Strategy: stale-while-revalidate for static assets, network-first for JSON data.
*/
const CACHE_VERSION = "v1.0.0";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/manifest.json",
  "/data/products.json",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k !== STATIC_CACHE && k !== DATA_CACHE) return caches.delete(k);
        })
      );
      await self.clients.claim();
    })()
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    return (
      cached ||
      new Response(JSON.stringify({ error: "offline" }), {
        headers: { "Content-Type": "application/json" },
      })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // GET requests only
  if (request.method !== "GET") return;

  // JSON data: network-first
  if (url.pathname.endsWith("/data/products.json")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Local images: cache-first (via staleWhileRevalidate, effectively cache-first if already cached)
  if (url.pathname.startsWith("/assets/img/") || url.pathname.startsWith("/assets/icons/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // App shell + CSS/JS: stale-while-revalidate
  if (url.origin === self.location.origin || url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(staleWhileRevalidate(request));
  }
});
