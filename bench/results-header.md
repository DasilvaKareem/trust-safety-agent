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
