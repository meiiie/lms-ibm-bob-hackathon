# Current work state

## Demo role access — deployed and verified

26 September 2026, **21:35 UTC+7 (Vietnam)**. The owner requested enabling
teacher, organization-manager and system-admin access. All four roles are now
live at https://neko-core-lms-demo.pages.dev/auth/login. This supersedes the
original student-only policy; the older deployment record below is historical.

- Backend source `1ea41ff5`, Railway deployment
  `b13a57d4-425b-414e-9278-e45cfdded645`: SUCCESS, health UP, startup 17.105 s.
  Frontend artifact remains `86ceb885`; frontend application code was unchanged.
- `python scripts/verify-demo-roles.py --output .tools/demo-roles-run4` passed
  30 checks across four fresh Chrome contexts with real UI login and API data.
  It verified portals, course lists, title search (Enter submits), approved/pending
  filters, teacher learner management and role/organization access restrictions.
  No failing UI API responses or browser runtime errors in the final run.
- 134 focused backend tests and package passed. Exact test selection and
  source review/acceptance limits are in `docs/DEMO-ACCOUNTS.md`. Full CI and
  merge status are tracked by PR #5; do not infer them from local tests alone.
- Two read-only Neon snapshots confirm four enabled identities, other users
  disabled, unchanged SAF-101 course/class/teacher ownership and learner
  enrollment progress. Default inherited admin login still fails. Cloud AI,
  payments, uploads, email and media processing remain unprovisioned/restricted.
- First browser acceptance caught an inherited admin native-SQL sort failure
  (`c.createdAt`). The adapter now maps timestamp properties to PostgreSQL
  column names only for native queries. Four regressions pass; live filtered
  admin queries now return HTTP 200. The runner also corrected its assumption
  that title search matches course codes and explicitly presses Enter, waits
  for the actual search response and settled dashboard data before screenshots.
  Failed baselines remain ignored; final public evidence is
  `docs/evidence/demo-roles-2026-09-26/`.
- Private English credential handoff: `.tools/team-demo-accounts.private.md`.
  Four independent passwords are set in Railway and never committed. The teacher
  keeps the original owner ID. Backend startup restores four demo identities;
  admin edits affect this shared fixture, so preserve SAF-101 for the recording.
- Codex continuation, not Bob work. Both Bob PNG Git blobs remain identical.
  The owner's unrelated `backend/.factorypath` edit remains unstaged.

Next: use PR #5 for final CI/merge status and send the private credential handoff
to teammates. Remaining video, slides, cover, Bob summaries and submission form
are separate tasks; this account rollout does not claim they are complete.

## Free demo deployment — hosted acceptance passed

26 September 2026, Vietnam (UTC+7). The owner authorized choosing and deploying
this isolated demo, publishing and merging its changes. This is Codex continuation
work, not Bob session evidence. Preserve `backend/.factorypath` and team evidence.

- Live demo: https://neko-core-lms-demo.pages.dev. Cloudflare Pages serves Angular,
  a fixed-origin Worker proxies the API, Railway runs one backend in Singapore,
  and a separate Neon Free PostgreSQL 16 project stores synthetic demo data.
  No card, paid upgrade or production resource was used.
- The `prod,demo` profile prepares one enabled synthetic student and disables all
  inherited users before accepting traffic. Privileged actions, account changes,
  payments, uploads, email, cloud AI and media conversion are restricted. All 131
  migrations through version 159 succeeded; 72 focused backend tests passed.
- The public proxy guard smoke passed at 20:30 UTC+7: learner login works;
  inherited admin login, admin route, registration, raw encoded password route and
  checkout fail. ChatGPT is disabled, Wiii unconfigured, API responses no-store.
- Frontend artifact `86ceb885`, CI run `36240432617`: 374 package entries and all
  service-worker hashes verified. Backend `c9c67946` deployment
  `84e5413c-3d70-4b5e-9109-b52623182084` succeeded; health UP, startup 15.725 seconds,
  observed Railway memory 495.8 MB / 1,024 MB. Local Java processes are stopped.
