# Benchmark results

> **Synthetic dataset.** 47 hand-written samples (24 phishing kits, 23 benign pages) created for this benchmark. Not real-world traffic; use it as a pipeline sanity check, not production accuracy.

Generated 2026-10-25T18:38:28.982Z. Positive = score >= 0.3 (status review or flagged). Tiered escalates to Argon when Flash >= 0.4 or rules >= 0.3.
Models: fast `gemini-3.8-flash` (thinking low), deep `gemini-4-argon` (thinking high).

| Config | Precision | Recall | F1 | FPR | p50 latency | p95 latency | Cost / scan | Cost / 1k scans | Errors |
|---|---|---|---|---|---|---|---|---|---|
| rules-only | 100.0% | 95.8% | 0.979 | 0.0% | 0.15 ms | 0.74 ms | $0.00000 | $0.00 | 0 |
| flash-only | 100.0% | 100.0% | 1.000 | 0.0% | 4030 ms | 6651 ms | $0.00079 | $0.79 | 0 |
| argon-only | 100.0% | 100.0% | 1.000 | 0.0% | 8781 ms | 14483 ms | $0.00788 | $7.88 | 0 |
| rules+argon | 100.0% | 100.0% | 1.000 | 0.0% | 8781 ms | 14483 ms | $0.00788 | $7.88 | 0 |
| tiered (rules+flash -> argon) (escalated 51.1%) | 100.0% | 100.0% | 1.000 | 0.0% | 10091 ms | 17759 ms | $0.00538 | $5.38 | 0 |

## Token usage (per call average)

| Model | Thinking | Calls | Input | Output (incl. thinking) | Thinking tokens |
|---|---|---|---|---|---|
| gemini-3.8-flash | low | 47 | 457 | 120 | 14 |
| gemini-4-argon | high | 47 | 743 | 640 | 526 |

Pricing (USD per 1M tokens): gemini-4-argon $2 in / $10 out (AI Studio price, through Nov 30 2026); gemini-3.8-flash $0.75 in / $3.75 out (introductory price, through Dec 31 2026).

## Misclassified

- **rules-only**: FN phish-20
- **flash-only**: none
- **argon-only**: none
- **rules+argon**: none
- **tiered (rules+flash -> argon)**: none
