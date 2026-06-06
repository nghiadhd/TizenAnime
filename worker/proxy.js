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

  // Log relay: POST → TV is sending a log line
  if (request.method === 'POST') {
    const body = await request.text().catch(() => '(unreadable)');
    console.log('[TV]', body);
    return new Response('ok', { headers: corsHeaders() });
  }

  const reqUrl = new URL(request.url);
  const { searchParams } = reqUrl;

  // /app — serve latest app.js so index.html bypasses TizenBrew's file cache
  if (reqUrl.pathname === '/app') {
    const r = await fetch('https://raw.githubusercontent.com/nghiadhd-2702/TizenAnime3/main/app/app.js');
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' },
    });
  }

  // /fetch — general CORS proxy for wibu47.vip catalog/search pages
  if (reqUrl.pathname === '/fetch') {
    const fetchTarget = searchParams.get('url');
    if (!fetchTarget) return new Response('Missing url', { status: 400, headers: corsHeaders() });
    let fetchHost;
    try { fetchHost = new URL(fetchTarget).hostname; } catch (_) {
      return new Response('Invalid url', { status: 400, headers: corsHeaders() });
    }
    if (!fetchHost.endsWith('wibu47.vip') && !fetchHost.endsWith('streamc.xyz')) {
      return new Response('Host not allowed', { status: 403, headers: corsHeaders() });
    }
    const r = await fetch(fetchTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'vi,en;q=0.9',
      },
    });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { ...corsHeaders(), 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // /s/*.ts — segment proxy, with optional AES-GCM decryption
  if (reqUrl.pathname.startsWith('/s/')) {
    const segTarget  = searchParams.get('url');
    const segReferer = searchParams.get('ref') || '';
    const segKey     = searchParams.get('key') || '';  // hex AES-GCM key (kX)
    const segIv      = searchParams.get('iv')  || '';  // hex IV from #ENC-AESGCM
    if (!segTarget) return new Response('Missing url', { status: 400, headers: corsHeaders() });
    let segOrigin = 'https://embed1.streamc.xyz';
    try { if (segReferer) segOrigin = new URL(segReferer).origin; } catch (_) {}
    const seg = await fetch(segTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':     '*/*',
        'Origin':     segOrigin,
        'Referer':    segReferer || segOrigin + '/',
      },
    });
    if (segKey && segIv) {
      try {
        const keyBytes = hexToBytes(segKey);
        const ivBytes  = hexToBytes(segIv);
        const cipher   = await seg.arrayBuffer();
        const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
        const plain  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, cryptoKey, cipher);
        return new Response(plain, { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'video/mp2t' } });
      } catch (e) {
        console.log('[seg] decrypt failed:', e.message);
      }
    }
    return new Response(seg.body, {
      status: seg.status,
      headers: { ...corsHeaders(), 'Content-Type': 'video/mp2t' },
    });
  }

  const target  = searchParams.get('url');
  const referer = searchParams.get('ref') || '';
  const raw     = searchParams.get('raw') === '1';
  const passKey = searchParams.get('key') || '';   // AES-GCM key forwarded from app
  const rewrite = !raw && (searchParams.get('rewrite') === '1' || /\.m3u8(\?|$)/i.test(target || ''));

  if (!target) {
    return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders() });
  }

  let targetUrl;
  try { targetUrl = new URL(target); } catch (_) {
    return new Response('Invalid url', { status: 400, headers: corsHeaders() });
  }

  const h = targetUrl.hostname;
  let refHost = '';
  try { if (referer) refHost = new URL(referer).hostname; } catch (_) {}
  const trustedRef = refHost.endsWith('.streamc.xyz');
  const allowed = h.endsWith('.streamc.xyz') || /^saus\d+\.amass\d+\.top$/.test(h) || /\.amass\d+\.top$/.test(h) || /\.hihihoho\d+\.top$/.test(h) || trustedRef;
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
    const outType = /^image\//i.test(contentType) ? 'video/mp2t' : contentType;
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...corsHeaders(), 'Content-Type': outType },
    });
  }

  const text = await upstream.text();
  if (!upstream.ok || !text.startsWith('#EXTM3U')) {
    return new Response('bad m3u8: ' + text.substring(0, 120), { status: 502, headers: corsHeaders() });
  }

  const finalUrl   = upstream.url || target;
  const baseUrl    = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
  const encodedRef = encodeURIComponent(referer || origin + '/');
  const workerOrigin = reqUrl.origin;

  // Detect custom AES-GCM encrypted format: #ENC-AESGCM;iv=HEX
  let encIv = '';
  let encMode = false;
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^#ENC-AESGCM;iv=([0-9a-f]+)/i);
    if (m) { encIv = m[1]; encMode = true; break; }
  }

  const lines = text.split('\n');
  const outLines = [];
  let seenFirstSegment = false;
  let segIndex = 0;

  for (const line of lines) {
    const t = line.trim();
    if (!t) { outLines.push(''); continue; }
    if (t === '#EXT-X-DISCONTINUITY' && !seenFirstSegment) { outLines.push(''); continue; }
    if (t.startsWith('#EXTINF')) seenFirstSegment = true;
    // Strip non-standard tags
    if (t.startsWith('#ENC-') || t.startsWith('#EXT-X-B65')) { outLines.push(''); continue; }
    if (t.startsWith('#EXT-X-KEY') || t.startsWith('#EXT-X-MAP') || t.startsWith('#EXT-X-MEDIA')) {
      outLines.push(t.replace(/URI="([^"]+)"/, (_, uri) => {
        const abs = uri.startsWith('http') ? uri : baseUrl + uri;
        return 'URI="' + workerOrigin + '/?url=' + encodeURIComponent(abs) + '&ref=' + encodedRef + '"';
      }));
      continue;
    }
    if (t.startsWith('#')) { outLines.push(line); continue; }

    // Segment line
    if (encMode && passKey && encIv && !t.startsWith('http')) {
      // Segment line is base64 AES-GCM ciphertext — decrypt to get real CDN URL
      try {
        const cipher    = base64ToBytes(t.replace(/\s/g, ''));
        const keyBytes  = hexToBytes(passKey);
        const ivBytes   = hexToBytes(encIv);
        const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
        const plain     = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, cryptoKey, cipher);
        const realUrl   = new TextDecoder().decode(plain).trim();
        console.log('[m3u8] decrypted seg URL:', realUrl.substring(0, 80));
        // Inject EXTINF if missing, then segment proxy URL
        if (!outLines.some(l => l.startsWith('#EXTINF'))) {
          outLines.push('#EXT-X-TARGETDURATION:10');
          outLines.push('#EXT-X-MEDIA-SEQUENCE:0');
        }
        outLines.push('#EXTINF:10.0,');
        outLines.push(workerOrigin + '/s/seg' + segIndex + '.ts?url=' + encodeURIComponent(realUrl) + '&ref=' + encodedRef);
        segIndex++;
      } catch (e) {
        console.log('[m3u8] decrypt error:', e.message);
      }
      continue;
    }

    const abs = t.startsWith('http') ? t : baseUrl + t;
    if (/\.m3u8(\?|$)/i.test(abs)) {
      outLines.push(workerOrigin + '/?url=' + encodeURIComponent(abs) + '&ref=' + encodedRef + '&rewrite=1' + (passKey ? '&key=' + passKey : ''));
      continue;
    }
    outLines.push('#EXTINF:10.0,');
    const fname = (abs.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '') || 'seg');
    outLines.push(workerOrigin + '/s/' + fname + '.ts?url=' + encodeURIComponent(abs) + '&ref=' + encodedRef);
  }

  if (encMode && segIndex > 0) outLines.push('#EXT-X-ENDLIST');

  const rewritten = outLines.join('\n');

  return new Response(rewritten, {
    status: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/vnd.apple.mpegurl' },
  });
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
