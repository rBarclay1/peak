// Cache the current shell and its hashed assets, never API responses or personal data.
const CACHE = 'peak-shell-v2'
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const response = await fetch('/index.html', { cache: 'reload' })
      if (!response.ok) throw new Error('Could not update app shell')
      const html = await response.clone().text()
      const assets = [
        ...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g),
      ].map((match) => match[1])
      await cache.addAll(['/manifest.json', ...assets])
      await cache.put('/index.html', response)
      await self.skipWaiting()
    })(),
  )
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('peak-shell-') && key !== CACHE)
          await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url)
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          if (!response.ok) throw new Error('Navigation failed')
          const cache = await caches.open(CACHE)
          await cache.put('/index.html', response.clone())
          return response
        } catch {
          return (await caches.match('/index.html')) || Response.error()
        }
      })(),
    )
  } else if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      (async () => {
        // Hashed same-origin assets are identical across Origin header variants.
        const cached = await caches.match(request, { ignoreVary: true })
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok)
          await (await caches.open(CACHE)).put(request, response.clone())
        return response
      })(),
    )
  }
})
