# Current work state

Updated 26 September 2026, ~08:45 UTC+7 (Vietnam).

## Goal and decisions

Prepare the Neko Core submission fork of LMS for work in IBM Bob. The owner has
authorized merging the prepared MIT transition, then creating the submission
fork and adapting the existing Bob preparation kit. A teammate understands and
has run the LMS. Hackathon scope: offline-safe AI assistant sidebar (first
deliverable from docs/DARK-BOB-TASK.md).

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
- PASS: all six fork CI jobs at `6f3005677226c238170734cc6528c0b32b80af0e`, including
  Bob Harness Checks and Docker build/start/backend-health/frontend-edge checks:
  https://github.com/meiiie/lms-ibm-bob-hackathon/actions/runs/36169537090
- PASS: `npm.cmd --prefix fe run build` in the independent clone under Node
  24.21.0, with `SITEMAP_BASE_URL=http://127.0.0.1:9`. Bundle generation took
  280.543 seconds; existing Angular/CommonJS warnings remain. The service-worker
  check reported no phantom files. Log: ignored `.tools/frontend-build-setup.log`.
- The final follow-up changes only documentation; its commit skips another full
  CI run. Application/tooling code remains the revision verified above.
- No Bob AI task has been run by this setup; no task screenshots are supplied.
- Actual Bob skill/hook activation, IBMid/instance/quota and product browser flows
  are not verified by file installation. See BOB-SETUP for startup commands.

## First deliverable: offline-safe assistant sidebar

Branch: `codex/dark-offline-assistant` from `d70ac29f`.
Authorized by owner per docs/DARK-BOB-TASK.md.

### Changes

**`fe/src/app/features/ai-chat/presentation/components/chat-panel/chat-panel.component.ts`**
- Inject `NetworkStatusService`; derive `isOffline = computed(() => !networkStatus.online())`
- `ngOnInit`: skip `initEmbed()` when `isEffectivelyOffline()`
- Template: offline state branch (with guidance to continue downloaded lessons,
  accessible `role=status` div, close button always visible); reconnect-ready branch
  (separate from offline block so the button persists once `isOffline()` becomes false)
- `initInFlight` signal guards double-click (second call is no-op while first is pending);
  also suppresses `offlineReconnectReady` during ordinary online init
- Connectivity-loss effect: increments `initGeneration` (invalidates in-flight promise),
  clears `embedUrl`, resets `loadError`, resets `offlineReconnectReady`
- Connectivity-restore effect: sets `offlineReconnectReady` only when `!initInFlight`
  and `!embedUrl` and `!loadError`; reactive on `initInFlight` signal so button appears
  as soon as the pending promise settles after reconnect
- `initEmbed()`: generation token guards commit post-await; mid-flight offline check
  after `await`; `finally` always clears `initInFlight`
- PostMessage bridge: `!iframeRef → return` (missing iframe rejects all messages);
  source window checked against snapshot taken before `await`; `refreshGeneration`
  check ensures refresh targets the same iframe that sent the request
- `ngOnDestroy`: sets `destroyed=true`, increments `initGeneration`

**`fe/src/app/api/interceptors/offline.interceptor.ts`**
- Added `/api/v3/ai/` to `NEVER_INTERCEPT_PREFIXES`. AI token exchange was not
  previously bypassed; offline failures fell into the mutation queue, creating a
  spurious sync item and false pending-sync badge.

### Tests

**`fe/src/app/features/ai-chat/presentation/components/chat-panel/chat-panel.component.spec.ts`**
  35 cases: offline open, offline mid-init, e2e reconnect (online pending → offline → online
  → old resolves (no-op) → retry → new request → iframe), teardown, online flow, postMessage
  bridge (valid, dedup, replacement guard, wrong origin/source), double-click = 1 request.

**`fe/src/app/features/ai-chat/presentation/components/chat-panel/chat-panel.recovery.spec.ts`**
  Coordinator regression: stale init must not strand recovery.

**`fe/src/app/api/interceptors/offline.interceptor.spec.ts`**
  Regression: `/api/v3/ai/` paths bypass offline interception.

### Verification (round 2, commit da4fbcb4)

```
npm.cmd --prefix fe run test -- \
  --include="**/chat-panel.component.spec.ts" \
  --include="**/chat-panel.recovery.spec.ts" \
  --include="**/offline.interceptor.spec.ts" \
  --browsers=ChromeHeadless --no-watch --no-progress
```
Result: **35/35 SUCCESS, exit 0** — Chrome Headless 153.0.0.0 (Windows 10)

```
SITEMAP_BASE_URL=http://127.0.0.1:9 npm.cmd --prefix fe run build
```
Result: Build succeeded (sitemap fetch offline fallback as documented; bundles generated,
no TypeScript or Angular compile errors).

### Coordinator baseline

Coordinator reproduced the original compiled app in real Chrome (port 4311,
offline open): 1 token request fired despite being offline; new sync item appeared.
docs/DARK-QA-BASELINE.md records the original defect. All findings fixed across two
commits (5d47ddf1 and da4fbcb4).

## Next step

PR open on meiiie/lms-ibm-bob-hackathon: `codex/dark-offline-assistant → main`.
Await coordinator's independent verification and green CI before merge.
After merge: implement the follow-on personal ChatGPT connection per docs/DARK-BOB-TASK.md
(feasibility report due after offline sidebar review passes).
