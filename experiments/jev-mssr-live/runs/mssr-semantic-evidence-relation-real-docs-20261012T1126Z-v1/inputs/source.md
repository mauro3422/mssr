# Exact source ranges

## docs/decisions/0009-semantic-evidence-plane.md — block-11, line 62

> `EvidenceAtom v2` derives a stable content-addressed id from subject + normalized source/revision + provenance + fingerprints + dedupe identity. Semantic reason codes, usage state and small attributes are deliberately non-identity metadata so later selection/outcome observations do not rewrite the atom's stable identity. Exact heading/range refs require a source revision. A `fresh` label additionally requires a caller-supplied observation assertion matching canonical owner, normalized ref and revision with an observation timestamp; validation checks consistency only and does not authenticate the host or independently prove the observation occurred. Sensitive-excluded atoms and free-form attribute strings are rejected. Projection from a Librarian catalog record carries only compact refs/fingerprints plus explicitly selected primitive attributes; it never copies the full Librarian metadata payload.

## .mssr/knowledge/architecture/semantic-evidence-plane.md — block-5, line 15

> Librarian adapts typed, privacy-safe producer metadata while retaining caller-asserted provenance; it does not authenticate that provenance. Deterministic structural duplicate checks run before optional Jev relation judgments. Jev selections, confidence and sufficiency scores remain advisory and uncalibrated. Exact fetch, independent verification and separate permission/write gates remain required; synthesis preview never writes canonical sources.
