## 2026-10-11 connected Jev/Librarian diagnostics

The direct-MCP pilot used five selection requests across three exact
source-document clusters. Expected ranges were selected on two primary cases
and one narrow facet, while compound OpenCode queries abstained. Exact fetches
passed. Labels were blind Luna model-assisted, not owner-gold; the run was
ad hoc, exploratory, and uncalibrated. Full packet:
`experiments/jev-mssr-live/runs/mssr-librarian-live-holdout-pilot-20261011T152823Z-v1/`.
No threshold change.

The connected Bridge compound-query diagnostic used five Jev selections on
one real MSSR source cluster; all five exact fetches verified. With a fixed
three-handle pool, two host-split authority/inbox questions selected their
respective exact blocks (2/2); the compound question selected only the inbox
block and omitted the explicit `.bridge/` no-fallback rule. Noul returned 0.83
for that partial evidence, while Choice confidence was 0.32. This is one
post-hoc source-derived diagnostic, not owner-gold, independent evaluation or
calibration. One blind Luna reviewer also marked the compound result partial.
It supports testing explicit facet decomposition and semantic union coverage;
it does not justify a threshold or production change. Receipt:
`experiments/jev-mssr-live/runs/mssr-bridge-cutover-compound-diagnostic-20261011T1704Z-v1/`.

The fresh changelog-cluster diagnostic used three source clusters. Jev selected
and exact-fetched two primary cases; on the third it abstained from an
answerable compound question. Four linked, manually split facets on that same
source then selected exact ranges, and two blind Luna reviewers judged their
union complete for the frozen question. This supports a manual host-side
decomposition/evidence-union pattern for one case; it does not prove automatic
facet planning, semantic-coverage gating, owner-gold, or calibration. All six
selected exact fetches matched fingerprints. Scores remain uncalibrated, and
production Bridge/runtime behavior did not change. Follow-up plan timestamps
were declared incorrectly; the append-only erratum records Bridge
write-before-call event ordering. See
`experiments/jev-mssr-live/runs/mssr-librarian-fresh-changelog-clusters-20261011T1717Z-v1/RUN-REPORT.md`
and the [run ledger](../../../experiments/jev-mssr-live/README.md).

The cross-family run used three queries on separate MSSR documents through
Bridge 0.6.169 / MSSR 0.2.121. Target sections, search, exact fetches and packs
passed 3/3. Blind Luna grades were complete, with extra context; labels are not
owner-gold or calibration. A heading-format mismatch caused the original 0/3;
the summarizer now normalizes titles. The runner dropped numeric
`evidenceSufficiency` under a wrong field name, so Noul values are lost, not
Jev omissions. Runtime and thresholds did not change. See the [report](../../../experiments/jev-mssr-live/runs/mssr-librarian-cross-family-fresh-smoke-20261011T181217Z-v1/ADJUDICATION-REPORT.md)
and [run ledger](../../../experiments/jev-mssr-live/README.md).
