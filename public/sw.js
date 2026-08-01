const CACHE = 'drop-shell-v3';
const SHELL = ['/', '/manifest.webmanifest', '/drop-icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const path = new URL(event.request.url).pathname;
  if (
    event.request.method !== 'GET' ||
    path.startsWith('/api/') ||
    path.startsWith('/community') ||
    path.startsWith('/media/community/')
  ) return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(response => response || caches.match('/'))));
});
