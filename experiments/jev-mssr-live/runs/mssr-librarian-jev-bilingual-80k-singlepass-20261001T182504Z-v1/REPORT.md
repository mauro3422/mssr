# Live bilingual Jev selection — 80k direct run v1

Status: complete exploratory benchmark. Provider: TypeSafe Jev 1.13.0. Corpus: 21 MSSR Markdown documents / 200 headings. Queries: 52 paired English/Spanish. This run used the 0.2.96 candidate implementation before the decomposed-Unicode excerpt fix; the final 0.2.97 behavior is rerun in the sibling `...184400Z-v2/` directory.

## Outcome

All 52 calls succeeded in single-pass mode over 200 headings. There were 2 abstentions; 50/50 selected handles passed exact fetch. Strict labelled heading match: 35/52 (18/26 English, 17/26 Spanish). Usage: 1,465,227 input / 106,438 output tokens; mean observed latency 674 ms. The score script was rerun with `--overwrite` only to correct its comparison labels and scope caveat; the raw live responses were not changed.

The 80k cap avoided the 96k synthetic request-size failure and kept this real 200-heading corpus in one Choice per query. A separate live synthetic 261-heading smoke retained two candidates from each local shard and passed exact fetch 2/2; a separate real Spanish one-query smoke confirmed the live probability-map contract and exact fetch. These smoke results do not count in the 52-query score.

The single exact-label result is exploratory, not proof of a stable lift over the older full-heading benchmark. Labels remain Luna-reviewed and confidence is uncalibrated. See the comparison index one directory above for all limitations and next gates.
