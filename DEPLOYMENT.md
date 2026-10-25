# Argon Guard - Deployment Guide

## ✅ What's Been Built

A complete Vercel integration MVP that scans every deployment for phishing and abuse using:
1. **Fast rules-based detection** (login forms, brand keywords, typosquats)
2. **Two-tier Gemini scan**: Gemini 3.8 Flash on every deploy, escalating to Gemini 4 Argon (heavy thinking) when risky
3. **SimHash clustering** for repeat offender detection
4. **Next.js dashboard** with review queue and metrics
5. **Demo mode** with sample phishing pages

**Status**: ✅ All tests pass, build succeeds, ready for deployment

## 🔗 Pull Request

**PR Link**: https://github.com/DasilvaKareem/trust-safety-agent/pull/1

## 📋 Manual Steps Required

### 1. Create Vercel Integration

Go to: https://vercel.com/dashboard/integrations/console

Create new integration with:
- **Name**: Argon Guard
- **Redirect URL**: 
  - Dev: `http://localhost:3000/api/integration/callback`
  - Prod: `https://your-domain.vercel.app/api/integration/callback`
- **Webhook URL**:
  - Dev: `http://localhost:3000/api/webhooks/vercel`
  - Prod: `https://your-domain.vercel.app/api/webhooks/vercel`
- **Events**: Select `deployment.created` and `deployment.succeeded`

Copy the Client ID and Client Secret.

### 2. Get Google Gemini API Key

Go to: https://aistudio.google.com/app/apikey

Create an API key (used for both gemini-3.8-flash and gemini-4-argon).

### 3. Set Up Environment Variables

Required for production:
```bash
VERCEL_CLIENT_ID=<from step 1>
VERCEL_CLIENT_SECRET=<from step 1>
VERCEL_INTEGRATION_WEBHOOK_SECRET=<generate with: openssl rand -hex 32>
GOOGLE_GENERATIVE_AI_API_KEY=<from step 2>
```

Optional for persistent storage (uses in-memory if omitted):
```bash
DATABASE_URL=<Neon pooled URL>
DATABASE_URL_UNPOOLED=<Neon direct URL>
NEON_AUTH_BASE_URL=<Neon Auth URL>
NEON_AUTH_COOKIE_SECRET=<random 32+ character secret>
AUTH_SECRET=<stable random token encryption key>
CRON_SECRET=<random scheduler secret>
```

### 4. Deploy to Vercel

```bash
cd trust-safety-agent
npx vercel link  # Link to a Vercel project
# Add environment variables in Vercel Dashboard > Settings > Environment Variables
npx vercel --prod
```

After deployment:
1. Update integration callback URLs to production domain
2. Test the integration install flow

## 🧪 Testing Locally

### Quick Start (No Setup Required)
```bash
npm install
npm run dev
# Visit http://localhost:3000/demo
# Select a sample phishing page and scan!
```

Demo mode works without any credentials - Gemini analysis gracefully skips if no API key is set.

### Full Integration Test

1. Set up all environment variables in `.env.local`
2. Run `npm run dev`
3. Install the integration from Vercel Integration Console
4. Deploy a test project
5. Check the dashboard at `http://localhost:3000`

### Run Tests
```bash
npm test
# ✅ All 30 tests pass
```

## 📊 What Each Component Does

### Rules Scorer (`lib/rules/`)
- Checks for password forms
- Detects brand keywords on non-brand domains
- Identifies typosquat domains
- Flags CLI deploys and new accounts
- Produces weighted 0-1 score with reasons

### Gemini Analysis (`lib/gemini/`)
- Fetches deployed page HTML
- Sends to Gemini 3.8 Flash, escalating to Gemini 4 Argon with heavy thinking
- Returns structured JSON: score, impersonated brand, reasons
- Gracefully handles missing API key (returns mock result)

### Fingerprinting (`lib/fingerprint/`)
- SHA-256 exact content hash
- SimHash for near-duplicate detection (64-bit)
- Hamming distance matching (threshold: 6 bits)
- Groups similar phishing pages into clusters

