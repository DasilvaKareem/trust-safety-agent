#!/usr/bin/env python3
"""Build a balanced, fixed-seed sample of the PhreshPhish benchmark split for `npm run bench -- --dataset phreshphish`.

Source:  https://huggingface.co/datasets/phreshphish/phreshphish (CC BY 4.0, anti-phishing research only)
Paper:   Dalton et al., "PhreshPhish: A Real-World, High-Quality, Large-Scale Phishing Website Dataset
         and Benchmark", arXiv:2507.10854

The HTML is archived text scraped by the dataset authors. Nothing here fetches or renders a live phishing page.

Usage:   pip install huggingface_hub pyarrow
         python3 scripts/prepare_phreshphish.py [--per-label 125] [--seed 42]

Only benchmark rows are eligible (benchmark/benign.txt + benchmark/phish.txt, the "full" benchmark, a subset
of the test split). Rows come from shards test-000 and test-002 (shards aren't time-ordered; each spans the
whole collection window), so we download about 365 MB instead of the full 48 GB test split.
Writes bench/data/phreshphish-sample.jsonl (gitignored) and bench/phreshphish-manifest.json (committed hash list).
"""
import argparse, json, random, os
from huggingface_hub import hf_hub_download
import pyarrow.parquet as pq

REPO = "phreshphish/phreshphish"
REV = "eca603e0ecd4f698f8d4d226c088659e72681239"  # pinned dataset commit
SHARDS = ["data/test-000.parquet", "data/test-002.parquet"]

ap = argparse.ArgumentParser()
ap.add_argument("--per-label", type=int, default=125)
ap.add_argument("--seed", type=int, default=42)
args = ap.parse_args()

def hashes(name):
    with open(hf_hub_download(REPO, name, repo_type="dataset", revision=REV)) as f:
        return set(f.read().split())

benign_ids, phish_ids = hashes("benchmark/benign.txt"), hashes("benchmark/phish.txt")
pool = {"benign": [], "phish": []}
rows = {}
for shard in SHARDS:
    t = pq.read_table(hf_hub_download(REPO, shard, repo_type="dataset", revision=REV))
    for r in t.to_pylist():
        ok = (r["label"] == "benign" and r["sha256"] in benign_ids) or (r["label"] == "phish" and r["sha256"] in phish_ids)
        if ok and r["html"]:
            pool[r["label"]].append(r["sha256"])
            rows[r["sha256"]] = r

rng = random.Random(args.seed)
picked = []
for label in ("phish", "benign"):
    ids = sorted(pool[label])
    picked += rng.sample(ids, args.per_label)

os.makedirs("bench/data", exist_ok=True)
with open("bench/data/phreshphish-sample.jsonl", "w") as f:
    for sha in picked:
        r = rows[sha]
        f.write(json.dumps({
            "id": sha[:12], "sha256": sha, "url": r["url"], "html": r["html"],
            "label": "phishing" if r["label"] == "phish" else "benign",
            "target": r.get("target"), "date": str(r.get("date")), "lang": r.get("lang"),
        }) + "\n")
json.dump({
    "dataset": REPO, "revision": REV, "license": "CC-BY-4.0", "split": "benchmark (full) subset of test",
    "shards": SHARDS, "seed": args.seed, "per_label": args.per_label,
    "pool": {k: len(v) for k, v in pool.items()}, "sha256": picked,
}, open("bench/phreshphish-manifest.json", "w"), indent=1)
print({k: len(v) for k, v in pool.items()}, "->", len(picked), "samples")
