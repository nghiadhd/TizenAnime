// Cloudflare Worker — dedicated to animevsub.app (replaces the old wibu47.vip
// source). Separate deploy from both TizenPhim's worker and TizenAnime's existing
// tizenanime-proxy (worker/proxy.js) — do not merge with either.
//
// Deploy: Workers & Pages → Create Worker → Edit code → paste → Deploy.
// After deploying, copy your workers.dev URL into app.js:
//   const AVS_PROXY = '...'

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Log relay: POST → TV is sending a log line (used by app.js's rlog()).
  if (request.method === 'POST') {
    const body = await request.text().catch(() => '(unreadable)');
    console.log('[TV]', body);
    return new Response('ok', { headers: corsHeaders() });
  }

  const reqUrl = new URL(request.url);
  const { searchParams } = reqUrl;

  // /fetch — CORS proxy for animevsub.app catalog/detail/watch pages.
  // Some pages 406 without a realistic header set, so always send one.
  if (reqUrl.pathname === '/fetch') {
    const target = searchParams.get('url');
    if (!target) return new Response('Missing url', { status: 400, headers: corsHeaders() });
    let host;
    try { host = new URL(target).hostname; } catch (_) {
      return new Response('Invalid url', { status: 400, headers: corsHeaders() });
    }
    if (!host.endsWith('animevsub.app')) {
      return new Response('Host not allowed', { status: 403, headers: corsHeaders() });
    }
    const r = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en;q=0.9',
        'Referer': 'https://animevsub.app/',
      },
    });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { ...corsHeaders(), 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // /hls — CORS proxy for the .m3u8 manifest only. No rewriting: segments are
  // hosted on Google's CDN and already send access-control-allow-origin: *,
  // so only the manifest itself (which lacks CORS headers) needs proxying.
  if (reqUrl.pathname === '/hls') {
    const target = searchParams.get('url');
    if (!target) return new Response('Missing url', { status: 400, headers: corsHeaders() });
    let host;
    try { host = new URL(target).hostname; } catch (_) {
      return new Response('Invalid url', { status: 400, headers: corsHeaders() });
    }
    // animevsub.app's ArtPlayer serves manifests from kkphimplayer* CDNs; the
    // exact host varies per title, so add new ones here if a stream 403s.
    const allowedHosts = ['kkphimplayer6.com', 'kkphimplayer.com', 'cdnphim.store', 'cdnphim.online'];
    if (!allowedHosts.some(h => host.endsWith(h))) {
      return new Response('Host not allowed: ' + host, { status: 403, headers: corsHeaders() });
    }
    const r = await fetch(target);
    return new Response(r.body, {
      status: r.status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/vnd.apple.mpegurl' },
    });
  }

  return new Response('Not found', { status: 404, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
