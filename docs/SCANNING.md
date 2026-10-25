# Scanning and evaluation

[Back to README](../README.md)

Model IDs below are the repository’s hackathon defaults. Timing, costs, and metrics are recorded evaluation results, not current pricing or guaranteed performance. See the linked raw reports for methodology.

## Policies

The model prompt evaluates scanned pages against four abuse categories plus a benign category (`phishing`, `scam`, `hate_harassment`, `violent_extremism`, `benign`) and returns the single most severe applicable category:

- **Phishing (`phishing`):** Brand impersonation and credential, payment-card, SSN, or seed-phrase harvesting on unrelated or typosquat domains.
- **Scams (`scam`):** Fake giveaways, crypto-doubling schemes, advance-fee fraud, fake stores, and tech-support scams even when no login form is present.
- **Hate and harassment (`hate_harassment`):** Content that attacks, dehumanizes, or incites hatred, exclusion, or expulsion against people based on protected attributes (religion, race, ethnicity, national origin, sexual orientation, gender identity, disability), such as antisemitic conspiracy claims, comparing a group to vermin or parasites, or targeted harassment and doxxing of individuals.
- **Violent extremism (`violent_extremism`):** Glorification, recruitment, or support for violent extremist groups or ideologies, including praising mass shooters, distributing violent manifestos, or recruiting for armed race-war militias.
- **Counter-speech and educational exemption (`benign`):** News reporting on hate crimes or extremism, history and Holocaust museum education, counter-speech and debunking pages, academic research, policy documentation, and fiction or reviews that discuss hate without endorsing it are instructed to be scored benign (`<= 0.1`). The test is whether a page endorses or promotes abuse, not whether it mentions or quotes it to condemn it.

Demo fixtures and live preview routes:
- `/demo` (supports `?sample=<slug>` query parameters)
- `/fixtures/hate-group` (fictional hate-group landing page fixture, `noindex`)
- `/fixtures/anti-hate-education` (benign counter-speech / education fixture, `noindex`)
- `/fixtures/fake-paypal`, `/fixtures/fake-microsoft`, `/fixtures/legit-bank`

Run the synthetic hate and extremism evaluation (20 hand-written pages: 10 abusive, 10 tricky benign):
```bash
npx tsx scripts/eval-hate.ts
npx tsx scripts/eval-hate.ts --rules-only
npx tsx scripts/check-rules-fpr.ts
```

## Detection pipeline

### 1. Runtime Rules Check (Fast, Synchronous)
During a scan. A login form alone is normal, and so is a brand name alone (security blogs, docs), so context signals only count when the page **collects data**:

