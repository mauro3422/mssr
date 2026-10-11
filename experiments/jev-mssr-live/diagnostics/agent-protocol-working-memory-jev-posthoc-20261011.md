# Agent protocol working-memory Jev diagnostic

This is an append-only post-hoc live diagnostic, not a frozen benchmark run.
The queries were exploratory and all four Jev calls used the same source
document and revision, so they form **one source-document cluster**. Do not pool
them as independent cases or use their provider scores for calibration,
threshold setting, or production activation.

## Source and live path

- Repository: `d:/dev/mssr`
- Source: `docs/AGENT_PROTOCOL.md`
- Source revision: `30e9f8da6103c4904559009533fa946ac53c3e5bf04ac5898e6088f919a458ca`
- Bridge: live connected Bridge 0.6.169; MSSR 0.2.121
- Trace: `mssr-20261011140241-cf4ec8c0-0a0`
- Provider/model: `typesafe-jev` / `jev-1.13.0`
- Execution window: 2026-10-11, approximately 14:50–14:52 UTC
- Every provider call completed; exact source fetch and verbatim evidence-pack
  checks passed for the selected full section and selected prose block.

## Four linked queries

| Query | Exact result | Raw Jev scores |
| --- | --- | --- |
| Which bounded working metadata may remain in an open trace, and what must never be stored there? | `heading-8`, “Ephemeral trace working memory”, lines 131–141 | Choice 0.58; probability map `h001=0.79`, `none=0.21`; Noul 0.32 |
| What exact fields may the host keep in the bounded working-memory object while a trace remains open? | Same `heading-8`, lines 131–141 | Choice 0.34; map `h001=0.67`, `none=0.33`; Noul 0.31 |
| Which categories are excluded from the durable learning digest? | Same `heading-8`, lines 131–141 | Choice 0.94; map `h001=0.97`, `none=0.03`; Noul 0.67 |
| What exact fields may the host preserve in bounded open-trace working metadata? | `block-30`, prose block, line 133 | Choice 0.62; map `h001=0.81`, `none=0.19`; Noul 0.41 |

These are raw, uncalibrated provider outputs. The score changes across these
wordings are descriptive only; they do not establish a reliability rate.

## Integrity and answer review

The full-section handle was `f06b8c936996d68dcff6b536a98fc76241d6371f0121313c7b2c67c6aec1d784`, range `heading-8`, lines 131–141, fingerprint
`694e1a6bc6fd34bcd3481c483292df186c11e872d364b5aba12bc7f2ea2c0270`.
Fetch returned 2,058 exact characters; the evidence pack preserved that text
verbatim with citation `docs/AGENT_PROTOCOL.md:L131-L141`.

The focused block handle was `312d3fb995642027a2dfda735a509413e8daf359c7358e4eaf030e50d933e7e3`, range `block-30`, line 133, fingerprint
`d2d4439a3f34046f1c7e52f853387155d72a796e7a97f85fa435b4c2988a91a7`.
Fetch and evidence pack returned the same 395-character paragraph with
citation `docs/AGENT_PROTOCOL.md:L133-L133`.

A blind Luna review marked the compound result **Full**. A separate literal
scope review finds that label too broad: the source distinguishes what is not
stored in open working memory (it is not a transcript or chain-of-thought
store) from what is excluded from the *durable learning digest* (including the
working summary, active hypotheses, arbitrary decisions, raw prompts,
transcripts, secrets, private chain-of-thought, and unbounded scratchpads).
The compound query's word “there” leaves that scope ambiguous. Treat the blind
Full as model-assisted annotation, not owner-gold; provisionally score the
second facet as partial/ambiguous pending independent adjudication.

## Implementation observation and next experiment

`src/librarian-jev-selection.ts` builds each Jev candidate from a
query-centered excerpt capped at 260 characters. Exact fetching happens after
selection and revalidates the complete revision-bound range; Jev does not see
that full range during the selection call. That design can explain why a
selection's Noul score differs from the completeness found after exact fetch,
but these four calls do not establish causality. The 395-character focused
block was still clipped for the live selection request, while the subsequent
fetch and pack verified the full 395 characters.

Next, prepare a frozen paired diagnostic that compares the current excerpt cap
with a larger bounded excerpt against the same held-out source clusters. Keep
Choice selection, Noul sufficiency, exact-fetch integrity, and literal facet
coverage as separate outcomes. Check candidate throughput/token cost before
changing the 260-character cap. No code, score threshold, project policy, or
runtime activation was changed by this diagnostic.
