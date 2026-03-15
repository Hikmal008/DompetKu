/* =====================================================
   DompetKu — service-worker.js
   Handles: Caching, Offline Fallback, Background Sync
   ===================================================== */

const CACHE_NAME = "dompetku-v1.0.2";
const OFFLINE_URL = "/offline.html";

// Assets to cache on install
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap",
];

// ─── INSTALL ─────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        console.log("[SW] Pre-caching assets");
        // Cache one by one to avoid total failure on one bad asset
        await Promise.allSettled(
          PRECACHE_ASSETS.map((url) =>
            cache
              .add(url)
              .catch((e) => console.warn("[SW] Failed to cache:", url, e)),
          ),
        );
      })
      .then(() => self.skipWaiting()),
  );
});

// ─── ACTIVATE ─────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── FETCH ─────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin API calls (e.g. Google Apps Script POST)
  if (request.method !== "GET") return;
  if (request.mode === "no-cors" && url.hostname === "script.google.com")
    return;

  // Navigation requests — serve index.html or offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Google Fonts — Cache First
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return response;
        });
      }),
    );
    return;
  }

  // App assets — Stale While Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      return cached || fetchPromise || caches.match(OFFLINE_URL);
    }),
  );
});

// ─── BACKGROUND SYNC ──────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-expenses") {
    console.log("[SW] Background sync triggered");
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_PENDING" });
        });
      }),
    );
  }
});

// ─── PUSH NOTIFICATIONS ───────────────────────────────
self.addEventListener("push", (event) => {
  let data = {
    title: "DompetKu",
    body: "Jangan lupa catat pengeluaran hari ini!",
  };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "dompetku-reminder",
      renotify: true,
      actions: [
        { action: "open", title: "📝 Catat Sekarang" },
        { action: "dismiss", title: "✕ Tutup" },
      ],
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if open
        for (const client of clientList) {
          if (
            client.url.includes(self.registration.scope) &&
            "focus" in client
          ) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      }),
  );
});

// ─── MESSAGE HANDLER ──────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