- Real Chrome acceptance passed all seven stages at 20:35 UTC+7 with no mocked
  API, login or storage. It cached 259 prefetch assets, downloaded 31 lessons,
  cleared ordinary HTTP cache, reloaded offline from the service worker with
  navigator.onLine=false and identical prose, completed a text lesson, reloaded
  again, and reconnected. The server confirms COMPLETED and pending progress zero.
  Command: `python scripts/verify-demo-pwa.py --output .tools/demo-pwa-run4` (exit 0).
  Public evidence and limits: `docs/DEMO-VERIFICATION.md`.
- Failed runner baselines are retained locally. They exposed a hidden video option
  in a text-only fixture, premature PWA readiness, and CDP offline-state interference.
  The final runner waits for actual cache population and detaches its cache-clearing
  session before network emulation. No application fix was needed for these issues.
- Railway needed explicit Dockerfile/healthcheck settings and only one region.
  Its new legacy-config attachment was rejected, so unused `railway.json` was
  removed. Provider settings are documented in `docs/FREE-DEMO-DEPLOYMENT.md`.
  Cloudflare production/preview fail_open=false was applied and verified.
- Railway credit checked around 20:31 UTC+7: 4.99126 USD / 30 trial days. This is
  temporary credit-funded hosting. Native peak RSS was 552.3 MB, so a strict
  512 MB fallback remains unverified. No capacity/load test was performed.
- All six CI jobs passed at `c9c67946` in run `36241307317`; independent source
  review found no blockers. The owner's PR #1 merge added only an evidence PNG
  at `ada302bb`; preserve it during integration. PR #4 is the delivery record for
  final documentation/runner changes and integration; check its current GitHub
  state for the final merge revision. Mobile viewport checks also passed.
- Credentials remain in ignored `.tools/demo-access.local.md` and backend secrets.
  ChatGPT is online-only and disabled on this public demo; local models require
  the visitor's own runtime. Offline video, physical mobile/PWA installation and
  first-ever offline access are not proven by this desktop test.

Next: hand off the verified demo URL/private learner access and recheck trial
credit before recording. Submission still needs final Bob summaries, video,
slides, cover and form. See PR #4 for delivery/CI status.

## Current integration — local provider, UX and authorized merge

26 September 2026, Vietnam (UTC+7). The owner subsequently authorized merging
PR #3 while clearly documenting ChatGPT's online-only experimental status, asked
for professional sidebar UX, optional local models, a WebMCP assessment and
careful preservation of teammates' work. This decision supersedes the earlier
requirement below to hold the entire PR solely for a new ChatGPT consent.

- The existing `gemma3:4b` model answered a harmless lifeboat question through
  Ollama at `127.0.0.1:11434` in 18.34 seconds. This is a real local-provider shell
  check, not browser or installed-PWA proof. No model or runtime was installed;
  the request released the model with `keep_alive:0` afterwards.
- Added explicit same-device Ollama and LM Studio connections through isolated
  browser fetch, fixed loopback endpoints, no LMS JWT/cookies, no automatic probe,
  no queued/replayed requests, no cloud fallback and bounded cancellable responses.
  Known Ollama cloud/remote models are excluded. LM Studio is not installed here
  and its actual runtime remains unverified.
- Sidebar polish preserves the existing design system, offers clear cloud/local
  states and offline drafting, and copies selected text into a reviewed question
  only on explicit action. New local setup remains reachable without cloud health.
- PASS: all 101 targeted Angular tests in ChromeHeadless, exit 0; local log
  `.tools/assistant-integration-fixed-tests.log`. The earlier 96-test run passed
  before the final integration regressions were added.
- Fresh integration review identified rapid-reconnect discovery and click-only
  accessibility races. Three regression tests first failed against the old code
  (14 passed, exit 1), then passed in the combined suite after the fixes. The
  final suite also verifies deduplicated recovery and listener cleanup. Log:
  `.tools/assistant-integration-before-fix.log`. Independent review found no
  remaining blocker in these changes.
