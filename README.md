# Neko Core — IBM Bob hackathon fork

Fork of [Maritime LMS](https://github.com/linhlinhlin/LMS_hohulili), created after
the owner-authorized [MIT transition](https://github.com/linhlinhlin/LMS_hohulili/pull/541).
The existing LMS is reused. The hackathon work improves debugging and verification
of its assistant around offline/reconnect failures, with optional online ChatGPT
and same-device Ollama / LM Studio providers. Bob's first sidebar fix is merged in PR #2; Codex continues
the follow-up after Bob's quota stop. See the verification limits below before
treating this repository as a completed submission.

- **Start with Bob:** [Team setup](docs/BOB-SETUP.md) · [First-task prompt](docs/BOB-START-PROMPT.md)
- **Current scope/status:** [PRD](docs/PRD.md) · [WORKSTATE](docs/WORKSTATE.md)
- **Provenance/evidence:** [PREEXISTING](docs/PREEXISTING.md) · [Bob sessions](bob_sessions/README.md)
- **Optional ChatGPT connection:** [Setup and limits](docs/CHATGPT-SETUP.md)
- **Local AI and offline boundaries:** [Ollama / LM Studio setup](docs/LOCAL-AI-SETUP.md)
- **WebMCP decision:** [Research as of 26 September 2026](docs/WEBMCP-RESEARCH-2026-09-26.md)
- **Submission:** [Readiness audit](docs/SUBMISSION-READINESS.md) · [Checklist](docs/SUBMISSION-CHECKLIST.md) · [Draft](submission/TEMPLATE.md)

Build window: **25 September 22:00–27 September 22:00, 2026, Vietnam (UTC+7)**.
Internal target: 27 September 20:00 UTC+7. Neko Core is the team name, not an LMS
software dependency. No hackathon demo URL has been deployed by this setup.

ChatGPT requires internet. Downloaded lessons remain independent of cloud AI.
Local AI requires a running server and a downloaded chat model on the learner's
own device; installing the PWA alone does not install an AI model. WebMCP is a
researched follow-up, not an implemented dependency or a provider connection.

The upstream README below describes the existing application; its historical
production links, deployment commands and accomplishments are not this fork's
new hackathon contribution. Use the local development setup above.

---

<div align="center">

# Maritime LMS

Production-first LMS for maritime training, with adaptive video, offline-first learning, payment, and role-based operations.

[![CI](https://github.com/linhlinhlin/LMS_hohulili/actions/workflows/ci.yml/badge.svg)](https://github.com/linhlinhlin/LMS_hohulili/actions/workflows/ci.yml)
![Java 21](https://img.shields.io/badge/Java-21-0056D2)
![Angular 20](https://img.shields.io/badge/Angular-20-0F172A)
![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-006B75)
![PWA Ready](https://img.shields.io/badge/PWA-offline--first-0E8A16)

[Quick Start](#quick-start) | [Runtime Truth](#runtime-truth) | [Local Validation](#local-validation) | [Documentation Map](#documentation-map) | [GitHub Governance](docs/reference/GITHUB_GOVERNANCE.md)

</div>

![HoHoLiHu LMS Maritime Learning Platform banner](.github/assets/hoholihu-readme-banner.png)

---

## Overview

Maritime LMS is a full-stack learning platform for maritime education and training. The current production baseline includes:

- course authoring with `Chapter -> Lesson -> Section`
- learner progress, quizzes, assignments, certificates, and messaging
- offline-first PWA flows backed by IndexedDB, queued sync, and stale-package detection
- private video delivery on `Cloudflare R2 + Shaka Packager`
- dedicated ingest worker on GCP
- media-domain edge auth for adaptive playback on Cloudflare Free
- payment flows with backend-truth access activation states
- multi-tier roles: `ADMIN`, `ORG_ADMIN`, `TEACHER`, `STUDENT`

## Runtime Truth

These are the most important truths to remember before changing code or docs:

- Local frontend: `http://localhost:4200`
- Local backend from host: `http://localhost:8088`
- Local backend internal container port: `8080`
- Production site: `https://holilihu.online`
- Production media domain: `https://media.holilihu.online`

### Video

- Teacher uploads use `upload/init -> upload/confirm -> /api/v3/video-assets/from-upload`
- Learner-facing adaptive playback uses private `R2 + Shaka`, not Cloudflare Stream for new internal video
- Production ingest runs on a dedicated `video-worker` VM
- Production playback uses backend-signed manifests plus media objects through `media.holilihu.online`

### Offline / PWA

- Offline downloads are **device-local**
- Offline settings are **device-local**
- Offline progress sync is additive and forward-only
- Stale offline packages are surfaced to the learner and must be refreshed when publication/content versions diverge

### Payment

- The frontend should trust backend payment/access state, not local optimistic guesses
- Available payment methods come from backend truth and admin settings
- Post-payment access states are:
  - `READY`
  - `MANUAL_ACTIVATION_REQUIRED`
  - `ACCESS_PENDING`

## Quick Start

### Prerequisites

| Tool | Recommended |
|---|---|
| Docker Desktop | Recent stable version |
| Node.js | 22.x |
| Java | 21 |
| Maven | 3.9+ |

### Option 1: Backend in Docker, frontend local

```bash
cp .env.dev.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db backend

cd fe
npm install
npm start
```

### Option 2: Full local stack in Docker

```bash
cp .env.dev.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

### Default Local Accounts

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@maritime.edu` | `admin123` |
| ORG_ADMIN | `orgadmin@maritime.edu` | `orgadmin123` |
| TEACHER | `teacher@maritime.edu` | `teacher123` |
| STUDENT | `student@maritime.edu` | `student123` |

Extended seeded accounts are documented in [docs/testing/TEST_CHECKLIST.md](docs/testing/TEST_CHECKLIST.md).

## Local Validation

Use this baseline before release work, runtime refactors, or a GitHub push prep pass:

```bash
cd fe && npm run build
cd ../backend && mvn -DskipTests compile -B
cd .. && docker compose -f docker-compose.yml -f docker-compose.dev.yml config -q
docker compose -f docker-compose.yml -f docker-compose.dev.yml build backend frontend
curl -s http://localhost:8088/actuator/health
cd fe && npm run test:e2e:smoke
```

For the broader browser slice:

```bash
cd fe && npm run test:e2e:release
```

## Documentation Map

Start with these files:

| File | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Codex working rules and current repo truth snapshot |
| [CHANGELOG.md](CHANGELOG.md) | Notable shipped changes |
| [backend/README.md](backend/README.md) | Backend architecture, runtime, and testing |
| [fe/FRONTEND_ARCHITECTURE.md](fe/FRONTEND_ARCHITECTURE.md) | Frontend architecture and conventions |
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/reference/GITHUB_GOVERNANCE.md](docs/reference/GITHUB_GOVERNANCE.md) | GitHub operating model, labels, PR quality bar, branch rules, and contributor flow |
| [docs/reference/PRODUCTION_SURFACES.md](docs/reference/PRODUCTION_SURFACES.md) | Current production topology and public surfaces |
| [docs/runbooks/GITHUB_PROFESSIONAL_SETUP_RUNBOOK.md](docs/runbooks/GITHUB_PROFESSIONAL_SETUP_RUNBOOK.md) | Repository settings, label sync, ruleset, and social preview setup |
| [docs/runbooks/DEDICATED_VIDEO_WORKER_RUNBOOK.md](docs/runbooks/DEDICATED_VIDEO_WORKER_RUNBOOK.md) | Dedicated video-worker operations |
| [docs/runbooks/CLOUDFLARE_MEDIA_DOMAIN_EDGE_AUTH_RUNBOOK.md](docs/runbooks/CLOUDFLARE_MEDIA_DOMAIN_EDGE_AUTH_RUNBOOK.md) | Media-domain edge-auth operations |
| [docs/testing/TEST_CHECKLIST.md](docs/testing/TEST_CHECKLIST.md) | Local validation and release checklist |
| [docs/testing/E2E_MATRIX.md](docs/testing/E2E_MATRIX.md) | Smoke-vs-release browser test matrix |

## Contributor Workflow

- Start with [CONTRIBUTING.md](CONTRIBUTING.md) for branch, commit, review, and verification rules.
- Use [docs/reference/GITHUB_GOVERNANCE.md](docs/reference/GITHUB_GOVERNANCE.md) as the source of truth for labels, PR quality bar, CODEOWNERS, and main-branch protection.
- Use [SUPPORT.md](SUPPORT.md) for support paths and [SECURITY.md](SECURITY.md) for private vulnerability reporting.
- Repository labels are versioned in [.github/labels.json](.github/labels.json) and synced with [scripts/github/sync-labels.ps1](scripts/github/sync-labels.ps1).
- Community expectations are documented in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Original project material is available under the [MIT License](LICENSE).
The `sdk/` boundary remains Apache-2.0, and third-party components retain their
own licenses and notices. See [LICENSING.md](LICENSING.md) for scope and history,
and [TRADEMARKS.md](TRADEMARKS.md) for the separate brand policy.

## Production Notes

- Reverse proxy in production is `Caddy`, not `nginx`
- App VM currently runs `backend + frontend + caddy + postgres`
- Dedicated ingest runs on a separate `video-worker` VM
- Media edge auth is live on Cloudflare Free through a Worker custom domain
- The canonical production surface map is in [docs/reference/PRODUCTION_SURFACES.md](docs/reference/PRODUCTION_SURFACES.md)

## Contribution Rule of Thumb

If you change runtime behavior, update:

1. code
2. the relevant runbook/reference doc
3. [CHANGELOG.md](CHANGELOG.md)
