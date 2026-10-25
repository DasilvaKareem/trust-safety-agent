# Hate & Violent Extremism Evaluation (Synthetic, n=20)

> **Caveat:** This is a **SMALL SYNTHETIC hand-written set (n=20: 10 abusive, 10 tricky benign)**. It checks that the pipeline catches explicit hate speech, harassment/doxxing, and violent extremism while respecting the counter-speech, journalism, history, and education exemptions. It is a sanity check, not a claim of real-world production accuracy.

- **Date:** 2026-10-25T20:13:25.985Z
- **Mode:** rules-only
- **Models:** Rules only (no Gemini API calls)
- **Dataset:** `bench/hate-extremism-dataset.ts` (20 samples: 10 abusive, 10 benign)
- **Positive threshold:** effective score >= 0.3

## Summary Metrics

| Precision | Recall | FPR | Accuracy | Category Accuracy (on TP) | Escalation Rate | p50 Latency | p95 Latency | Total Cost | Cost / Scan |
|---|---|---|---|---|---|---|---|---|---|
| 90.0% | 90.0% | 10.0% | 90.0% | 100.0% | 0.0% | 0.07 ms | 1.92 ms | $0.00000 | $0.00000 |

## Per-Sample Results

| ID | Label | Expected | Predicted | Rules | Flash | Argon | Decided By | Latency |
|---|---|---|---|---|---|---|---|---|
| `hate-01-antisemitic-conspiracy` | abusive | `hate_harassment` | `hate_harassment` (0.30) | 0.30 | n/a | skip | rules | 3.02 ms |
| `hate-02-anti-muslim-invasion` | abusive | `hate_harassment` | `hate_harassment` (0.30) | 0.30 | n/a | skip | rules | 1.23 ms |
| `hate-03-anti-immigrant-dehumanizing` | abusive | `hate_harassment` | `hate_harassment` (0.30) | 0.30 | n/a | skip | rules | 0.06 ms |
| `hate-04-anti-lgbt-harassment` | abusive | `hate_harassment` | `hate_harassment` (0.30) | 0.30 | n/a | skip | rules | 0.05 ms |
| `hate-05-journalist-doxxing` | abusive | `hate_harassment` | `benign` (0.00) | 0.00 | n/a | skip | rules | 1.92 ms |
| `extremism-06-shooter-saints-fanpage` | abusive | `violent_extremism` | `violent_extremism` (0.30) | 0.30 | n/a | skip | rules | 0.55 ms |
| `extremism-07-race-war-militia` | abusive | `violent_extremism` | `violent_extremism` (0.30) | 0.30 | n/a | skip | rules | 0.74 ms |
| `extremism-08-manifesto-excerpt` | abusive | `violent_extremism` | `violent_extremism` (0.30) | 0.30 | n/a | skip | rules | 0.07 ms |
| `extremism-09-purge-game` | abusive | `violent_extremism` | `violent_extremism` (0.30) | 0.30 | n/a | skip | rules | 0.06 ms |
| `hate-10-discord-hate-raid-bot` | abusive | `hate_harassment` | `hate_harassment` (0.30) | 0.30 | n/a | skip | rules | 0.08 ms |
| `benign-01-hate-crime-trial-news` | benign | `benign` | `benign` (0.00) | 0.00 | n/a | skip | rules | 0.07 ms |
| `benign-02-holocaust-museum-exhibit` | benign | `benign` | `benign` (0.00) | 0.00 | n/a | skip | rules | 0.14 ms |
| `benign-03-history-of-kkk-lesson` | benign | `benign` | `benign` (0.00) | 0.00 | n/a | skip | rules | 0.08 ms |
| `benign-04-hate-symbol-glossary` | benign | `benign` | `violent_extremism` (0.30) | 0.30 | n/a | skip | rules | 0.07 ms |
| `benign-05-counterspeech-campaign` | benign | `benign` | `benign` (0.00) | 0.00 | n/a | skip | rules | 0.08 ms |
| `benign-06-academic-radicalisation-paper` | benign | `benign` | `benign` (0.00) | 0.00 | n/a | skip | rules | 0.06 ms |
| `benign-07-moderation-policy-page` | benign | `benign` | `benign` (0.00) | 0.00 | n/a | skip | rules | 0.06 ms |
| `benign-08-film-review-neonazi-drama` | benign | `benign` | `benign` (0.00) | 0.00 | n/a | skip | rules | 0.05 ms |
| `benign-09-deradicalisation-helpline` | benign | `benign` | `benign` (0.00) | 0.00 | n/a | skip | rules | 0.05 ms |
| `benign-10-game-studio-community-guidelines` | benign | `benign` | `benign` (0.00) | 0.00 | n/a | skip | rules | 0.11 ms |
