# Candidate-seed scan — 2026-10-04

**Status:** query-seed proposals only; no answers, labels, accepted ranges,
benchmark outcomes, or Jev/Noul calls.

Two separate `gpt-6-luna` reviewers at low reasoning effort inspected MSSR
source revision `ad9a46ad2c0d95dc012fe1e07049bfd45cc3c330` and the existing
C01–C18 candidate bank. They were asked for distinct bilingual candidate
queries in disjoint architecture/decision and protocol/document areas, with
source anchors and no labels or provider calls. The architecture reviewer
returned 11 proposals across two read-only turns; the protocol reviewer
returned 6. This is candidate generation, not independent evaluation: both
reviewers used the same model family.

Fourteen proposals became C19–C32 after a source and duplicate review for distinct scope
and usable source anchors. Three proposals were excluded from this bank:

- The notice-ownership-history query was historical and overlapped the more
  direct host-boundary receipt case C27.
- A Project Context Plane query used the exact C11 heading and was too close
  to its existing maintenance/write-preflight concept.
- One metadata projection query duplicated C24's sidecar fingerprint/stale
  data concept.

Several retained cases share source documents or broad domains with older
cases. Keep them in the same data split wherever source or concept overlap is
confirmed. The new cases do not increase the proven independent-unit count
until a human owner defines and adjudicates source/concept clusters. C30 and
C31 deliberately ask about historical decisions and must not be read as
current Git/runtime state. C26 is a versioned migration guide; verify it
against the present installer before using it as a current-behavior label.

The query bank records all retained Spanish/English wording and source
anchors. Freeze one exact source snapshot for the full bank before human
adjudication. C01–C18 were first seeded from `cbc4f35`, while the blind review
and C19–C32 generation read `ad9a46a`; between those revisions, `.mssr/PROJECT_STATE.md`
changed among the C01–C18 source files. Re-read all state-backed cases at the
frozen revision and never copy a prior line range without checking it there.
