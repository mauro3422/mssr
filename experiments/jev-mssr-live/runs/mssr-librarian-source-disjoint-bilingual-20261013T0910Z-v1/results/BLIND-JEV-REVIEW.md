# Independent blind review

The reviewer received the frozen source snapshots and the sanitized retrieval/selection pack. It did not receive the positive/negative class labels or call Jev. This is an independent source review, not owner-gold.

| ID | Case / arm | Retrieval | Jev outcome | Evidence range quality |
|---|---|---|---|---|
| Q-01 | BEE-01 / ES | Sufficient | Sufficient | Moderate |
| Q-02 | BEE-01 / EN | Sufficient | Sufficient | Tight |
| Q-03 | BEE-02 / ES | Insufficient; no candidates | Not run | — |
| Q-04 | BEE-02 / EN | Sufficient | Sufficient | Tight |
| Q-05 | BEE-03 / ES | Sufficient | Abstention appropriate | — |
| Q-06 | BEE-03 / EN | Sufficient | Abstention appropriate | — |
| Q-07 | BEE-04 / ES | Insufficient; no candidates | Not run | — |
| Q-08 | BEE-04 / EN | Sufficient | Abstention appropriate | — |
| Q-09 | EF-01 / ES | Sufficient | Sufficient | Broad |
| Q-10 | EF-01 / EN | Sufficient | Sufficient | Reviewer said tight; exact saved handle is broad |
| Q-11 | EF-02 / ES | Sufficient | Sufficient | Broad |
| Q-12 | EF-02 / EN | Sufficient | Abstention missed | — |
| Q-13 | EF-03 / ES | Sufficient | Sufficient | Tight |
| Q-14 | EF-03 / EN | Sufficient | Sufficient | Tight |
| Q-15 | EF-04 / ES | Sufficient | Abstention appropriate | — |
| Q-16 | EF-04 / EN | Sufficient | Abstention appropriate | — |
| Q-17 | BR-01 / ES | Insufficient; target absent from candidates | Abstention appropriate | — |
| Q-18 | BR-01 / EN | Sufficient | Sufficient | Moderate |
| Q-19 | BR-02 / ES | Sufficient | Sufficient | Tight |
| Q-20 | BR-02 / EN | Sufficient | Sufficient | Tight |
| Q-21 | BR-03 / ES | Sufficient | Sufficient | Tight |
| Q-22 | BR-03 / EN | Sufficient | Abstention missed | — |
| Q-23 | BR-04 / ES | Sufficient | Abstention appropriate | — |
| Q-24 | BR-04 / EN | Sufficient | Abstention appropriate | — |

## Reconciled discrepancy

The reviewer labeled Q-10 tight. The persisted Jev result `selection/EF-01.en.jev.json` points to `heading-1`, lines 1–39, while the answer is on line 6. This is the full matrix, so the run counts Q-10 as broad. The reviewer correctly judged the evidence sufficient; only its breadth label conflicts with the exact handle.

## Interpretation

- All 12 selected results were judged sufficient; no unsupported selection was observed in this cohort.
- The reviewer found two missed abstentions: Q-12 had the exact positive span available, and Q-22 had explicit no-authorization evidence available.
- Q-09 and Q-11 were broad; Q-10 is broad after exact-handle reconciliation. Q-01 and Q-18 were moderate.
- Q-17 is a retrieval failure on a positive case, followed by a safe abstention. It is not a true no-answer case.
- Three selected negative-case passages explicitly say a value is unset or unauthorized. The reviewer considered those useful evidence; strict abstention metrics alone undercount that behavior.
