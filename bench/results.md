# Benchmark results

> **Synthetic dataset.** 47 hand-written samples (24 phishing kits, 23 benign pages) created for this benchmark. Not real-world traffic; use it as a pipeline sanity check, not production accuracy.

Generated 2026-10-25T18:21:40.394Z. Positive = score >= 0.3 (status review or flagged). Tiered escalates to Argon when Flash >= 0.4 or rules >= 0.3.
Models: fast `gemini-3.8-flash` (thinking low), deep `gemini-4-argon` (thinking high).

| Config | Precision | Recall | F1 | FPR | p50 latency | p95 latency | Cost / scan | Cost / 1k scans | Errors |
|---|---|---|---|---|---|---|---|---|---|
| rules-only | 73.3% | 91.7% | 0.815 | 34.8% | 0.13 ms | 1 ms | $0.00000 | $0.00 | 0 |
| flash-only | 100.0% | 100.0% | 1.000 | 0.0% | 3554 ms | 4878 ms | $0.00080 | $0.80 | 0 |
| argon-only | 100.0% | 100.0% | 1.000 | 0.0% | 9523 ms | 15558 ms | $0.00799 | $7.99 | 0 |
| rules+argon | 75.0% | 100.0% | 0.857 | 34.8% | 9523 ms | 15558 ms | $0.00799 | $7.99 | 0 |
| tiered (rules+flash -> argon) (escalated 68.1%) | 100.0% | 100.0% | 1.000 | 0.0% | 12316 ms | 18852 ms | $0.00677 | $6.77 | 0 |

## Token usage (per call average)

| Model | Thinking | Calls | Input | Output (incl. thinking) | Thinking tokens |
|---|---|---|---|---|---|
| gemini-3.8-flash | low | 47 | 457 | 122 | 19 |
| gemini-4-argon | high | 47 | 743 | 651 | 539 |

Pricing (USD per 1M tokens): gemini-4-argon $2 in / $10 out (AI Studio price, through Nov 30 2026); gemini-3.8-flash $0.75 in / $3.75 out (introductory price, through Dec 31 2026).

## Misclassified

- **rules-only**: FN phish-09, FN phish-11, FP benign-15, FP benign-16, FP benign-17, FP benign-18, FP benign-20, FP benign-21, FP benign-22, FP demo-bank
- **flash-only**: none
- **argon-only**: none
- **rules+argon**: FP benign-15, FP benign-16, FP benign-17, FP benign-18, FP benign-20, FP benign-21, FP benign-22, FP demo-bank
- **tiered (rules+flash -> argon)**: none
