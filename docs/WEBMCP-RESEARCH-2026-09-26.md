# WebMCP assessment for the LMS

Research date: **26 September 2026, Vietnam (UTC+7)**. Author: Codex, after the
team's IBM Bob quota stop. This is a design assessment, not evidence of an
implemented WebMCP integration or a successful live ChatGPT answer.

Later same-day implementation work added a separate experimental browser-to-local
provider path. See [Local AI setup](LOCAL-AI-SETUP.md) for its actual scope and
verification limits; the WebMCP recommendations below remain independent of it.

## Decision

**Make the study assistant useful through explicit, reviewable lesson context
first. Defer a WebMCP-dependent agent workflow until after the core demo is
reliable.** WebMCP is promising for this LMS, but it does not supply a model,
connect ChatGPT, or make a cloud model available offline.

An optional WebMCP adapter can later expose the same small application functions
to compatible browser agents. Ordinary buttons and the LMS's own sidebar must
continue to work without WebMCP, browser flags, or an extension. Do not upgrade
Angular during the hackathon just to obtain experimental framework helpers.

## What is verified as of this date

| Area | Verified status and implication |
| --- | --- |
| Standard | WebMCP is an evolving proposal / Community Group draft, not a completed cross-browser standard. |
| Chrome | Chrome Status lists developer trial 146, origin trial 149–156, and **planned** shipping milestone 157. Planned shipping is not proof that the installed browser enables it by default. |
| Local development | Chrome documents `chrome://flags/#enable-webmcp-testing`; origin-trial enrollment is the website route. The team has not enrolled this LMS origin or enabled a flag for users. |
| Other browsers | The project implementation list records Edge's origin trial from 150; Chrome Status records no Firefox/WebKit signal. This is insufficient evidence for broad production support. |
| API name | Current official docs and the pinned draft use **`document.modelContext`**. Tutorials using `navigator.modelContext` describe an older API shape. |
| Angular | Angular announced experimental integration in v22. This repository uses Angular 20.3; its native helpers cannot simply be imported here. Plain browser APIs can be wrapped without a framework migration. |
| ChatGPT Desktop | The WebMCP project's implementation list reports support. This is **not** evidence that this LMS's custom Java ChatGPT adapter, or every ChatGPT client, discovers page tools. |

