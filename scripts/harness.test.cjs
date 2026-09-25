const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const testRoot = path.join(root, '.tools', 'harness-tests');
fs.mkdirSync(testRoot, { recursive: true });

function run(cwd, cmd, args) {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 15000, windowsHide: true });
}
function git(cwd, ...args) {
  const result = run(cwd, 'git', args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function fixture() {
  const dir = fs.mkdtempSync(path.join(testRoot, 'case-'));
  for (const name of [
    '.bob/settings.json', '.vscode/settings.json', '.vscode/extensions.json',
    'tooling/package.json', 'tooling/package-lock.json', 'tooling/extensions.lock.json',
    'AGENTS.md', 'docs/PRD.md', 'docs/WORKSTATE.md', 'docs/PREEXISTING.md',
    'scripts/harness.cjs', '.githooks/pre-commit', '.gitignore', '.gitattributes',
  ]) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, name), target);
  }
  git(dir, 'init', '-q');
  git(dir, 'add', '.');
  git(dir, '-c', 'user.name=Harness test', '-c', 'user.email=harness@example.invalid',
    '-c', 'core.hooksPath=.no-test-hooks', 'commit', '-qm', 'fixture');
  return dir;
}
function check(dir, action) { return run(dir, process.execPath, ['scripts/harness.cjs', action]); }

test('staged check reads the index, including when the working copy was repaired', () => {
  const dir = fixture();
  const file = path.join(dir, '.vscode/settings.json');
  const original = fs.readFileSync(file);
  fs.writeFileSync(file, '{broken');
  git(dir, 'add', '.vscode/settings.json');
  fs.writeFileSync(file, original);
  assert.equal(check(dir, 'check-staged').status, 1);
  git(dir, 'add', '.vscode/settings.json');
  fs.writeFileSync(file, '{broken');
  assert.equal(check(dir, 'check-staged').status, 0);
  assert.equal(check(dir, 'check').status, 1);
});

test('forced tracked environment file is rejected', () => {
  const dir = fixture();
  fs.writeFileSync(path.join(dir, '.env'), 'FAKE_VALUE=fixture\n');
  git(dir, 'add', '-f', '.env');
  const result = check(dir, 'check-staged');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /local\/private material/);
});

test('session hooks produce bounded context and local diagnostics without claiming product tests', () => {
  const dir = fixture();
  const start = check(dir, 'start');
  assert.equal(start.status, 0);
  assert.ok(start.stdout.length < 3000);
  const stop = check(dir, 'stop');
  assert.equal(stop.status, 0);
  const report = JSON.parse(fs.readFileSync(path.join(dir, '.tools/harness/last-stop.json')));
  assert.equal(report.configurationValid, true);
  assert.equal(report.applicationTests, 'not_run');
  assert.equal(report.bobUsageEvidence, 'not_collected_by_this_script');
  assert.equal(git(dir, 'status', '--porcelain').trim(), '');
});

test('LMS environment examples are allowed, real environment files are rejected', () => {
  const dir = fixture();
  for (const name of ['.env.dev.example', '.env.prod.example', '.env.video-worker.example']) {
    fs.writeFileSync(path.join(dir, name), 'EXAMPLE_VALUE=placeholder\n');
    git(dir, 'add', name);
  }
  assert.equal(check(dir, 'check-staged').status, 0);
  fs.writeFileSync(path.join(dir, '.env.production'), 'FAKE_VALUE=fixture\n');
  git(dir, 'add', '-f', '.env.production');
  assert.equal(check(dir, 'check-staged').status, 1);
});