### Storage (`lib/storage/`)
- Neon Postgres and Neon Auth for production
- In-memory fallback for local dev
- Stores: installations, deployments, clusters
- Manages review queue

### Dashboard (`pages/`)
- Home: Recent scans, review queue, metrics
- Demo: Sample pages + manual URL scanner
- Clusters: Grouped similar deployments
- Integration success page

## 🎯 Architecture Decisions

### Why eve? (and what runs on it)
- **Durable execution**: `agent/tools/deep_scan.ts` is a `"use workflow"` tool whose stages (fetch, rules, Flash, Argon, persist) are retryable `"use step"`s.
- **No scheduled jobs**: scans run on deploy and on demand. `POST /api/rescan` re-scans review and flagged deployments when called; `examples/scheduled-rescan.md` shows how to add a cron later.
- **Webhook hand-off**: the webhook verifies the signature, then calls `POST /eve/v1/session` with `EVE_SCAN_TOKEN` and returns 202. If eve is unreachable or `EVE_HANDOFF=off`, it falls back to scanning inline.
- **Runtime**: `withEve()` in `next.config.ts` runs eve as a second service in the same Vercel project. It requires Node 24 (`engines.node: 24.x`).
- **Env**: `EVE_SCAN_TOKEN` (required for the hand-off). `EVE_AGENT_ORIGIN` is optional and defaults to the production URL. Set `DATABASE_URL` so both services share storage.
- **Webhook secret**: Vercel signs with HMAC-SHA1 over the raw body. Set `VERCEL_INTEGRATION_WEBHOOK_SECRET` to the integration Client Secret, or to the account-webhook secret.

### Why Flash then Argon?
- **Flash on every deploy**: about 3.6 s per scan. Cost is about $0.003 per scan on real PhreshPhish pages and about $0.0008 on the small synthetic set. On real pages Flash had AP 0.960 with 0 false positives in 125 benign pages.
- **Argon only when needed**: heavy thinking (about 10 s and about $0.014 per scan on real pages) for borderline or rule-flagged deploys. Tiered escalated 36% of real pages and cost about $0.009 per scan. See `bench/results.md`.
- **Structured output**: JSON schema via the AI SDK

### Why SimHash?
- **Near-duplicate detection**: Catches template variations
- **Efficient**: 64-bit hash, fast comparison
- **Proven**: Used by Google, GitHub for duplicate detection
- **Tunable**: Hamming distance threshold adjustable

## 📈 Thresholds

- **Clean**: Score < 0.3 (auto-pass)
- **Review**: 0.3 ≤ Score < 0.6 (human review queue)
- **Flagged**: Score ≥ 0.6 (alert, consider blocking)

Rules contribute. Context signals count only when the page collects data:
- Password form: +0.15
- Card / SSN / seed-phrase / OTP fields: +0.3
- Third-party brand shown prominently while collecting data: +0.35
- Form posts to a different site: +0.3
- Urgency language next to a form: +0.15
- Typosquat: +0.5
- CLI deploy: +0.15
- New account: +0.1

## 🚀 Next Steps (Post-MVP)

1. **Screenshot capture**: Implement with Playwright or screenshot service
2. **Auto-pause**: Add eve HITL approval for deployment pause
3. **Scheduled re-scan**: optional cron for `/api/rescan` (example in examples/scheduled-rescan.md)
4. **Dashboard auth**: Add authentication before production
5. **Rate limiting**: Handle Gemini API rate limits gracefully
6. **Monitoring**: Add Sentry/Datadog for error tracking
7. **Tuning**: Refine thresholds based on production data

## 📞 Support

- **GitHub Issues**: https://github.com/DasilvaKareem/trust-safety-agent/issues
- **eve Docs**: https://www.npmjs.com/package/eve
- **Gemini API**: https://ai.google.dev/

---

**Built for**: CV Gemini 4 Argon Hackathon + Vercel Trust & Safety interview showcase
**Status**: ✅ Complete MVP, ready for deployment and demonstration
