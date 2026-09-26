# Personal ChatGPT study assistant

This optional sidebar connects a signed-in LMS learner to their own ChatGPT
subscription. LMS login stays unchanged. Wiii remains a separate provider.
The connection is experimental and disabled by default. It is intended for an
explicitly opted-in personal/self-hosted instance, not a claim of general ChatGPT
SSO or approval for a public multi-tenant service.

## Enable on a development instance

Use the existing Java 21 / Angular stack and lockfiles. No new package or database
migration is required. Set these in the backend process or a private Compose env file:

```dotenv
CHATGPT_CONNECTION_ENABLED=true
CHATGPT_MODEL=gpt-6-luna
```

The default is listed in the official Codex 0.157.1 model catalog linked below;
actual account entitlement must still be checked live. A real probe authenticated
successfully but OpenAI rejected the old `gpt-5.4-mini` protocol-example default
as unsupported. Update existing private env files as well as the application.
Restart the backend to apply an env change; this clears its in-memory ChatGPT
connections, so reconnect ChatGPT afterwards.
An unsupported-model error keeps the connection and asks the instance administrator
to select an available model; it does not require reconnecting the LMS account.
Do not put provider tokens in environment
files, Angular configuration or browser storage. The feature needs no shared
OpenAI API key. No existing Codex login cache is read.

For the existing Docker development topology, copy `.env.dev.example` to a
private local env file, change the opt-in setting, then run from the repo root:

```powershell
docker compose --project-name lms-bob-hackathon --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up -d --build --wait
```

Frontend: `http://localhost:4200`; backend: `http://localhost:8088`.
Use development accounts and data. Do not run a production deployment to test it.
For a host-native backend, export the same settings in that process and use the
existing development database configuration with `mvn.cmd spring-boot:run`.
Docker/database readiness is separate from passing unit or fixture browser tests.

## Connect and verify

1. Sign in to the LMS and open its right-hand assistant sidebar.
2. Select **ChatGPT**. This choice is available independently of Wiii when the
   backend reports the feature enabled.
3. Choose **Connect ChatGPT**. Open the displayed OpenAI verification page and
   enter the one-time code yourself. Complete the provider's sign-in and consent.
   Device-code login may need enabling in ChatGPT security settings or workspace
   permissions. Never send your password, cookies or provider access token to a teammate.
4. Wait for the sidebar to report connected, then send a short non-sensitive
   study question. Only the question you submit is sent; course/student data
   and prior chat history are not automatically attached.
5. Confirm a real answer is displayed. **Disconnect**, reopen the panel, and
   check that a fresh connection is needed. Closing the panel stops browser
   polling but is not the same action as disconnecting an existing connection.

Cloud AI requires internet access. Offline learning remains available independently.
Requests are not queued or automatically replayed after reconnecting. Answers are
plain text, with no model tools or code execution.

The sidebar labels ChatGPT as cloud/online-only. A learner can prepare a question
offline, but it stays only in the current panel and is cleared when that panel
closes; it is never added to the LMS synchronization queue. The selected-passage
action copies only text the learner deliberately selected outside the assistant
into the editable question, within its 2,000-character limit. Review it before
sending; this is not automatic page access or WebMCP tool execution.

For a separately running model on the learner's own device, see
[Local AI setup](LOCAL-AI-SETUP.md). Ollama/LM Studio inference is a separate
provider; the LMS does not make ChatGPT available offline.

## Prototype limits

Connections live only in bounded backend memory, scoped to the authenticated LMS
user. Restarting the backend or expiring the credential requires connecting again;
refresh tokens are discarded. Use one backend instance: this prototype has no
distributed credential store or cross-instance session routing. Disconnect clears
the local connection; it does not promise revocation at the provider.

The adapter uses the pinned unofficial subscription wire protocol. Provider
changes, account entitlement, disabled device login, quotas and network failures
can prevent authentication or a response. A passing mock test does not prove live
provider compatibility. See WORKSTATE for the actual verification reached.

## API and privacy boundary

Authenticated paths under `/api/v3/ai/chatgpt` return the existing `ApiResponse`
envelope and `Cache-Control: no-store`:

| Method/path | Purpose |
| --- | --- |
| `GET /status` | Availability and safe connection metadata |
| `POST /device` | Start device login for the current LMS user |
| `POST /poll` | Check that user's opaque attempt ID at the required interval |
| `POST /ask` | Send one explicit study question |
| `DELETE /connection` | Clear that user's pending/connected state |

The browser never receives provider access/refresh tokens, device-auth identifiers
or PKCE verifiers. The authenticated LMS principal determines ownership; request
bodies and provider JWT claims cannot select an LMS user. Errors expose safe
messages rather than provider response bodies. The service worker does not cache
these routes and the offline interceptor bypasses all `/api/v3/ai/` mutations.

## Sources and authorship

- Official [Codex authentication](https://learn.chatgpt.com/docs/auth) documents
  device-code login for Codex. It does not establish generic LMS SSO approval.
- Official [Codex 0.157.1 model catalog](https://github.com/openai/codex/blob/36650394c5b38c2990ccf2a3457165ca3e9d9726/codex-rs/models-manager/models.json)
  lists `gpt-6-luna`; this catalog is model metadata, not proof of access for every
  ChatGPT account. See WORKSTATE for the actual live verification result.
- Protocol reference: [chatgpt-oauth at 53299ef](https://github.com/vishhvak/chatgpt-oauth/tree/53299ef0b335b53f6204b1c64a316a48567ca76e),
  including the required `client_version` query parameter on Responses requests.
  Its MIT notice is preserved in [third-party attribution](third-party/chatgpt-oauth-LICENSE.txt).
- Bob implemented the original offline sidebar in PR #2. The owner asked Codex
  to continue after Bob exhausted its allowance. This ChatGPT follow-up and its
  new tests must be attributed to Codex, not recorded as additional Bob sessions.

All hackathon evidence timestamps use Vietnam (UTC+7). Preserve the real earlier
Bob screenshot as an intermediate checkpoint; never fabricate a completed-login
screenshot or count synthetic fixture responses as live ChatGPT answers.
