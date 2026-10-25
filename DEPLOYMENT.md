# Setup and deployment

[Back to README](README.md)

Use Node.js 24. The existing hackathon app is **https://argon-guard.vercel.app**; its Vercel integration slug is `argon-guard`. The integration is registered and its credentials are configured in Vercel. A fork needs its own app, database, secrets, and integration registration.

## 1. Install and configure

```bash
npm ci
cp .env.example .env.local
```

Never commit `.env.local`, provider tokens, or database URLs. Generate independent random values for the secrets below using `openssl rand -hex 32`.

| Variable | Purpose / when needed |
| --- | --- |
| `DATABASE_URL` | Neon pooled runtime connection; required for durable workspace data |
| `DATABASE_URL_UNPOOLED` | Direct migration connection; migration falls back to `DATABASE_URL` |
| `NEON_AUTH_BASE_URL` | Neon Auth endpoint for Google sign-in and sessions |
| `NEON_AUTH_COOKIE_SECRET` | Random 32+ character SDK cookie-signing secret |
| `AUTH_SECRET` | Stable encryption key for Vercel installation tokens; keep it unchanged once tokens exist |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; canonical HTTPS origin when explicitly configuring production |
| `VERCEL_CLIENT_ID` | Integration client ID, for Connect Vercel |
| `VERCEL_CLIENT_SECRET` | Integration client secret, for OAuth exchange and webhook verification |
| `VERCEL_INTEGRATION_SLUG` | Registered integration’s URL slug |
| `VERCEL_INTEGRATION_WEBHOOK_SECRET` | Optional override only when using a separately issued webhook secret; normally leave blank |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini analysis; leave blank to use the explicit rules-only fallback |
| `GEMINI_FAST_MODEL`, `GEMINI_DEEP_MODEL` | Optional model overrides; defaults are `gemini-3.8-flash` and `gemini-4-argon` |
| `EVE_SCAN_TOKEN` | Server-side bearer for the eve channel and manual `/api/rescan` endpoint |
| `CRON_SECRET` | Bearer for on-demand `/api/sites/monitor`; setting it does not install a cron |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Optional legacy Redis storage when Neon is absent |

In Vercel, configure variables for the environments you use, then redeploy. Keep credentials server-side; do not prefix them with `NEXT_PUBLIC_`. `appOrigin()` uses the preview deployment URL in previews, otherwise the explicit app URL or Vercel’s production URL.

## 2. Neon database and Google sign-in

1. Add Neon from Vercel Marketplace with **Auth enabled** and connect it to the app project. This supplies the database and auth endpoint variables.
2. Add `NEON_AUTH_COOKIE_SECRET` and `AUTH_SECRET` to the app’s environments.
3. Pull development variables and apply the schema:

   ```bash
   vercel link
   vercel env pull .env.local --environment development
   npm run db:migrate
   ```

4. In **Neon → Auth → Configuration → Domains**, trust the exact application origin, including `https://` and no trailing slash. For this app it is `https://argon-guard.vercel.app`. Check preview domains separately when testing preview logins.
5. Enable Google in Neon Auth. Shared Google credentials support development; configure your own Google OAuth client in Neon for your own public launch. The provider callback is `${NEON_AUTH_BASE_URL}/callback/google`; the app’s completion route is `/auth/complete`.
6. Run `npm run dev`, sign in, refresh, and confirm your workspace remains available. Sign out and verify protected APIs reject access.

The idempotent migration creates the `argon_guard` schema. Neon manages `neon_auth`; do not modify it as part of app migrations. `npm run build` runs the migration when a database URL exists. Use a development database/branch for local work; running a build against a production URL applies the migration there.

Without a database, builds and fixed sample scans can run in hackathon mode with temporary memory. That is not durable account storage, and separate Next/eve processes do not share it. Existing Redis data and user IDs are not automatically migrated to Neon.

## 3. Vercel integration registration

