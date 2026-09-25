# LMS hackathon workspace — team setup

Prepared on 26 September 2026 for Neko Core. All event times below are in
**Vietnam (UTC+7)**: build from 25 September 22:00 to 27 September 22:00;
team submission target 27 September 20:00. UTC equivalents: 25 September 15:00
to 27 September 15:00; team target 27 September 13:00 UTC.

This is a fork of an existing LMS, not a new application built during the event.
Read [PREEXISTING](PREEXISTING.md). The new developer-workflow improvement still
needs to be selected, built with Bob, verified and documented.

## Clone and prepare (Windows x64)

Install Git/GitHub CLI, IBM Bob IDE, Java 21, Maven 3.9+, and Docker Desktop with
Linux containers. Chrome is used by the browser tooling check. Java and Maven
must be on PATH. Do not commit machine-specific JDK paths or credentials.

```powershell
git clone https://github.com/meiiie/lms-ibm-bob-hackathon.git
Set-Location lms-ibm-bob-hackathon
.\scripts\Install-Node.ps1
.\scripts\Use-DevEnv.ps1
.\scripts\Install-AgentTools.ps1
.\scripts\Install-BobExtensions.ps1
.\scripts\Install-Harness.ps1
.\scripts\Check-Setup.ps1
.\scripts\Check-Browser.ps1
.\scripts\Open-Bob.ps1
```

The scripts pin Node 24.21.0 and Playwright CLI 0.1.21. Upstream CI uses Node 22;
the local frontend build was also verified under Node 24.21.0. Always use the
existing frontend lockfile. Python is not required for the Angular/Spring setup.
The extension lock targets Windows x64. Teammates on other platforms should
install equivalent stable extensions through Bob, use Node 24.21.0 on PATH,
and replace the two Windows hook commands in `.bob/settings.json` with
`node scripts/harness.cjs start` / `node scripts/harness.cjs stop` locally.
The application and Node harness are cross-platform; these installers are Windows-specific.

Open **the repository root**, containing `AGENTS.md`, `.bob/`, `fe/` and `backend/`.
If extensions were installed while Bob was open, save edits and run **Developer:
Reload Window**. Handle Workspace Trust and IBMid login yourself. Verify the
hackathon instance and remaining quota before starting an AI task.

## What the setup provides

| Component | Purpose |
| --- | --- |
| `AGENTS.md` | Short repository map, real commands, verification and provenance rules |
| `docs/PRD.md`, `docs/WORKSTATE.md` | Agreed requirements versus changing progress |
| `.bob/custom_modes.yaml` | Hackathon Build, Verify and Ship |
| `.bob/skills/` | Ponytail, Ponytail review, slicing, debugging, evaluation, UI craft, browser QA, submission |
| `.bob/settings.json` | SessionStart context and Stop diagnostics |
| `scripts/harness.cjs` | Configuration/index checks, not product testing |
| `bob_sessions/` | Actual Bob task-summary screenshots and participant manifest |
| `data/`, `metrics/`, `submission/` | Data permissions, real measurements and submission assets |

Eight recommended extensions are pinned in `tooling/extensions.lock.json`:
Prettier, ESLint, YAML, EditorConfig, Red Hat Java, Java Debugger, Java Test Runner,
and Angular Language Service 20.3.0. Automatic format-on-save is off to avoid
unrelated formatting churn in the existing repo. Format changed code deliberately.
Previously installed Python extensions are not removed from the user's IDE.

In Bob Settings, verify the eight skills and three custom modes appear. Files on
disk and CLI extension installation do not prove activation in an actual Bob task.
Use the [first-task prompt](BOB-START-PROMPT.md) in built-in **Plan** mode; use
**Hackathon Build** or built-in **Agent** after agreeing the slice. Use a fresh
**Hackathon Verify** task for important integration; finish with **Hackathon Ship**.
Verify's terminal can technically modify files: its no-edit instruction is a
workflow convention, not a security sandbox. No extra MCP server is required.

## Run and check the existing application

For a local development stack, start Docker Desktop, ensure ports 4200/8088 are
available, then run `scripts/Start-LmsDev.ps1`. It uses a separate Compose project
name, `lms-bob-hackathon`, and the checked-in development examples. It does not
deploy to a public host. Existing services can still conflict on published ports.

- Frontend: <http://localhost:4200>
- Backend health: <http://localhost:8088/actuator/health>
- Inspect the existing seed/data docs for test accounts; do not use production data.

To stop only this stack while retaining its volumes:

```powershell
docker compose --project-name lms-bob-hackathon --env-file .env.dev.example -f docker-compose.yml -f docker-compose.dev.yml down
```

For host-based work, from the root run `scripts/Use-DevEnv.ps1`, then:

```powershell
# From backend/:
mvn.cmd test -B -ntp
# From fe/:
npm.cmd ci --no-audit --no-fund
$env:SITEMAP_BASE_URL = 'http://127.0.0.1:9'
npm.cmd run build
```

The sitemap variable above deliberately exercises the existing offline fallback;
do not present a fallback build as proof that production course indexing works.
For browser regression checks inspect `fe/playwright.smoke.config.ts` and the
existing fixtures, then run `npm.cmd run test:e2e:smoke`. Product smoke remains a
separate check from `scripts/Check-Browser.ps1`, which uses a synthetic HTML form.

## Collaborate and preserve evidence

Create one branch per scoped task (`codex/<short-scope>`), avoid editing the same
files concurrently, and update WORKSTATE with exact checks and the next step.
Keep upstream `CONTRIBUTING.md`/architecture conventions for product contributions.
Before a new PR, follow the owner's review/publication instructions. The submission
fork's inherited production workflow is guarded to the original upstream repo;
configure a separate demo host only when the team chooses and authorizes it.

After every relevant Bob task, each participant captures the real consumption
summary into root `bob_sessions/` and adds a manifest row. Review captures for
credentials/private data. The PNG ignore exception is intentional. No automatic
script can manufacture Bob usage evidence. Keep Codex preparation separate.

Record data permissions in `data/SOURCES.csv`; record actual before/after runs
in `metrics/experiments.csv`. Do not invent a baseline time or expected speedup.
Use [submission checklist](SUBMISSION-CHECKLIST.md) and [template](../submission/TEMPLATE.md).
No demo URL, video, slides or completed hackathon feature is supplied by this setup.
