# EvidenceAtom lifecycle/freshness diagnostic (2026-10-14)

## Question

Does adding the current EvidenceAtom package to a parent section help Jev
classify whether that section is current, and does a neutral clarification of
`freshness: unknown` change the result?

## Frozen design and execution

- Four paired arms: parent text; parent text plus a neutral clarification;
  parent text plus the full EvidenceAtom; and parent text plus the full atom and
  clarification.
- Three repeated source sections, three repetitions per arm: 36 live requests.
- All three expected labels are author-derived `current`; this is not a balanced
  lifecycle corpus or independently adjudicated gold.
- Requests were randomized with a fixed seed and paired by source section and
  repetition. Labels and request metadata were kept outside the provider
  payload. The frozen payload privacy preflight scanned all 36 requests with
  zero blocks or matches.
- Jev `1.13.0` completed 36/36 calls, with no retries or failures. Recorded
  usage was 40,590 input and 1,780 output tokens; mean client-observed latency
  was 265 ms.
- Runner limitation: it marks the manifest `running` before provider calls and
  does not resume a partial run. If a future invocation is interrupted, retain
  its partial packet and use a new run ID/directory; this run completed normally.
- The package is development-only and outside Git at
  `D:\MSSR-benchmark-artifacts\jev-mssr-dev\evidence-atom-lifecycle-freshness-diagnostic-20261014T032623Z-dev-v1`.
  Its six recorded SHA-256 entries, the manifest's request/label/runner hashes,
  and the frozen source snapshot checksums were revalidated after execution.
  Keep `labels.private.json` private; do not publish or copy the whole artifact
  directory as a public packet.

## Results

| Arm | Matches author labels | Errors | Choices | Mean raw Choice score |
|---|---:|---:|---|---:|
| Parent | 9/9 | 0/9 | 9 current | 0.646 |
| Parent + neutral note | 9/9 | 0/9 | 9 current | 0.621 |
| Parent + EvidenceAtom | 2/9 | 7/9 | 2 current, 4 historical, 3 unknown | 0.350 |
| Parent + EvidenceAtom + neutral note | 5/9 | 4/9 | 5 current, 4 historical | 0.486 |

Paired comparisons:

- Parent and parent-plus-note gave the same result in all 9 pairs.
- Adding the atom without the note changed 7/9 answers, all from a matching
  `current` answer to a mismatch.
- Adding the atom and note instead of parent-plus-note changed 4/9 answers,
  again all from a match to a mismatch.
- The note changed 3/9 answers when added to the atom; all three changed from
  `unknown` to the author-labeled `current`.
- By case, the atom answered `historical` three times for the first case; the
  second case produced two `current` and one `historical`; the third produced
  `unknown` three times. With the note, the first two patterns were unchanged,
  while the third became `current` three times.

Raw scores did not establish a usable threshold. In the atom-only arm, mean
Choice score was 0.230 on the two matches and 0.384 on the seven mismatches.
With the note, these means were 0.600 on five matches and 0.342 on four
mismatches. The sample is too small and class-skewed to estimate calibration.

## Interpretation and decision

This is a **warning signal for this lifecycle task**: adding the full atom
coincided with more mismatches than parent text alone in these three cases. The
neutral note repaired only the `unknown` responses in one case; it did not fix
the `historical` responses in the other two. Because the arm adds the entire
atom, this experiment does not identify whether `source.freshness`, usage
defaults, source identity/path/revision, provenance, authority/privacy, lineage,
fingerprints, or another field drove the changes. Repeated calls on the same
three sections are not independent content units.

**Maintenance decision: `insufficient-evidence`; no code, skill, threshold,
Bridge runtime, or production setting changed.** Keep EvidenceAtom advisory and
human-reviewed. Do not use this run to promote automatic lifecycle judgments,
merge decisions, confidence cutoffs, or a general Jev reliability claim.

## Next experiment

1. Run a frozen field-family ablation on the same exposed sections solely to
   locate likely input sensitivity. Separate freshness observation, usage
   state, source locator/identity, provenance/authority, and lineage/fingerprint
   fields. Mark it exploratory and do not add its repetitions to a benchmark
   denominator.
2. In parallel, obtain owner-adjudicated lifecycle cases across independent
   source documents, with current, historical, mixed, and unknown outcomes.
   Freeze labels before any provider call and keep source families grouped.
3. Evaluate generalization and Choice calibration only on a separate holdout
   after dataset/provenance review. No score threshold is supported now.
