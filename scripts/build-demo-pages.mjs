import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_ASSET_FILES = 20_000;
const sha1 = bytes => createHash('sha1').update(bytes).digest('hex');

async function filesUnder(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error(`Symlink is not a deployable asset: ${path}`);
    if (item.isDirectory()) result.push(...await filesUnder(path));
    else if (item.isFile()) result.push(path);
  }
  return result;
}

function assetPath(directory, url) {
  if (!url.startsWith('/') || url.startsWith('//') || /[?#\\]/.test(url)) {
    throw new Error(`Unsupported service-worker asset URL: ${url}`);
  }
  const path = resolve(directory, `.${decodeURIComponent(url)}`);
  if (!path.startsWith(`${resolve(directory)}${sep}`)) throw new Error(`Asset escapes output: ${url}`);
  return path;
}

export async function verifyServiceWorker(directory) {
  const manifest = JSON.parse(await readFile(join(directory, 'ngsw.json'), 'utf8'));
  if (!manifest.hashTable?.[manifest.index]) throw new Error('Service-worker index is not hashed.');
  for (const [url, expected] of Object.entries(manifest.hashTable)) {
    let contents;
    try { contents = await readFile(assetPath(directory, url)); }
    catch (error) { throw new Error(`Missing service-worker asset ${url}: ${error.message}`); }
    if (sha1(contents) !== expected) throw new Error(`Service-worker hash mismatch: ${url}`);
  }
  for (const group of manifest.assetGroups || []) {
    for (const url of group.urls || []) {
      if (!manifest.hashTable[url]) throw new Error(`Unhashed service-worker asset: ${url}`);
    }
  }
  await readFile(join(directory, 'ngsw-worker.js'));
  await readFile(join(directory, 'manifest.webmanifest'));
  return manifest;
}

// Only demo identity/SEO metadata changes. App scripts, styles, icons, CSP and
// service-worker recovery code remain intact; the changed HTML hash is rebuilt.
export function demoHtml(html) {
  return html
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*\b(?:name|property)=["'](?:og:url|msvalidate\.01)["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/(<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=)["'][^"']*["']/gi, '$1"noindex, nofollow"')
    .replace(/(<meta\b[^>]*\b(?:name|property)=["'](?:og:image|twitter:image)["'][^>]*\bcontent=)["'][^"']*["']/gi, '$1"/og-image.png"');
}

export async function checkAssetLimits(directory, { maxBytes = MAX_ASSET_BYTES, maxFiles = MAX_ASSET_FILES } = {}) {
  const files = await filesUnder(directory);
  if (files.length > maxFiles) throw new Error(`Pages asset count ${files.length} exceeds ${maxFiles}; no assets were removed.`);
  let largestBytes = 0;
  let largestFile = '';
  for (const file of files) {
    const { size } = await lstat(file);
    if (size > maxBytes) throw new Error(`Pages asset exceeds ${maxBytes} bytes: ${relative(directory, file)} (${size}); no assets were removed.`);
    if (size > largestBytes) { largestBytes = size; largestFile = relative(directory, file); }
  }
  return { files: files.length, largestFile, largestBytes };
}

export async function packageDemoPages({ sourceDir, targetDir, templateDir = join(ROOT, 'deploy/demo-pages') }) {
  sourceDir = resolve(sourceDir);
  targetDir = resolve(targetDir);
  if (sourceDir === targetDir || targetDir.startsWith(`${sourceDir}${sep}`) || sourceDir.startsWith(`${targetDir}${sep}`)) {
    throw new Error('Build source and deployment output must be separate directories.');
  }
  await checkAssetLimits(sourceDir);
  const ngsw = await verifyServiceWorker(sourceDir);
  if (ngsw.index !== '/index.csr.html') throw new Error('Expected the production CSR shell at /index.csr.html.');
  if ((await readdir(sourceDir)).includes('404.html')) {
    throw new Error('A root 404.html disables Pages SPA navigation fallback; review it before deployment.');
  }
  await mkdir(targetDir, { recursive: true });
  if ((await readdir(targetDir)).length) throw new Error('Deployment output must be empty to avoid stale assets.');
  for (const name of await readdir(sourceDir)) {
    await cp(join(sourceDir, name), join(targetDir, name), { recursive: true, errorOnExist: true, force: false });
  }

  const html = demoHtml(await readFile(join(sourceDir, 'index.csr.html'), 'utf8'));
  for (const name of ['index.csr.html', 'index.html']) await writeFile(join(targetDir, name), html);
  ngsw.hashTable['/index.csr.html'] = sha1(html);
  ngsw.hashTable['/index.html'] = sha1(html);
  ngsw.index = '/index.html';
  const shell = ngsw.assetGroups.find(group => group.urls?.includes('/index.csr.html'));
  if (!shell) throw new Error('The CSR shell is missing from service-worker asset groups.');
  if (!shell.urls.includes('/index.html')) shell.urls.push('/index.html');
  await writeFile(join(targetDir, 'ngsw.json'), `${JSON.stringify(ngsw, null, 2)}\n`);
  await cp(join(templateDir, 'worker.mjs'), join(targetDir, '_worker.js'));
  for (const name of ['_routes.json', '_headers']) await cp(join(templateDir, name), join(targetDir, name));
  await verifyServiceWorker(targetDir);
  return checkAssetLimits(targetDir);
}

async function main(args) {
  if (args.some(arg => !['--package-only', '--check-only'].includes(arg)) || args.length > 1) {
    throw new Error('Usage: node scripts/build-demo-pages.mjs [--package-only | --check-only]');
  }
  const sourceDir = join(ROOT, 'fe/dist/lms-demo/browser');
  const targetDir = join(ROOT, '.tools/demo-pages');
  if (args.includes('--check-only')) {
    await verifyServiceWorker(targetDir);
    console.log(JSON.stringify(await checkAssetLimits(targetDir), null, 2));
    return;
  }
  if (!args.includes('--package-only')) {
    // Do not run the inherited sitemap generator against the upstream LMS.
    const build = spawnSync(process.execPath, [join(ROOT, 'fe/node_modules/@angular/cli/bin/ng.js'),
      'build', '--configuration', 'production,demo', '--progress=false'], {
      cwd: join(ROOT, 'fe'), stdio: 'inherit',
      env: { ...process.env, SITEMAP_BASE_URL: 'http://127.0.0.1:9' },
    });
    if (build.error) throw build.error;
    if (build.status !== 0) throw new Error(`Angular demo build failed (exit ${build.status}).`);
  }
  await mkdir(join(ROOT, '.tools'), { recursive: true });
  const parent = await realpath(dirname(targetDir));
  if (parent !== await realpath(join(ROOT, '.tools'))) throw new Error('Unexpected deployment output parent.');
  try {
    const output = await lstat(targetDir);
    if (!output.isDirectory() || output.isSymbolicLink()) throw new Error('Deployment output must be a real directory.');
    // Fixed, resolved .tools/demo-pages only; source and user-selected paths are never deleted.
    await rm(targetDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const result = await packageDemoPages({ sourceDir, targetDir });
  console.log(`Pages output: ${targetDir}`);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
