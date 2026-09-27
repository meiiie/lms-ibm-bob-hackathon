import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY = 'meiiie/lms-ibm-bob-hackathon';

export function validateRelease(run, mainSha) {
  if (run.repository?.full_name !== REPOSITORY ||
      run.head_repository?.full_name !== REPOSITORY ||
      run.path !== '.github/workflows/ci.yml' || run.head_branch !== 'main' ||
      !['push', 'workflow_dispatch'].includes(run.event) ||
      run.status !== 'completed' || run.conclusion !== 'success' ||
      !/^[a-f0-9]{40}$/.test(run.head_sha) || !Number.isSafeInteger(run.id)) {
    throw new Error('Release requires successful CI from this repository main branch.');
  }
  return run.head_sha === mainSha;
}

async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GitHub release lookup failed (${response.status}).`);
  return response.json();
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Demo deployment only runs from the fork main branch.');
  }
  const runId = process.env.CI_RUN_ID;
  if (!/^\d+$/.test(runId ?? '')) throw new Error('A numeric CI run ID is required.');
  const [run, branch] = await Promise.all([api(`actions/runs/${runId}`), api('git/ref/heads/main')]);
  const current = validateRelease(run, branch.object.sha);
  await appendFile(process.env.GITHUB_OUTPUT, `current=${current}\nsha=${run.head_sha}\nrun_id=${run.id}\n`);
  if (!current) console.log('Skipped: this CI revision has been superseded on main.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
