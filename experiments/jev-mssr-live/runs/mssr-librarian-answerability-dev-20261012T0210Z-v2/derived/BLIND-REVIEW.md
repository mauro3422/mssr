# Blind source-quality review — answerability cohort v2

Reviewed only the anonymized `BLIND-REVIEW-INPUT.json`; expected labels, target ranges, manifests, summaries, and raw score fields were not supplied to the reviewer. The source and selected/fetched text were visible. This is one model-assisted blind review, not owner-gold or confidence calibration.

| Case | Source answerable? | Selection/abstention | Coverage | Overbreadth | Evidence |
|---|---|---|---|---|---|
| Q01 | Yes | Appropriate selection | Direct, complete | Low | S01 L13: bilingual query filtering is limited to search terms; indexed Markdown and fetched source retain original words. |
| Q02 | No | Appropriate abstention | No Japanese stopword list supplied | N/A | S01 L5, L13–17 establish English/Spanish scope. |
| Q03 | Yes | Appropriate selection | Direct, complete | Low | S02 L15: count refers to jobs needing review for either block or relation reasons. |
| Q04 | No | Appropriate abstention | No numeric threshold supplied | N/A | S02 L13–17; L17 says no thresholds changed. |
| Q05 | Yes | Appropriate selection | Direct, complete | Low | S03 L15: omitted handles map to retained citations and preserve owner/source/revision/range/line/fingerprint/privacy provenance. |
| Q06 | No | Appropriate abstention | No compression ratio or token target supplied | N/A | S03 L13–17; compaction does not summarize. |
| Q07 | Yes | Appropriate selection | Direct, complete | Low | S04 L15: detailed selector history belongs in a focused reference module; PROJECT_MEMORY retains the concise contract. |
| Q08 | No | Appropriate abstention | No numeric Jev confidence threshold supplied | N/A | S04 L16 says confidence calibration did not change. |
| Q09 | Yes | Selection contains the answer | Direct, complete | High | S05 L253 has the ordered trace; selected S05 L239–279 includes that answer plus substantial adjacent material. |
| Q10 | No | Appropriate abstention | No measured learned-vs-deterministic result supplied | N/A | S05 L346 and L350–359 say compare experimentally and do not assume the learned controller wins. |

The review supports the selected text's answer coverage for Q09 but flags substantial extra context. It does not retroactively add a `relevantRanges` label: frozen labels remain unchanged, and the derived scorer records that range as outside the pre-labeled ranges, with semantic usefulness ungraded.
