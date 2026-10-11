# Append-only run erratum

The prepared manifest says `source.workingTreeClean: true`. That field was
incorrect: the MSSR worktree already contained this new untracked run directory
when the manifest was frozen. The tracked source commit is still the recorded
base commit, and the provider input bytes were copied into the run, hashed, and
checked against the explicit sourceRef before and after the request. The
isolated Bridge checkout itself was clean at freeze and stayed clean after the
temporary package swap.

The 13-CRLF fixture was too short to distinguish MSSR 0.2.126 from 0.2.121:
both versions selected `Target evidence` and exact fetch passed. This run proves
the candidate path works on this small CRLF/Unicode case, but it is not evidence
that the fix changes provider-visible text. The linked baseline receipt is in
`../mssr-librarian-crlf-baseline-20261011T183100Z-v1/`.
