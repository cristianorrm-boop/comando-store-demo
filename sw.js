const CACHE_NAME = "comando-store-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20261021",
  "./script.js?v=20261021",
  "./firebase-config.js?v=20261021",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Só intercepta GET do próprio site (app shell). Chamadas ao Firestore/Firebase
// (outra origem) passam direto pela rede, sem cache.
//
// Estratégia network-first: sempre tenta buscar a versão mais nova primeiro,
// e só cai no cache se a rede falhar (ex: sem internet).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
