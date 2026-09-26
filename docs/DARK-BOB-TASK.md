# Dark workstream — Bob implementation brief

Owner authorization (26 September 2026, Vietnam UTC+7): take over Dark's AI and
optimization work, choose a practical implementation, test it, create a PR and
merge it in `meiiie/lms-ibm-bob-hackathon` when verification passes. This is actual
Bob work coordinated by Codex for the owner; do not attribute it to Dark personally.
The selected branch is `codex/dark-offline-assistant` from `d70ac29f`.

## First deliverable: an offline-safe assistant sidebar

Read AGENTS.md, WORKSTATE and the Ponytail skill. Implement, do not stop at a plan.
Reuse the existing Angular ChatPanelComponent, AiTokenService and
NetworkStatusService. The product already has Wiii embedding; that is reused code.
Toshiro owns broad i18n and Fainz owns deployment: avoid their scope.

Baseline to reproduce: ChatPanelComponent initializes a cloud token exchange
unconditionally and only distinguishes generic error/loading states. Inspect
the actual behavior, add a regression demonstrating the relevant missing behavior,
then make the smallest robust change.

Acceptance:
1. Opening the sidebar while offline displays a clear, accessible offline state
   with useful guidance to continue downloaded lessons. It does not exchange an
   AI token or instantiate a cloud iframe, and the panel can still be closed.
2. Losing connectivity during initialization cannot resurrect a stale iframe
   when an earlier promise completes. Teardown cannot commit stale async results.
3. Reconnection offers a deliberate retry or a bounded single recovery; no
   automatic request loop or duplicate initialization. Online Wiii behavior works.
4. Token exchange failure has retry; local offline study is never blocked by AI.
   Keep exact-origin iframe checks; reject messages from an unrelated window even
   if the message claims the trusted origin. Do not print tokens.
5. Meaningful Angular tests cover offline open, loss during pending init,
   reconnection, teardown, and existing online integration. Run the targeted tests
   in ChromeHeadless and build. Add real-browser coverage using the existing
   Playwright tooling and explicitly labeled stubbed AI responses if needed.
6. Record exact commands/results, the pre-existing/new boundary, and a short
   English demonstration guide. Update WORKSTATE and this scope in PRD.

Keep changes scoped. Preserve the lockfile and stack. Existing local frontend
dependencies and pinned Node are available. Local Docker is currently unavailable;
do not reset Docker or use production services. CI has a working Docker smoke.

You are authorized to edit/test/commit/push this branch and create a PR into the
fork's main. Use `gh ... --repo meiiie/lms-ibm-bob-hackathon` explicitly. Never
publish into upstream `linhlinhlin/LMS_hohulili`, force-push, deploy production, or
change repository security settings. A fresh independent verification and green
CI on the final head are required before merge. The coordinator will arrange that
verification and attach the PR. Stage only intended files. Do not invent Bob
screenshots or task statistics; the coordinator will export actual task evidence.

## Follow-on investigation: personal Sign in with ChatGPT

The user explicitly wants this researched and implemented if feasible. It is a
connection to a learner's own AI subscription, separate from LMS authentication.
Do not dismiss it as nonexistent: these real sources were inspected today:

- https://github.com/vishhvak/chatgpt-oauth — MIT, experimental unofficial SDK;
  subject-keyed credential custody, device flow, refresh and inference. Its author
  warns that the Codex public client and backend protocol may change.
- https://docs.openclaw.ai/providers/openai — states that OpenAI supports
  subscription OAuth in external tools and workflows like OpenClaw.
- https://developers.openai.com/codex/auth — official Codex authentication.
- https://developers.openai.com/codex/app-server — official integration surface.

The exact Tibo X post remains unverified; do not cite secondary reporting as an
original announcement or claim arbitrary LMS SSO is supported. First complete the
offline sidebar slice, then report a concrete feasible design for the optional
personal connection using the existing Angular/Spring stack, with per-LMS-user
credential isolation, no token pooling, no browser persistent token storage, no
reuse of the owner's existing Codex credentials, and an explicit connect action.
Do not add a misleading sign-in button that lacks a working backend. The
coordinator will send the follow-on implementation brief after reviewing this slice.
