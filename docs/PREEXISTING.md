# Pre-existing material and hackathon provenance

Updated 26 September 2026, Vietnam (UTC+7). Neko Core is the team name; it does
not imply a Neko Core software dependency in the LMS.

## Existing application

- Upstream: https://github.com/linhlinhlin/LMS_hohulili
- Pre-license baseline: `736a7661f9d365f035e7150c7c7613079479f925`.
- Baseline time: `2026-08-16T00:25:49+07:00`.
- Existing authors: upstream authors and contributors; retain their notices.
- Reused material: Angular frontend, Spring backend, migrations, learning/offline
  features, deployment configuration, documentation, and existing unit/browser tests.

These features were not created during the hackathon. A fork or new license does
not reset their history. Upstream tests already passing is not a new Bob outcome.

## Owner-authorized license change

The owner requested MIT for original LMS material. Codex prepared source commit
`a4b7028ee966ade8176ab56b7fbbcdddd9042833`; PR
[#541](https://github.com/linhlinhlin/LMS_hohulili/pull/541) merged as
`34c3f0f204510e67aa0b26d3373866dde46cc131` on `2026-09-26T00:39:07+07:00` after
all five PR CI checks passed. Earlier AGPL grants are preserved; the SDK remains
Apache-2.0 and third-party terms remain separate. See [LICENSING.md](../LICENSING.md).
This license preparation is not Bob work and is not an eligibility ruling by the event.

## Submission fork and reused preparation

- Submission fork: https://github.com/meiiie/lms-ibm-bob-hackathon
- Fork created after the MIT merge, from revision `34c3f0f204510e67aa0b26d3373866dde46cc131`.
- Preparation source: https://github.com/Long97189/Hackathon-IBM-by-Neko-Core-Prepare
- Copied source revision: `4773812f80294496769a54b213fab69802838f3f`.
- Source commit time: `2026-09-24T17:09:42Z` = `2026-09-25T00:09:42+07:00`,
  before the event window. Research/setup began on 24 September.
- The source team's Bob modes, eight skill files, Node/browser installers and
  harness were reused with attribution here; they are preparation, not new product work.
- LMS adaptation on 26 September was prepared with Codex: Java/Angular extensions,
  repository instructions, scripts, hooks, evidence folders and shared docs.
- The original local evidence scaffold was commit `3ec41dcd931271603667bdb205bb97c9c71070c3`;
  its files are carried into the fork without duplicating the upstream license commit.

The fork removes an inherited machine-local Claude permission file, makes its
production publishing/deployment workflow conditional on the original upstream
repository, and preserves upstream application behavior. Setup does not create
a public demo deployment or supply real Bob task summaries.

Extension/tool dependencies keep their own licenses, recorded where available in
`tooling/extensions.lock.json` and package metadata. Repository MIT does not
relicense those third-party tools or the separate SDK.

## New hackathon contribution

Bob implemented the offline-safe assistant sidebar and AI interceptor bypass in
[PR #2](https://github.com/meiiie/lms-ibm-bob-hackathon/pull/2), merged on
26 September 2026 at 08:16:45 UTC+7 as `3432af2aa65b47027eae5aaddaa06fdad5e20618`.
The underlying Wiii embedding, AI token service and offline-learning infrastructure
are reused upstream code. Bob's latest targeted run recorded 35 passing tests;
that is not proof of a live ChatGPT connection.

After Bob task `b3f61aaa13f3e3d94298655249da2d8c` stopped with a quota error,
the owner asked Codex to continue and check the ChatGPT sidebar. The ChatGPT
implementation, new verification and follow-up documentation are Codex work.
They must not be added to Bob usage totals or credited to Dark personally.

The same Codex continuation on 26 September adds the optional browser-to-local
Ollama/LM Studio adapter, sidebar UX, explicit selected-passage context, regression
tests and WebMCP research. It reuses the existing LMS design and offline stack;
it does not turn the PWA into an embedded model runtime. The real local probe used
an already installed Ollama server and `gemma3:4b`; no model weights are bundled
or relicensed by this repository. Consult the provider/model terms separately.

The Java protocol adapter references `vishhvak/chatgpt-oauth` at revision
`53299ef0b335b53f6204b1c64a316a48567ca76e`. Preserve its
[MIT notice](third-party/chatgpt-oauth-LICENSE.txt). This protocol is reused
reference material, not a new authentication protocol invented during the event.

The manifest now has an actual screenshot row from 08:18 UTC+7 showing 28.50
Bobcoins. It is an intermediate IDE checkpoint, not the final consumption panel.
The task later reached approximately 38.66 Bobcoins before stopping. The recovered
303-message transcript remains local and excluded from Git pending privacy review.
Every participant still needs to capture their own relevant real Bob summaries.

Before submission, record the final revision, identify precisely what changed
during the event, and link all actual screenshots through the manifest.

On 26 September, the owner also asked Codex to deploy a free public demo. The
isolated student-only backend profile, Cloudflare Pages proxy and build package,
Railway/Neon configuration and hosted PWA acceptance runner are Codex continuation
work in PR #4. The Angular offline learning implementation and seeded maritime
course are reused LMS features; deploying or verifying them does not make them
new Bob-authored features. Only actual hosted acceptance results may be reported.
