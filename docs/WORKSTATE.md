# Current work state

## Current continuation — personal ChatGPT sidebar

26 September 2026, Vietnam (UTC+7). After Bob's quota stop, the owner explicitly
asked Codex to continue implementation and verify the connection. Work is on
`codex/chatgpt-study-assistant`, based on `c94f9f9f`. This section supersedes
historical next-step statements below; the new work is attributed to Codex.

- Implemented optional backend device login, per-principal in-memory credentials,
  bounded single-question responses and disconnect; disabled by default through
  `CHATGPT_CONNECTION_ENABLED=false`. Added independent ChatGPT choice in the
  existing sidebar, keeping Wiii and offline learning separate.
- Fixed the inherited Wiii stale-finally lock race. ChatGPT HTTP requests now opt
  out of automatic 5xx retry and LMS-token refresh/replay. Provider authorization
  errors use safe HTTP 409 responses so they do not expire the LMS session.
- PASS: 65 targeted Angular tests in ChromeHeadless, exit 0. Includes Wiii/widget,
  ChatGPT device/poll/ask/disconnect, cancellation/offline recovery, and real HTTP
  interceptor composition with synthetic provider responses. Log (local/ignored):
  `.tools/chatgpt-frontend-final-test.log`.
- PASS: 21 backend regression tests (7 adapter, 11 session, 3 controller), exit 0,
  using the isolated output described below. Read-only review found no blocking
  issue after the stream cancellation fix.
- PASS: `python scripts/verify-ai-sidebar.py`, 9 acceptance groups in real Chrome
  153.0.8010.53, with visibly labeled synthetic LMS/provider fixtures. Covers both
  providers, disabled/unavailable cases, device/poll/ask/disconnect, plain text,
  rate-limit recovery, offline no replay and iframe message isolation. It does not
  verify live provider authentication, a real backend or service-worker behavior.
- PASS: working-tree harness configuration; `git diff --check`. Production build
  and final CI are still being verified at this checkpoint.
- Live probe used the actual Java adapter/session service with a synthetic LMS
  owner, not the full application. OpenAI returned a device code and polling
  remained pending. The 180-second consent window ended without connection or a
  live answer, and the probe discarded its in-memory state. In a second probe the
  owner completed consent: the actual adapter reached `connected`, proving device
  polling and token exchange. Its answer request then failed with safe error
  `unavailable` (exit 1). Inference is being diagnosed; do not claim working live
  chat or full LMS end-to-end login. The second connection was also discarded.
- Read-only backend review found no confirmed remaining blocker. A targeted test
  exposed a successful-response overflow path attempting to drain the upstream
  body again; direct Flux cancellation now passes the bounded-stream regression.
- The first Maven attempt also encountered missing existing class files in the
  IDE-shared `backend/target` output, plus a corrected new test generic type error.
  Rerunning with identical project dependencies/compiler settings and isolated
  `.tools/chatgpt-maven-target` avoids the output collision. No unrelated domain
  sources or the owner's `.factorypath` change were modified.
- The submission audit is in `docs/SUBMISSION-READINESS.md`. The final expanded
  Bob summary, team task coverage and demo/video/slides/cover remain outstanding.
  The user stopped the UI capture attempt with Escape; no new summary was captured.
- Docker recovered at 08:58:49 UTC+7: Linux engine 29.7.2 responded to `docker version`,
  `docker info` and `docker ps`. Stale `dockerInference` and secrets-engine runtime
  sockets were preserved by renaming their parent runtime directories; no settings,
  images, volumes or container data were reset. The three backups are under
  `%LOCALAPPDATA%` with suffixes `run.before-recovery-20260926`,
  `run.before-recovery2-20260926`, and `docker-secrets-engine.before-recovery-20260926`.
  An existing unrelated container resumed under its restart policy. No LMS stack
  was launched. With about 2 GB free RAM, run heavy builds sequentially.

See `docs/CHATGPT-SETUP.md` for configuration, consent steps and prototype limits.
Do not publish the local recovered transcript or private probe state.

## Latest verified checkpoint — Bob quota stop

Verified by Codex on 26 September 2026 at 08:34 Vietnam (UTC+7). This checkpoint
supersedes older statements below about PR status and missing Bob evidence.

- Bob task `b3f61aaa13f3e3d94298655249da2d8c` stopped with `BudgetExceededError`
  at 08:24:34 UTC+7; recorded task consumption is 38.658728 Bobcoins.
- Its offline-safe sidebar PR #2 is merged as `3432af2aa65b47027eae5aaddaa06fdad5e20618`.
  All six CI jobs passed on the final PR head. Bob's latest targeted Angular run
  recorded 35 passing tests; live ChatGPT integration and full user flows are not
  established by those tests.
- Bob then inspected backend code for the ChatGPT follow-up. No implementation
  writes are recorded after the 08:23 continuation request. That feature remains
  unfinished.
- A real 08:18 Bob IDE screenshot and manifest are already on remote main. Their
  28.50 Bobcoin figure is an intermediate checkpoint, not the final session total.
- Codex recovered 303 stored messages read-only. The transcript and handoff are
  local, Git-ignored files: `bob_sessions/meiiie_b3f61aaa13f3e3d94298655249da2d8c_history.local.md`
  and `docs/BOB-SESSION-HANDOFF.local.md`. Review privacy before sharing them.
- No product code changed or tests reran during this recovery audit. Preserve
  the unrelated `.factorypath` edit and existing research documents. Next: review
  the follow-up integration and capture the actual final Bob summary evidence.

## Earlier checkpoint (historical)

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
