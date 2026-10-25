# Live hate & extremism demo (production)

- Ran: 2026-10-25 ~1:38 PM America/Los_Angeles
- Deploy: `30e4e2c` on https://trust-safety-agent.vercel.app
- Endpoint: `POST /api/demo/scan` with built-in fixtures

## hate-group → flagged / hate_harassment

- URL (fixture): `https://northern-covenant.vercel.app`
- Status: **flagged** · category: **hate_harassment** · decidedBy: **argon**
- Rules score: 0.3 — Contains dehumanizing language or conspiracy claims targeting a protected group
- Flash: score 0.98, 2661ms
- Argon (escalated): score 0.99, 7787ms
- Total: 10456ms
- Reasons:
  - Promotes antisemitic conspiracy theories regarding control of banks and media
  - Uses dehumanizing language comparing a protected group to parasites
  - Calls for the exclusion and expulsion of a protected group from institutions and borders

## anti-hate-education → clean / benign

- URL (fixture): `https://understanding-antisemitism.vercel.app`
- Status: **clean** · category: **benign** · decidedBy: **flash**
- Rules score: 0 (no hate signals)
- Flash: score 0, 2422ms (no Argon escalation)
- Total: 2425ms
- Reasons:
  - Educational and counter-speech content explicitly debunking antisemitic conspiracy myths and tropes
  - Analyzes dehumanizing tropes from a historical and educational perspective without endorsing them
  - Provides guidance on recognizing and reporting hate speech
  - Falls under MUST NOT FLAG exceptions for educational material and counter-speech

## Notes

- Fixtures are server-side HTML (no outbound fetch). Live Gemini Flash→Argon pipeline ran on production.
- Counter-speech fixture correctly stayed benign despite discussing antisemitic tropes.
