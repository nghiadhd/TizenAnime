'use strict';

const http  = require('http');
const https = require('https');

const PORT    = 7777;
// CDN hostnames and segment paths vary by episode/provider. Keep a strict
// allowlist on protocol + media-related extension instead of fixed path shapes.
const SEG_PATTERN = /^https?:\/\/[^/?#]+\/[^?#]+\.(?:m3u8|m4s|mp4|m4a|aac|ts|webvtt|vtt|key|png)(?:$|[?#])/i;


function proxySeg(targetUrl, referer, rangeHeader, res) {
  const u = new URL(targetUrl);
  if (!SEG_PATTERN.test(targetUrl)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  const client = u.protocol === 'http:' ? http : https;
  let origin = 'https://embed1.streamc.xyz';
  try { origin = new URL(referer).origin; } catch (_) {}
  const upstreamHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer':    referer || (origin + '/'),
    'Origin':     origin,
    'Accept':     '*/*',
  };
  if (rangeHeader) upstreamHeaders.Range = rangeHeader;

  const req2 = client.get({
    hostname: u.hostname,
    protocol: u.protocol,
    port:     u.port || undefined,
    path:     u.pathname + u.search,
    headers:  upstreamHeaders,
  }, upstream => {
    const passthrough = {
      'Content-Type': upstream.headers['content-type'] || 'application/octet-stream',
      'Cache-Control': upstream.headers['cache-control'] || 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    };
    if (upstream.headers['content-length']) passthrough['Content-Length'] = upstream.headers['content-length'];
    if (upstream.headers['content-range'])  passthrough['Content-Range'] = upstream.headers['content-range'];
    if (upstream.headers['accept-ranges'])  passthrough['Accept-Ranges'] = upstream.headers['accept-ranges'];
    if (upstream.headers.etag)              passthrough.ETag = upstream.headers.etag;
    if (upstream.headers['last-modified'])  passthrough['Last-Modified'] = upstream.headers['last-modified'];

    res.writeHead(upstream.statusCode || 200, passthrough);
    upstream.pipe(res);
  });
  req2.on('error', () => { if (!res.headersSent) { res.writeHead(500); res.end(); } });
  req2.setTimeout(20000, () => req2.destroy());
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/seg') {
    const target = url.searchParams.get('url');
    const ref    = url.searchParams.get('ref') || 'https://embed1.streamc.xyz/';
    const range  = req.headers.range || '';
    if (!target) { res.writeHead(400); res.end('missing url'); return; }
    try { proxySeg(target, ref, range, res); }
    catch (e) { res.writeHead(400); res.end(e.message); }
    return;
  }

  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`TizenAnime segment proxy running on port ${PORT}`));
