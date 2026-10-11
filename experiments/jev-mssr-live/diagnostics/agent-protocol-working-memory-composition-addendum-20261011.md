# Working-memory retrieval and composition addendum

Append-only continuation of the [four-query post-hoc diagnostic](agent-protocol-working-memory-jev-posthoc-20261011.md). This remains the same `docs/AGENT_PROTOCOL.md` source-document cluster; this additional query is not an independent benchmark sample.

## Fifth linked Jev request

- Query: “What is the retention rule for open-trace working memory, and which fields are excluded from the durable learning digest?”
- Selected exact handle: `block-31`, `docs/AGENT_PROTOCOL.md:L135-L135`
- Source revision: `30e9f8da6103c4904559009533fa946ac53c3e5bf04ac5898e6088f919a458ca`
- Handle fingerprint: `74516934c52fe74b944cf3159aa2f14ca4ba21bf0e512ea8dc8755a98d02fe6e`
- Jev: Choice 0.48; map `h001=0.74`, `none=0.26`; Noul 0.37
- Provider/model: `typesafe-jev` / `jev-1.13.0`; 676 input and 57 output tokens

The scores are raw, uncalibrated provider outputs. Jev selected the exact block;
the subsequent fetch returned 663 characters with the same fingerprint. The
verbatim evidence pack retained that text and citation. It states that working
memory is retained `until-outcome` and purged after a final outcome; a separate
durable learning digest may contain only specified observable structured
evidence, and must exclude the working summary, active hypotheses, arbitrary
working decisions, raw prompts, transcripts, secrets, private chain-of-thought,
and unbounded scratchpads.

## Host composition check

The host combined the previously exact-packed `block-30` (`L133`, fingerprint
`d2d4439a3f34046f1c7e52f853387155d72a796e7a97f85fa435b4c2988a91a7`, 395
characters) with this `block-31` (`L135`, 663 characters) into this Spanish
answer:

> Mientras ayude a continuar o recuperar, el host puede mantener un `workingSummary` resuelto, hipótesis acotadas con referencias de evidencia, decisiones acotadas con razones breves y el `nextGate` [docs/AGENT_PROTOCOL.md:L133]. Ese objeto sólo vive hasta el resultado final, cuando debe purgarse [docs/AGENT_PROTOCOL.md:L135]; no es un almacén de transcripciones ni de chain-of-thought [docs/AGENT_PROTOCOL.md:L133]. Antes de purgarlo, el host puede derivar un `learning-digest-v1` únicamente de evidencia estructurada observable (firma semántica, skills/recomendaciones y transiciones, módulos de contexto acotados, metadatos del resultado e hipótesis respaldadas o rechazadas con referencia) [docs/AGENT_PROTOCOL.md:L135]. Al digest no se copian `workingSummary`, hipótesis activas, decisiones arbitrarias, prompts crudos, transcripciones, secretos, chain-of-thought privado ni scratchpads ilimitados [docs/AGENT_PROTOCOL.md:L135].

A blind Luna review graded the composed response **Full** for the three requested
facets and confirmed that the answer distinguishes restrictions on ephemeral
working memory from exclusions specific to the durable digest. This is a
second model-assisted review of the same source cluster, not independent
adjudication or owner-gold. The evidence pack provides exact citations
`docs/AGENT_PROTOCOL.md:L133-L133` and `docs/AGENT_PROTOCOL.md:L135-L135`;
Jev selected evidence but did not author the paragraph.

## Connector/lifecycle recovery

A direct Jev connector call that omitted trace attribution returned
`executed=false` with `mssr-lifecycle-preflight-required`; no provider request
was made. After MSSR bootstrap, the same request ran successfully through the
Bridge action wrapper with the explicit active trace ID. A bootstrap registry
snapshot also reported its Bridge provider as disconnected, while the separate
local Bridge wrapper remained callable. No runtime restart was attempted.
Earlier diagnostics already describe this wrapper requirement, so this is
recorded as another observation of the known recovery path, not a new Jev or
source-integrity incident. The root cause of the transient registry status is
unresolved.

## Conclusion

This adds one linked selection plus exact fetch/pack and a cited host-composed
answer to the existing exploratory cluster. It demonstrates the full
search/select → exact re-read → evidence-pack → host-compose path on one real
MSSR source. It does not establish general retrieval quality, calibrated
confidence, an agent-generated synthesis capability, or production readiness.
No code, thresholds, release package, or runtime activation changed.
