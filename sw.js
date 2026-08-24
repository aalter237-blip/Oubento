const CACHE = "oubento-v3";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/os.css",
  "./css/distros.css",
  "./js/i18n.js",
  "./js/fs.js",
  "./js/core.js",
  "./js/auth.js",
  "./js/distros.js",
  "./js/shell.js",
  "./js/apps.js",
  "./js/apps-native.js",
  "./assets/branding/icon-512.png",
  "./assets/branding/icon-192.png",
  "./assets/branding/boot-mascot.png",
  "./assets/wallpapers/ubuntu-default.jpg",
  "./assets/wallpapers/ubuntu-orange.jpg",
  "./assets/wallpapers/ubuntu-dark.jpg",
  "./assets/wallpapers/ubuntu-light.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
