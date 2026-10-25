# Example: scheduled re-scan (proof of concept, not wired up)

The app scans on deploy (signed Vercel webhook) and on demand (`/demo`, `POST /api/rescan`).
There is no cron job. This file shows how a scheduled re-scan *would* work if you want one
later, for example because phishing kits often go live after a clean first deploy.

## Option A: eve schedule

eve turns any file in `agent/schedules/` into a Vercel Cron Job. To enable a daily re-scan,
create `agent/schedules/rescan.ts`:

```ts
import { defineSchedule } from "eve/schedules";

// Daily at 06:00 UTC (11pm PT): second durable Flash -> Argon pass on borderline pages.
export default defineSchedule({
  cron: "0 6 * * *",
  markdown:
    "Batch re-scan: call list_deployments with statuses [\"review\", \"flagged\"] and limit 20, then call deep_scan once for each result. Reply with the one-line summaries.",
});
```

The agent already has the tools it needs (`list_deployments`, `deep_scan`).

## Option B: Vercel Cron calling the manual endpoint

Add a `vercel.json` cron that hits `POST /api/rescan`, which already re-scans `review` and
`flagged` deployments when called with `Authorization: Bearer $EVE_SCAN_TOKEN`:

```json
{ "crons": [{ "path": "/api/rescan", "schedule": "0 6 * * *" }] }
```

Vercel Cron sends GET requests with `Authorization: Bearer $CRON_SECRET`, so you would also
accept GET and check `CRON_SECRET` in `pages/api/rescan.ts`.

## Trigger it manually today

```bash
curl -X POST https://trust-safety-agent.vercel.app/api/rescan \
  -H "Authorization: Bearer $EVE_SCAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"statuses":["review","flagged"],"limit":5}'
```

## Website monitoring batch (also on demand)

`GET /api/sites/monitor` (bearer `CRON_SECRET`) scans up to five verified, monitoring-enabled
websites that are due. It used to be wired to an hourly Vercel cron; that was removed for the
hackathon build. To restore it, add a `vercel.json`:

```json
{ "crons": [{ "path": "/api/sites/monitor", "schedule": "0 * * * *" }] }
```

Manual run:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://trust-safety-agent.vercel.app/api/sites/monitor
```
