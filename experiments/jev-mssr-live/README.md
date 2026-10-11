# Jev and Librarian live experiments

These runs exercise the local Bridge release adapter against exact frozen MSSR
Markdown. They are exploratory diagnostics, not production rollout or
confidence-calibration evidence.

## Evidence handling

- Keep each run directory immutable after provider calls. Preserve `manifest.json`,
  raw `records.jsonl`, `request-events.jsonl`, and `run-completion.json` as the
  original evidence packet. Correct metadata through a separate append-only
  erratum; never rewrite the frozen manifest or provider records.
- Run a live request only through a frozen runner with explicit `--allow-network`
  and recorded user authorization. Labels stay out of provider requests.
- Run `node experiments/jev-mssr-live/summarize-run.mjs <run-directory> --write`
  after execution. This validates manifest/completion/case/record identities
  and derives request counts, unique source-document clusters, exact fetches,
  evidence packs, tokens, and timestamp warnings from the frozen artifacts.
- A runner-produced `summary.json` is convenient output, not an authority for
  cluster counts or semantic answer quality. Copied runners can retain static
  template text. Use `summary-calculated.json` for mechanical counts and keep
  semantic judgments in a separate reviewed file.
- A blind model-assisted review is useful evidence, but it is not owner-gold.
  Keep reviewer identity, input boundaries, and limitations explicit. Do not
  tune confidence thresholds from raw Jev Choice/Noul scores.
- Group queries by source-document cluster. Linked follow-ups, query variants,
  and repeated prompts against the same source are diagnostic repeats, not
  independent benchmark units. Do not pool them as additional holdout samples.
- Record the timestamp at freeze in UTC. Use request-event timestamps as the
  actual execution interval; if a frozen timestamp is wrong, add an erratum and
  preserve the original manifest hash.

## Current linked diagnostic sequence

1. [`mssr-librarian-live-path-unseen-20261011T111400Z-a71d3f`](runs/mssr-librarian-live-path-unseen-20261011T111400Z-a71d3f/) — ten exploratory requests across five source documents; a scorer heading-marker mismatch was corrected only in a derived analysis. Blind review found a Spanish-to-English retrieval miss and an incomplete compound preview query.
2. [`mssr-librarian-linked-diagnostics-20261011T121000Z-7c4e91`](runs/mssr-librarian-linked-diagnostics-20261011T121000Z-7c4e91/) — three linked requests against one source. Explicit English variants restored search from zero to twelve candidates for the Spanish query; Jev selected the exact preview-only rule. The split relation query directly found the allowed relations and fingerprints; the review-only answer remained partial on explicit temporal/scope wording. Its manifest timestamp has a separate erratum.
3. [`mssr-librarian-temporal-scope-facet-20261011T112431Z-91cd52`](runs/mssr-librarian-temporal-scope-facet-20261011T112431Z-91cd52/) — one linked precision request selected the exact source item listing missing temporal/scope data, low confidence, and contradiction as review/abstention triggers.

All semantic reviews are model-assisted and not independently owner-adjudicated.
All linked runs use the same policy document and are one source-document
cluster for evidence accounting. They show a promising retrieval/selection
diagnostic improvement, not general reliability, calibrated probability, or
production confidence.
4. [`mssr-librarian-independent-sources-20261011T113622Z-f94729`](runs/mssr-librarian-independent-sources-20261011T113622Z-f94729/) — three calls over three fresh source-document clusters, 2 selections and 1 abstention; exact fetch/fingerprints passed. Blind Luna review: 1 direct, 1 partial, 1 likely inappropriate abstention. It is exploratory, not owner-gold. A separate `blind-review.json` and `summary-calculated.json` preserve derived analysis; `SHA256SUMS` protects original run payloads and `DERIVED-SHA256SUMS` protects derivatives.
5. [`mssr-librarian-split-diagnostic-20261011T114100Z-9bc623`](runs/mssr-librarian-split-diagnostic-20261011T114100Z-9bc623/) — six linked split queries across the same two sources: 6/6 provider/tool completions, search target present 6/6, exact fetch/fingerprints and evidence packs 6/6. Mechanical heading match was 5/6; blind fetch-text review found 4 direct and 2 partial. Two first-pass blind grades were corrected after reading only the literal fetched ranges. This is a query/selection diagnostic across two source clusters, not six independent cases, owner-gold, or calibration evidence. Derivatives have their own checksum file.
6. [`mssr-librarian-facet-followup-20261011T114800Z-42cd10`](runs/mssr-librarian-facet-followup-20261011T114800Z-42cd10/) — four targeted follow-ups over those same two sources: Jev selected the expected subsection, exact fetch/fingerprint and evidence pack passed 4/4. Blind literal-text review found 3 direct/complete and 1 partial: the trace/route fetch omitted the ambiguous-ownership clause. The run has a separate timestamp erratum because `createdAt` was inherited from its parent; the frozen manifest remains unchanged. Two source clusters only, no owner labels, no calibration.
7. [`mssr-librarian-ambiguous-owner-narrow-20261011T115644Z-f21a7c`](runs/mssr-librarian-ambiguous-owner-narrow-20261011T115644Z-f21a7c/) — two targeted queries against ADR 0007. The narrow ambiguous-ownership query selected and fetched rule 7 exactly; the compound four-branch query again selected only rule 6 and omitted the ambiguous case. Search, exact fetch/fingerprint and evidence-pack checks passed 2/2. Blind Luna review: 1 direct/complete, 1 partial. A derived pack then combined both exact handles without another Jev call; the final blind text check found full evidence coverage, after the reviewer corrected an initial misread of the literal `review`/`inspect-traces` phrase. This tests evidence assembly, not synthesis. One source cluster; source-derived labels, no owner-gold or calibration.

