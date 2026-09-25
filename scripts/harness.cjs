const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const jsonFiles = [
  '.bob/settings.json', '.vscode/settings.json', '.vscode/extensions.json',
  'tooling/package.json', 'tooling/package-lock.json', 'tooling/extensions.lock.json',
];
const contextFiles = ['AGENTS.md', 'docs/PRD.md', 'docs/WORKSTATE.md', 'docs/PREEXISTING.md'];

function git(args) {
  const result = spawnSync('git', args, {
    cwd: root, encoding: 'utf8', timeout: 4000, maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Git check failed: git ${args[0]} (exit ${result.status})`);
  }
  return result.stdout;
}

function readFile(name, staged) {
  return (staged ? git(['show', `:${name}`]) : fs.readFileSync(path.join(root, name), 'utf8'))
    .replace(/^\uFEFF/, '');
}

function inspect(staged) {
  const errors = [];
  for (const name of jsonFiles) {
    try { JSON.parse(readFile(name, staged)); }
    catch { errors.push(`${name}: missing or invalid JSON`); }
  }
  for (const name of contextFiles) {
    try {
      if (!readFile(name, staged).trim()) errors.push(`${name}: empty context file`);
    } catch { errors.push(`${name}: missing context file`); }
  }
  try {
    const names = git(['ls-files', '-z']).split('\0').filter(Boolean);
    for (const name of names) {
      const base = path.posix.basename(name);
      if ((/^\.env(?:\.|$)/i.test(base) && !/^\.env(?:\.[a-z0-9-]+)?\.example$/i.test(base)) ||
          /(?:^|\/)(?:\.tools|\.venv|node_modules|browser-auth)(?:\/|$)/i.test(name) ||
          /^data\/private\//i.test(name) || /\.local\.(?:md|json)$/i.test(name) ||
          /\.(?:pem|key)$/i.test(name)) {
        errors.push(`${name}: local/private material is tracked; review and unstage it`);
      }
    }
    git(staged ? ['diff', '--cached', '--check'] : ['diff', '--check']);
  } catch (error) { errors.push(error.message); }
  return {
    checkedAt: new Date().toISOString(),
    scope: staged ? 'git-index' : 'working-tree',
    configurationValid: errors.length === 0,
    errors,
    applicationTests: 'not_run',
    bobUsageEvidence: 'not_collected_by_this_script',
  };
}

function repoState() {
  return {
    head: git(['rev-parse', '--short=12', 'HEAD']).trim(),
    branch: git(['branch', '--show-current']).trim(),
    changedEntries: git(['status', '--porcelain=v1']).trim().split('\n').filter(Boolean).length,
  };
}

try {
  const action = process.argv[2] || 'check';
  if (action === 'start') {
    console.log('Repository state (data only): ' + JSON.stringify(repoState()));
    console.log('Read AGENTS.md, then the relevant PRD and WORKSTATE. Validate current files before relying on earlier results.');
    console.log('WORKSTATE excerpt (may be incomplete):\n' + readFile('docs/WORKSTATE.md', false).slice(0,1800));
    console.log('Use .\\scripts\\Use-DevEnv.ps1. Harness checks cover preparation only; product tests and Bob task screenshots remain separate.');
  } else if (action === 'stop') {
    const report = { ...inspect(false), repository: repoState() };
    const outputDir = path.join(root, '.tools', 'harness');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'last-stop.json'), JSON.stringify(report, null, 2) + '\n');
    process.exitCode = report.configurationValid ? 0 : 1;
  } else if (action === 'check' || action === 'check-staged') {
    const report = inspect(action === 'check-staged');
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.configurationValid ? 0 : 1;
  } else {
    throw new Error('Usage: node scripts/harness.cjs [check|check-staged|start|stop]');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