Create a connectable-account integration in the [Integration Console](https://vercel.com/dashboard/integrations/console). The existing Argon Guard registration can be managed under the Edesia team. For your own registration, replace the origin below.

| Setting | Existing app value |
| --- | --- |
| Redirect URL | `https://argon-guard.vercel.app/api/integration/callback` |
| Configuration URL | `https://argon-guard.vercel.app/onboarding?step=connect` |
| Webhook URL | `https://argon-guard.vercel.app/api/webhooks/vercel` |
| Website | `https://argon-guard.vercel.app` |
| EULA / privacy / support | `/terms`, `/privacy`, `/support` on the app origin |
| Scopes | Installation: Read; Projects: Read; Deployments: Read |
| Event | `deployment.succeeded`; configuration removal is automatically subscribed by the console |
| Visibility | Unlisted for the hackathon |

The handler also accepts `deployment.ready`. It ignores other event types. Do not request write access or environment-variable access. The integration needs its name, logo, description, contact details, legal URLs, and featured image; the repository contains [featured artwork](public/integration/argon-guard-featured.png). Review policy content before reusing it for a different operator.

Copy its client ID, client secret, and slug into the app environment. For integration webhooks, **use the integration client secret**; do not generate an unrelated signing secret. Leave `VERCEL_INTEGRATION_WEBHOOK_SECRET` blank to use the `VERCEL_CLIENT_SECRET` fallback.

Start installation from **Argon Guard → Connect a site → Connect Vercel**. This creates the signed-in user’s one-time OAuth state. Going straight to the marketplace install URL can leave the callback without valid state. Select the team and specific projects, install, select a project in Argon Guard, and run its first scan.

For local OAuth testing, use a separate development integration and the corresponding callback. A webhook needs a reachable HTTPS endpoint; Vercel cannot deliver to your laptop’s `localhost`. Use a preview deployment or a tunnel and configure its origin consistently.

## 4. Deploy and verify

```bash
npm test -- --runInBand
npm run build
vercel deploy --prod
```

A GitHub push and a Vercel deployment are separate unless the Vercel project’s Git connection is configured. Connect this repository in **Vercel → Project → Settings → Git** for automatic deployments. The repository’s GitHub Actions workflow performs validation only; it does not deploy or receive application secrets.

Smoke test:

1. `/terms`, `/privacy`, and `/support` load without signing in.
2. Google sign-in returns to onboarding; refresh preserves the session.
3. Add a public website and run a scan. Unverified sites cannot enable monitoring.
4. Connect Vercel from the app, select a project, and run its first scan.
5. Enable monitoring, deploy that project to production, and check for a new scan. Inspect the integration’s webhook delivery logs if no scan appears.
6. Confirm another signed-in user cannot read or mutate the first user’s sites.
7. Sign out; private APIs should return 401.

A successful build or mocked OAuth test does not prove live provider authorization works.

## Monitoring and troubleshooting

No cron is deployed. Vercel project scans are event-driven. The manual `GET /api/sites/monitor` endpoint requires `Authorization: Bearer $CRON_SECRET`, processes up to five due verified sites, and rechecks ownership. `POST /api/rescan` requires `$EVE_SCAN_TOKEN` and runs the shared pipeline over recent matching records. Both are administrative endpoints; do not expose their tokens to browsers. See [the scheduling example](examples/scheduled-rescan.md) for an optional future scheduler.

| Symptom | Check |
| --- | --- |
| Google disabled | Neon auth URL, cookie secret, and durable storage configuration |
| `INVALID_ORIGIN` / `INVALID_CALLBACKURL` | Exact app origin in Neon’s trusted domains; app origin configuration |
| Connect Vercel unavailable | All three `VERCEL_CLIENT_*` / slug variables, `AUTH_SECRET`, and redeployment |
| OAuth returns `vercel_connect` | Start from the app; verify redirect URL, active session, client credentials, and one-time state |
| Webhook 401 | Raw-body signature and correct integration client secret; check for a stale override |
| Webhook 200 with `scanned: 0` | Site monitoring, selected project/team, active installation, and READY production deployment |
| Scan stays rules-only | Gemini key, model availability, provider quota, and returned fallback reason |
| History disappears | Missing durable storage or separate services using memory |
| Site fetch rejected | Public IPv4 address, standard port, bounded redirects/page size; private hosts are intentionally rejected |

Disconnecting a site does not erase historical scans. Uninstalling the Vercel integration revokes its access and pauses connected-site monitoring. Account/data deletion requests use the support contact; there is no automatic scan-history retention deadline.
