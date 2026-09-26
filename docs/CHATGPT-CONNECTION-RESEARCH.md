# Personal ChatGPT connection — research and implementation boundary

Researched by Codex on 26 September 2026 (Vietnam, UTC+7), before Bob's follow-on
implementation. This document is research, not proof that a live integration works.

## What is established

- OpenAI's authentication guide describes ChatGPT subscription authentication
  for Codex clients: https://developers.openai.com/codex/auth.
- OpenAI documents an app-server integration API:
  https://developers.openai.com/codex/app-server.
- OpenClaw's own provider documentation explicitly describes external-tool
  subscription OAuth support: https://docs.openclaw.ai/providers/openai.
- `vishhvak/chatgpt-oauth` is a real MIT-licensed implementation, inspected at
  `53299ef0b335b53f6204b1c64a316a48567ca76e`:
  https://github.com/vishhvak/chatgpt-oauth/tree/53299ef0b335b53f6204b1c64a316a48567ca76e.
  Its author labels it experimental and unofficial, using the Codex public client
  and an undocumented subscription transport. The README describes subject-keyed
  custody and cautions against hosted use without approval for the exact use.
- `Xyntera/chatgpt-login-app` is another MIT example of the device-code flow:
  https://github.com/Xyntera/chatgpt-login-app. Its browser token exposure and
  client-supplied device identifiers should not be copied into this LMS.

The specific Tibo X announcement has not been verified directly. Secondary
reporting is not sufficient to claim that any multi-tenant LMS deployment is
officially approved. An OSS license authorizes reuse of code, not provider access.

## Product decision for Bob to assess

Keep LMS authentication. A logged-in learner may optionally connect their own
ChatGPT subscription for their own questions. No pooled account, no imported
Codex auth cache, no silent fallback to someone else's credentials. Wiii remains
available as the existing provider. Cloud AI is online-only; offline courses work
independently. Do not claim a generic OpenAI identity/SSO service.

Prefer the current Spring/Angular stack over adding a Node sidecar. An explicitly
experimental, disabled-by-default personal/self-hosted connection is an acceptable
bounded prototype. A public hosted launch needs a separate provider-use decision.
If implemented with in-memory credentials for the hackathon, label restart and
single-instance limits and never claim durable or horizontally scaled support.
Refresh tokens need not be retained for a short-lived prototype: expired access
can require reconnection. This avoids token rotation/persistence complexity.

## Essential implementation criteria

- Fixed allowlisted provider endpoints; no user-supplied upstream URL or token.
- Every status/connect/poll/chat/disconnect operation derives its UUID from the
  authenticated LMS principal, never from request fields or unverified JWT claims.
- Pending device flow stays server-side, bound to that principal and an opaque
  attempt ID. Enforce upstream polling interval, expiry, cancellation and stale
  generation checks. A cancel or replacement must not resurrect a connection.
- Access tokens stay in bounded, expiring server memory. Discard refresh tokens
  if not implementing encrypted durable storage. Do not include credentials in
  DTOs, exception messages, logs, URLs, localStorage, IndexedDB or screenshots.
- Status returns only safe connection metadata. All connection endpoints use
  `Cache-Control: no-store`. Angular service-worker/offline mutation queues must
  not cache or replay connection/chat operations.
- Bound inputs, output size, pending connections, request time and concurrent
  requests per user; close failed or cancelled upstream streams. No model tools,
  code execution, autonomous browsing or student-data collection are needed.
- Handle authorization pending, expiration, device auth disabled, provider
  unavailable, account entitlement failure, 401 and 429 with clear recoverable UI.
- The learner explicitly opens the OpenAI verification page and approves login.
  Automation must not enter their password or approve consent for them.
- Tests must cover two-user isolation, stale polling after disconnect, pending
  timeout, polling rate, token non-disclosure, bounded chat output, provider errors,
  and offline UI. Label mocked provider tests; live authentication is separate.

## Protocol source

Use the pinned MIT source as a reference, verify exact requests from source, and
retain attribution/license if copying code or material portions of implementation:
https://github.com/vishhvak/chatgpt-oauth/blob/53299ef0b335b53f6204b1c64a316a48567ca76e/PROTOCOL.md.

The documented device sequence is user-code POST, interval-governed poll, then
authorization-code exchange using the returned verifier. The subscription response
transport streams SSE and requires a model, list-valued input, `store:false` and
`stream:true`; it differs from the public Platform Responses API. Do not treat
mock tests or a protocol document as evidence of present live compatibility.

## Open before live use

Bob must record its final design, actual tests and remaining limitations. The
owner must perform the first consent step; a successful token exchange and one
real answer must be demonstrated before claiming live ChatGPT connectivity.
