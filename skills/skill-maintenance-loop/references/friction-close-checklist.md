# Maintenance close checklist

Read at close after maintenance or publication work.

## Close checklist

- original failure reproduced or historical limitation stated;
- root cause separated from contributor and tooling artifact;
- skill/tool/routing owner identified;
- affected generated outputs refreshed, if any;
- positive, negative and continuation fixtures pass;
- process exits cleanly;
- source and live version gates are distinguished;
- no cache, secrets or temporary evidence staged;
- commits and pushes confirmed when publication was in scope;
- context handoff recorded when another product must continue.

Record the maintenance phase checkpoint before the final outcome. A read-only
review needs its conclusion and evidence, not artificial persistence or a
release. A completed source change and an unadopted live package are separate
states; report the latter explicitly.
