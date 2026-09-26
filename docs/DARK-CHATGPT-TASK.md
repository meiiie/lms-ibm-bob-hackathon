# Bob follow-on: personal ChatGPT study assistant

Owner authorization continues from DARK-BOB-TASK.md. This brief was written by
Codex. Update, 26 September 2026: after Bob exhausted its quota, the owner
explicitly asked Codex to continue implementation. Attribute that follow-up to
Codex; reported Bob work must still come from actual Bob tasks.
Complete the offline-sidebar slice and its review first. Then implement this
bounded experimental feature on a separate codex branch from the verified head.

## Product outcome

A learner can explicitly connect their own ChatGPT subscription, ask a short
study question in the existing right sidebar, read a response, and disconnect.
Keep ordinary LMS login and the existing Wiii provider. Cloud AI is online-only.
No automatic upload of course content, student records, credentials or chat history.
Use English copy for this new optional panel; do not undertake global i18n.

Read CHATGPT-CONNECTION-RESEARCH.md. Use the pinned MIT protocol as a reference,
retaining attribution for copied implementation. Verify source before writing the
adapter. This is an experimental personal/self-hosted connection, disabled by
default; never advertise it as general ChatGPT SSO or approved public hosting.

## Small implementation

Use existing Spring WebClient, Caffeine, Jackson, validation and Angular services.
No separate Node service, agent framework, DB migration or new dependencies.
An opt-in environment setting enables the backend feature. Model is configured
server-side with a documented default verified from the pinned example.

- Authenticated endpoints under /api/v3/ai/chatgpt provide status, device start,
  polling, a single-question response, and disconnect. All use no-store responses.
- Derive the owner solely from the authenticated UserJpaEntity UUID. Store opaque
  attempt ID, provider device state and short-lived access credentials in bounded
  server memory. Never return provider tokens/device-auth ID/verifier to clients.
  Discard refresh tokens and require reconnect after expiry/restart. Document
  single-instance/restart limits. Separate pending flow from connected session.
- Fixed provider URLs; hard deadlines, strict input/output bounds, a per-user
  in-flight guard, poll interval and expiry. Disconnect/replacement invalidates
  asynchronous results. One user's operation cannot observe another user's data.
- Browser sees only verification URL/user code, opaque attempt ID, safe status,
  expiry, answer text and safe recoverable errors. A user opens the verification
  URL and performs consent. Do not automate credentials or read Codex auth files.
- Render plain response text, with no HTML trust or model tool execution. Bound
  upstream SSE aggregation, close on limits/errors, and return a concise JSON
  answer for this prototype. Do not log raw provider responses or secrets.
- On provider 401 invalidate the connection; distinguish rate limit, pending,
  expired, unavailable and cancelled states. Do not return raw exception bodies.
- Integrate the choice in the existing sidebar. Availability must not depend on
  Wiii being configured when the ChatGPT feature is enabled. When disabled, retain
  the current Wiii experience. Network loss never queues auth/chat mutations;
  there is no automatic replay. Cancel polling on destroy or disconnect.

Prefer a small provider adapter, owner-bound session service, thin controller,
and isolated Angular component/service integrated into the existing sidebar.
Avoid broad rewrites of the sidebar or shared authentication system.

## Verification and delivery

Tests: feature disabled; authentication requirement and principal ownership;
two-user isolation; pending interval/expiry; disconnect/replacement during poll
and chat; secret non-disclosure in API/errors; bounded response; 401/429/timeouts;
offline UI and duplicate clicks. Use mocked provider transport and label it.
Run targeted Maven tests, Angular tests, frontend build and real browser checks.
Do not claim live sign-in works until the owner has performed consent and a real
answer is verified. A missing live-account check must remain explicit.

Write concise English setup/demo instructions, .env.example setting, attribution,
and actual evidence. Update PRD, PREEXISTING and WORKSTATE without overwriting other
workstreams. Produce a reviewable PR to the fork; fresh Verify review and green CI
on its final head precede merge. The owner has already authorized PR and merge.
