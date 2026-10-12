# Run51 — Real-document provenance relation diagnostic

Status: prepared before provider call; one live Jev call is planned.

This diagnostic compares two exact MSSR ranges about provenance/freshness
claims. The expected relation is stored in `inputs/labels.json` and is not sent
to Jev. The pair uses real canonical repository documents, but the architecture
module may summarize the ADR; treat the sources as dependent, not as two
independent samples or owner-adjudicated gold.

The expected relation is `supports`: both ranges say that caller-supplied
provenance/freshness assertions are consistency-checked but not authenticated.
That is a manual exploratory label, not an accepted project decision.

The full source text is frozen in `inputs/source.md`; exact revision-bound
handles and fingerprints were fetched through the Bridge Librarian before the
provider call. EvidenceAtoms use a host observation timestamp from that exact
fetch. Jev output remains advisory and unverified; the evaluator should keep it
in review absent independent verification. No threshold, runtime, policy, or
canonical document is changed by this run.

This is a direct Bridge diagnostic, not a frozen CLI-runner packet. It preserves
the structured Bridge request/response and reported usage; it does not capture
raw provider HTTP bytes. See the derived report and metrics after the call.
