# Current work state

Updated 26 September 2026, Vietnam (UTC+7).

## Goal and decisions

Prepare the Neko Core submission fork of LMS for work in IBM Bob. The owner has
authorized merging the prepared MIT transition, then creating the submission
fork and adapting the existing Bob preparation kit. A teammate understands and
has run the LMS. Exact hackathon scope remains proposed in PRD.

## Preparation in this checkout

Eight Bob skills, three modes, lifecycle hooks, Git staged checks, a pinned Node
runtime installer, browser tooling, Java/Angular editor recommendations, first-task
prompt, submission templates and evidence directories are configured.
This setup is Codex work, not a new LMS feature or Bob usage evidence.
The tracked upstream machine-local Claude permissions file is removed in the
fork; inherited production image publishing/deployment is guarded to upstream.

## Verification checkpoint

- MIT transition at source commit a4b7028: local 1,283 backend tests passed;
  frontend npm ci/build passed under Node 24.21.0 with existing Angular/CommonJS
  warnings and the documented offline sitemap fallback. License copies agree.
- Upstream PR: https://github.com/linhlinhlin/LMS_hohulili/pull/541
- PR #541 merged after all five CI checks passed (backend, frontend, worker,
  Compose and Docker app smoke). Merge: `34c3f0f204510e67aa0b26d3373866dde46cc131`.
  Merge time: 26 September 2026 00:39:07 Vietnam (UTC+7). The merge message skips
  push workflows to avoid triggering the upstream production deployment.
- Public fork created from that merge: https://github.com/meiiie/lms-ibm-bob-hackathon
- Standalone clone: `E:\Sach\Sua\LMS-IBM-Bob-Hackathon`; `origin` is the submission
  fork and `upstream` is the original LMS. The owner's dirty LMS checkout remains
  separate. Git/GitHub defaults in this clone point to the submission fork.
- PASS: `node --test scripts/harness.test.cjs` (4 tests); `harness.cjs check` and
  `check-staged`; manual SessionStart/Stop commands; PowerShell parse and YAML checks.
- PASS: `scripts/Check-Setup.ps1` (Bob 2.2.0, 8 pinned extensions, 8 skills, Node
  24.21.0, Playwright CLI 0.1.21, Java 21.0.8, Maven 3.9.11), with Docker-daemon warning.
- PASS: `scripts/Check-Browser.ps1` real Chrome form assertion, using a synthetic
  fixture. This is tooling verification, not an LMS browser acceptance test.
- Installed pre-commit in this standalone clone; no shared hooksPath override.
  The fork CI now includes the same Bob harness checks.
- App sources, app lockfiles, SDK and license files match the merged upstream
  revision. No further app tests are inferred from the setup-only changes.
- PASS: frontend dependencies installed in this clone with `npm.cmd ci
  --no-audit --no-fund` (806 packages, existing deprecation/install-script warnings).
- PASS: dev and prod Compose configuration validation; new setup documentation
  links, empty evidence manifest and upstream-only production guards checked.
- Docker Desktop startup was attempted, but the local daemon remains unavailable.
  Local Compose app startup is not verified. Upstream PR Docker smoke passed in
  GitHub Actions; it does not establish that Docker is working on this machine.
- Fork CI was explicitly enabled after the initial fork push registered its
  workflows without starting a run. Manual CI dispatch is also available.
- No Bob AI task has been run by this setup; no task screenshots are supplied.
- Actual Bob skill/hook activation, IBMid/instance/quota and product browser flows
  are not verified by file installation. See BOB-SETUP for startup commands.

## Next step

Open the fork root in Bob. Verify account, instance/quota and workspace trust.
Use docs/BOB-START-PROMPT.md in Plan mode to validate one small developer-workflow
improvement. Agree criteria, then switch to Build/Agent. Record each real task.

After meaningful work, replace this checkpoint with actual changed files/commits,
commands/results, unresolved failures, Bob evidence and the next concrete step.
Do not mark proposed functionality or a template as complete.
