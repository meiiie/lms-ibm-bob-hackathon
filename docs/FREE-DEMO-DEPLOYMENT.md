# Free public demo deployment

Updated **26 September 2026**. All team times below use **Vietnam, UTC+7**.

## Decision and current status

Use **Cloudflare Pages + Railway Full Trial + Neon Free** for a small, separate
hackathon demo. Pages serves the Angular PWA; a Pages Worker proxies approved API
requests to one fixed Railway backend; Neon stores the demo's PostgreSQL data.
This retains the existing Angular / Java 21 / Spring Boot application.

Account setup and official CLI authorization are complete. The frontend is
published at [neko-core-lms-demo.pages.dev](https://neko-core-lms-demo.pages.dev)
from the CI artifact for `86ceb885` (run `36240432617`). A native backend connected
to the separate Neon database passed health, student login, and 31-lesson checks.
Railway deployment succeeded and the public backend and genuine browser login
work. **Offline text reload, completion persistence and real backend reconnect
sync passed at 20:35 UTC+7.** See [actual evidence and limits](DEMO-VERIFICATION.md).
Physical-device installation and offline video are not tested.

The Railway part is a **time-limited credit trial**, not permanent free hosting.
Do not add a payment method, upgrade a plan, enable paid add-ons, or assume that
the demo will stay online through judging without checking the remaining credit.

## Resource and cost boundaries

| Component | Selected allowance | Practical boundary |
| --- | --- | --- |
| Cloudflare Pages Free | 500 builds/month; 20,000 files; 25 MiB per file; static requests are free and unlimited | API proxy requests consume the Workers Free allowance, shared with other Workers on the account: 100,000 requests/day. Do not bundle large videos. |
| Railway Full Trial | One-time $5 credit, expiring after 30 days; up to 1 GB RAM per service; no credit card required | Verify **Full Trial**, available credit, and resource limits in the actual account. Limited Trial restricts outbound networking and can prevent database/API connections. After trial, Free provides only $1/month and up to 0.5 GB RAM/service. |
| Neon Free | 0.5 GB storage/project; 100 CU-hours/project/month; 5 GB public network transfer; scale to zero after 5 idle minutes | Use a small synthetic dataset. Idle database connections/background work can affect actual usage. Do not enable a paid plan to resolve a quota error. |

Railway documents Free-tier deployment restrictions from 08:00 to 20:00 in each
region's local timezone. For Singapore that is **07:00–19:00 UTC+7**. Confirm
whether the actual trial account is affected; do not promise deployment during a
blocked period. Existing deployments are not stopped by this scheduling rule.

If Railway is unavailable, **Render Free + Neon** is a fallback only after testing
the backend within 512 MB RAM / 0.1 CPU. Render sleeps after 15 idle minutes and
usually needs about one minute to wake. Its filesystem is ephemeral. Render's
own Free Postgres expires after 30 days, so it is not the selected database.
The native backend peaked at **552.3 MB RSS with `-Xmx384m`**; this is not proof
that Render's 512 MB limit is sufficient, and heap size is not total process RAM.

## Demo isolation and feature scope

- Create new demo resources and a new database. Leave the upstream production
  domains, deployment workflows, accounts, databases, and storage untouched.
- Use `deploy/demo-backend/Dockerfile`, configured explicitly in Railway's
  service settings and `RAILWAY_DOCKERFILE_PATH`; use Spring profiles
  **`prod,demo`**. The rejected legacy `railway.json` was removed. This is a separate
  demo target, not the inherited production stack.
- Use the Pages files in `deploy/demo-pages/` and
  `scripts/build-demo-pages.mjs`. Bind the proxy to the **verified demo backend**;
  never turn it into an arbitrary URL proxy. Database/JWT secrets belong only in
  backend environment settings, never frontend assets or Git.
- The public experience is a **synthetic student demo**. Its account guard and
  seed data must pass verification before public access. Do not publish admin or
  teacher credentials, expose account promotion, or seed real people or courses.
  Do not reuse the inherited development administrator account.
- Keep `CHATGPT_CONNECTION_ENABLED=false`. Do not copy Wiii, payment, mail,
  Google OAuth, media-storage, or other production integration secrets. A local
  model runs on the visitor's own device and is not included with hosting.
- Do not deploy Gotenberg or enable document conversion and video transcoding
  jobs. The original multi-service Compose topology does not fit these limits.
  Uploaded files on ephemeral storage are not durable demo evidence.

## Deployment sequence

1. **Account owner:** Railway and Neon signup/authorization are complete. The
   actual Railway account showed **$5 credit / 30 trial days**, with no card added
   and no plan upgrade. Recheck remaining credit before the handoff. Signup alone
   does not prove deployment readiness.
2. **DevOps owner:** create a dedicated Neon Free project/database. Store its
   TLS-enabled JDBC connection details in Railway secrets; do not paste them into
   shared instructions, screenshots, or a public issue.
3. Deploy the dedicated backend from a reviewed, recorded Git revision. Use only
   **one replica in Singapore**, as configured for this account. Set the
   demo database, a new random JWT secret, `prod,demo` profiles, and required demo
   account settings. Confirm the student guard and seed behavior before exposing
   it. Keep all optional external integrations disabled.
4. Verify backend startup, migrations and `/actuator/health`. Configure Railway's
   target port to match the application's listening port; its default healthcheck
   timeout is 300 seconds. A successful build alone is not a healthy API.
5. Build and publish the Pages artifact with its fixed API backend binding. Set
   the backend's demo base URL and allowed origin to the actual Pages URL. Use
   explicit demo origins, not inherited production URLs or wildcard credentials.
6. Run the checks below against the published HTTPS origin. Record the exact
   revision, URL, commands and results, then give Fainz / the DevOps owner the
   handoff. Do not label a static landing page as a working LMS demo.

### Commands and verified deployment record

The deployment owner must replace **PENDING** with commands that were actually
run. No credential values belong in this table.

| Item | Verified value |
| --- | --- |
| Source commit / PR | PR #4; frontend artifact built from `86ceb885`, CI run `36240432617` |
| Backend configuration and deploy | Explicit Dockerfile `deploy/demo-backend/Dockerfile` plus `RAILWAY_DOCKERFILE_PATH`; health `/actuator/health`, timeout 300 seconds, restart `ON_FAILURE` with 3 retries, one Singapore replica. Settings verified through the official CLI's GraphQL `serviceInstanceUpdate`. Source `c9c67946` was archived from tracked files only, then `npx.cmd --offline @railway/cli up .tools/demo-upload-c9c67946 --path-as-root --no-gitignore --service lms-api --environment production --detach` deployed it to the linked isolated project. Deployment `84e5413c-3d70-4b5e-9109-b52623182084` succeeded. |
| Pages build and deploy commands | CI ran `node scripts/build-demo-pages.mjs`; downloaded its `demo-pages` artifact and verified with `node scripts/build-demo-pages.mjs --check-only`; deployed from `deploy/demo-pages` with `npx.cmd wrangler pages deploy --project-name neko-core-lms-demo --branch main` |
| Public HTTPS demo URL | `https://neko-core-lms-demo.pages.dev` — real UI login, course download, offline reload/progress and reconnect passed; see `docs/DEMO-VERIFICATION.md` |
| Backend health / database migration result | All 131 migrations through version 159 applied to the new Neon database; one enabled student and zero enabled privileged users. Native smoke and 72 focused tests passed. Railway also reports `UP` with startup in 15.725 seconds; observed memory 495.8 MB / 1,024 MB. Public Pages-proxy checks at 20:30 UTC+7 passed login, role verification, blocked admin/registration/encoded-password/checkout requests and disabled cloud AI. |
| Synthetic student access instructions | The owner's ignored `.tools/demo-access.local.md` contains the demo URL and learner credentials. Share through the team's private handoff; never substitute administrator credentials or commit passwords. |
| Remaining Railway credit and check time (UTC+7) | $4.99126 / 30 trial days on 26 September around 20:31; credit decreases while resources run |
| Pages Functions failure policy | Production and preview `fail_open=false` verified through the official Cloudflare API; the fixed backend binding was preserved and API health rechecked. Quota exhaustion itself was not forced. |

Railway setup required two corrections: the first attempt rejected multiple
regions, so San Francisco was removed; the second used Railpack autodetection and
failed, so the service now selects the Dockerfile explicitly. Railway also
rejected a new `railwayConfigFile` setting as deprecated, despite the CLI noting
that existing files work until 1 December. The verified service settings above
are the actual deployment configuration; do not require a newly attached config
file or describe either failed attempt as a successful deployment. The unused
legacy file has been removed from the final branch; these are explicit service
settings, not a claim that configuration-as-code is active.

## Acceptance and handoff

- A fresh browser can open the public HTTPS site, enter the synthetic student
  experience, and read the seeded lesson. No production resource is required.
- Attempts to enter administrator/teacher functions or change the demo account's
  privileges are rejected by the server, not merely hidden in navigation.
- Download a demo lesson, then verify reload and reading through the installed
  service worker while offline. Distinguish browser offline emulation from a
  physically disconnected device; report the actual method used.
- ChatGPT is clearly unavailable/off by default; no cloud AI claim is made from
  a mocked result. Same-device Ollama/LM Studio still require the visitor's own
  runtime and any browser local-network/CORS permission.
- Check refresh/deep links, mobile layout, API errors, and backend wake/restart.
  Record which features are excluded and whether uploaded content survives.
- Handoff to Fainz / the DevOps owner: verified URL, revision, safe student access,
  logs without secrets, credit check time, known limitations, and who will stop
  the trial resources or extend hosting before credit expires. Do not alter a
  teammate's deployment or merge their work as part of this setup.

Public deployment does not replace the video, slides, or real Bob session
evidence. Attribute Codex-created deployment work accurately; keep Bob task
summaries and the evidence manifest separate from infrastructure logs.

## Primary sources checked on 26 September 2026

- [Railway Free Trial and account verification](https://docs.railway.com/pricing/free-trial)
- [Railway plans and current resource limits](https://railway.com/pricing)
- [Railway deployment scheduling and ephemeral storage](https://docs.railway.com/deployments/reference)
- [Railway healthchecks and port configuration](https://docs.railway.com/deployments/healthchecks)
- [Neon plan quotas and scale to zero](https://neon.com/docs/introduction/plans)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare static requests and Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Render Free limits and database expiration](https://render.com/docs/free)
