# Search-derived block selection — notice-plane diagnostic

Run: `mssr-librarian-notice-blocks-20261011T162000Z-v1`

Provider: Jev `jev-1.13.0` through the isolated Bridge `0.6.169` adapter

MSSR selector: `0.2.124`; repository commit `061ca1875c1e75179a8ca1024cec906df7105c1a`

## Result

The three live requests completed without provider errors. MSSR's deterministic
search supplied ten revision-bound candidate handles per query. Jev selected
an exact block in all three cases; all three exact fetch fingerprints matched.

| Query | Selected source range | Choice / Noul | Blind quality |
| --- | --- | --- | --- |
| Compound transition, threshold, and authority question | ADR 0002, line 22; 284 code units | 0.90 / 0.76 | Partial: both reviewers found it omits whether the notice authorizes or executes the action. |
| Transition and threshold facet | ADR 0002, line 22; 284 code units | 1.00 / 0.92 | Full, low overbreadth from both reviewers. |
| Notice-authority facet | ADR 0002, line 24; 100 code units | 1.00 / 0.97 | Full, low overbreadth from both reviewers. |

I composed a concise answer from the two facet fetches and cited each exact
range. Both blind reviewers judged the union-supported answer full and low in
overbreadth:

> Se genera un candidato de atención cuando la evidencia entra, cambia, escala,
> desescala o sale del umbral accionable. El umbral es `review` dentro de `ok <
> watch < review < error`. La notificación puede recomendar una acción del host,
> pero no la autoriza ni la ejecuta automáticamente.

The host performed the query decomposition and composition in this diagnostic.
The test demonstrates that the existing search → exact-handle selection → exact
fetch pieces can provide compact evidence for a composed answer. It does not
show that MSSR currently plans facets, checks semantic union coverage, or gates
synthesis automatically. That is the next capability to assess against the
existing evidence-pack and preview contracts before adding a new subsystem.

This is three linked requests against one already-exposed ADR source cluster,
not three independent benchmark cases. Expected facets were prepared from the
source before live calls, but are host-authored rather than owner-gold. Choice
and Noul remain descriptive provider scores, not calibrated probabilities.
Usage was 5,521 input and 441 output tokens. The run used an isolated adapter;
`run-completion.json` records `productionRuntimeTouched: false`. No production
runtime, default excerpt cap, confidence threshold, or policy was changed.

See `host-composed-answer.json`, blind labels, `SHA256SUMS`, and
`DERIVED-SHA256SUMS` for the exact reproducible evidence.
