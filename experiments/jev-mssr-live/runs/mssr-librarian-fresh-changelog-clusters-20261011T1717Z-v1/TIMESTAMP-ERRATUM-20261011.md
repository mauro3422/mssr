# Timestamp erratum — 2026-10-11

This append-only note preserves the frozen follow-up plans and records their
actual durable-write/provider-call order from Bridge 0.6.169 metrics. The
declared freeze times in the original files were inaccurate; no plan or Jev
record was rewritten.

| Frozen plan | Declared time (UTC) | Bridge durable write (UTC) | Jev event (UTC) | Event evidence |
| --- | --- | --- | --- | --- |
| `FOLLOWUP-PLAN.md` | 17:19:00 | 17:18:31.366 | Facet A 17:18:36.449; facet B 17:18:37.307 | write `mv437efa-5na2yabm`; Jev `mv437ich-ombjm1oe`, `mv437j0b-kzjtg0ob` |
| `FOLLOWUP-ADDENDUM-2.md` | 17:20:10 | 17:20:19.119 | 17:20:27.026 | write `mv439pkf-gxcjkzov`; Jev `mv439vo2-mhg3ym71` |
| `FOLLOWUP-ADDENDUM-3.md` | 17:21:00 | 17:21:50.716 | 17:21:50.770 | write `mv43bo8s-0odks6ws`; Jev `mv43boaa-qo8hjlbf` |

For all three items, the persisted plan preceded the associated Jev call, so
the query/facet text was durable before provider execution. The declared
timestamps are not valid freeze receipts. Facet D's call began only 54 ms after
the file-write event, which leaves a narrow orchestration interval; the Bridge
event ordering is the available evidence and does not prove a stronger
pre-registration guarantee.

All events belong to Bridge boot
`adf97c06-a668-4ff9-a187-c12ab058bff2`, active trace
`mssr-codex-6fa7ae20-eb87-4652-996b-20fd7e64c7b2`. The primary manifest's
17:17:21Z freeze remains unchanged. This correction does not alter the frozen
query/rubric bytes or semantic grades.
