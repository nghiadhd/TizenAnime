const HLS_CACHE   = 'tizenanime-hls-v1';
const SEG_SERVICE = 'http://localhost:7777/seg';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Serve stored m3u8 content from Cache API
  if (url.pathname.startsWith('/hls/')) {
    e.respondWith(
      caches.open(HLS_CACHE)
        .then(c => c.match(e.request))
        .then(r => r || new Response('Not found', { status: 404 }))
    );
    return;
  }

  // Forward segment requests to the local service, which sends the correct
  // embed host as Origin/Referer (the CDN validates against the specific embedN host used).
  if (url.pathname === '/seg-proxy') {
    const segUrl = url.searchParams.get('url');
    const segRef = url.searchParams.get('ref') || 'https%3A%2F%2Fembed1.streamc.xyz%2F';
    const serviceUrl = SEG_SERVICE + '?url=' + encodeURIComponent(segUrl) + '&ref=' + segRef;
    e.respondWith(fetch(serviceUrl));
  }
});
