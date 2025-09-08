const CACHE_NAME = "roon-cache-v1";
const urlsToCache = [
  "/",  // главная страница
  "/static/social/manifest.json",
  "/media/avatars/icon.png",
  "/media/avatars/icon.png",
  "/static/social/style.css",
];

// Установка Service Worker и кэширование файлов
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Перехват запросов и отдача из кэша при возможности
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
