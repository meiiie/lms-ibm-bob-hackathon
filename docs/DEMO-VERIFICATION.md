# Hosted demo verification

Verified **26 September 2026, 20:35 UTC+7 (Vietnam)** at
https://neko-core-lms-demo.pages.dev. This is Codex deployment/verification work
against the reused LMS, not a Bob session or a new productivity measurement.

The frontend is the optimized demo artifact from `86ceb885`, built by
[CI run 36240432617](https://github.com/meiiie/lms-ibm-bob-hackathon/actions/runs/36240432617).
Subsequent frontend application and proxy source is unchanged. Railway runs
backend source `c9c67946`, deployment `84e5413c-3d70-4b5e-9109-b52623182084`.
All six checks passed in
[CI run 36241307317](https://github.com/meiiie/lms-ibm-bob-hackathon/actions/runs/36241307317).
Later documentation and runner corrections do not alter these deployed binaries.

## Actual acceptance

`python scripts/verify-demo-pwa.py --output .tools/demo-pwa-run4` exited 0 using
Chrome 153.0.8010.53 in a fresh, disposable desktop browser context. Login used
the real UI; no API responses, course content or browser storage were mocked.
The test modified only the isolated synthetic learner's lesson progress.

| Check | Actual result |
| --- | --- |
| Real login and identity | PASS: synthetic STUDENT account |
| Course download | PASS: 31 lessons stored in IndexedDB; video quality `none` |
| Service worker readiness | PASS: 259 prefetch assets cached; NGSW `NORMAL`, no pending initialization |
| Offline reload | PASS: ordinary HTTP cache cleared; document returned by service worker; `navigator.onLine=false` before and after reload |
| Offline lesson content | PASS: all 2,956 normalized prose characters match the online SHA-256 |
| Offline completion | PASS: completion and section IDs stored locally with pending sync |
| Second offline reload | PASS: completion retained |
| Reconnect | PASS: real server reports `COMPLETED`; pending progress queue is zero |
| Public access restrictions | PASS: default admin login, admin route, registration, encoded password path and checkout rejected |
| Cloud AI | PASS: ChatGPT disabled and Wiii unconfigured; no hosted AI answer claimed |
| Mobile viewport | PASS: real login at 375 x 812 with touch emulation; no horizontal overflow, full-screen assistant, cloud providers unavailable as configured |

Reviewed, credential-free evidence:

- [PWA report](evidence/demo-2026-09-26/pwa-summary.json)
- [Public API guard report](evidence/demo-2026-09-26/api-guard-summary.json)
- [Actual offline lesson screenshot](evidence/demo-2026-09-26/offline-lesson.png)
- [Actual reconnected sync screenshot](evidence/demo-2026-09-26/reconnected-sync.png)
- [Mobile layout/status report](evidence/demo-2026-09-26/mobile-summary.json)
- [Mobile assistant screenshot](evidence/demo-2026-09-26/mobile-assistant.png)

The mobile follow-up used `python .tools/verify-demo-mobile-stable.py` (exit 0),
an ignored diagnostic runner. It made no progress writes or local-model requests.

## Reproduce and respect the limits

Get the synthetic learner credentials from the owner's private handoff. Log in,
open **Khóa học của tôi**, download the SAF-101 course without videos, and open a
text lesson. On a first visit, keep it online while the PWA finishes caching its
shell. Then disconnect, reload, complete an unfinished text lesson, reload once
more, reconnect and check **Lưu trữ ngoại tuyến** for successful sync. Progress is
shared for this demo account; choose an unfinished lesson instead of resetting it.

The automated run uses browser-context offline emulation; the host remains online.
Physical mobile devices, the PWA installation dialog, offline video, offline first
visit, concurrent load and every LMS feature were not tested. A downloaded course
alone does not prove the initial application-shell cache has finished. Hosted
ChatGPT, Wiii, mail, payments, uploads and media conversion are intentionally off.
Local AI requires the visitor's own model/runtime and browser permissions.

Failed runner baselines remain in ignored `.tools/demo-pwa*` directories: a missing
video-quality radio for the text-only fixture; premature service-worker readiness;
and a second CDP Network session interfering with the offline state on reload.
The final runner waits for actual prefetch completion, clears HTTP cache and
detaches that CDP session before offline emulation. No product source changes were
needed for these runner issues.

See [deployment handoff](FREE-DEMO-DEPLOYMENT.md) for trial credit, source commands,
resource limits, the private access-file location and what remains to submit.
