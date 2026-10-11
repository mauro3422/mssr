# ADR 0008 post-hoc Librarian trace diagnostic — 2026-10-11

**Status:** exploratory, post-hoc, one source-document cluster. This note was
written after the live calls. It is not a frozen benchmark run, owner-gold,
holdout, reliability estimate, or confidence-calibration evidence.

## Source and trace

- Project: `D:\Dev\mssr`
- Source: `docs/decisions/0008-context-economy-v2.md`
- Source SHA-256 / Librarian revision: `fddc73ba3178f5335ae0d9a7df53964d458c4cd7925cd9ce2e4b292d94a132e5`
- Bridge: `0.6.169`; runtime boot `adf97c06-a668-4ff9-a187-c12ab058bff2`
- MSSR trace: `mssr-20261011140241-cf4ec8c0-0a0`
- Workflow: `jev-mssr-librarian-evaluation`
- Trace readback contained the successful search, Jev selection, exact fetch, and
  evidence-pack operations under this same explicit trace ID. It also retained
  the recovered wrapper/schema errors listed below.

The source hash was read from the current working-tree file and matched the
revision in every selected/fetched handle.

## Linked retrieval observations

Both requests used the same ADR 0008 source and therefore form **one document
cluster**, not two independent cases.

| Request | Jev result | Literal-range review |
| --- | --- | --- |
| Broad: “¿Qué prueba exacta necesita el host para reutilizar contexto procedimental previo después de una replanificación?” | Selected `block-7` / `Decision`, lines 20–20; raw Choice confidence `0.97`; Noul/evidence sufficiency `0.81`. Both are uncalibrated provider scores. | **Partial.** The exact fetched range required a currently retained context and exact id+fingerprint match, but omitted the stable unit-ID forms and the bytes covered by the fingerprint. |
| Facet-specific: “¿Qué campos exactos identifica el recibo y sobre qué bytes se calcula su fingerprint?” | From 40 exact candidate handles, selected `block-6`, lines 17–18; raw Choice confidence `0.91`; Noul `0.61`. Both remain uncalibrated. | **Full** under a blind Luna review against the two explicit facets in the query. |

For the focused request, exact fetch and evidence pack returned the same 129
characters and handle fingerprint `13bbebd2157824ea6f1bbd26394a12b038e6756f038dcd07d1cbd7f6e2dc356d`.
The literal text was:

> - its stable unit id (`<skill>:core` or `<skill>:module:<id>`); and
> - a SHA-256 fingerprint of the exact assembled content bytes.

The focused question divided the compound requirement into the two concrete
facets missing from the broad selected range. This is a useful diagnostic
example of query decomposition, but it is one source and two linked queries;
it cannot establish general performance or justify a confidence threshold.

## Trace/wrapper friction

Three calls failed before recovery; none indicates a Jev or source-integrity
failure:

1. `mssr_librarian_search` rejected `maxSnippetChars=420`; the runtime maximum
   is 240. The corrected search succeeded.
2. `bridge_tool_query` refused Jev selection because that operation is not
   classified read-only. `bridge_tool_action` with the exact tool-name
   confirmation succeeded and retained the explicit trace ID.
3. `bridge_tool_action` refused exact fetch because fetch is classified
   read-only. `bridge_tool_query` succeeded for fetch and evidence-pack.

The recovered usage rule is: use the query wrapper for read-only search/fetch/
pack, and the action wrapper for Jev selection; pass the active trace ID at the
wrapper level. The failures and recovery are visible in the trace evidence.
No MSSR source or benchmark semantics needed correction, so this is recorded as
reviewed operational friction rather than a product incident.

## Interpretation and next gate

- Exact source selection, re-fetch, citation binding, and verbatim packing all
  worked in the connected Bridge path.
- The focused selection fully covered its narrow two-facet question; the broad
  selection was partial despite higher raw scores. Raw Jev confidence/Noul is
  not a probability of semantic completeness.
- Do not pool these observations with prior ADR 0008 exposures or count them as
  independent samples.
- A future confirmatory run needs a frozen manifest and independently prepared
  labels before provider calls. Keep source-document grouping, blind literal
  range review, and facet coverage separate from retrieval integrity and raw
  provider scores.
- No production activation, score threshold, canonical project decision, or
  calibration claim changed.
