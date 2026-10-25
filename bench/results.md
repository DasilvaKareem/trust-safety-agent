# Benchmark results

Two datasets, reported separately:

1. **Real-world: PhreshPhish.** Real phishing and benign pages (archived HTML) from the PhreshPhish benchmark split. This is the accuracy number to quote.
2. **Demo set.** 47 synthetic, hand-written pages in `bench/dataset.ts`. It checks the pipeline works and backs the `/demo` page; it is not an accuracy measure.

Regenerate with `python3 scripts/prepare_phreshphish.py && npm run bench -- --dataset phreshphish`, and `npm run bench -- --dataset demo`. Add `--estimate` to print the expected Gemini cost without calling the API, or `--rules-only` for a free rules pass.

## Real-world dataset

| | |
|---|---|
| Dataset | PhreshPhish (`phreshphish/phreshphish` on Hugging Face), revision `eca603e0ecd4` |
| Paper | Dalton et al., "PhreshPhish: A Real-World, High-Quality, Large-Scale Phishing Website Dataset and Benchmark", [arXiv:2507.10854](https://arxiv.org/abs/2507.10854) |
| License | CC BY 4.0, for anti-phishing research only |
| Source URL | https://huggingface.co/datasets/phreshphish/phreshphish |
| What's in it | URL + full rendered HTML + label + target brand + date. Phishing URLs come from PhishTank, APWG eCX and Netcraft; benign pages come from Webroot browsing telemetry plus legitimate pages of the brands phishers target most. Test split pages were collected Sep 8 to Dec 16, 2025. |
| Split used | The "full" benchmark (`benchmark/benign.txt` + `benchmark/phish.txt`, 90,262 benign + 28,476 phish), which the authors built from the test split with leakage, diversity and difficulty filters |
| Sample | 250 pages: 125 phish + 125 benign, drawn uniformly at random (seed 42) from the benchmark rows in shards `test-000` and `test-002` (1,145 phish / 3,643 benign eligible). The hash list is in `bench/phreshphish-manifest.json`. |
| Sampled | Oct 25, 2026 |
| Safety | Pages are archived text from the dataset. Nothing here fetches, renders or executes a live phishing page. |

**Why PhreshPhish.** It is the only candidate I found that has real HTML, a recent collection window (2025), a published benchmark split and published baselines. Other candidates:
- Mendeley "Phishing Websites Dataset" (Ariyadasa et al., 2021, CC BY 4.0) has 80k URL + HTML pairs, but it was collected in 2020–21 and has no benchmark split.
- Mendeley "CompPhish" has 15k URL + HTML pairs from 2024–25, no benchmark split, and no license shown on its page.
- PhishTank and OpenPhish are live URL feeds only, which would mean fetching live phishing pages.
- Tranco is a ranked domain list only, with no HTML.

The PhreshPhish paper also reports high rejection rates when its cleaning process is applied to the older Kaggle HTML sets (Aljofey et al.: 65.5% of phish rejected; Crawling2024: 43.8%).

**Published baselines (read from the paper, Table 4, "full" benchmark at a 24% phishing base rate):**

| Model (paper) | AP | P@R=0.9 |
|---|---|---|
| Linear SVM (n-grams + hand-crafted features) | 0.9551 ± 0.0028 | 0.8957 ± 0.0075 |
| FFN | 0.9607 ± 0.0018 | 0.9045 ± 0.0038 |
| GTE-large, fine-tuned | 0.9779 ± 0.0020 | 0.9746 ± 0.0037 |
| Gemini-2.5-Pro, zero-shot LLM | 0.9216 ± 0.0034 | 0.9352 ± 0.0235 |

These numbers are **not directly comparable** with ours:
- Our sample is 250 pages at a 50% base rate, not the full 118,738 pages at 24%. Precision rises with base rate, so AP measured at 50% reads higher than it would at 24%.
- Our models see only the URL and the first 8,000 characters of raw HTML. The paper's LLM saw simplified HTML with scripts and CSS stripped.
- Our scores are coarse (a few distinct values), so AP and P@R=0.9 come from a step curve with many ties.

To get a fairer read on precision, each table also shows "projected precision @24%": this run's recall and FPR re-weighted to the 24% base rate, using the formula from the paper's Appendix B.1.

**Findings on real data (Oct 25, 2026 run, full table below):**
- **Rules alone don't work on real pages: 3.2% recall.** Most rule signals rely on Vercel deployment metadata (typosquatted project names, fresh accounts, brand terms in the deployment name). PhreshPhish pages carry none of that, so the rules are only useful in the integration path.
- **Flash at low thinking is the best single model here.** It has AP 0.960, 0 false positives and 71.2% recall at our 0.3 threshold, for about $0.003 per scan. Argon (high thinking) catches a few more (75.2% recall), costs about 5× as much and takes 2.6× as long. Tiered matches Flash's precision for about $0.009 per scan.
- **About 30% of phishing pages are missed by every model.** Of tiered's 38 false negatives, 35 have no `<form>` or `<input>` in the first 8,000 characters the models see, against 17 of the 87 true positives. Many are non-credential scams such as fake casinos and lottery or "other" brand pages, or pages whose phishing form loads later via script. Likely fixes (not done yet): strip script and style and send the visible text, as the paper's LLM baseline does; raise the 8,000-character cap; and prompt explicitly for scams that don't harvest credentials.
- **An FPR of 0 to 0.8% on 125 benign pages means at most one false positive.** The 95% confidence interval is still a few percent wide.
- **P@R=0.9 of 0.500** (Argon and rules+Argon) means recall 0.9 is only reached by also flagging every page scored 0, so precision drops to the base rate. It does not mean the model is a coin flip.
- Spend: about $4.18 for the PhreshPhish run and about $0.41 for the demo rerun.

## Real-world: phreshphish (250 samples)

> PhreshPhish (Dalton et al., arXiv:2507.10854) full-benchmark split, balanced fixed-seed sample: seed 42, 125 phish + 125 benign, drawn from benchmark rows in shards data/test-000.parquet, data/test-002.parquet (pool 1145 phish / 3643 benign). Dataset revision eca603e0ecd4. Real pages collected Sep 8 to Dec 16 2025; archived HTML, no live fetching.

- Source: https://huggingface.co/datasets/phreshphish/phreshphish
- License: CC BY 4.0 (anti-phishing research only)
- Sample: 250 (125 phishing, 125 benign)
- Run: 2026-10-25T18:56:25.775Z (wall clock 491 s, concurrency 6)
- Positive = score >= 0.3 (status review or flagged). Tiered escalates to Argon when Flash >= 0.4 or rules >= 0.3.
- Models: fast `gemini-3.8-flash` (thinking low), deep `gemini-4-argon` (thinking high). The models see the URL plus the first 8000 HTML characters; rules see the full HTML.

| Config | Precision | Recall | F1 | FPR | AP | P@R=0.9 | Proj. precision @24% base rate | p50 latency | p95 latency | Cost / scan | Cost / 1k scans | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rules-only | 57.1% | 3.2% | 0.061 | 2.4% | 0.511 | 0.500 | 29.6% | 0.52 ms | 5 ms | $0.00000 | $0.00 | 0 |
| flash-only | 100.0% | 71.2% | 0.832 | 0.0% | 0.960 | 0.951 | 100.0% | 3625 ms | 4908 ms | $0.00286 | $2.86 | 0 |
| argon-only | 98.9% | 75.2% | 0.855 | 0.8% | 0.919 | 0.500 | 96.7% | 9535 ms | 19789 ms | $0.01387 | $13.87 | 0 |
| rules+argon | 95.9% | 75.2% | 0.843 | 3.2% | 0.916 | 0.500 | 88.1% | 9535 ms | 19789 ms | $0.01387 | $13.87 | 0 |
| tiered (rules+flash -> argon) (escalated 36.0%) | 100.0% | 69.6% | 0.821 | 0.0% | 0.956 | 0.921 | 100.0% | 3998 ms | 22497 ms | $0.00873 | $8.73 | 0 |

AP and P@R=0.9 rank samples by score (rules and model scores are coarse, so ties are common). "Proj. precision @24%" re-weights this run's recall and FPR to the 24% phishing base rate of the PhreshPhish full benchmark (precision formula from the paper, App. B.1).

### Token usage (per call average)

| Model | Thinking | Calls | Input | Output (incl. thinking) | Thinking tokens |
|---|---|---|---|---|---|
| gemini-3.8-flash | low | 250 | 3280 | 107 | 6 |
| gemini-4-argon | high | 250 | 3541 | 678 | 551 |

Pricing (USD per 1M tokens): gemini-4-argon $2 in / $10 out (AI Studio price, through Nov 30 2026); gemini-3.8-flash $0.75 in / $3.75 out (introductory price, through Dec 31 2026).

### Misclassified

- **rules-only**: FN 32a67eac0866, FN 0d333cc413d3, FN 8385cfc01e42, FN 764b408f7e76, FN 6ac93a65fa16, FN 3ea794c2c1a5, FN 2da69ec9cf75, FN 2697df0b202d, FN c74828313405, FN 0f4bb9c4d496, FN 0e97577f738e, FN 29aec10763c6, FN 6f17288bb6be, FN edc68196dcaf, FN 0d8d0a99b9be, FN 5f28bea58918, FN c67b6f7e1f90, FN 69d72df73d38, FN d2011583656e, FN 84b6f4479e82, FN 028531f029ca, FN 48c20b2c4211, FN c769ded5ff9d, FN a2a828cec27d, FN 474e730f8dea, FN a0fe22d9baa6, FN 2967011073fa, FN b51dfbfc5106, FN 2b0a055e18c5, FN ab0f474008f1, FN a4743315f3c3, FN 7ebf59265f75, FN 12ef085c76ea, FN d7801aeeb13e, FN fa0f8d01b3c4, FN 38692b36cff3, FN b4e5a70bc53a, FN 224a453f8045, FN fe2b41187b64, FN 8b917c2df7d4, FN ac6bbb24d1d3, FN 5c841bc44628, FN 1e88c0164349, FN 148fc2b5dfda, FN 6d77cfccdd6d, FN 89e465097d00, FN 22819307aa4b, FN 2d204df8de66, FN d3f5032ead11, FN ade3a4c8ede6, FN 49fc1d9ee35e, FN b11c10157886, FN aa0fac89fcd9, FN 652b98af425f, FN 7fe053a3c510, FN 1ed933addb09, FN 506651c4a0d1, FN f9001fadf3d5, FN 4a271660706b, FN d8e247775bfc, FN b4f781d8b6b0, FN 80ceb7a08e79, FN ff5ea2c35039, FN 69ad1c7f726c, FN 9d336ec7f960, FN 17af8f0b006a, FN 6e346dd128d9, FN 98b9eff756ad, FN be12891db1d0, FN 807d123d5a76, FN 1cd9a289344d, FN 662f7b42f6ba, FN 98875da6099e, FN 66fabfe4619e, FN bafddf55fdf6, FN d71c4dd131a3, FN 404febc1de57, FN 7f235e31a04c, FN 77a5d2808efd, FN fab17cc39a1b, FN 7e72f3ad4061, FN c91b0952a4bc, FN bd4b63696d4e, FN ac9d289d70c6, FN 3e54c5dae57f, FN eeacea41535a, FN e7c7e706b4a4, FN 288b61f144ac, FN 14f580b118f6, FN 30f1e5b89d67, FN 46109396b36c, FN 48e5e15f95b4, FN 1c5f45b3049f, FN b78422a75cbb, FN b5fb838dc84c, FN db1ae23caf41, FN f721e86f46cd, FN 7a5b4730228e, FN fea530f85d8c, FN 04df8dde7172, FN 3378e67141c2, FN fa29a7c2766c, FN 8bd822a7552e, FN caeece0bfa7b, FN 4829f8744e8a, FN d47366aa9e33, FN 01eb98dc1e16, FN 7ea226998fcd, FN ebdc17e40b0e, FN 548ec611a91d, FN ee71ecc4a84f, FN 2f3282ea6ae0, FN 8e1b1e2933a1, FN b2c0df2381e5, FN 4937a7c2ac52, FN fae2da89938b, FN f77ff38aed45, FN 007102452926, FN 9cd5d7ebf15e, FN e4753d3d28a5, FN 0981b57d2d15, FP cdd20064260d, FP 33c63e7da071, FP 96de5abc19c6
- **flash-only**: FN 32a67eac0866, FN 764b408f7e76, FN 2da69ec9cf75, FN 2697df0b202d, FN c74828313405, FN 0f4bb9c4d496, FN 0e97577f738e, FN edc68196dcaf, FN 0d8d0a99b9be, FN 5f28bea58918, FN 69d72df73d38, FN d2011583656e, FN 48c20b2c4211, FN c769ded5ff9d, FN 12ef085c76ea, FN fe2b41187b64, FN 8b917c2df7d4, FN 22819307aa4b, FN 652b98af425f, FN b4f781d8b6b0, FN 80ceb7a08e79, FN 17af8f0b006a, FN 807d123d5a76, FN 1cd9a289344d, FN 66fabfe4619e, FN 77a5d2808efd, FN 7e72f3ad4061, FN b78422a75cbb, FN fea530f85d8c, FN 3378e67141c2, FN fa29a7c2766c, FN 4829f8744e8a, FN 01eb98dc1e16, FN ebdc17e40b0e, FN f77ff38aed45, FN 007102452926
- **argon-only**: FN 32a67eac0866, FN 764b408f7e76, FN 2da69ec9cf75, FN 2697df0b202d, FN c74828313405, FN 0f4bb9c4d496, FN 0e97577f738e, FN edc68196dcaf, FN 0d8d0a99b9be, FN 5f28bea58918, FN d2011583656e, FN 48c20b2c4211, FN c769ded5ff9d, FN 12ef085c76ea, FN fe2b41187b64, FN 8b917c2df7d4, FN d3f5032ead11, FN 652b98af425f, FN b4f781d8b6b0, FN 80ceb7a08e79, FN 807d123d5a76, FN 66fabfe4619e, FN 77a5d2808efd, FN 7e72f3ad4061, FN b78422a75cbb, FN b5fb838dc84c, FN fea530f85d8c, FN fa29a7c2766c, FN 4829f8744e8a, FN ebdc17e40b0e, FN f77ff38aed45, FP 76316b9d4d98
- **rules+argon**: FN 32a67eac0866, FN 764b408f7e76, FN 2da69ec9cf75, FN 2697df0b202d, FN c74828313405, FN 0f4bb9c4d496, FN 0e97577f738e, FN edc68196dcaf, FN 0d8d0a99b9be, FN 5f28bea58918, FN d2011583656e, FN 48c20b2c4211, FN c769ded5ff9d, FN 12ef085c76ea, FN fe2b41187b64, FN 8b917c2df7d4, FN d3f5032ead11, FN 652b98af425f, FN b4f781d8b6b0, FN 80ceb7a08e79, FN 807d123d5a76, FN 66fabfe4619e, FN 77a5d2808efd, FN 7e72f3ad4061, FN b78422a75cbb, FN b5fb838dc84c, FN fea530f85d8c, FN fa29a7c2766c, FN 4829f8744e8a, FN ebdc17e40b0e, FN f77ff38aed45, FP cdd20064260d, FP 76316b9d4d98, FP 33c63e7da071, FP 96de5abc19c6
- **tiered (rules+flash -> argon)**: FN 32a67eac0866, FN 764b408f7e76, FN 2da69ec9cf75, FN 2697df0b202d, FN c74828313405, FN 0f4bb9c4d496, FN 0e97577f738e, FN edc68196dcaf, FN 0d8d0a99b9be, FN 5f28bea58918, FN 69d72df73d38, FN d2011583656e, FN 48c20b2c4211, FN c769ded5ff9d, FN 12ef085c76ea, FN fe2b41187b64, FN 8b917c2df7d4, FN 22819307aa4b, FN d3f5032ead11, FN 652b98af425f, FN b4f781d8b6b0, FN 80ceb7a08e79, FN 17af8f0b006a, FN 807d123d5a76, FN 1cd9a289344d, FN 66fabfe4619e, FN 77a5d2808efd, FN 7e72f3ad4061, FN b78422a75cbb, FN b5fb838dc84c, FN fea530f85d8c, FN 3378e67141c2, FN fa29a7c2766c, FN 4829f8744e8a, FN 01eb98dc1e16, FN ebdc17e40b0e, FN f77ff38aed45, FN 007102452926

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
