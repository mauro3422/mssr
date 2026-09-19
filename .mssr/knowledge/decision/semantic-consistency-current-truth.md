# Semantic consistency current-truth decision

## C2c projection

Freshness and semantic consistency are separate. C2c compares bounded structured observations under an explicit semantic `key`, with declared role, authority, state, optional value/revision, and lifecycle requirement. Canonical disagreement or release-critical required replica drift may project ERROR. Generic C2c may still review historical authority when a caller deliberately submits it against newer canonical evidence. C2c does not parse free-form memory for truth, merge unrelated version-like strings, rewrite authority, or execute recovery.

## C2d recommendation

Diagnosis and recovery recommendation remain separate owners. C2d `evidence-first-v1` consumes only the bounded C2c projection and its observations. It favors high-information/low-risk inspection when repair evidence is unresolved, blocks downstream verification behind known upstream generated drift, blocks repair on canonical conflict, and may abstain on insufficient evidence. Recommendation metadata is advisory and auditable; learned weights or priors remain observe/shadow-only until their existing promotion gates pass.

## R4 temporal validity

R4 separates authority from temporal validity. A statement can be authoritative evidence of an earlier state without competing as current truth. Explicit `historical` and `superseded` claims remain provenance but are filtered before the R4 current-truth C2c comparison; `unknown` also abstains. Only explicit `current` claims enter the scope-isolated R4 comparison. This wrapper does not change generic C2c semantics for callers that intentionally submit historical-authority observations.

R4 claim producers stay narrow: declared machine/checklist structures may produce claims; arbitrary surrounding prose, prompts, transcripts, logs, or model-extracted summaries do not become canonical facts.