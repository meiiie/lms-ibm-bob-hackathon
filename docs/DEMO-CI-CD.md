# Demo delivery and operations

This fork deploys to **https://neko-core-lms-demo.pages.dev**. It never deploys
to the inherited upstream production site. The `prod` backend profile is combined
with `demo` and a separate synthetic database; it is not the upstream database.

## Delivery path

1. Push a feature branch, open a PR and let `CI` finish. It checks the harness,
   backend tests, frontend tests/build, Worker/packaging tests, Compose and a real
   Docker stack smoke. Do not merge a failing or superseded head.
2. Merge the tested change to `main`. CI runs again for that exact merge revision.
3. **Frontend:** `Demo CD` is triggered by successful `CI` on `main`. It validates
   the run's repository, workflow, event, branch, conclusion and current main SHA;
   PR artifacts and superseded main runs cannot deploy. It downloads the exact
   `demo-pages` artifact, verifies PWA hashes/locales and deploys with Wrangler
   4.141.0. The final current-main check prevents known stale builds being uploaded.
   Deploy jobs are serialized; they are not cancelled mid-upload. A main push
   occurring during upload can briefly leave the previous tested revision live
   until its successor passes CI and deploys.
4. **Backend:** Railway's GitHub source is this fork's `main`, with **Wait for CI**
   enabled (`checkSuites=true`). Dockerfile: `deploy/demo-backend/Dockerfile`;
   health path `/actuator/health`, timeout 300 seconds. Keep the repository root
   as build context. Neon data and existing environment secrets are preserved.
5. The Pages job checks the live revision marker and direct backend health.
   These are deployment probes, not an end-to-end acceptance test. Railway and
   Pages release independently; maintain backward-compatible API changes and
   verify Railway's deployed SHA separately when backend code changes.

The inherited `.github/workflows/deploy.yml` remains guarded to the upstream
repository. Do not remove that guard to deploy the demo.

## Configuration and credentials

- GitHub repository secret: `CLOUDFLARE_API_TOKEN`. Account permission:
  **Cloudflare Pages:Edit**, restricted to the account containing this demo.
  Cloudflare scopes this permission by account, not by a single Pages project.
  Current token expires **28 October 2026**. Rotate before expiry and revoke it
  when the demo is retired.
- The public Cloudflare account ID and project name are fixed in the workflow;
  they are identifiers, not credentials. `BACKEND_ORIGIN` is the fixed demo API
  in `deploy/demo-pages/wrangler.jsonc`.
- Railway uses its native GitHub integration; no Railway personal or project
  token is copied into Actions. Keep **Wait for CI** enabled in service settings.
- Database/JWT/role passwords stay in Railway variables. Private local handoff:
  `.tools/team-demo-accounts.private.md`. Never commit that file or `.tools`.
- Public demo intentionally keeps ChatGPT, Wiii, payments, mail, uploads and
  media processing disabled/unprovisioned. See [capability limits](FREE-DEMO-DEPLOYMENT.md).

## Check the current deployment

Open GitHub Actions **CI** and **Demo CD** and inspect the current `main` revision.
The machine-readable frontend marker is
https://neko-core-lms-demo.pages.dev/__demo-release.json (commit, CI and CD run IDs).
The direct backend probe is
https://lms-api-production-ff2e.up.railway.app/actuator/health.
Use Railway's deployment details to check its source SHA and health; an UP result
alone does not prove the latest backend code is deployed.

After a release, check real login for all four roles and downloaded text learning
across offline reload/reconnect. Clear ordinary HTTP cache when verifying PWA
behavior; do not clear IndexedDB containing the learner's downloaded work.

## Retry, rollback and quota

- Fix a failing CI run before release. Missing/expired Cloudflare secret causes
  a visible CD failure, not an automatic untested deployment.
- Retry **Demo CD → Run workflow** on `main` with the successful **current main**
  CI run ID. This cannot deploy an older revision. Artifacts are retained seven
  days; rerun CI if the required artifact has expired.
- Preferred rollback: revert the faulty commit through a reviewed PR and pass CI.
  For an urgent incident, use the provider's prior successful deployment rollback,
  record the rollback SHA, and then reconcile `main`. Never reset the shared
  Neon database or force-push shared Git history as a deployment repair.
- Existing PWA clients can continue using the previous cached version until they
  accept/reload an update; preserve offline drafts and queued progress first.
- Railway is temporary trial-credit hosting. Inspect its credit and expiry before
  recording or judging; no card or paid upgrade is authorized by this setup.

Provider references: [Pages CI upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
and [Railway GitHub deployments](https://docs.railway.com/deployments/github-autodeploys).
Actual verification results and limits belong in [WORKSTATE](WORKSTATE.md).