| Signal | Weight |
|---|---|
| Password form | 0.15 (alone stays clean) |
| Card / SSN / seed-phrase / OTP fields | 0.30 |
| Collects data + a third-party brand in title, headings, buttons, labels or logo alt (not on that brand's domain; "Sign in with Google" SSO buttons ignored) | 0.35 |
| Collects data + form posts to a different site | 0.30 |
| Collects data + urgency language ("suspended", "within 24 hours", "unpaid fee") | 0.15 |
| Typosquat hostname (`paypa1`, `rnicrosoft`) | 0.50 |
| CLI deploy without git / new account (< 7 days) | 0.15 / 0.10 |

Score is capped at 1.0. `__tests__/rules-holdout.test.ts` checks the rules against hand-written pages that are not in the benchmark (SSO buttons, words like "apple" and "chase", off-site form posts), so tuning can't simply memorise the benchmark.

### 2. Two-tier Gemini Scan
- **Tier 1:** `gemini-3.8-flash` (low thinking, ~3.5 s, ~$0.0008/scan)
- **Tier 2, escalation only:** `gemini-4-argon` with heavy thinking (`thinkingLevel: 'high'`, ~10 s, ~$0.008/scan) when the Flash score is >= 0.4, the rules score is >= 0.3, or tier 1 fails
- Once Argon runs, its verdict decides the status; rules only decide whether to escalate
- Returns structured JSON: score, impersonated brand, reasons
- Screenshot capture is still stubbed (HTML only)

Run evaluation commands from the repository root. Configure with `GEMINI_FAST_MODEL`, `GEMINI_DEEP_MODEL`, `GEMINI_FAST_THINKING_LEVEL`, `GEMINI_DEEP_THINKING_LEVEL` and `GEMINI_ESCALATION_THRESHOLD`. "Gemini 3.8 Flash Cyber" is only listed on Google Cloud's Agent Platform (Vertex AI), not the default integration used here. Model access depends on your provider account; use available model IDs through the environment overrides.

### Benchmark
Full write-up: [`bench/results.md`](../bench/results.md). There are two datasets, reported separately.

**Real-world: [PhreshPhish](https://huggingface.co/datasets/phreshphish/phreshphish)** ([arXiv:2507.10854](https://arxiv.org/abs/2507.10854), CC BY 4.0, anti-phishing research only). The sample is 250 archived real pages from the paper's "full" benchmark split, 125 phishing and 125 benign, drawn at random with seed 42 (Oct 25, 2026). Pages are stored HTML from the dataset; nothing fetches a live phishing page.

| Config | Precision | Recall | F1 | FPR | AP | p50 latency | Cost / scan |
|---|---|---|---|---|---|---|---|
| rules-only | 57.1% | 3.2% | 0.061 | 2.4% | 0.511 | 0.5 ms | $0 |
| flash-only | 100.0% | 71.2% | 0.832 | 0.0% | 0.960 | 3625 ms | $0.00286 |
| argon-only | 98.9% | 75.2% | 0.855 | 0.8% | 0.919 | 9535 ms | $0.01387 |
| rules+argon | 95.9% | 75.2% | 0.843 | 3.2% | 0.916 | 9535 ms | $0.01387 |
| tiered (36% escalated) | 100.0% | 69.6% | 0.821 | 0.0% | 0.956 | 3998 ms | $0.00873 |

Published baselines on the full PhreshPhish benchmark (paper Table 4, 24% base rate) are AP 0.978 for fine-tuned GTE and AP 0.922 for zero-shot Gemini-2.5-Pro. Our run used a smaller, balanced sample and only the first 8k chars of HTML, so the numbers are not directly comparable; see `bench/results.md` for details.

Takeaways:
- The rules depend on Vercel deployment metadata, so on raw pages they add almost nothing.
- Flash gives the best precision for the cost.
- Most misses are scam pages with no form in the first 8k chars (see `bench/results.md` for the planned fix).

**Demo set (synthetic):** `bench/dataset.ts` holds 24 hand-written phishing kits and 23 benign pages. This set is a sanity check, not an accuracy claim.

| Config | Precision | Recall | F1 | FPR | p50 latency | Cost / scan |
|---|---|---|---|---|---|---|
| rules-only | 100.0% | 95.8% | 0.979 | 0.0% | 0.16 ms | $0 |
| flash-only | 100.0% | 100.0% | 1.000 | 0.0% | 3704 ms | $0.00077 |
| argon-only | 100.0% | 100.0% | 1.000 | 0.0% | 9378 ms | $0.00804 |
| tiered (51% escalated) | 100.0% | 100.0% | 1.000 | 0.0% | 11369 ms | $0.00559 |

A legitimate shop checkout that collects card numbers still scores 0.30 and is sent to review.

Run the benchmarks:
```bash
npm run bench -- --dataset demo                  # synthetic set
python3 scripts/prepare_phreshphish.py           # needs huggingface_hub + pyarrow; writes bench/data/ (gitignored)
npm run bench -- --dataset phreshphish --estimate # print the expected Gemini cost first
npm run bench -- --dataset phreshphish           # about $4 for 250 pages
npm run bench -- --dataset phreshphish --rules-only
```

