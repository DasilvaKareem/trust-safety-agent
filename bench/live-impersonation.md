# Live impersonation check (production)

- Ran: 2026-10-25 ~1:38 PM America/Los_Angeles
- Deploy: `30e4e2c` on https://trust-safety-agent.vercel.app
- Endpoint: `POST /api/impersonation/find`
- Request: `{ "url": "https://trust-safety-agent.vercel.app", "brand": "Argon Guard" }`

## Result (real, not faked)

- Protected: **Argon Guard** at `trust-safety-agent.vercel.app` (title: Meet Argon Guard)
- Candidates generated: **40** (40-cap permute)
- Candidates resolved (DNS/HTTP): **40**
- Live hosts: **0**
- Compared / judged: **0**
- Hits (impersonating): **0**
- CT (crt.sh): soft-fail — `crt.sh HTTP 502`
- Elapsed: **931ms** (truncated=False)

No live lookalike hosts responded for this brand/domain in this run. That is an honest empty result: permute + resolve ran; crt.sh returned HTTP 502 and was soft-failed; nothing was fabricated.

## Pipeline exercised

1. `permuteDomains` → 40 dnstwist-style candidates
2. `queryCertificateTransparency` → soft-fail on 502
3. `resolveCandidates` → 40 DNS/HTTP probes, 0 live
4. compare + Flash/Argon judge → skipped (nothing live to compare)
