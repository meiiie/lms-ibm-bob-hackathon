# First Bob task — paste into Plan mode

```text
We are Neko Core, participating in the IBM Bob 2.0 Hackathon. This workspace is
our fork of the existing Maritime LMS. Read AGENTS.md, docs/WORKSTATE.md,
docs/PRD.md and docs/PREEXISTING.md before proposing changes. Then inspect only
the manifests, CI and tests needed for your recommendation.

Our goal is to demonstrate a measurable improvement to a developer workflow
using IBM Bob as a core tool. The LMS itself predates the event. Do not describe
its existing learning/offline features as new hackathon work. Neko Core is our
team name, not a library used by LMS. The setup was prepared with Codex; it is
not Bob usage evidence.

Use hackathon-slice and Ponytail. The candidate direction is reproducible
debugging and release verification for ONE existing LMS flow, preferably an
offline-learning regression if you can reproduce a real problem quickly.
This direction is a proposal, not a verified defect or an instruction to rewrite
the LMS. Preserve Angular 20, Java 21/Spring Boot, existing tests and lockfiles.

In this first task:
1. Confirm repository/branch and local changes, inspect actual setup, and report
   which existing app/test commands can run. Keep production untouched.
2. Identify at most two concrete developer pain points supported by repository
   evidence. Recommend one bounded slice with a demo path and failure case.
3. Define observable acceptance criteria, the smallest relevant tests, and a
   fair before/after measurement. Distinguish untested hypotheses from findings.
4. Present the recommended slice and files to change so we can agree scope.
   Do not begin broad application edits before scope is agreed. If Plan mode
   cannot write the proposed PRD/WORKSTATE updates, include their exact content
   for the next Build task rather than claiming you saved them.

Do not deploy, push upstream, change licensing, add frameworks or use real
student/payment data. Respect the task permissions; do not broaden auto-approval.
At completion, remind me to capture this real Bob task summary into bob_sessions/
and update its manifest. Deadline: 27 September 2026 22:00 Vietnam (UTC+7),
equivalent to 15:00 UTC. Our internal submission target is 20:00 UTC+7.
```

After agreeing scope, start **Hackathon Build** (or Agent) with the agreed criteria
and ask Bob to update PRD/WORKSTATE, implement the slice, run relevant checks and
report limitations. Keep one small integrated slice ahead of optional features.
