# Demo role accounts

On 26 September 2026 the owner requested enabling all four LMS roles in the
isolated hosted demo. This supersedes the original student-only access policy.
All four accounts are deployed and have passed real hosted login and role checks.

Sign in at https://neko-core-lms-demo.pages.dev/auth/login. The role dashboard
is selected automatically after login.

| Role | Email | Intended use |
| --- | --- | --- |
| STUDENT | learner@demo.invalid | Read/download SAF-101 and test offline learning |
| TEACHER | teacher@demo.invalid | Existing SAF-101 course, learner and assessment management |
| ORG_ADMIN | orgadmin@demo.invalid | Management within the demo organization |
| ADMIN | admin@demo.invalid | System dashboards, users, courses and organizations |

Each role has its own random password. The complete English credential handoff
is the owner's ignored `.tools/team-demo-accounts.private.md`. Never put the
passwords in Git, screenshots or a public issue. These are LMS credentials, not
GitHub, Bob, Railway, Neon, Cloudflare or ChatGPT accounts.

The teacher keeps the existing SAF-101 teacher ID so course ownership, class
assignments and question banks remain linked. All four accounts use the demo
organization. Learner progress is preserved. Other inherited seed accounts stay
disabled and their known seed passwords are replaced with an unknown random hash.

The initializer restores the four demo identities on backend startup and disables
other accounts; this is a shared fixture, not a production user directory. Admin
actions change the shared demo data. The original payment, email, cloud AI, uploads,
media processing and related configuration restrictions remain because those
integrations are not provisioned. Ordinary role access uses the application's
existing Spring Security checks.

SAF-101 is self-paced. Instructor-led class-only APIs are not applicable to it;
use teacher course/learner views when demonstrating that course.

See [deployment handoff](FREE-DEMO-DEPLOYMENT.md) and [previous learner/PWA
acceptance](DEMO-VERIFICATION.md). The older reports are timestamped evidence of
the student-only deployment, not proof of these new role accounts.

## Verified rollout — 26 September 2026, Vietnam (UTC+7)

Final browser run finished at **21:35 UTC+7**: all **30 checks passed**. Evidence:
[role report](evidence/demo-roles-2026-09-26/role-acceptance.json),
[API boundaries](evidence/demo-roles-2026-09-26/api-boundaries.json),
[teacher course](evidence/demo-roles-2026-09-26/teacher-courses.png),
[organization dashboard](evidence/demo-roles-2026-09-26/org_admin-home.png),
[admin search](evidence/demo-roles-2026-09-26/admin-courses.png).
The screenshots include a test-run label; no account password or token is shown.

- Backend source: `1ea41ff5`; Railway deployment
  `b13a57d4-425b-414e-9278-e45cfdded645` is successful and health is UP.
  Startup took 17.105 seconds. No frontend redeploy was needed.
- The first live run found an inherited admin title-search HTTP 500: a native
  SQL query received the entity property `createdAt`, which PostgreSQL cannot
  resolve as a column. The repository adapter now maps timestamp sorts to SQL
  column names for native queries only; JPQL keeps entity properties.
- 134 focused backend tests and packaging passed, including four sorting
  regression cases, admin controller tests, all demo guards and initialization.
  Fresh independent source reviews found no actionable blockers.
- Fresh Chrome contexts logged in through the real UI for all four roles,
  rendered their portals and SAF-101 course lists, and exercised real API data.
  Teacher learner management includes the enrolled demo learner. Admin title
  search uses **STCW**, followed by **Enter**; it matches titles, not course codes.
- Learner/teacher system administration returns HTTP 403. The organization
  manager sees its own organization and cannot read system organization stats;
  the system administrator can. No failing UI API responses or browser runtime
  errors were recorded in the passing run.
- Read-only Neon before/after checks confirmed exactly one enabled account of
  each role, no other enabled users, unchanged course/class/teacher ownership,
  and identical learner enrollment progress. Default seed-admin login remains
  rejected. Registration, encoded password-change requests and payment checkout
  remain blocked; API responses use `private, no-store`.

Reproduce the browser check with `python scripts/verify-demo-roles.py --output
.tools/demo-roles-recheck` after placing the private credentials in the ignored
secrets file. Backend check from the normal checkout:

```powershell
mvn.cmd -f backend/pom.xml '-Dtest=CourseRepositoryImplPagingTest,AdminCoursesControllerV3Test,AdminCoursesControllerV3PendingFilterTest,DemoSafetyConfigurationTest,DemoRequestFilterTest,DemoDataInitializerTest,VideoPipelineHealthIndicatorTest' test
```

The actual local package check used `.tools/demo-verification-pom.xml` to redirect
output into `.tools/demo-maven-target`, with the same application source/tests,
`MAVEN_OPTS=-Xmx512m` and `-DargLine=-Xmx256m`. Full CI and final merge status are
recorded in [PR #5](https://github.com/meiiie/lms-ibm-bob-hackathon/pull/5).

This verifies online role access and read operations. It does not certify every
authoring/admin mutation, other organizations' data, physical mobile devices or
the external integrations above. Service workers were blocked for these online
role checks; the earlier offline learner acceptance remains a separate report.
All work in this rollout is Codex continuation, not Bob session evidence.
