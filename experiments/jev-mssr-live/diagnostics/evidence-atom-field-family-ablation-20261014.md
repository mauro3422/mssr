# EvidenceAtom field-family sensitivity ablation (2026-10-14)

## Question

On the three already-exposed lifecycle sections from the prior diagnostic, do
Jev's answers change when the atom's freshness field, usage object, or bundled
identity/source locators are altered, while the parent, question, section text,
and neutral clarification stay fixed?

This is a prompt-sensitivity probe, not a reliability benchmark. It reuses the
same three content units and author-derived `current` labels as the earlier
[lifecycle diagnostic](evidence-atom-lifecycle-freshness-20261014.md).

## Frozen design and execution

- Five arms: parent plus neutral note; complete EvidenceAtom v2 plus note;
  atom with `source.freshness` omitted; atom with the whole `usage` object
  omitted; and an opaque identity/locator projection that neutralizes
  `subject.identity`, `source.ref`, revision, heading path, range, and dedupe
  key, then rebuilds the atom ID.
- Three exposed sections × three repeated calls per arm = 45 requests over
  only **three unique content units**. Repetitions are not independent cases.
- The parent, source text, lifecycle question, and note were held constant.
  Requests were interleaved with seeded randomization. Labels remained outside
  the provider payload.
- Local MSSR provider-input privacy screening blocked 0/45 requests. Strict
  EvidenceAtom v2 validation identified 18 valid atom payloads and 18 expected
  invalid payloads: the 9 freshness omissions and 9 usage omissions. The
  parent control has no atom. The opaque identity/locator projection passed
  schema validation but is synthetic and not a production source handle.
- Jev 1.13.0 completed all 45 sequential calls with no failures or retries.
  Total usage was 59,130 input and 2,225 output tokens; mean client-observed
  latency was 267 ms.
- Two independent Luna reviewers recomputed the aggregate counts from the
  private records and labels. All six entries in the artifact `SHA256SUMS`
  file were independently verified.
- Frozen requests, responses, and private labels remain outside Git at
  `D:\MSSR-benchmark-artifacts\jev-mssr-dev\evidence-atom-field-family-ablation-20261014T075235Z-dev-v1`.
  Do not publish or copy that complete directory into the repository.

## Results

Every label below is an exposed author-derived `current` label, not independent
owner adjudication.

| Arm | Matches | Errors | Choices | Mean raw Choice score |
|---|---:|---:|---|---:|
| Parent + neutral note | 9/9 | 0/9 | 9 current | 0.618 |
| Full atom + neutral note | 6/9 | 3/9 | 6 current, 3 historical | 0.486 |
| Freshness omitted (schema-invalid) | 6/9 | 3/9 | 6 current, 3 historical | 0.511 |
| Usage omitted (schema-invalid) | 6/9 | 3/9 | 6 current, 3 historical | 0.496 |
| Opaque identity/locator projection | 8/9 | 1/9 | 8 current, 1 historical | 0.469 |

Paired with the full-atom arm by the same section and repetition:

- Omitting freshness changed 2/9 choices: one changed to the author label and
  one changed away from it.
- Omitting usage also changed 2/9: one toward and one away from the author
  label.
- Neutralizing the identity/locator bundle changed 4/9: three changed toward
  the author label and one away. This is a net gain of two matching calls on
  these repeated examples, not two additional independent successes.

The raw scores are descriptive outputs, not probabilities or calibrated
confidence. The identity/locator projection's lower mean score (0.469) despite
more label matches is another reason not to read the score as a correctness
percentage.

## Interpretation and decision

The parent-only control again matched all nine responses, while the full atom
matched six. Neutralizing the atom's bundled identity and locator metadata
matched eight and changed four paired answers. This makes the bundle a useful
follow-up hypothesis for the lifecycle regression; it does **not** identify a
single causal field. The parent still contains source identity metadata, and
the ablation changes several atom fields together.

Freshness and usage omission did not improve the aggregate count. Those arms
deliberately violate the strict v2 atom schema, so they test Jev prompt
sensitivity to malformed payloads only; they say nothing about the effect of
valid freshness or usage fields in production.

**Maintenance decision: insufficient evidence for a code, schema, prompt,
threshold, Bridge, or production change.** Keep the librarian advisory and
human-reviewed. Do not pool these calls with benchmark, holdout, reliability,
or calibration denominators.

## Next gate

Build and owner-adjudicate a balanced lifecycle set from independent source
documents, covering current, historical, mixed, and unknown outcomes. Then
compare schema-valid one-factor variants under a frozen Spanish rubric,
separating source freshness from claim validity and recording contradiction or
supersession context as an independent factor. Group splits by project/source
family; reserve a fresh untouched holdout. Repetitions may describe stability,
but they do not increase the number of independent units. No confidence
threshold is supported until those gates and per-family calibration metrics
pass.
