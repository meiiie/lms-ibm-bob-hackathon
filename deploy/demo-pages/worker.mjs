const REQUEST_HEADERS = [
  'accept', 'accept-language', 'authorization', 'content-type', 'cookie',
  'origin', 'range', 'if-range', 'if-none-match', 'if-modified-since',
  'x-xsrf-token', 'x-csrf-token', 'sec-websocket-key', 'sec-websocket-version',
  'sec-websocket-protocol', 'sec-websocket-extensions',
];

export function isBackendPath(pathname) {
  return ['/api', '/ws', '/uploads'].some(path => pathname === path || pathname.startsWith(`${path}/`));
}

function failure(status, code, message) {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function backendOrigin(value, publicOrigin) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' ||
        url.search || url.hash || url.origin === publicOrigin) return null;
    return url;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    if (!isBackendPath(incoming.pathname)) return env.ASSETS.fetch(request);
    const backend = backendOrigin(env.BACKEND_ORIGIN, incoming.origin);
    if (!backend) return failure(503, 'demo_backend_unconfigured', 'The demo backend is not configured.');

    const origin = request.headers.get('origin');
    if (origin && origin !== incoming.origin) {
      return failure(403, 'cross_origin_request', 'Use this demo from its own website.');
    }

    // Assign path and query independently: even //host or a URL query parameter
    // cannot replace the one administrator-configured upstream origin.
    backend.pathname = incoming.pathname;
    backend.search = incoming.search;
    const headers = new Headers();
    for (const name of REQUEST_HEADERS) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    headers.set('x-forwarded-host', incoming.host);
    headers.set('x-forwarded-proto', 'https');
    headers.set('cache-control', 'no-store');
    const isWebSocket = request.headers.get('upgrade')?.toLowerCase() === 'websocket';
    if (isWebSocket) {
      if (incoming.pathname !== '/ws' && !incoming.pathname.startsWith('/ws/')) {
        return failure(400, 'invalid_upgrade', 'WebSocket upgrades are supported only at /ws.');
      }
      headers.set('upgrade', 'websocket');
      headers.set('connection', 'Upgrade');
    }

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = new Request(backend, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: 'half' } : {}),
      redirect: 'manual',
      signal: request.signal,
    });

    let response;
    try {
      response = await fetch(upstream, { cf: { cacheEverything: false, cacheTtl: 0 } });
    } catch {
      return failure(502, 'demo_backend_unavailable', 'The demo backend is temporarily unavailable.');
    }
    // Preserve the Workers WebSocket response without reconstructing its socket.
    if (response.status === 101) return response;

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Cache-Control', 'private, no-store');
    responseHeaders.set('CDN-Cache-Control', 'no-store');
    responseHeaders.set('Cloudflare-CDN-Cache-Control', 'no-store');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    for (const name of ['access-control-allow-origin', 'access-control-allow-credentials',
      'access-control-allow-headers', 'access-control-allow-methods', 'server',
      'x-powered-by', 'connection', 'transfer-encoding']) responseHeaders.delete(name);

    const location = responseHeaders.get('location');
    if (location && response.status >= 300 && response.status < 400) {
      let destination;
      try { destination = new URL(location, backend); } catch { /* reject below */ }
      if (!destination || destination.origin !== backend.origin || !isBackendPath(destination.pathname)) {
        await response.body?.cancel();
        return failure(502, 'demo_redirect_blocked', 'The demo backend returned an unsupported redirect.');
      }
      responseHeaders.set('location', `${incoming.origin}${destination.pathname}${destination.search}${destination.hash}`);
    }

    return new Response(response.body, {
      status: response.status, statusText: response.statusText, headers: responseHeaders,
    });
  },
};
