const CACHE_NAME = "zunny-pos-v6";

const STATIC_ASSETS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/js/quagga.min.js"
];

// HTML pages — never cache these, always fetch fresh from network
const HTML_PAGES = ["/", "/index.html", "/login.html", "/admin.html"];

// Install — only cache static assets (not HTML)
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // HTML pages — network first, no caching
  // This ensures cashiers always get the latest code after a deploy
  if (HTML_PAGES.includes(url.pathname) || url.pathname === "") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // API calls — network only, never cache
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/products") || url.pathname.startsWith("/auth")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ message: "You are offline." }), {
          headers: { "Content-Type": "application/json" }
        })
      )
    );
    return;
  }

  // Static assets (icons, images, JS libs) — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      });
    })
  );
});
