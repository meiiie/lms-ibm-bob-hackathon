import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkAssetLimits, demoHtml, packageDemoPages, verifyServiceWorker } from '../../scripts/build-demo-pages.mjs';

const html = '<!doctype html><html><head><meta name="robots" content="index, follow">' +
  '<link rel="canonical" href="https://holilihu.online/"><meta property="og:url" content="https://holilihu.online/">' +
  '<meta property="og:image" content="https://holilihu.online/og-image.png">' +
  '<script type="application/ld+json">{"url":"https://holilihu.online"}</script>' +
  '</head><body><app-root></app-root><script src="main-FIXTURE.js"></script></body></html>';
const hash = content => createHash('sha1').update(content).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lms-demo-pages-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = join(root, 'browser');
  const targetDir = join(root, 'pages');
  await mkdir(sourceDir);
  const files = {
    'index.csr.html': html,
    'main-FIXTURE.js': '/* synthetic Angular fixture */',
    'chunk-FIXTURE.js': '/* synthetic lazy course feature */',
    'manifest.webmanifest': '{"name":"Synthetic fixture","start_url":"/"}',
    'ngsw-worker.js': '/* synthetic service worker */',
  };
  for (const [name, contents] of Object.entries(files)) await writeFile(join(sourceDir, name), contents);
  const manifest = {
    configVersion: 1, index: '/index.csr.html',
    assetGroups: [{ name: 'app-shell', urls: Object.keys(files).map(name => `/${name}`) }],
    dataGroups: [{ name: 'existing-course-cache', synthetic: true }],
    hashTable: Object.fromEntries(Object.entries(files).map(([name, content]) => [`/${name}`, hash(content)])),
  };
  await writeFile(join(sourceDir, 'ngsw.json'), JSON.stringify(manifest));
  return { root, sourceDir, targetDir, manifest, files };
}

test('packages all assets and both shells; every SW hash matches and source remains untouched', async t => {
  const f = await fixture(t);
  const result = await packageDemoPages(f);
  assert.ok(result.files >= Object.keys(f.files).length + 4);
  assert.equal(await readFile(join(f.sourceDir, 'index.csr.html'), 'utf8'), html);
  const shell = await readFile(join(f.targetDir, 'index.html'), 'utf8');
  assert.equal(shell, await readFile(join(f.targetDir, 'index.csr.html'), 'utf8'));
  assert.match(shell, /noindex, nofollow/);
  assert.doesNotMatch(shell, /holilihu\.online/);
  for (const name of ['main-FIXTURE.js', 'chunk-FIXTURE.js', 'manifest.webmanifest', 'ngsw-worker.js']) {
    assert.equal(await readFile(join(f.targetDir, name), 'utf8'), f.files[name]);
  }
  const manifest = await verifyServiceWorker(f.targetDir);
  assert.equal(manifest.index, '/index.html');
  assert.equal(manifest.hashTable['/index.html'], hash(shell));
  assert.equal(manifest.hashTable['/index.csr.html'], hash(shell));
  assert.deepEqual(manifest.dataGroups, f.manifest.dataGroups);
  assert.match(await readFile(join(f.targetDir, '_worker.js'), 'utf8'), /BACKEND_ORIGIN/);
});

test('missing and corrupted SW assets fail rather than silently losing an offline feature', async t => {
  const f = await fixture(t);
  await rm(join(f.sourceDir, 'chunk-FIXTURE.js'));
  await assert.rejects(packageDemoPages(f), /Missing service-worker asset \/chunk-FIXTURE.js/);
  await writeFile(join(f.sourceDir, 'chunk-FIXTURE.js'), 'corrupted');
  await assert.rejects(packageDemoPages(f), /hash mismatch: \/chunk-FIXTURE.js/);
});

test('oversized assets and excessive file counts fail with no file deletion', async t => {
  const f = await fixture(t);
  await assert.rejects(checkAssetLimits(f.sourceDir, { maxBytes: 10 }), /exceeds 10 bytes/);
  await assert.rejects(checkAssetLimits(f.sourceDir, { maxFiles: 2 }), /asset count .* exceeds 2/);
  assert.equal(await readFile(join(f.sourceDir, 'main-FIXTURE.js'), 'utf8'), f.files['main-FIXTURE.js']);
});

test('unsafe manifest paths and root404 are rejected before deployment', async t => {
  const f = await fixture(t);
  f.manifest.hashTable['/../outside'] = hash('outside');
  await writeFile(join(f.sourceDir, 'ngsw.json'), JSON.stringify(f.manifest));
  await assert.rejects(packageDemoPages(f), /Asset escapes output/);
  delete f.manifest.hashTable['/../outside'];
  await writeFile(join(f.sourceDir, 'ngsw.json'), JSON.stringify(f.manifest));
  await writeFile(join(f.sourceDir, '404.html'), 'inherited missing-page feature');
  await assert.rejects(packageDemoPages(f), /root 404.html disables Pages SPA/);
});

test('source and output cannot overlap, and stale output is not merged', async t => {
  const f = await fixture(t);
  await assert.rejects(packageDemoPages({ ...f, targetDir: f.sourceDir }), /separate directories/);
  await mkdir(f.targetDir);
  await writeFile(join(f.targetDir, 'stale.js'), 'old feature');
  await assert.rejects(packageDemoPages(f), /output must be empty/);
});

test('HTML adjustment preserves app code and explicit CSP', () => {
  const content = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">' + html;
  const transformed = demoHtml(content);
  assert.match(transformed, /default-src 'self'/);
  assert.match(transformed, /<script src="main-FIXTURE.js"><\/script>/);
  assert.match(transformed, /content="\/og-image.png"/);
});
