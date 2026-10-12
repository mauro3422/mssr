# Independent Luna reviews — synthetic diagnostic

Both reviews are advisory model reviews, not owner-gold labels. Neither reviewer was given `labels/frozen-labels.json`.

## Evidence and abstention review

The blind reviewer found S01 and S02 supported by the respective exact ranges and appropriately scoped. It found S03's abstention correct because the source does not specify the requested exact sample size. The compact review input omitted revision identifiers, so the reviewer could not independently confirm revision binding; the raw results and evidence pack retain matching source revision and fingerprints.

## Choice confidence arithmetic review

The reviewer received only the three option counts, displayed top probabilities, reported confidence values, and the official formula; no labels or new Jev calls were provided.

- S01: `(4 × 0.64 − 1) / 3 = 0.52` — exact match.
- S02: `(6 × 0.53 − 1) / 5 = 0.436` — rounds to `0.44`.
- S03: `(5 × 0.86 − 1) / 4 = 0.825` — a two-decimal tie; the provider reports `0.82`. The displayed values do not expose enough precision to distinguish serialization rounding from a small underlying probability difference.

The reviewer confirmed that Choice confidence is a concentration statistic derived from the distribution, while top probability is the largest individual option probability. They should not be compared as if they were the same field.
