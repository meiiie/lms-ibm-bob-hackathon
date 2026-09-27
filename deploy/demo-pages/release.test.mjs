import assert from 'node:assert/strict';
import test from 'node:test';
import { REPOSITORY, validateRelease } from '../../scripts/demo-release.mjs';

const sha = 'a'.repeat(40);
const passing = {
  repository: { full_name: REPOSITORY }, head_repository: { full_name: REPOSITORY },
  path: '.github/workflows/ci.yml', head_branch: 'main', head_sha: sha,
  event: 'push', status: 'completed', conclusion: 'success', id: 123,
};
test('deploys only the successful current main revision; skips a stale successful run', () => {
  assert.equal(validateRelease(passing, sha), true);
  assert.equal(validateRelease(passing, 'b'.repeat(40)), false);
});
test('rejects PR artifacts, foreign repositories, wrong workflows and incomplete CI', () => {
  for (const override of [
    { event: 'pull_request' }, { head_branch: 'codex/test' },
    { repository: { full_name: 'another/repo' } },
    { head_repository: { full_name: 'another/repo' } },
    { path: '.github/workflows/demo-deploy.yml' },
    { status: 'in_progress' }, { conclusion: 'failure' }, { head_sha: 'bad' },
  ]) assert.throws(() => validateRelease({ ...passing, ...override }, sha));
});
