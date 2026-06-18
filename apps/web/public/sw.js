// Service worker — Sunrise CRM PWA
// Navegación: network-first (para tomar deploys nuevos). Assets: stale-while-revalidate.
const CACHE = 'sunrise-crm-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  // Navegaciones: red primero, fallback al shell offline
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')))
    return
  }

  // Assets del mismo origen: stale-while-revalidate
  const url = new URL(req.url)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req)
          .then(res => {
            if (res && res.status === 200) {
              const clone = res.clone()
              caches.open(CACHE).then(c => c.put(req, clone))
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      }),
    )
  }
})
