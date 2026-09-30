# Routing contract maintenance

Read when a skill's activation, phase, dependency, exclusion, discovery, or
routing result changes.

Run `skill_route_audit`; inspect the canonical vocabulary; classify the change;
then update only the Git-tracked contract and fixtures needed by the changed
semantics. A new or renamed owned skill is unstable until it has explicit
metadata, a positive active/deferred case, a nearby negative case (unless
always-active), a bounded continuation case when resumable, and a real route
plan. Inspect both active and deferred candidates for contamination.

Use artifact/action/need/signal match gates with nearby negatives when a broad
match creates false positives. Verify dependency references and cycles. For
discovery changes, test allowed junctions and plugin cache roots separately;
never mutate caches. Run focused case(s), build/router/context tests, audit, and
package/discovery checks as applicable. Update docs and incidents only for a
durable contract defect, preserving observable facts rather than reasoning.

## Selection-feedback maintenance

Repeated optional-skill feedback is review evidence, not routing authority. When
a host skips a candidate as `redundant`, record `relatedSkillName` only when it
observed an exact peer covering the same task need; never infer that peer from
skill names or prose. Legacy redundancy without a peer may surface bounded
co-occurring accepted skills as hypotheses only. Repeated `irrelevant-domain`
feedback may surface the task domains/signatures where the candidate leaked.

After the configured distinct-trace threshold, telemetry may emit only bounded
`skill-overlap` or `skill-domain-mismatch` maintenance candidates. Review the
owning skill and versioned routing metadata before choosing a correction:

- tighten domain/action/artifact/need/signal gates or negative intents for false positives;
- use existing `requires`, `complements`, or `excludes` relations when that is the reviewed semantic relationship;
- merge, supersede, split, or remove a skill only after explicit owner review proves structural duplication;
- keep distinct skills when overlap is phase-, domain-, or task-signature-specific.

Frequency, a model/Jev suggestion, a generated workspace index, or an exact
`relatedSkillName` observation never proves semantic equivalence and never
mutates routing automatically. Add positive and nearby negative fixtures for the
reviewed correction and verify that unrelated domains remain unaffected.