- Real Chrome also exposed an inherited offline notice masking the lower part
  of Send. The notice now moves outside the desktop sidebar, and the mobile panel
  sits above it. The final browser run verified top/center/bottom pointer hits
  across the whole 44px Send button on desktop and mobile.
- PASS: `python scripts/verify-ai-sidebar.py --real-local --output
  .tools/assistant-polish-browser-verified`, 14 acceptance groups, exit 0, real
  Chrome 153.0.8010.53. The LMS identity and cloud/LM Studio responses were
  synthetic. Exactly one real Ollama `gemma3:4b` request returned the nautical
  mile answer through the sidebar while cloud routes were blocked by the fixture.
  Local requests carried no LMS JWT/cookies/referrer and created no sync entries.
  Desktop/mobile layouts, selected-passage privacy, offline drafts, explicit
  recovery, cancellation and switching passed. Mobile means viewport/touch
  emulation, not a physical phone. See the ignored output directory for labeled
  captures, `summary.local.json` and `real-ollama-answer.local.json`.
- Not verified by that browser run: real ChatGPT inference with the updated
  model, full logged-in LMS/backend transport, installed-PWA service-worker
  behavior, or production HTTPS local-network permission. Host networking stayed
  enabled; this was a simulated cloud outage, not a physically disconnected host.
- PASS: `node scripts/harness.cjs check`, all four harness regression tests,
  development/production Compose validation and Caddy configuration validation
  (`caddy adapt --validate` in the existing `caddy:2-alpine` image with network
  disabled). Caddy reported its existing formatting warning. These checks do not
  start the LMS stack or prove installed-PWA behavior.
