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
