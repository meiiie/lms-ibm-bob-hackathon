# Offline assistant baseline — coordinator verification

Observed 26 September 2026, 01:19 UTC+7 (Vietnam). Executed by Codex using
Python Playwright and installed Chrome, headless, against the existing production
frontend build from the preparation checkpoint (application sources at `6f300567`,
unchanged by documentation-only `d70ac29f`). Bob had edited source but had not built
it yet; this observation concerns the original compiled app.

Fixture: localhost port 4311, `/student/storage`, synthetic user
`qa@example.invalid`, fake LMS tokens, mocked AI health and ancillary read APIs,
and a mocked 503 token response. All non-localhost requests were blocked. Service
workers were blocked for this focused sidebar test; this is not a complete PWA
download/sync acceptance test and uses no production accounts or data.

Steps: load the existing storage screen online, switch the browser context offline,
then click the existing `Mở trợ lý AI` button. The actual Angular sidebar rendered
`Không thể kết nối AI. Vui lòng thử lại sau.` with a retry button, instead of an
offline explanation. Exactly one `/api/v3/ai/token` request was observed, despite
the browser already being offline. The offline storage screen also showed a new
pending sync item; inspect the offline interceptor before treating cloud AI
mutations as replayable learning progress.

No browser page errors were observed. The fake refresh token only supplies an
expiry to the frontend fixture; no real authentication was performed.

Local reproducibility artifacts (ignored): `.tools/baseline-sidebar.py`,
`.tools/baseline-offline-sidebar.png`. Command:

```powershell
$env:PYTHONIOENCODING='utf-8'
python .tools\baseline-sidebar.py
```

## Review findings sent to Bob

- First implementation hid the reconnect button inside the offline-only template
  branch; once online returned it displayed a spinner indefinitely.
- In-flight generations must be invalidated on connectivity loss, not only on
  destroy. Test offline -> online before the original promise resolves.
- Check both exact origin and the currently mounted iframe window. A missing
  iframe must also reject a message. Refresh completion must target the same
  iframe generation, not a replacement mounted while the refresh was pending.
- Duplicate retry clicks should issue only one token request, not merely discard
  the first result after issuing two requests. A reconnect state must not appear
  during ordinary online initialization.
- Existing `offline.interceptor.ts` bypasses auth/sync/actuator, but not AI. Add
  narrowly scoped protection for cloud token/chat operations with a regression
  test so an interrupted online attempt cannot later be replayed from IndexedDB.

These are coordinator findings to fix and verify, not completed checks or Bob
authorship. Final results belong in the workstream handoff after tests pass.
