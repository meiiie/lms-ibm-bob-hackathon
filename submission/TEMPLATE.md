# Submission draft — team assets still required

- Proposed title: **Maritime LMS: Bob-assisted offline resilience**
- Short description (under 255 characters): An offline-ready maritime LMS PWA, improved with IBM Bob-assisted debugging and verification. Learners download lessons, continue at sea, and sync progress when online, with English/Vietnamese UI and clear AI connectivity boundaries.
- Technologies: IBM Bob IDE, Angular 20, TypeScript, Java 21, Spring Boot,
  PostgreSQL 16, IndexedDB/PWA, Cloudflare Pages/Workers, Railway, Neon, GitHub Actions.
- Public repository: https://github.com/meiiie/lms-ibm-bob-hackathon
- Final branch: `main`; obtain the final deployed commit from
  https://neko-core-lms-demo.pages.dev/__demo-release.json and its linked CI/CD runs.
- Interactive demo: https://neko-core-lms-demo.pages.dev/auth/login
  (team owner provides private synthetic account credentials in the submission form).
- Video MP4, up to 5 minutes: **team must supply the actual recording**.
- Slides PDF: **team must supply the final file**.
- Cover PNG/JPG, recommended 16:9: **team must supply the final image**.
- Bob evidence: `bob_sessions/`; member task summaries verified and logged in `manifest.csv`.
- Provenance: `docs/PREEXISTING.md`; release: `docs/DEMO-CI-CD.md`;
  final checklist: `docs/SUBMISSION-READINESS.md`.

## Long description

Seafarers and learners in remote areas cannot depend on a continuous internet
connection. Our existing maritime learning platform already supports downloaded
content, but integrating an assistant creates additional failure cases for its
developers: blocked sends, reconnect races, accidental request replay and confusing
online/offline states. Neko Core uses IBM Bob IDE to improve this debugging and
verification workflow within the existing Angular and Spring Boot codebase.

Bob implemented the first offline-safe assistant sidebar and AI interceptor bypass.
The team also contributed English/Vietnamese UI work and actual Bob task summaries.
After Bob's quota stopped, Codex continued the fixes, provider boundaries, tests,
demo deployment and documentation; these contributions are disclosed separately.
The LMS and its original offline infrastructure are reused, rather than claimed
as new hackathon work.

The hosted synthetic demo demonstrates real account login, downloaded text lessons,
offline reload, locally recorded completion and synchronization after reconnect.
Four role accounts support learner, teacher, organization and administration flows.
CI checks changes before deployment. Cloud AI is disabled on this public demo;
ChatGPT needs internet, while optional same-device models require a separately
running local server. We report demonstrated behavior and test results, not an
unmeasured productivity speedup. The repository includes exact verification limits,
source provenance and the current delivery record.

## Suggested 4-minute-30-second demo

| Time | Content |
| --- | --- |
| 0:00–0:30 | Developer and a concrete painful step |
| 0:30–1:00 | Existing LMS baseline, what is reused, what changes |
| 1:00–3:00 | Real flow: reproduce -> Bob-assisted improvement -> repeat verification |
| 3:00–3:45 | Measured results, failure case and limitations |
| 3:45–4:30 | Value, team, next step and accessible links |

Slides: problem/audience; workflow; architecture and Bob's role; demo/evidence;
impact and limits; team and links. This outline does not replace the actual PDF
or MP4. Do not report unmeasured speedups or create imaginary screenshots.
