---
name: playwright-cli
description: Verify a local web application in a real browser with the installed Microsoft Playwright CLI. Use for UI smoke tests, forms, navigation, responsive checks, screenshots and browser errors.
---

# Browser verification in Bob

Run `scripts/Use-DevEnv.ps1`, then `playwright-cli.cmd --help`. The CLI is pinned
in `tooling/package-lock.json`; do not install another browser automation stack.
Start the application's documented local dev server and record its actual URL.

Use a disposable named session owned by this task:

```powershell
playwright-cli.cmd -s=bob-ui-check open http://127.0.0.1:4200 --browser=chrome
playwright-cli.cmd -s=bob-ui-check snapshot
```

Replace the example port with the observed server port. Read the snapshot file.
Use current element references from that snapshot for `click`, `fill` and similar
commands; refresh the snapshot after navigation or a substantial page change.
Run a command's `--help` when its arguments are uncertain. Never invent selectors
or use stale element references.

For assertions, `run-code --filename path/to/check.js` accepts an async function
receiving `page`. Use observed roles, labels or test IDs. Assert an observable
result and throw on failure; merely clicking or taking a screenshot is not a test.
Check console/network failures where relevant, an important error or empty state,
and the viewport needed for the demo. Save useful screenshots under ignored
`test-results/`, then inspect them before describing their visual contents.

PowerShell quoting is simpler with a small code file than a long inline argument.
Do not assume CLI exit status alone proves success: inspect its returned result
and any reported error. Record the URL, action, expected result and actual result.

Close only the session created by this task:

```powershell
playwright-cli.cmd -s=bob-ui-check close
```

Default to headless, in-memory profiles. Do not reuse a personal browser profile,
save authentication state into Git, or run `close-all` / `kill-all` on others' sessions.
Use `scripts/Check-Browser.ps1` to diagnose the toolchain; its synthetic fixture
does not verify the hackathon product or replace IBM Bob task-summary evidence.

Adapted to Windows and Bob from Microsoft's Playwright CLI documentation;
see `docs/PREEXISTING.md` for the preparation source and `docs/BOB-SETUP.md` for local prerequisites. Use the existing frontend Playwright suites for product regression tests.
