## Real-world: phreshphish (250 samples)

> PhreshPhish (Dalton et al., arXiv:2507.10854) full-benchmark split, balanced fixed-seed sample: seed 42, 125 phish + 125 benign, drawn from benchmark rows in shards data/test-000.parquet, data/test-002.parquet (pool 1145 phish / 3643 benign). Dataset revision eca603e0ecd4. Real pages collected Sep 8 to Dec 16 2025; archived HTML, no live fetching.

- Source: https://huggingface.co/datasets/phreshphish/phreshphish
- License: CC BY 4.0 (anti-phishing research only)
- Sample: 250 (125 phishing, 125 benign)
- Run: 2026-10-25T18:48:07.460Z (wall clock 0 s, concurrency 4)
- Positive = score >= 0.3 (status review or flagged). Tiered escalates to Argon when Flash >= 0.4 or rules >= 0.3.
- Rules only (no model calls).

| Config | Precision | Recall | F1 | FPR | AP | P@R=0.9 | Proj. precision @24% base rate | p50 latency | p95 latency | Cost / scan | Cost / 1k scans | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rules-only | 57.1% | 3.2% | 0.061 | 2.4% | 0.511 | 0.500 | 29.6% | 0.34 ms | 4 ms | $0.00000 | $0.00 | 0 |

AP and P@R=0.9 rank samples by score (rules and model scores are coarse, so ties are common). "Proj. precision @24%" re-weights this run's recall and FPR to the 24% phishing base rate of the PhreshPhish full benchmark (precision formula from the paper, App. B.1).

### Misclassified

- **rules-only**: FN 32a67eac0866, FN 0d333cc413d3, FN 8385cfc01e42, FN 764b408f7e76, FN 6ac93a65fa16, FN 3ea794c2c1a5, FN 2da69ec9cf75, FN 2697df0b202d, FN c74828313405, FN 0f4bb9c4d496, FN 0e97577f738e, FN 29aec10763c6, FN 6f17288bb6be, FN edc68196dcaf, FN 0d8d0a99b9be, FN 5f28bea58918, FN c67b6f7e1f90, FN 69d72df73d38, FN d2011583656e, FN 84b6f4479e82, FN 028531f029ca, FN 48c20b2c4211, FN c769ded5ff9d, FN a2a828cec27d, FN 474e730f8dea, FN a0fe22d9baa6, FN 2967011073fa, FN b51dfbfc5106, FN 2b0a055e18c5, FN ab0f474008f1, FN a4743315f3c3, FN 7ebf59265f75, FN 12ef085c76ea, FN d7801aeeb13e, FN fa0f8d01b3c4, FN 38692b36cff3, FN b4e5a70bc53a, FN 224a453f8045, FN fe2b41187b64, FN 8b917c2df7d4, FN ac6bbb24d1d3, FN 5c841bc44628, FN 1e88c0164349, FN 148fc2b5dfda, FN 6d77cfccdd6d, FN 89e465097d00, FN 22819307aa4b, FN 2d204df8de66, FN d3f5032ead11, FN ade3a4c8ede6, FN 49fc1d9ee35e, FN b11c10157886, FN aa0fac89fcd9, FN 652b98af425f, FN 7fe053a3c510, FN 1ed933addb09, FN 506651c4a0d1, FN f9001fadf3d5, FN 4a271660706b, FN d8e247775bfc, FN b4f781d8b6b0, FN 80ceb7a08e79, FN ff5ea2c35039, FN 69ad1c7f726c, FN 9d336ec7f960, FN 17af8f0b006a, FN 6e346dd128d9, FN 98b9eff756ad, FN be12891db1d0, FN 807d123d5a76, FN 1cd9a289344d, FN 662f7b42f6ba, FN 98875da6099e, FN 66fabfe4619e, FN bafddf55fdf6, FN d71c4dd131a3, FN 404febc1de57, FN 7f235e31a04c, FN 77a5d2808efd, FN fab17cc39a1b, FN 7e72f3ad4061, FN c91b0952a4bc, FN bd4b63696d4e, FN ac9d289d70c6, FN 3e54c5dae57f, FN eeacea41535a, FN e7c7e706b4a4, FN 288b61f144ac, FN 14f580b118f6, FN 30f1e5b89d67, FN 46109396b36c, FN 48e5e15f95b4, FN 1c5f45b3049f, FN b78422a75cbb, FN b5fb838dc84c, FN db1ae23caf41, FN f721e86f46cd, FN 7a5b4730228e, FN fea530f85d8c, FN 04df8dde7172, FN 3378e67141c2, FN fa29a7c2766c, FN 8bd822a7552e, FN caeece0bfa7b, FN 4829f8744e8a, FN d47366aa9e33, FN 01eb98dc1e16, FN 7ea226998fcd, FN ebdc17e40b0e, FN 548ec611a91d, FN ee71ecc4a84f, FN 2f3282ea6ae0, FN 8e1b1e2933a1, FN b2c0df2381e5, FN 4937a7c2ac52, FN fae2da89938b, FN f77ff38aed45, FN 007102452926, FN 9cd5d7ebf15e, FN e4753d3d28a5, FN 0981b57d2d15, FP cdd20064260d, FP 33c63e7da071, FP 96de5abc19c6
