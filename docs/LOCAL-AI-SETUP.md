# Local study assistant setup

Updated: **26 September 2026, Vietnam (UTC+7)**. Prepared by Codex after the IBM
Bob quota stop. These instructions describe the experimental local-provider
implementation; read the verification status below before presenting a demo.

## What works where

**ChatGPT needs an internet connection.** An installed PWA does not contain
ChatGPT or its model. Downloaded LMS lessons can remain usable offline without
any AI runtime.

The **Local model** option sends a question directly from the learner's browser
to a model server on that **same device**. A downloaded model, a running server,
available memory, and browser permission are still required. It can answer
without internet once those prerequisites have been prepared and verified.

| Provider | Fixed endpoint used by this preview | Requests |
| --- | --- | --- |
| Ollama | `http://127.0.0.1:11434` | `GET /api/tags`, `POST /api/chat` |
| LM Studio | `http://127.0.0.1:1234` | `GET /v1/models`, `POST /v1/chat/completions` |

There is no custom endpoint field, LAN-server mode, API-key field, or automatic
provider fallback in this preview. On a phone, `127.0.0.1` means the **phone**, not
a laptop on the same Wi-Fi. A production backend's `localhost` means that server,
not the learner's computer. This browser implementation deliberately avoids that
backend-routing mistake.

## Before going offline

1. Use a computer that can run the chosen model. Download the runtime and a local
   model while internet is available; inspect the runtime's hardware requirements.
2. Download the required LMS lessons and confirm that the actual installed PWA
   reopens them offline. A cached app shell alone is insufficient.
3. Configure access for the exact LMS origin, start the local server, and make
   one successful request through the sidebar while still online.
4. Disconnect from the internet while keeping the local runtime running. Verify
   a second local answer and the downloaded lesson. Cloud ChatGPT must remain
   unavailable in this state.

The commands below are setup instructions for the user to run deliberately. This
documentation task did not install software, pull a model, change environment
variables, or start a service.

## Ollama on Windows — preferred prototype path