These linked runs suggest query decomposition improves exact-range selection, but selection and semantic completeness still diverge: the narrow ownership query fetched the correct rule, while the four-branch query again stopped at the preceding rule. The next system-level experiment should split compound state questions into explicit facets, fetch each exact range, and check union coverage before synthesis; it must report incomplete coverage rather than infer the omitted branch. This remains a candidate interaction pattern, not a validated production behavior. Keep raw confidence descriptive and uncalibrated.

8. [`mssr-librarian-crosslang-variants-20261011T121611Z-v1`](runs/mssr-librarian-crosslang-variants-20261011T121611Z-v1/) — four calls over two source clusters compared Spanish-only questions with the same questions plus explicit English variants. All calls selected and fetched exact ranges, but variants made no observable difference where Spanish already had lexical overlap. Blind review found the public-benchmark excerpt partial (it omitted benchmark names) and the Reddit document overbroad (the answer was in the fetched text, alongside unrelated reports). This is not evidence that variants improve every bilingual query.
9. [`mssr-librarian-crosslang-low-overlap-20261011T121909Z-v1`](runs/mssr-librarian-crosslang-low-overlap-20261011T121909Z-v1/) — a strict two-call pair on one previously exposed source cluster. Spanish-only search returned zero candidates and Jev abstained; adding the explicit English variant returned 11 candidates, after which Jev selected and exact-fetched the relevant 204-character range. The exact payload/fingerprint check and pack passed. Blind review judged the excerpt partial because it was scoped to “this review” and could not prove a broader external-evaluation absence. This demonstrates a useful retrieval recovery case, not general bilingual quality, an inappropriate abstention, owner-gold, or confidence calibration.

10. [`mssr-librarian-composed-adr007-20261011T124146Z-v1`](runs/mssr-librarian-composed-adr007-20261011T124146Z-v1/) — one previously exposed ADR 0007 cluster exercised as a composed lifecycle answer: 9 live Jev Choice calls (8 selections, 1 abstention), exact fetches and a six-range cited evidence pack. Broad first-pass queries were incomplete; narrower facets and exact-range union covered four source-derived facets. A Luna literal-text review found the final host-composed Spanish paragraph supported with aligned citations. Jev selected evidence but did not generate prose; MSSR did not perform semantic facet coverage or synthesis. A post-run Bridge revalidation matched all six final pack texts, fingerprints, and source revisions; several original per-call receipt fields remain incomplete/inconsistent, documented in the [append-only erratum](runs/mssr-librarian-composed-adr007-20261011T124146Z-v1/REVALIDATION-ERRATUM-20261011.md). This is exploratory, not owner-gold or calibration.

11. [`mssr-librarian-connected-smoke-adr007-20261011T1317Z`](runs/mssr-librarian-connected-smoke-adr007-20261011T1317Z/) — one live connected-Bridge diagnostic over the same ADR 0007 cluster. A compound ownership/current-trace/unavailable-tool query selected a broad rule with confidence 0.47 and Noul 0.26; a linked narrow ownership facet over five exact candidates selected the correct list item with 0.99/0.90. Both exact fetches and evidence packs passed. The scores remain uncalibrated and the two queries are not independent. The unavailable-tool facet remains unanswered. Dedicated connector calls lacked trace attribution in this chat; explicit Bridge query/action wrappers with the active trace succeeded. No prose synthesis was performed.

## Composed-runner prototype

[`scripts/run-composed-librarian-experiment.mjs`](../../scripts/run-composed-librarian-experiment.mjs) is a development harness for dry-run and provider-off receipt replay. Replay requires a strict receipt linking Jev's recorded choice, offered candidates, and an exact source fetch; it snapshots plan, runner, source bytes, MSSR build identity, and checksums. Its coverage value is explicitly line-span overlap only, not semantic support or owner-gold. Junction/reparse-point paths are refused. Live mode currently writes a checksummed `blocked` record with zero provider/network calls: the local Bridge tree is dirty and the harness cannot prove that its module build is the connected process/catalog. Do not use this prototype to make benchmark, reliability, or confidence-calibration claims.

Together these latest runs show that host-supplied query variants help when wording has low lexical overlap, while adding them to an already-overlapping query need not change the result. Exact retrieval integrity does not ensure complete or focused answers: measure facet coverage and overbreadth separately, and keep the no-candidate abstention distinct from a Jev selection error. Both source clusters in the four-call comparison were exposed to local artifacts; the low-overlap pair is one cluster and not an independent benchmark sample. No confidence threshold or production policy is changed.
