## Demo set (synthetic, 47 samples)

> **Synthetic.** Demo set: synthetic, hand-written phishing kits and benign pages (bench/dataset.ts). Not real-world traffic; a pipeline sanity check, not production accuracy.

- Source: bench/dataset.ts
- License: project code
- Sample: 47 (24 phishing, 23 benign)
- Run: 2026-10-25T18:58:16.370Z (wall clock 86 s, concurrency 6)
- Positive = score >= 0.3 (status review or flagged). Tiered escalates to Argon when Flash >= 0.4 or rules >= 0.3.
- Models: fast `gemini-3.8-flash` (thinking low), deep `gemini-4-argon` (thinking high). The models see the URL plus the first 8000 HTML characters; rules see the full HTML.

| Config | Precision | Recall | F1 | FPR | AP | P@R=0.9 | Proj. precision @24% base rate | p50 latency | p95 latency | Cost / scan | Cost / 1k scans | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rules-only | 100.0% | 95.8% | 0.979 | 0.0% | 0.997 | 1.000 | 100.0% | 0.16 ms | 1 ms | $0.00000 | $0.00 | 0 |
| flash-only | 100.0% | 100.0% | 1.000 | 0.0% | 1.000 | 1.000 | 100.0% | 3704 ms | 4759 ms | $0.00077 | $0.77 | 0 |
| argon-only | 100.0% | 100.0% | 1.000 | 0.0% | 1.000 | 1.000 | 100.0% | 9378 ms | 15237 ms | $0.00804 | $8.04 | 0 |
| rules+argon | 100.0% | 100.0% | 1.000 | 0.0% | 1.000 | 1.000 | 100.0% | 9378 ms | 15237 ms | $0.00804 | $8.04 | 0 |
| tiered (rules+flash -> argon) (escalated 51.1%) | 100.0% | 100.0% | 1.000 | 0.0% | 1.000 | 1.000 | 100.0% | 11369 ms | 19886 ms | $0.00559 | $5.59 | 0 |

AP and P@R=0.9 rank samples by score (rules and model scores are coarse, so ties are common). "Proj. precision @24%" re-weights this run's recall and FPR to the 24% phishing base rate of the PhreshPhish full benchmark (precision formula from the paper, App. B.1).

### Token usage (per call average)

| Model | Thinking | Calls | Input | Output (incl. thinking) | Thinking tokens |
|---|---|---|---|---|---|
| gemini-3.8-flash | low | 47 | 457 | 115 | 11 |
| gemini-4-argon | high | 47 | 743 | 655 | 542 |

Pricing (USD per 1M tokens): gemini-4-argon $2 in / $10 out (AI Studio price, through Nov 30 2026); gemini-3.8-flash $0.75 in / $3.75 out (introductory price, through Dec 31 2026).

### Misclassified

- **rules-only**: FN phish-20
- **flash-only**: none
- **argon-only**: none
- **rules+argon**: none
- **tiered (rules+flash -> argon)**: none