- The final PR checks are the gate for the production frontend build, complete
  backend suite and Docker application smoke. See the checks and merge state on
  [PR #3](https://github.com/meiiie/lms-ibm-bob-hackathon/pull/3) for the published
  revision; the owner authorized merging only this PR after those checks pass.
- WebMCP remains experimental and does not connect the Java ChatGPT adapter.
  Defer a dependent workflow; see `docs/WEBMCP-RESEARCH-2026-09-26.md` and
  `docs/LOCAL-AI-SETUP.md` for current capabilities, topology and prerequisites.
- Remote main was `c94f9f9f` when inspected. Faiz's PR #1 adds only its own image,
  with no changed-path overlap with PR #3. Preserve PR #1 and the owner's unrelated
  `.factorypath` edit. Recheck remote main and the final PR head before merging.
- Bob evidence: the original meiiie intermediate PNG is already on main and is
  preserved byte-for-byte. Faiz's open PR image appears to show the wrong window,
  not a Bob consumption summary; it also lacks a manifest entry. No teammate
  evidence was changed or merged, and the private recovered transcript stays
  ignored. Final consumption summaries and submission assets remain outstanding.

## Earlier continuation — personal ChatGPT sidebar

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
  The later model-error change passed all 15 focused panel tests at 09:30:31;
  log: `.tools/chatgpt-model-error-test.log`. It preserves the connected state
  and question, gives administrator guidance, and does not retry or reconnect.
- PASS: 27 backend regression tests (9 adapter, 11 session, 3 controller,
  4 manual-probe diagnostic tests), exit 0 at 09:27:53 UTC+7, using the isolated
  output described below. Log: `.tools/chatgpt-model-tests-final.log`. A strengthened
  65,536-byte provider-error regression then passed in the 9-test adapter rerun
  at 09:29:29; log: `.tools/chatgpt-model-bound-tests-final.log`.
  Independent review found no blocking issue after the corrections below.
- PASS: `python scripts/verify-ai-sidebar.py`, 9 acceptance groups in real Chrome
  153.0.8010.53, with visibly labeled synthetic LMS/provider fixtures. Covers both
  providers, disabled/unavailable cases, device/poll/ask/disconnect, plain text,
  rate-limit recovery, offline no replay and iframe message isolation. It does not
  verify live provider authentication, a real backend or service-worker behavior.
- PASS: working-tree harness configuration; `git diff --check`; production Angular
  build with `SITEMAP_BASE_URL=http://127.0.0.1:9` (documented offline sitemap
  fallback and existing CommonJS warnings). Local build log is ignored at
  `.tools/chatgpt-frontend-build.log`.
- PASS: all six CI jobs on final application commit
  `55979f4edb5f13a227ac9ec69d72a2e4f1da06eb`, including
  1,310 backend tests, 66 targeted frontend tests, frontend build, worker tests,
  harness, Compose validation and Docker application smoke:
  https://github.com/meiiie/lms-ibm-bob-hackathon/actions/runs/36212103389.
  The subsequent handoff commit only records these results and the expired live
  probe; it changes no application code. PR #3 remains draft because a real answer
  using the updated model still requires verification.
  PR #3 contains the implementation and follow-up fixes; consult its current
  checks and merge status for the final revision:
  https://github.com/meiiie/lms-ibm-bob-hackathon/pull/3.
- Live probe used the actual Java adapter/session service with a synthetic LMS
  owner, not the full application. OpenAI returned a device code and polling
  remained pending. The 180-second consent window ended without connection or a
  live answer, and the probe discarded its in-memory state. In a second probe the
  owner completed consent: the actual adapter reached `connected`, proving device
  polling and token exchange. Its answer request then failed with safe error
  `unavailable` (exit 1). Inference is being diagnosed; do not claim working live
  chat or full LMS end-to-end login. The second connection was also discarded.
  A third diagnostic probe ended pending after its 600-second consent window;
  no new consent or answer was obtained, and its in-memory state was discarded.
  A fourth probe, using the corrected stream reader, authenticated successfully
  and received HTTP 400 within 1,055 ms: the fixed diagnostic classification was
  `model is not supported`. OpenAI rejected `gpt-5.4-mini`; this was a model error,
  not an authentication failure. The probe was stopped and its state discarded.
  Configuration now defaults to `gpt-6-luna` from the pinned official Codex
  0.157.1 catalog. Unsupported models return safe `model_not_supported` / HTTP 409
  and preserve the connection; the sidebar gives administrator guidance without
  automatically retrying. The new probe ended pending at about 09:40 UTC+7 after
  its 600-second consent window and discarded its in-memory state. No live answer
  was obtained with the updated model. Do not reuse an expired probe code.
  At that checkpoint the next step was a fresh opt-in consent and real-answer
  probe. The later owner-authorized merge decision at the top of this document
  supersedes that PR-readiness hold; live ChatGPT inference remains unverified.
  The revised test-only runner permits at most two explicit allowlisted model
  retries within the same connected session, without storing credentials.
- Read-only backend review found no confirmed remaining blocker. A targeted test
  exposed a successful-response overflow path attempting to drain the upstream
  body again; direct Flux cancellation now passes the bounded-stream regression.
  A second reproduced regression showed a completed answer followed by an open
  HTTP stream timing out. Incremental SSE frame handling now ends and cancels on
  completion, with bytewise UTF-8/CRLF, truncated, failed and incomplete response
  coverage. This is a proven fixture failure; the later live probe separately
  identified an unsupported model. Test-only diagnostics were also corrected to observe one
  body subscription and keep their manual retry input deadline bounded.
- The first Maven attempt also encountered missing existing class files in the
  IDE-shared `backend/target` output, plus a corrected new test generic type error.
  Rerunning with identical project dependencies/compiler settings and isolated
  `.tools/chatgpt-maven-target` avoids the output collision. No unrelated domain
  sources or the owner's `.factorypath` change were modified.
- The submission audit is in `docs/SUBMISSION-READINESS.md`. The final expanded
  Bob summary, team task coverage and demo/video/slides/cover remain outstanding.
  The user stopped the UI capture attempt with Escape; no new summary was captured.
  The existing manifest now records the verified Bob task ID and labels the
  08:18 screenshot as intermediate; its unverified completion timestamp is blank.
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
