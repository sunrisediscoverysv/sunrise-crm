// Service worker — Sunrise CRM PWA
// Navegación: network-first (para tomar deploys nuevos). Assets: stale-while-revalidate.
const CACHE = 'sunrise-crm-v3'
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

// ── Web Push ──────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Sunrise CRM', body: '', url: '/' }
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
      vibrate: [80, 40, 80],
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if ('focus' in w) { w.navigate(target); return w.focus() }
      }
      return self.clients.openWindow(target)
    }),
  )
})
