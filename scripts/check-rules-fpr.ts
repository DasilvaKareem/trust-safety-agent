/**
 * Check rules-only false positive rate and recall on bench/data/phreshphish-sample.jsonl,
 * including how many benign pages trip hasHateSignals or hasExtremismSignals.
 * Makes no file writes and no API calls.
 */

import { existsSync, readFileSync } from 'fs';
import { computeRulesScore } from '../lib/rules';

const FILE = 'bench/data/phreshphish-sample.jsonl';
const POSITIVE_THRESHOLD = 0.3;

function main() {
  if (!existsSync(FILE)) {
    console.error(`${FILE} not found. Run: python3 scripts/prepare_phreshphish.py`);
    process.exit(1);
  }

  const lines = readFileSync(FILE, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  let benignHateTrips = 0;
  let benignExtremismTrips = 0;

  for (const line of lines) {
    const row = JSON.parse(line) as { id: string; label: 'phishing' | 'benign'; url: string; html: string };
    const res = computeRulesScore(row.html, row.url);
    const predPos = res.score >= POSITIVE_THRESHOLD;
    const isPhish = row.label === 'phishing';

    if (predPos && isPhish) tp++;
    else if (predPos && !isPhish) fp++;
    else if (!predPos && isPhish) fn++;
    else tn++;

    if (!isPhish) {
      if (res.flags.hasHateSignals) benignHateTrips++;
      if (res.flags.hasExtremismSignals) benignExtremismTrips++;
    }
  }

  const fpr = fp + tn ? fp / (fp + tn) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;

  console.log(`PhreshPhish sample rows: ${lines.length} (${tp + fn} phishing, ${fp + tn} benign)`);
  console.log(`Rules-only FPR (benign score >= ${POSITIVE_THRESHOLD}): ${(fpr * 100).toFixed(2)}% (${fp}/${fp + tn})`);
  console.log(`Rules-only recall (phishing score >= ${POSITIVE_THRESHOLD}): ${(recall * 100).toFixed(2)}% (${tp}/${tp + fn})`);
  console.log(`Benign pages tripping hasHateSignals: ${benignHateTrips}`);
  console.log(`Benign pages tripping hasExtremismSignals: ${benignExtremismTrips}`);
}

main();
