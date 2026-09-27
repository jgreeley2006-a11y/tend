// Tend service worker: offline app shell + push notifications.
const CACHE = "tend-v3";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./config.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/apple-touch-icon.png", "./icons/badge-96.png"];

self.addEventListener("install", e => {
  // Cache each file on its own so one missing file can't stop the worker from installing.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first for our own files so updates show up; fall back to cache when offline.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});

self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { body: e.data && e.data.text() }; }
  const title = data.title || "Tend";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || "Open Tend to see today's next steps.",
    icon: "icons/icon-192.png",
    badge: "icons/badge-96.png",
    tag: data.tag || "tend-daily",
    data: { url: data.url || "./" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL(e.notification.data && e.notification.data.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if ("focus" in c) { c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