Sources: [Chrome overview](https://developer.chrome.com/docs/ai/webmcp),
[Chrome feature status](https://chromestatus.com/feature/5117755740913664),
[pinned implementation list](https://github.com/webmachinelearning/webmcp/blob/69b73b4ab821ccb2e95a8b8551b15ab133bc862b/implementation-status.md),
[Angular v22 announcement](https://blog.angular.dev/announcing-angular-v22-c52bb83a4664),
[Angular documentation](https://angular.dev/ai/webmcp).

The W3C community repository was pinned to
`69b73b4ab821ccb2e95a8b8551b15ab133bc862b`, committed on
26 September 2026 at 01:20 UTC. Live documentation may change after this report.

### A concrete compatibility warning

Chrome's imperative guide, last updated 1 September, demonstrates
`executeTool(tool, '{"text":"..."}')`. The pinned 26 September draft explicitly
requires an **object**, for example `executeTool(tool, {message: 'hello'})`.
This disagreement must be resolved against the actual target browser and its
tests before implementing execution. Do not silently retry a mutating tool with
different argument forms: the first call might already have performed its action.

Sources: [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api),
[pinned draft](https://github.com/webmachinelearning/webmcp/blob/69b73b4ab821ccb2e95a8b8551b15ab133bc862b/index.bs),
[dated clarification](https://github.com/webmachinelearning/webmcp/commit/69b73b4ab821ccb2e95a8b8551b15ab133bc862b).

## Four separate pieces

| Piece | What it provides | What it does not provide |
| --- | --- | --- |
| WebMCP | Browser-page registration, discovery and execution of structured application tools in the page's current context. | An LLM, cloud credentials, autonomous orchestration, or a server endpoint. |
| Remote MCP | A client/server tool protocol, commonly using Streamable HTTP. | Automatic access to the user's open Angular page or its in-memory state. |
| Model provider | Inference through ChatGPT, Ollama, LM Studio, or another explicitly configured provider. | Knowledge of this lesson unless the application deliberately supplies it. |
| Agent orchestration | Selection, validation, execution, cancellation and display of tool calls and results. | Permission to expose private records or perform actions outside the user's request. |

The [WebMCP explainer](https://github.com/webmachinelearning/webmcp/blob/69b73b4ab821ccb2e95a8b8551b15ab133bc862b/README.md)
distinguishes in-page tools from backend integrations. The
[MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
describes server transports; those transports are not the WebMCP browser API.

At the research checkpoint, `ChatGptProviderAdapter.ask()` sends one question,
explicitly instructs the model not to execute tools, and sends no tool catalog.
`ChatgptApiService.ask()` accepts only that question. Registering WebMCP tools
elsewhere would therefore leave this sidebar's behavior unchanged. This finding
is based on local source inspection, not a live inference test.

## An appropriate first application

The immediate, cross-browser feature should let a learner choose a short lesson
excerpt, preview exactly what will be sent, and ask to explain it, summarize it,
or generate practice questions. Show a removable lesson-context chip and the
excerpt before sending. Never collect the whole DOM or silently include grades,
classmates, credentials, answer keys, or private instructor material.

Once that flow works, expose a few existing functions through an optional,
same-origin, read-only WebMCP adapter:

| Proposed tool | Useful result | Boundary |
| --- | --- | --- |
| `get_study_context` | Current lesson title and the excerpt the learner deliberately selected. | Only the reviewed selection; no hidden page scraping or account details. |
| `list_downloaded_lessons` | A bounded list of the learner's already downloaded lessons. | Local, current-user records only; no cross-user index. |
| `get_offline_readiness` | Whether required lesson content is already available locally and why something is missing. | Reuse actual cache checks; no invented readiness or automatic downloads. |

These are proposed capabilities, not implemented endpoints. Keep navigation as a
visible user action initially. Do not expose grading, enrolment changes, deletion,
payments, arbitrary URLs, or arbitrary JavaScript evaluation as tools.

For an internal sidebar agent, an explicit orchestrator would additionally need
to pass the reviewed tool definitions to a tool-capable provider, validate each
requested call, run the allowlisted application function, return its bounded
result to the model, and show the action to the learner. A direct Angular service
call is a simpler initial implementation; WebMCP can be another adapter around
that same service. A cloud backend cannot directly execute JavaScript in the
learner's open browser without an application-owned communication path.

## Browser and lifecycle requirements

The draft marks `document.modelContext` as a secure-context API. Chrome also
requires origin isolation and gates access with the `tools` Permissions Policy,
whose default is `self`. An origin that enables `document.domain`, for example
through `Origin-Agent-Cluster: ?0`, is not eligible. This origin-isolation rule
must not be confused with assuming that every site needs a new COOP/COEP setup.

Cross-origin iframes require policy delegation and explicit origin exposure.
Leave both disabled for the initial LMS design; do not grant the existing Wiii
iframe new tool access merely because it is displayed beside the lesson.

Feature-detect the required API methods in the browser, after SSR guards. Handle
registration rejection. Register only tools relevant to the active page and
authenticated user, and unregister them on route change, logout or destruction.
The current API uses a registration `AbortSignal`; execution cancellation is a
separate signal. Unregistering a tool must not be mistaken for cancelling an
already running operation.

Chrome documents page-context limitations. The repository also contains a
[service-worker supplemental proposal](https://github.com/webmachinelearning/webmcp/blob/69b73b4ab821ccb2e95a8b8551b15ab133bc862b/docs/service-workers.md);
that proposal is not evidence that an installed PWA gains working background
WebMCP tools. Do not promise closed-app agents or offline AI from PWA installation.

Sources: [Chrome overview](https://developer.chrome.com/docs/ai/webmcp),
[imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api),
[declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api),
[pinned draft](https://github.com/webmachinelearning/webmcp/blob/69b73b4ab821ccb2e95a8b8551b15ab133bc862b/index.bs).

## Online, offline, and local models

**ChatGPT is online-only in this product.** Downloading the PWA or a lesson does
not download ChatGPT. Offline learning remains available for content already
downloaded; cloud AI must show a clear unavailable state and must not queue a
private question for automatic transmission later.

Ollama and LM Studio are feasible **separate provider integrations**. Local
inference needs a running runtime, a model downloaded in advance, sufficient
RAM/VRAM, and a reachable endpoint. It can work without internet on the same
computer, or across a ship's local network, while the network is available.
It does not mean every phone with an installed PWA can run that model.

Choose the topology deliberately:

- **Local/self-hosted LMS:** a local backend may reach Ollama or LM Studio on the
  same computer or approved LAN server. This avoids making the browser a generic
  network proxy.
- **Cloud LMS with learner-local model:** the cloud backend's `localhost` refers
  to the cloud server, not the learner's laptop. A deliberate client-side or local
  companion connection is needed; test actual browser CORS, secure-context and
  local-network access behavior. Restrict origins and endpoints rather than
  telling users to disable browser protections or expose the runtime publicly.

Use separate labels such as **ChatGPT · internet required** and **Local model ·
requires a configured runtime**. Model availability should come from a bounded
health check, not only `navigator.onLine`. Never fall back from local to cloud
without the user's choice. Local-model support remains proposed unless separate
implementation and verification records establish otherwise.

Sources: [Ollama configuration and local-only mode](https://docs.ollama.com/faq),
[LM Studio local API server](https://lmstudio.ai/docs/developer/core/server).

## Security and acceptance checks

Tool schemas and annotation hints describe behavior; they do not replace runtime
validation, current-user authorization, or data minimization. Course text and
tool results are data, not instructions. Read-only tools can still disclose
sensitive information. Preserve server authorization on every real data access.
Use small bounded outputs and deterministic allowlists. Do not assume a prompt,
`readOnlyHint`, or a proposed consent API makes an unsafe tool safe.

For a later prototype, demonstrate all of these before calling it integrated:

1. A real supported browser discovers and invokes the correct read-only tool.
2. An unsupported browser renders the normal study flow without errors.
3. Navigation, logout and user changes remove stale tools and context.
4. Invalid arguments, cancellation and oversized results fail safely.
5. A lesson containing adversarial instructions does not gain extra capabilities.
6. Going offline never triggers a cloud request, retry queue, or silent replay.
7. Cloud and local provider states are tested separately; offline PWA learning is
   tested with the real service worker, not only a mocked network indicator.
8. The interface shows what context was used and which provider answered. Any
   model-generated practice questions are clearly distinguished from graded work.

Sources: [Chrome tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools),
[agent security](https://developer.chrome.com/docs/agents/security),
[tool design best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices).

## Research validation

Primary sources only were used for technical claims: Chrome, the WebMCP community
repository, Angular, the MCP specification, Ollama and LM Studio. Research used
the Agent Reach Exa/GitHub routes. Agent Reach's update check reported v1.5.0
current; no tools, extensions, browser flags or packages were installed or changed.
No application files were modified by this research task.
