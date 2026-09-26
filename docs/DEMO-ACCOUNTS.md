# Demo role accounts

On 26 September 2026 the owner requested enabling all four LMS roles in the
isolated hosted demo. This supersedes the original student-only access policy.
Deployment and live acceptance of the new roles are in progress.

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
