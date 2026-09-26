# Isolated Pages demo

This target publishes the existing Angular browser PWA as a client-rendered app.
Production Angular configuration, upstream hosting and backend data are unchanged.
It needs a separate demo backend running with `prod,demo` profiles and synthetic data.
The separate Pages project is `neko-core-lms-demo`; its intended public origin is
`https://neko-core-lms-demo.pages.dev`. Project creation alone does not publish it.

## Build and verify

From the repository root, using the pinned Node runtime:

```powershell
. .\scripts\Use-DevEnv.ps1
node --test deploy/demo-pages/*.test.mjs
node scripts/build-demo-pages.mjs
node scripts/build-demo-pages.mjs --check-only
```

The build uses `production,demo`, writes `fe/dist/lms-demo/browser`, and packages
`.tools/demo-pages`. The Angular server bundle is not deployed. Existing JS, CSS,
icons, media, course-download features and PWA workers are copied intact. Only the
demo HTML's upstream canonical/social/organization metadata is removed or made
relative; the changed shell hashes are regenerated and **all** manifest hashes
are verified. Both `index.csr.html` and `index.html` are retained. A missing asset,
bad hash, root `404.html`, symlink, file over 25 MiB or over 20,000 files fails the
packaging step; files are never silently excluded. The inherited production
sitemap fetch is not executed. Pages and the HTML send noindex for this demo.

`--package-only` repeats packaging from the existing **demo** build without
compiling Angular. It replaces only the fixed ignored `.tools/demo-pages` output.
Do not point a production deployment at this output.
The deployment configuration is `deploy/demo-pages/wrangler.jsonc`. An authorized
operator can deploy the prepared output with `wrangler pages deploy --config
deploy/demo-pages/wrangler.jsonc`; this script never deploys or authenticates.

## Runtime configuration

Set the Pages Functions environment variable `BACKEND_ORIGIN` to the one isolated
backend's HTTPS origin, for example `https://demo-backend.example.org` (no path,
credentials or query). This is server configuration, never a visitor input or
frontend secret. Configure backend allowed origins and frontend URL to the actual
Pages origin; native WebSocket validation needs it too. Backend cloud AI/payment/
mail integrations must remain disabled unless explicitly configured for the demo.
The demo environment has empty Wiii URLs; it never links the upstream Wiii app.

`_routes.json` invokes the Worker only for `/api`, `/ws` and `/uploads`, including
their children. Static files and client routes go directly to Pages assets. The
Worker preserves bearer auth, cookies, range requests and native WebSockets only
to the fixed backend. It rejects cross-origin browser requests, strips spoofed
forwarding headers, does not follow upstream redirects, and returns private API
responses with `no-store`. Backend redirects within the same allowed paths are
rewritten to the demo origin; other redirects fail safely. External OAuth/payment
redirect flows therefore require a separately reviewed integration.

No `/actuator`, admin secret, arbitrary URL proxy, tunnel token or private key is
published. API authorization remains the backend's responsibility. Set Pages
Functions to **fail closed** so quota exhaustion cannot return an HTML app shell
in place of an API response. Static assets do not invoke Functions, while API
traffic still consumes the account's Workers allowance.

The site's absence of a root `404.html` preserves Pages SPA fallback. Service
worker caching/downloading remains the LMS's existing user-device behavior;
`no-store` here prevents HTTP/CDN caching of authenticated API responses. ChatGPT
requires internet; a running loopback model is a separate optional connection.
Hosted HTTPS browsers may ask for local-network permission and the model runtime
must allow this exact Pages origin. No claim of deployed/offline browser success
is made until the actual hosted build has passed acceptance checks.
The inherited runtime SEO service may still set upstream canonical metadata;
the static `X-Robots-Tag: noindex, nofollow` response header prevents indexing.

## Official references checked for this target

- [Advanced mode and ASSETS binding](https://developers.cloudflare.com/pages/functions/advanced-mode/)
- [Function routing and fail-closed behavior](https://developers.cloudflare.com/pages/functions/routing/)
- [Pages asset limits](https://developers.cloudflare.com/pages/platform/limits/)
- [SPA fallback and asset serving](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Static response headers](https://developers.cloudflare.com/pages/configuration/headers/)
