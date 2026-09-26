import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker, { isBackendPath } from './worker.mjs';

const origin = 'https://lms-demo.pages.dev';
const backend = 'https://isolated-backend.example';
const env = { BACKEND_ORIGIN: backend, ASSETS: { fetch: async () => new Response('static asset') } };

test('only exact backend path families invoke the proxy; static assets remain direct', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected upstream request'); });
  for (const path of ['/api', '/api/v3/auth/login', '/ws', '/uploads/course.pdf']) assert.ok(isBackendPath(path));
  for (const path of ['/api-evil', '/uploads-other', '/actuator/health', '/student/course/1', '/ngsw-worker.js']) {
    assert.equal(isBackendPath(path), false);
    assert.equal(await (await worker.fetch(new Request(origin + path), env)).text(), 'static asset');
  }
  const routes = JSON.parse(await readFile(new URL('./_routes.json', import.meta.url), 'utf8'));
  assert.deepEqual(routes.include, ['/api', '/api/*', '/ws', '/ws/*', '/uploads', '/uploads/*']);
  assert.deepEqual(routes.exclude, []);
});

test('missing, insecure, credential-bearing, path-bearing and self-loop origins fail closed', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', () => { calls++; throw new Error('Unexpected upstream'); });
  for (const value of [undefined, '', 'http://localhost:8088', 'https://user:secret@backend.example',
    `${backend}/api`, `${backend}/?target=evil`, `${backend}/#secret`, origin]) {
    const response = await worker.fetch(new Request(`${origin}/api/v3/auth/login`), { ...env, BACKEND_ORIGIN: value });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'demo_backend_unconfigured');
  }
  assert.equal(calls, 0);
});

test('authenticated POST streams only to fixed backend and discards spoofed forwarding headers', async t => {
  let observed;
  t.mock.method(globalThis, 'fetch', async (request, options) => {
    observed = { request, options, body: await request.text() };
    return Response.json({ success: true }, { headers: {
      'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*',
      'Set-Cookie': 'demo=opaque; HttpOnly; Secure; SameSite=Lax',
    } });
  });
  const response = await worker.fetch(new Request(`${origin}/api/v3/auth/login?url=https://attacker.example`, {
    method: 'POST', body: '{"synthetic":"fixture"}', headers: {
      'Authorization': 'Bearer synthetic-test-token', 'Content-Type': 'application/json', 'Origin': origin,
      'Cookie': 'demo=synthetic', 'Forwarded': 'host=attacker.example', 'X-Forwarded-Host': 'attacker.example',
      'X-Forwarded-For': '127.0.0.1', 'CF-Connecting-IP': '127.0.0.1', 'X-User-Role': 'ADMIN',
    },
  }), env);
  assert.equal(observed.request.url, `${backend}/api/v3/auth/login?url=https://attacker.example`);
  assert.equal(observed.request.redirect, 'manual');
  assert.equal(observed.body, '{"synthetic":"fixture"}');
  assert.equal(observed.request.headers.get('authorization'), 'Bearer synthetic-test-token');
  assert.equal(observed.request.headers.get('cookie'), 'demo=synthetic');
  assert.equal(observed.request.headers.get('x-forwarded-host'), 'lms-demo.pages.dev');
  assert.equal(observed.request.headers.get('x-forwarded-proto'), 'https');
  for (const name of ['forwarded', 'x-forwarded-for', 'cf-connecting-ip', 'x-user-role']) {
    assert.equal(observed.request.headers.get(name), null);
  }
  assert.deepEqual(observed.options.cf, { cacheEverything: false, cacheTtl: 0 });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
});

test('cross-origin browser requests cannot send credentials through the demo', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', () => { calls++; throw new Error('Unexpected upstream'); });
  for (const requestOrigin of ['https://attacker.example', 'null']) {
    const response = await worker.fetch(new Request(`${origin}/api/v3/auth/login`, {
      method: 'POST', headers: { origin: requestOrigin },
    }), env);
    assert.equal(response.status, 403);
  }
  assert.equal(calls, 0);
});

test('redirects are never followed, only allowed same-backend routes are rewritten', async t => {
  let location = `${backend}/api/v3/files/view/next?ticket=synthetic`;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location } });
  });
  const response = await worker.fetch(new Request(`${origin}/api/v3/files/view/one`), env);
  assert.equal(response.headers.get('location'), `${origin}/api/v3/files/view/next?ticket=synthetic`);
  for (location of ['https://attacker.example/steal', '//attacker.example', `${backend}/actuator`, '/not-api']) {
    const blocked = await worker.fetch(new Request(`${origin}/api/v3/files/view/one`), env);
    assert.equal(blocked.status, 502);
    assert.equal((await blocked.json()).error.code, 'demo_redirect_blocked');
  }
  assert.equal(calls, 5);
});

test('upload range responses and WebSocket upgrade objects are preserved', async t => {
  const socketResponse = { status: 101, webSocket: { synthetic: true } };
  t.mock.method(globalThis, 'fetch', async request => {
    if (request.headers.get('upgrade') === 'websocket') {
      assert.equal(request.url, `${backend}/ws`);
      assert.equal(request.headers.get('sec-websocket-protocol'), 'v12.stomp');
      return socketResponse;
    }
    assert.equal(request.headers.get('range'), 'bytes=0-3');
    return new Response('data', { status: 206, headers: { 'content-range': 'bytes 0-3/9' } });
  });
  const partial = await worker.fetch(new Request(`${origin}/uploads/course.pdf`, { headers: { range: 'bytes=0-3' } }), env);
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), 'bytes 0-3/9');
  assert.equal(await partial.text(), 'data');
  const socket = await worker.fetch(new Request(`${origin}/ws`, {
    headers: { upgrade: 'websocket', origin, 'sec-websocket-protocol': 'v12.stomp' },
  }), env);
  assert.equal(socket, socketResponse);
  assert.equal((await worker.fetch(new Request(`${origin}/api/v3/test`, { headers: { upgrade: 'websocket' } }), env)).status, 400);
});

test('network failure returns safe no-store error with no upstream diagnostics', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private backend diagnostic'); });
  const response = await worker.fetch(new Request(`${origin}/api/v3/auth/login`), env);
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.doesNotMatch(await response.text(), /private backend diagnostic/);
});
