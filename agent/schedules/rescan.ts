import { defineSchedule } from "eve/schedules";

// Daily batch re-scan (06:00 UTC = 11pm PT). Phishing kits often go live after a clean
// first deploy, so pages that were borderline get a second durable Flash -> Argon pass.
// On Vercel this becomes a Cron Job.
export default defineSchedule({
  cron: "0 6 * * *",
  markdown:
    "Batch re-scan: call list_deployments with statuses [\"review\", \"flagged\"] and limit 20, then call deep_scan once for each result. Reply with the one-line summaries.",
});