Ollama binds to loopback port 11434 by default. Its official configuration supports
`OLLAMA_ORIGINS` for additional web origins and `OLLAMA_NO_CLOUD=1` for local-only
mode. [Official Ollama configuration](https://docs.ollama.com/faq)

### 1. Prepare a downloaded model

Install Ollama from its official distribution if necessary. Check models already
on the machine before downloading another:

```powershell
ollama list
```

If the desired model is absent, download it while online. The following is the
model used in this team's limited shell probe; it is an example, not a guarantee
that it fits every participant's device:

```powershell
ollama pull gemma3:4b
```

Avoid cloud-tagged or remotely backed models for an offline demonstration. The
LMS filters known Ollama cloud identifiers and `remote_host` / `remote_model`
metadata, but the runtime's configuration remains authoritative.

### 2. Allow only the actual LMS origin

An origin consists of scheme, hostname and optional port, without a page path.
For example, `http://localhost:4200` and `http://127.0.0.1:4200` are different
origins. Copy the origin of the LMS page you actually opened.

For a temporary PowerShell-hosted Ollama process, first quit the existing Ollama
tray application normally so that two servers do not compete for port 11434.
Replace the placeholder below with the real deployment origin before running:

```powershell
# Placeholder: replace with the real HTTPS origin of this team's fork.
$lmsOrigin = 'https://YOUR-FORK-DOMAIN.example'
$env:OLLAMA_ORIGINS = $lmsOrigin
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD = '1'
ollama serve
```

For local development, replace `$lmsOrigin` with the exact dev-server origin.
These environment changes affect this PowerShell process and the server launched
from it. Keep the terminal running; stop that server with Ctrl+C after the demo.
For the tray application, use **Edit environment variables for your account**,
set the same values, and restart Ollama normally, as the official FAQ describes.
Record existing values before changing them so they can be restored.

Do not use `OLLAMA_ORIGINS=*`, bind to `0.0.0.0`, open a firewall port, or create a
public tunnel to make this preview work. This implementation only calls loopback.

### 3. Check the server, then check the browser

In another PowerShell terminal:

```powershell
$modelList = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags'
$modelList.models | Select-Object name
```

This proves only that the shell can reach the model catalog; it does not prove
browser CORS or Local Network Access permission. The API is documented in
[List models](https://docs.ollama.com/api/tags) and
[Generate a chat message](https://docs.ollama.com/api/chat).

Open the LMS sidebar, choose **Local model**, select **Ollama · port 11434**, and
click **Check connection**. Choose a downloaded model and send a short question.
The application never probes the runtime merely because the sidebar opened.

## LM Studio — controlled single-device preview

LM Studio provides an OpenAI-compatible API, but this project's adapter has not
been verified against a real LM Studio installation. It sends no bearer token.
An authenticated LM Studio server is therefore unsupported by this preview.
Do not disable authentication on an existing shared or sensitive server to work
around that limitation; use the Ollama path or wait for authenticated support.

For a dedicated local test instance:

1. Download a suitable model in LM Studio and load it.
2. Open the **Developer** page and **Server Settings**.
3. Set **Server Port** to **1234**.
4. Keep **Serve on Local Network** off.
5. The browser requires **Enable CORS**. The official documented control is a
   switch, not an exact-origin allowlist. Do not describe it as origin-restricted.
6. This preview can connect only when **Require Authentication** is off, LM
   Studio's documented default. Its official guidance recommends authentication
   when CORS is enabled; this limitation makes the setup appropriate only for an
   explicitly controlled single-device experiment, not a production deployment.
7. Leave MCP integrations disabled; this LMS adapter does not use them. Start the
   API server, select **LM Studio · port 1234** in the sidebar, and click
   **Check connection**.

The equivalent documented CLI command for a dedicated test process is:

```powershell
lms server start --bind 127.0.0.1 --port 1234 --cors
```

Avoid keeping unrelated browser tabs open during this unauthenticated CORS test,
and stop the test server when finished. For ongoing use, prefer an authenticated
integration with deliberate origin controls; this adapter does not implement it.

Sources: [Server settings](https://lmstudio.ai/docs/developer/core/server/settings),
[authentication](https://lmstudio.ai/docs/developer/core/authentication),
[server start command](https://lmstudio.ai/docs/cli/serve/server-start),
[local API server](https://lmstudio.ai/docs/developer/core/server).

## Browser permissions and offline behavior

CORS permission from the runtime and Local Network Access permission from the
browser are **separate**. Chrome gates requests from a public website to local or
loopback services behind a site permission, and permission requests require a
secure context. Use HTTPS for the deployed LMS; localhost development is a
separate local testing context. Allow the local-network request only for the LMS
origin you intend to use. Never disable web security or bypass the browser's
permission system to make a demo pass.

Browser engines, versions, enterprise policies, and HTTP/HTTPS handling differ.
A working PowerShell request is insufficient to promise compatibility in Safari,
Firefox, or every installed PWA. Verify the actual target browser. Chrome's
[Local Network Access guidance](https://developer.chrome.com/blog/local-network-access)
explains the secure-context and loopback boundaries; its
[Chrome 141 release notes](https://developer.chrome.com/release-notes/141)
record the permission-gated restriction. Do not apply old Private Network Access
preflight workarounds or relax CORS globally.

Loss of internet does not necessarily make loopback unreachable. Conversely,
`navigator.onLine` does not prove the local model is running. The local panel
uses an explicit connection check; it does not treat cloud online/offline state
as a substitute for runtime reachability.

When testing offline, avoid confusing DevTools' broad network-emulation switch
with actual internet loss: an emulation mode may block the local request too.
Test the real installed PWA and loopback path on the intended device, document
the method, and keep the runtime running.

## Data handling and current limits

- Only the question explicitly sent is passed to the selected local endpoint.
  The initial local adapter does not automatically send lessons, student records,
  page HTML, or conversation history.
- Requests use isolated browser `fetch`, not LMS auth/offline interceptors. They
  omit cookies, LMS JWTs and bearer credentials, disallow redirects, bypass the
  Angular service worker, and are not queued or automatically retried.
- A question is limited to 2,000 characters. The current response budget is
  256 generated tokens, a 90-second request timeout and a bounded response size.
  Initial model discovery has an 8-second timeout. Cold model loading may fail
  these limits on a small machine.
- Ollama requests release the loaded model afterward (`keep_alive: 0`) to reduce
  retained memory. Subsequent requests may pay the loading cost again.
- Draft and answer state exists only in memory; it is not a saved chat history.
  Reloading or destroying the panel can discard it. Copy important study notes
  to the normal learning workflow if needed.
- Cancel stops the browser request. The runtime may briefly continue generation.
  There is no automatic replay when internet or a runtime returns.
- The application does not forward a failed local question to ChatGPT or another
  cloud provider. Runtime-level proxying, telemetry and logging still depend on
  the user's own runtime settings; the LMS cannot certify a third-party server.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cannot reach local server | Runtime is on this same device, correct fixed port, exact LMS origin allowed, browser local-network permission granted. |
| Shell succeeds; browser fails | Inspect browser CORS/LNA errors. Shell success does not validate either permission. Check that the LMS uses its actual allowed origin. |
| No eligible model | Download a local model first. Ollama cloud models are intentionally excluded. Select/load an LM Studio model before retrying. |
| Timeout | Model may exceed RAM/VRAM or load slowly. Try a smaller downloaded model and a short prompt; do not keep resending while another generation runs. |
| LM Studio rejects requests | Check whether authentication is required. This preview cannot send a token; do not weaken an existing protected server. |
| Phone cannot see laptop model | Loopback targets the phone. Remote/LAN model access is not implemented. |
| Offline lesson works but AI fails | The PWA cache and local model runtime are independent. Confirm both prerequisites separately. |

## Verification status

At this documentation checkpoint on 26 September:

- The team's existing Ollama instance returned a real answer using `gemma3:4b`
  to a harmless lifeboat study question in **18.34 seconds**, as reported by the
  backend implementation agent. This was one **shell-to-provider** probe, not a
  benchmark, browser test, or proof of offline PWA operation.
- LM Studio was absent from the inspected machine; no real LM Studio answer was
  verified.
- The later real-Chrome run passed **14 acceptance groups** with synthetic LMS
  identity/provider fixtures and exactly one actual Ollama question. Chrome
  153.0.8010.53 displayed this `gemma3:4b` response: "A nautical mile is
  approximately 1.15 statute miles or 1.852 kilometers, used for measuring
  distances at sea." Cloud routes were blocked by the browser fixture while
  real loopback requests remained allowed; host networking stayed enabled.
- The same browser run verified desktop/mobile layouts, explicit connection
  checks, cloud-model filtering, cancellation/runtime switching, no LMS
  JWT/cookies/referrer, plain-text answers and no offline queue. LM Studio
  responses in that run were synthetic. Mobile used Chrome viewport/touch
  emulation, not a physical phone.
- The command was `python scripts/verify-ai-sidebar.py --real-local --output
  .tools/assistant-polish-browser-verified` with the frontend already running on
  `http://127.0.0.1:4311`. Screenshots and the actual question/answer are retained
  locally under that ignored output directory. The flag deliberately sends one
  real question to an existing `gemma3:4b` runtime; omit it for fixtures only.
- A full installed-PWA/service-worker offline scenario, production HTTPS
  local-network permission, other browsers and real LMS backend transport remain
  unverified. These limits are independent of the successful local Chrome answer.
- This local feature does not resolve the separate pending verification of a
  real ChatGPT answer using the configured cloud model.

Research used official provider and Chrome documentation, checked on
26 September 2026. Agent Reach reported installed v1.5.0 current; no update or
installation was performed.
