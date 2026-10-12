# Run47 — Fixed-pool query-language selection diagnostic

## Question

With source revision and ordered candidate handles held fixed, does changing only the Jev question language change selection or abstention on recovered positive cases and a nearby negative?

## Frozen design

- Three previously exposed real-document cases: EF answerable, ERS answerable, and EF unanswerable-in-source.
- Two live Jev 1.13.0 Choice calls per case (six total): one original-language query and its blind translation from Run46.
- Both calls in each pair receive exactly the same ordered `candidateHandles` array, source root/ref, and source revision. The call has one `query`; it does not receive `queryVariants`.
- Candidate pools are reused from Run46 variant-search outputs. No search is rerun, so this measures selection language only, not bilingual retrieval.
- Run45 source-derived labels remain in `inputs/labels.json`; that file is never sent to Jev. The provider sees source text and the pool, not answerability, expected heading, target ID, or support spans.
- Pair call order is counterbalanced where possible and frozen in `inputs/query-pairs.json`.

## Outcomes

Report per arm: selected handle/abstention, whether the selected range matches the analyst-accepted target set, provider/model, token use and latency when returned. Also assert the exact ordered pool hash is identical within each pair. Do not average three pairs into a reliability estimate or interpret raw Choice/Noul values as calibrated probabilities.

## Limits and guardrails

Development diagnostic only: source families were previously exposed; labels are analyst-derived, not owner-adjudicated; no protected holdout. Metadata, EvidenceAtoms, contradiction relations, fetch, union, compaction and paragraph composition are out of scope because prior runs already provide narrow positive evidence for those stages and this run isolates only query-language effects. No threshold, routing policy, runtime, or canonical source changes.

## Pre-call gates

1. Confirm current source SHA-256 matches the frozen Run46 revision for both files.
2. Confirm each positive target is present in its frozen pool and the negative has no target label.
3. Confirm original and translated calls use identical ordered pool IDs within each pair.
4. Lock plan, inputs and manifest checksums before any Jev call; do not edit these inputs after calls.
5. Save each raw provider response separately before unblinding/evaluation.