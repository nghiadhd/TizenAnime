// Cloudflare Worker — paste into the dashboard editor (no build needed).
// Workers & Pages → Create Worker → Edit code → paste → Deploy.
// After deploying, copy your workers.dev URL into app.js: const HLS_PROXY = '...'

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Log relay: POST without ?url= → TV is sending a log line
  if (request.method === 'POST') {
    const body = await request.text().catch(() => '(unreadable)');
    console.log('[TV]', body);
    return new Response('ok', { headers: corsHeaders() });
  }

  const reqUrl = new URL(request.url);
  const { searchParams } = reqUrl;
  const target  = searchParams.get('url');
  const referer = searchParams.get('ref') || '';
  const raw     = searchParams.get('raw') === '1';  // opt-out of auto-rewrite (desktop buildProxyM3u8)
  const rewrite = !raw && (searchParams.get('rewrite') === '1' || /\.m3u8(\?|$)/i.test(target || ''));

  if (!target) {
    return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders() });
  }

  let targetUrl;
  try { targetUrl = new URL(target); } catch (_) {
    return new Response('Invalid url', { status: 400, headers: corsHeaders() });
  }

  const h = targetUrl.hostname;
  // Known embed/CDN hosts. Also allow any host when the request arrives via a
  // trusted embed referer — covers segment CDNs that vary by episode.
  let refHost = '';
  try { if (referer) refHost = new URL(referer).hostname; } catch (_) {}
  const trustedRef = refHost.endsWith('.streamc.xyz');
  const allowed = h.endsWith('.streamc.xyz') || /^saus\d+\.amass\d+\.top$/.test(h) || trustedRef;
  if (!allowed) {
    return new Response('Host not allowed: ' + h, { status: 403, headers: corsHeaders() });
  }

  let origin = 'https://embed1.streamc.xyz';
  try { if (referer) origin = new URL(referer).origin; } catch (_) {}

  const upstream = await fetch(target, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':     '*/*',
      'Origin':     origin,
      'Referer':    referer || origin + '/',
    },
  });

  const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';

  if (!rewrite) {
    // Segments disguised as images (e.g. .png filenames): force video/mp2t so
    // Tizen's media pipeline doesn't try to decode them as image data.
    const outType = /^image\//i.test(contentType) ? 'video/mp2t' : contentType;
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...corsHeaders(), 'Content-Type': outType },
    });
  }

  // Rewrite every URL in the m3u8 to route through this worker.
  // Auto-triggered for any *.m3u8 URL (catches un-marked nested variant playlists)
  // unless ?raw=1 is set (desktop buildProxyM3u8 does its own rewriting).
  const text = await upstream.text();
  if (!upstream.ok || !text.startsWith('#EXTM3U')) {
    return new Response('bad m3u8: ' + text.substring(0, 120), { status: 502, headers: corsHeaders() });
  }

  const finalUrl   = upstream.url || target;
  const baseUrl    = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
  const workerBase = reqUrl.origin + '/?';
  const encodedRef = encodeURIComponent(referer || origin + '/');

  let seenFirstSegment = false;
  const rewritten = text.split('\n').map(line => {
    const t = line.trim();
    if (!t) return line;
    // Drop leading #EXT-X-DISCONTINUITY (before first segment) — Tizen rejects it
    if (t === '#EXT-X-DISCONTINUITY' && !seenFirstSegment) return '';
    if (t.startsWith('#EXTINF')) seenFirstSegment = true;
    // Rewrite URI="..." inside tags that reference external resources
    if (t.startsWith('#EXT-X-KEY') || t.startsWith('#EXT-X-MAP') || t.startsWith('#EXT-X-MEDIA')) {
      return t.replace(/URI="([^"]+)"/, (_, uri) => {
        const abs = uri.startsWith('http') ? uri : baseUrl + uri;
        return 'URI="' + workerBase + 'url=' + encodeURIComponent(abs) + '&ref=' + encodedRef + '"';
      });
    }
    if (t.startsWith('#')) return line;
    const abs = t.startsWith('http') ? t : baseUrl + t;
    // Variant playlists need ?rewrite=1 so their segments are also rewritten
    const extra = /\.m3u8(\?|$)/i.test(abs) ? '&rewrite=1' : '';
    return workerBase + 'url=' + encodeURIComponent(abs) + '&ref=' + encodedRef + extra;
  }).join('\n');

  return new Response(rewritten, {
    status: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/vnd.apple.mpegurl' },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
