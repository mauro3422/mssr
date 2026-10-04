# Librarian owner-adjudication worksheet

**Purpose:** Prepare independent owner labels for one bilingual query per concept. This is an unadjudicated worksheet. Candidate ranges and review notes are proposals for owner review, not accepted gold ranges, answerability labels, or benchmark outcomes. No Jev/provider output is included.

**Frozen product source:** `e3e03912d63231ebf646fdaec9353ee1e28fe403` (MSSR 0.2.104). All citations use this commit. File SHA-256 hashes exact Git blob bytes; excerpt SHA-256 hashes the listed inclusive line range. Line numbers are one-based and inclusive.

## Independence and split warning

The bank contains **32 bilingual query pairs = 32 concepts**, with citations spanning **28 unique source paths** (from a 30-file frozen manifest; two manifest paths are not cited). Spanish and English are one case, not two. Shared-document and related-concept cases must stay in one partition. The independent cluster count is unknown and may be below 28; the 30-independent-unit reporting floor is not met by the case count. Even 30 independent units would be a reporting floor, not a sample-size guarantee.

## Frozen source manifest

| Ref | Repository path | File SHA-256 at frozen commit |
|---|---|---|
| S01 | `.mssr/PROJECT_STATE.md` | `93d05a9aefc4e00db5cfe2dccd8229c13d8027aff1cbf4175eed04bcf7e5ef49` |
| S02 | `.mssr/knowledge/architecture/architecture-impact-review-decision.md` | `e1ab8240b1edc4c6aad10d25a84b4bef4e9b7470663a7649cb415f0cd17c68df` |
| S03 | `.mssr/knowledge/architecture/architecture-impact-review-history.md` | `e1f817f4de9d44505708e95d75f552376fe0da6413ec30ce2c5ad39ee0baf514` |
| S04 | `.mssr/knowledge/architecture/canonical-ownership.md` | `dabe0cc19d56c8205280f20fd025bbd856d37e9ba9fb86bb01c97492767d7479` |
| S05 | `.mssr/knowledge/architecture/context-economy-v2.md` | `fa09f1ffa12379968e41481e4b1755f4ba1b618c4eabafefd52364c1d802d4ab` |
| S06 | `.mssr/knowledge/architecture/context-plane-history.md` | `e58610d13b3ed35537e30c0f5b16d03b7aa3033c868d4ed000cc183a71305fc7` |
| S07 | `.mssr/knowledge/architecture/jev-confidence-merge-evaluation.md` | `3f183932dccfb55ac83c0c875d6aa2d0d4e96b9efa8ada4378304587d92b7763` |
| S08 | `.mssr/knowledge/architecture/project-context-librarian-metadata.md` | `1ec96fe144070027033c74c9487f3b2219be3e7985e81ee7d168ea921c0e5d90` |
| S09 | `.mssr/knowledge/architecture/project-context-plane.md` | `436da00e7f93de2891040c5177d6ccf0b02272fabfe63b5fef2d7c8fcc143ed7` |
| S10 | `.mssr/knowledge/architecture/project-document-reference-lifecycle.md` | `7909dfc3a2c16ac628491f779b4dcb949b8d77483fe9ad47df7e7ecb368295c0` |
| S11 | `.mssr/knowledge/architecture/semantic-evidence-plane.md` | `bc961ec6b719aad85c4804510fcebd55a9962066f7a54c0f46934187abe61607` |
| S12 | `.mssr/knowledge/decision/canonical-project-context-cutover.md` | `78454857b313a70bfef25c00d24ecc59cbf6ff52ec3d1d1f0cc05ef2d0ee6905` |
| S13 | `.mssr/knowledge/decision/human-task-identity.md` | `7c7600253d4919570540c1f7a9de41c75369121ac0a2203d2e8d5fcef3409b5e` |
| S14 | `.mssr/knowledge/decision/mssr-first-party-skill-direction.md` | `a26f9bd1929710a0cb90130c161020017a074f689155921b5ba514f35440948f` |
| S15 | `.mssr/knowledge/decision/mssr-learning-activation-decision.md` | `fe4b24a72e3a5da3b2bc24f11c3d575ec81fa7aa86aaf00b81716fd1573cf935` |
| S16 | `.mssr/knowledge/decision/semantic-consistency-current-truth.md` | `79661c8f5621932e9b3a5996ade87660a42d63e476578e5d40446181e91e1d99` |
| S17 | `.mssr/knowledge/decision/semantic-consistency-relations-retrieval.md` | `b92e1c7d22e2a26a2e6b8b1f238ea0452ed140790379f458f4d4b5ccaf66c212` |
| S18 | `.mssr/knowledge/decision/trace-lifecycle-integrity.md` | `b989e41e9d3cb16831ad261fd27a95b9b1c805983f25b70bceee73420b828242` |
| S19 | `.mssr/knowledge/operations/jev-librarian-integration-handoff.md` | `1dc376f55aae107bfed3bbda060b49659d5402312b36d9fc61d41a1a4f7ef8f3` |
| S20 | `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md` | `9a3ad7239843f468a72f7555668195670a767b1c9ebc7b0e2444047058837692` |
| S21 | `.mssr/knowledge/pattern/mssr-change-history-contract.md` | `ef4dec93e8718d6291ea3f03b83ef1c2b8aed3a54ffc1c904202ef7e3006a13a` |
| S22 | `.mssr/knowledge/research/jev-decision-model-use-cases.md` | `4462bffb86c7e1c80ae33f06b7fc04be90fdc9133da8cf135420388e68fa7dfb` |
| S23 | `AGENTS.md` | `cb2d567bf085e68ed2e97ec5650de5a152d2a41f4293fe124917ebd3a3f346d2` |
| S24 | `docs/AGENT_PROTOCOL.md` | `30e9f8da6103c4904559009533fa946ac53c3e5bf04ac5898e6088f919a458ca` |
| S25 | `docs/FIRST_PARTY_SKILLS_V1.md` | `cc312b8c50c10c2909bceb63472bc611a6516bd02f9f0073947ecfa1a12c3b4d` |
| S26 | `docs/LEARNING_LOOP.md` | `f4a6a863c596a74fc12737e4516fd882e371ae8fbd04255129e028cfb8e97fb6` |
| S27 | `docs/OPERATIONAL_NOTICE_PLANE.md` | `e3d9ba01dab38f17f334e52c8e6f535355878e4da6ed1cdcf4b77ff23cc61e11` |
| S28 | `docs/REGISTRY.md` | `63497279ee1b4c78351efe42b24eb5b51198379d814056aa033d89b8ad320740` |
| S29 | `docs/ROUTING_EVIDENCE_OBSERVATORY.md` | `154d4e173bde2244d7beada1827299ade54484c0a2745d455b9297d76b87ebae` |
| S30 | `experiments/CONTROLLED_RUN_PROTOCOL.md` | `ad642ee2f5e9abbe0a06c73b84ff95b682b2b1f7d9405435ae77158468d84198` |

## Owner worksheet

For each concept, reviewers should independently identify all exact ranges that directly answer the whole query, including overlapping valid alternatives. Mark partial/unanswerable/ambiguous when required details are absent. Proposed ranges below are not accepted gold.

### C01 — Architecture-impact evidence and conflict handling

- **English / Spanish (paired):** When repository evidence disagrees about an architecture decision, how should a change be routed for review? / Si dos señales del repositorio discrepan sobre una decisión de arquitectura, ¿cómo se decide si el cambio requiere revisión?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/architecture-impact-review-decision.md#Architecture impact review decision`, lines 1–5 [S02; file SHA-256 `e1ab8240b1edc4c6aad10d25a84b4bef4e9b7470663a7649cb415f0cd17c68df`; excerpt SHA-256 `e1ab8240b1edc4c6aad10d25a84b4bef4e9b7470663a7649cb415f0cd17c68df`] — bank anchor.
- **Sufficiency checks:** Resolve how conflicting evidence affects attention; distinguish possible impact from proof that architecture changed and preserve explicit review/write authority.
- **Negative / contradiction checks:** A linked or structurally changed source alone does not prove an architecture change; a receipt cannot silence changed structural/invariant evidence.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C02 — Dataset state and label provenance

- **English / Spanish (paired):** Which learning examples are actually available, and which still lack independent labels? / ¿Qué ejemplos de aprendizaje tenemos realmente y cuáles siguen sin etiquetas independientes?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/PROJECT_STATE.md#Learning dataset state`, lines 24–27 [S01; file SHA-256 `93d05a9aefc4e00db5cfe2dccd8229c13d8027aff1cbf4175eed04bcf7e5ef49`; excerpt SHA-256 `d58e76d2c3eb0d4a7e1d410c5011b4ee1265963461887baedccfbbe3141c261f`] — bank anchor.
- **Sufficiency checks:** Separate the active local store observation from older Semantic Experience shadows; identify independently confirmed/corrected material versus shadow proposals.
- **Negative / contradiction checks:** Do not infer older shadows were deleted or exist in the current host-local store; Jev proposals and trace outcomes are not independent labels.
- **Source/query review flag:** REVIEW: current section reports 0 local observations/rules and an unreconciled older-shadow store; it does not enumerate actual available examples. Owner must find an authoritative inventory or mark partial/unanswerable.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C03 — Current skill-package state

- **English / Spanish (paired):** What warning affects the skills package, and what was verified afterward? / ¿Qué advertencia afecta al paquete de skills y qué se verificó después?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/PROJECT_STATE.md#Core skill package state`, lines 28–30 [S01; file SHA-256 `93d05a9aefc4e00db5cfe2dccd8229c13d8027aff1cbf4175eed04bcf7e5ef49`; excerpt SHA-256 `6291d31103fecb7088a65e4bb635eb5341bc0d8a097e80c24cd0756871e5c353`] — bank anchor.
- **Sufficiency checks:** State package shape, .104 scope, Bridge .156 verification, and distinguish candidate verification from production adoption.
- **Negative / contradiction checks:** Do not treat candidate integration/package tests as production adoption.
- **Source/query review flag:** REWRITE/HOLD: current section records status but no explicit “warning”; rewrite to ask current package/adoption status or hold.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C04 — Research discovery; proposals versus demonstrated uses

- **English / Spanish (paired):** Where is the inventory of possible Jev uses for MSSR? / ¿Dónde está el inventario de usos posibles de Jev para MSSR?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/research/jev-decision-model-use-cases.md#100 hipótesis de uso`, lines 85–87 [S22; file SHA-256 `4462bffb86c7e1c80ae33f06b7fc04be90fdc9133da8cf135420388e68fa7dfb`; excerpt SHA-256 `0af55693bedcd1f72613fe0d44a9e88286ae5e1690bee86b8ff70badfceea60d`] — bank anchor; inventory introduction.
  - `.mssr/knowledge/research/jev-decision-model-use-cases.md#100 hipótesis de uso`, lines 141–151 [S22; file SHA-256 `4462bffb86c7e1c80ae33f06b7fc04be90fdc9133da8cf135420388e68fa7dfb`; excerpt SHA-256 `083da17dccb6c68f5708011ca9fe26f2b1c5fc922feaacab5686a659e0956de8`] — candidate MSSR/context subset.
- **Sufficiency checks:** Locate the hypothesis inventory and distinguish proposed candidate uses from demonstrated implementations.
- **Negative / contradiction checks:** Do not present hypotheses as deployed/validated capabilities.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C05 — Activation gates and authority

- **English / Spanish (paired):** Can learning observations change routing automatically today? / ¿Las observaciones de aprendizaje pueden cambiar el enrutamiento automáticamente hoy?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/decision/mssr-learning-activation-decision.md#Learning activation decision`, lines 1–3 [S15; file SHA-256 `fe4b24a72e3a5da3b2bc24f11c3d575ec81fa7aa86aaf00b81716fd1573cf935`; excerpt SHA-256 `fe4b24a72e3a5da3b2bc24f11c3d575ec81fa7aa86aaf00b81716fd1573cf935`] — bank anchor.
- **Sufficiency checks:** State current observe-only status, no routing/authority influence, and explicit activation gates.
- **Negative / contradiction checks:** Do not infer learned observations currently change routing.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C06 — Release-history gate

- **English / Spanish (paired):** What must a release changelog say about PROJECT_* before persistence can proceed? / ¿Qué debe declarar el changelog sobre PROJECT_* para permitir persistir una versión?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/pattern/mssr-change-history-contract.md#Change-history contract`, lines 1–3 [S21; file SHA-256 `ef4dec93e8718d6291ea3f03b83ef1c2b8aed3a54ffc1c904202ef7e3006a13a`; excerpt SHA-256 `ef4dec93e8718d6291ea3f03b83ef1c2b8aed3a54ffc1c904202ef7e3006a13a`] — bank anchor.
- **Sufficiency checks:** Name all three PROJECT_* impact declarations and explain the persistence consequence of pending.
- **Negative / contradiction checks:** Do not omit an authority or treat pending as pass.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C07 — Reference lifecycle states

- **English / Spanish (paired):** When is a project document considered registered as a reference? / ¿Cuándo se considera que un documento del proyecto ya está registrado como referencia?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/project-document-reference-lifecycle.md#States`, lines 5–15 [S10; file SHA-256 `7909dfc3a2c16ac628491f779b4dcb949b8d77483fe9ad47df7e7ecb368295c0`; excerpt SHA-256 `f427a26c918b947c7e503c2d427c0217223f997300c5f7c4bed6e2a3dd36e2ee`] — bank anchor.
- **Sufficiency checks:** Distinguish candidate, provisional evidence, and explicitly connected/registered status; identify explicit review/persistence boundary.
- **Negative / contradiction checks:** Discovery or a read alone is not registration.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C08 — Miss handling versus registration

- **English / Spanish (paired):** If retrieval misses a document that was previously read, does that automatically register it? / Si una búsqueda no encuentra un documento leído antes, ¿eso lo registra automáticamente?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/project-document-reference-lifecycle.md#Reference-on-miss`, lines 22–27 [S10; file SHA-256 `7909dfc3a2c16ac628491f779b4dcb949b8d77483fe9ad47df7e7ecb368295c0`; excerpt SHA-256 `7920f81dacd7f76f4743da58c33a45a9817e115ad98d1727ca63dba296f70261`] — bank anchor.
- **Sufficiency checks:** Explain bounded miss recovery and candidate-only/advisory status; identify what repeated usefulness can and cannot authorize.
- **Negative / contradiction checks:** A retrieval miss or previous read does not automatically register a reference.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C09 — Temporal validity and supersession

- **English / Spanish (paired):** How should a historical claim be treated when a newer current-state observation exists? / ¿Cómo debe tratarse una afirmación histórica cuando existe un estado actual más reciente?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/decision/semantic-consistency-current-truth.md#R4 temporal validity`, lines 11–15 [S16; file SHA-256 `79661c8f5621932e9b3a5996ade87660a42d63e476578e5d40446181e91e1d99`; excerpt SHA-256 `d0f2a84ad37a92a7596e42f29b555e15a2c2151065bf9fa9e70eb6a2c2d1f27b`] — bank anchor.
- **Sufficiency checks:** Preserve historical validity while recognizing newer observations only within comparable subject, scope, authority, and time/revision.
- **Negative / contradiction checks:** A newer timestamp alone does not prove an older historical statement false or contradictory.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C10 — Candidate similarity versus verified relation

- **English / Spanish (paired):** Does high similarity prove that two claims support or contradict each other? / ¿Una similitud alta demuestra que dos afirmaciones se apoyan o se contradicen?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/decision/semantic-consistency-relations-retrieval.md#Semantic consistency relations and retrieval decision`, lines 1–7 [S17; file SHA-256 `b92e1c7d22e2a26a2e6b8b1f238ea0452ed140790379f458f4d4b5ccaf66c212`; excerpt SHA-256 `b92e1c7d22e2a26a2e6b8b1f238ea0452ed140790379f458f4d4b5ccaf66c212`] — bank anchor.
- **Sufficiency checks:** Separate similarity-based candidate retrieval from a verified typed relation; state identity/scope/time constraints for contradiction.
- **Negative / contradiction checks:** High similarity alone proves neither support nor contradiction.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C11 — Maintenance and write preflight

- **English / Spanish (paired):** What must be checked before applying a recommendation that changes project knowledge? / Antes de aplicar una recomendación que toca conocimiento del proyecto, ¿qué debe verificarse?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/project-context-plane.md#Maintenance and write preflight`, lines 9–18 [S09; file SHA-256 `436da00e7f93de2891040c5177d6ccf0b02272fabfe63b5fef2d7c8fcc143ed7`; excerpt SHA-256 `c8e2f995af13be971157fff2fa70cf51b35dbcccc15c00d48fb215bece4d8d33`] — bank anchor.
- **Sufficiency checks:** Cover ownership/freshness, bounded exact material, review, and host-controlled explicit write gate.
- **Negative / contradiction checks:** A recommendation, detector, or semantic judgment alone does not authorize canonical persistence.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C12 — Progressive retrieval and exact evidence

- **English / Spanish (paired):** How does the system move from section retrieval to exact-range verification without treating rank as truth? / ¿Cómo pasa el sistema de recuperar secciones a verificar rangos exactos sin tratar el ranking como verdad?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/semantic-evidence-plane.md#Progressive section retrieval`, lines 13–19 [S11; file SHA-256 `bc961ec6b719aad85c4804510fcebd55a9962066f7a54c0f46934187abe61607`; excerpt SHA-256 `4d61aec0d1a6186b006725bd5316fd9c97cdbc27d44dd2e0fa2c87470c01fbc3`] — retrieval hierarchy plus revision-bound exact materialization.
- **Sufficiency checks:** Describe progressive retrieval and exact revision/range verification; explain why ranking/index results remain candidate evidence.
- **Negative / contradiction checks:** Do not treat retrieval order, section index, or model-selected handle as truth or authority.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C13 — Trace lifecycle

- **English / Spanish (paired):** Which checkpoints does a long MSSR task need before verification and closure? / ¿Qué checkpoints necesita una tarea MSSR larga antes de verificarla y cerrarla?
- **Candidate range set for owner review (not accepted):**
  - `docs/AGENT_PROTOCOL.md#User-visible progress contract`, lines 114–129 [S24; file SHA-256 `30e9f8da6103c4904559009533fa946ac53c3e5bf04ac5898e6088f919a458ca`; excerpt SHA-256 `f9a689855b2154f5efbb6394ba647920ece8a83ae9460f063201dad4fc326db3`] — replacement candidate; original bank trace-lifecycle anchor lacks this checkpoint list.
- **Sufficiency checks:** List visible checkpoints for a long task and their content boundary before verification/closure.
- **Negative / contradiction checks:** Backend telemetry or successful trace does not substitute for visible progress.
- **Source/query review flag:** BANK ANCHOR INSUFFICIENT: review replacement range or rewrite/hold the query.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C14 — Human-task identity

- **English / Spanish (paired):** How do we keep two tasks separate when they share a project and tools? / ¿Cómo evitamos mezclar dos tareas cuando comparten proyecto y herramientas?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/decision/human-task-identity.md#Human-task identity decision`, lines 1–7 [S13; file SHA-256 `7c7600253d4919570540c1f7a9de41c75369121ac0a2203d2e8d5fcef3409b5e`; excerpt SHA-256 `7c7600253d4919570540c1f7a9de41c75369121ac0a2203d2e8d5fcef3409b5e`] — bank anchor.
- **Sufficiency checks:** Explain explicit stable task identity and immutable trace relations; distinguish task prose/tool overlap from actual identity.
- **Negative / contradiction checks:** Do not infer task identity or lineage from shared project/tools, wording, time, or similarity.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C15 — Context budgeting and omission

- **English / Spanish (paired):** How should context be reduced without silently dropping required information? / ¿Cómo se reduce el contexto sin descartar en silencio información obligatoria?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/context-economy-v2.md#Context Economy v2`, lines 1–13 [S05; file SHA-256 `fa09f1ffa12379968e41481e4b1755f4ba1b618c4eabafefd52364c1d802d4ab`; excerpt SHA-256 `fa09f1ffa12379968e41481e4b1755f4ba1b618c4eabafefd52364c1d802d4ab`] — bank anchor.
- **Sufficiency checks:** Explain bounded context/paging and explicit retention evidence; preserve required units through omission, stale receipt, or invalid cursor handling.
- **Negative / contradiction checks:** Prior delivery/load does not prove current retention; required information must not silently disappear.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C16 — Canonical ownership

- **English / Spanish (paired):** Which source owns stable architecture, durable decisions, and mutable status? / ¿Qué fuente es dueña de la arquitectura estable, las decisiones y el estado mutable?
- **Candidate range set for owner review (not accepted):**
  - `AGENTS.md#MSSR repository instructions`, lines 29–34 [S23; file SHA-256 `cb2d567bf085e68ed2e97ec5650de5a152d2a41f4293fe124917ebd3a3f346d2`; excerpt SHA-256 `eef15c84440f96210a2adc83b30f9cb39cd522139c73f1427c88944a34ec2299`] — stronger ownership source candidate.
- **Sufficiency checks:** Map stable architecture/facts to PROJECT_CONTEXT, durable decisions/lessons to PROJECT_MEMORY, mutable status to PROJECT_STATE.
- **Negative / contradiction checks:** Do not swap owner roles or treat a situational module as broad repository instructions.
- **Source/query review flag:** BANK anchor points to canonical-ownership.md; review this AGENTS range because it directly states all three roles.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C17 — Source readiness versus runtime adoption

- **English / Spanish (paired):** If code and tests exist, what evidence proves the host actually adopted that version? / Si el código y los tests existen, ¿qué evidencia demuestra que el host realmente adoptó esa versión?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/context-plane-history.md#Host delivery and canonical project-context cutover (0.2.11, 0.2.18)`, lines 11–13 [S06; file SHA-256 `e58610d13b3ed35537e30c0f5b16d03b7aa3033c868d4ed000cc183a71305fc7`; excerpt SHA-256 `7d51dcd13fb69e534994184c6c44fa3e49f1613c4292742bbe80a04a80260936`] — bank anchor.
- **Sufficiency checks:** Name host package/runtime version plus restart/readback, not merely source code or tests.
- **Negative / contradiction checks:** Do not infer runtime adoption from code, tests, package parity, or sibling checkout.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C18 — Temporal negative control

- **English / Spanish (paired):** According to the current release record, what is the latest local MSSR release, and is it published? / Según el registro de versión vigente, ¿cuál es la última versión local de MSSR y está publicada?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/PROJECT_STATE.md#Current release`, lines 3–5 [S01; file SHA-256 `93d05a9aefc4e00db5cfe2dccd8229c13d8027aff1cbf4175eed04bcf7e5ef49`; excerpt SHA-256 `318014b4adb9c00c40fbd4217fd5410144a585827878e285d6a5e666f1f29d6d`] — repaired current-state anchor.
- **Sufficiency checks:** Use frozen snapshot’s latest local release and publication state; query revised to match available current evidence.
- **Negative / contradiction checks:** Do not claim the removed 0.2.98 receipt is present or infer its historical details from newer state.
- **Source/query review flag:** REPAIRED: original receipt query/anchor is unsupported in .104. Proposed rewrite: “According to the current release record, what is the latest local MSSR release, and is it published?” / “Según el registro de versión vigente, ¿cuál es la última versión local de MSSR y está publicada?”
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C19 — Producer coverage and valid negative claims

- **English / Spanish (paired):** What may the Librarian conclude when a producer lacks instrumentation, and when can it claim coverage is complete? / ¿Qué puede concluir el Bibliotecario cuando falta instrumentación de un productor, y cuándo puede afirmar que la cobertura es completa?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/semantic-evidence-plane.md#Document Surface and Librarian contract`, lines 27–29 [S11; file SHA-256 `bc961ec6b719aad85c4804510fcebd55a9962066f7a54c0f46934187abe61607`; excerpt SHA-256 `41e764924ca7e95a3bb0ef4520f3a215d060e545c495e3d9a87e9ae5b56a31f8`] — direct coverage completeness/negative-claim candidate.
  - `.mssr/knowledge/architecture/semantic-evidence-plane.md#Query and coverage target`, lines 68–70 [S11; file SHA-256 `bc961ec6b719aad85c4804510fcebd55a9962066f7a54c0f46934187abe61607`; excerpt SHA-256 `47d0105755fd5264c26ebcd8211eeaf8404b57168c6f606ee3be41eaf132110e`] — context only; not sufficient alone.
- **Sufficiency checks:** State when a scoped/global negative conclusion is valid and how missing/partial instrumentation is reported.
- **Negative / contradiction checks:** Missing instrumentation is not evidence of absence; selected-scope completeness is not global completeness.
- **Source/query review flag:** BANK RANGE TOO NARROW: review lines 27–29 as direct rule; original Query/coverage section is inventory context.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C20 — Bounded acquisition requests, authorization, and budgets

- **English / Spanish (paired):** If Jev requests more evidence, which bounded reads may the host perform, and what prevents arbitrary access? / Si Jev pide más evidencia, ¿qué lecturas acotadas puede solicitar el host y qué límites impiden el acceso arbitrario?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/semantic-evidence-plane.md#Progressive evidence acquisition`, lines 41–56 [S11; file SHA-256 `bc961ec6b719aad85c4804510fcebd55a9962066f7a54c0f46934187abe61607`; excerpt SHA-256 `61b2f37d2737d326b42f5a9c931584d4b67908ae742d9aab916b7acb367760a1`] — bank anchor.
- **Sufficiency checks:** Give typed bounded read examples and explain host authorization, explicit budgets, and deduplication.
- **Negative / contradiction checks:** Jev does not receive arbitrary filesystem traversal or generic tool execution.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C21 — Skill ownership and progressive reference activation

- **English / Spanish (paired):** How does MSSR distribute first-party skills, and how does it avoid loading a large reference from a generic signal? / ¿Cómo distribuye MSSR sus skills propias y cómo evita cargar una referencia grande por una señal genérica?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/decision/mssr-first-party-skill-direction.md#First-party core skill direction`, lines 1–3 [S14; file SHA-256 `a26f9bd1929710a0cb90130c161020017a074f689155921b5ba514f35440948f`; excerpt SHA-256 `a26f9bd1929710a0cb90130c161020017a074f689155921b5ba514f35440948f`] — bank anchor.
  - `docs/AGENT_PROTOCOL.md#Selective procedural context`, lines 47–60 [S24; file SHA-256 `30e9f8da6103c4904559009533fa946ac53c3e5bf04ac5898e6088f919a458ca`; excerpt SHA-256 `6fdbb2185fb9aff1468f960062d77403ad152f0b11d7955f3db576f6d1c30709`] — candidate loading-contract range.
- **Sufficiency checks:** Describe first-party skill entry/package ownership and selective parent-owned references/modules by structured intent/stage.
- **Negative / contradiction checks:** Generic signal/parent activation must not load every large optional reference.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C22 — `.mssr/` initialization and legacy migration safeguards

- **English / Spanish (paired):** What does MSSR do when a repository lacks canonical initialization, and which legacy data may it migrate or discard? / ¿Qué hace MSSR si falta la inicialización canónica de un repositorio y qué datos heredados puede migrar o descartar?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/decision/canonical-project-context-cutover.md#Canonical project-context cutover`, lines 1–7 [S12; file SHA-256 `78454857b313a70bfef25c00d24ecc59cbf6ff52ec3d1d1f0cc05ef2d0ee6905`; excerpt SHA-256 `78454857b313a70bfef25c00d24ecc59cbf6ff52ec3d1d1f0cc05ef2d0ee6905`] — bank anchor.
- **Sufficiency checks:** Cover explicit .mssr initialization, no .bridge fallback, obsolete inbox receipt discard, and review protection for durable legacy authorities.
- **Negative / contradiction checks:** Do not describe legacy files as freely deletable or auto-migratable.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C23 — Provider-catalog health and negative inference

- **English / Spanish (paired):** If a provider catalog is empty or stale, what evidence is needed before concluding a capability does not exist? / Si el catálogo de un proveedor está vacío o vencido, ¿qué evidencia hace falta antes de concluir que una capacidad no existe?
- **Candidate range set for owner review (not accepted):**
  - `docs/REGISTRY.md#Degradation`, lines 45–51 [S28; file SHA-256 `63497279ee1b4c78351efe42b24eb5b51198379d814056aa033d89b8ad320740`; excerpt SHA-256 `82f152604dd2bf6d6148629d74bf649639b8fe3a1879f17a97c49c8a600f55a2`] — bank anchor.
- **Sufficiency checks:** Explain what an empty catalog reports and which health/refresh/alternate/manual evidence precedes absence claims.
- **Negative / contradiction checks:** Empty/stale provider catalog is not proof a capability does not exist.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C24 — Exact sidecar/range binding and fail-closed projection

- **English / Spanish (paired):** What must match for a sidecar declaration to project as a valid atom, and what happens when its range or fingerprint is stale? / ¿Qué debe coincidir para que una declaración del sidecar se proyecte como átomo válido, y qué pasa si su rango o fingerprint quedó obsoleto?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/project-context-librarian-metadata.md#Projection and stale-data behavior`, lines 30–53 [S08; file SHA-256 `1ec96fe144070027033c74c9487f3b2219be3e7985e81ee7d168ea921c0e5d90`; excerpt SHA-256 `108bc23511934ddcd495c36f044e038a6f1180754a0d8ccf0ce2ef978d10690d`] — bank anchor.
- **Sufficiency checks:** Identify declaration/owner/path/heading/fingerprint and current snapshot bindings; state fail-closed stale behavior.
- **Negative / contradiction checks:** Do not project stale fingerprint/range or treat tags/ranking as authority.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C25 — Calibration/holdout separation

- **English / Spanish (paired):** How do we prevent cases used to tune thresholds from also entering the final evaluation? / ¿Cómo evitamos que los casos usados para ajustar umbrales también formen parte de la evaluación final?
- **Candidate range set for owner review (not accepted):**
  - `experiments/CONTROLLED_RUN_PROTOCOL.md#Labels, holdouts, and claims`, lines 162–182 [S30; file SHA-256 `ad642ee2f5e9abbe0a06c73b84ff95b682b2b1f7d9405435ae77158468d84198`; excerpt SHA-256 `2b49938ee1ce9da2176e513894f6aa73facddcd9d5227408c0fda26afbd6ab90`] — direct split/holdout candidate.
  - `docs/LEARNING_LOOP.md#4. Calibration`, lines 101–106 [S26; file SHA-256 `f4a6a863c596a74fc12737e4516fd882e371ae8fbd04255129e028cfb8e97fb6`; excerpt SHA-256 `1fbdcf0543c319cd96017d11792e0eeff4a329d11f411f8deb27702a5bcd33c0`] — context only; not sufficient alone.
- **Sufficiency checks:** Freeze queries, labels, candidates, thresholds, exclusions; group splits by independent unit; keep calibration and unopened holdout disjoint.
- **Negative / contradiction checks:** Repeated calls, bilingual variants, or same-document cases are not independent holdout units; opening/tuning on holdout makes it exploratory.
- **Source/query review flag:** BANK ANCHOR INSUFFICIENT ALONE: review controlled-run protocol for split/no-leakage requirement.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C26 — Historical opt-in migration safeguards; verify against the current installer before current-truth use

- **English / Spanish (paired):** If a reserved skill directory already exists but differs from its source, what review and preservation steps precede replacement? / Si una carpeta reservada de una skill ya existe pero difiere de la fuente, ¿qué revisión y resguardo preceden a reemplazarla?
- **Candidate range set for owner review (not accepted):**
  - `docs/FIRST_PARTY_SKILLS_V1.md#Opt-in migration`, lines 54–83 [S25; file SHA-256 `cc312b8c50c10c2909bceb63472bc611a6516bd02f9f0073947ecfa1a12c3b4d`; excerpt SHA-256 `38c3958dbd884b59390b8573017085605558a2671d5f6d1589698d58afaa00a3`] — bank anchor.
- **Sufficiency checks:** Require inspection, stop/review for divergent reserved target, and preserve a recovery location before opted-in replacement.
- **Negative / contradiction checks:** Do not replace divergent local target without review/backup; no broad cleanup.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C27 — Delivery boundary versus agent receipt

- **English / Spanish (paired):** What does it prove when a notice reaches the host boundary, and what remains unconfirmed about its receipt? / ¿Qué demuestra que una notificación llegó al límite del host y qué queda sin confirmar sobre su recepción?
- **Candidate range set for owner review (not accepted):**
  - `docs/OPERATIONAL_NOTICE_PLANE.md#Stale-build channel guarantees`, lines 131–155 [S27; file SHA-256 `e3d9ba01dab38f17f334e52c8e6f535355878e4da6ed1cdcf4b77ff23cc61e11`; excerpt SHA-256 `cc4180addd4a5f54913ed8db1d96fba4ae816b3b7c0b115b9cefbb761aa0cc2a`] — bank anchor.
- **Sufficiency checks:** Distinguish boundary acceptance (delivered) from agent read/receipt and state channel confirmation limits.
- **Negative / contradiction checks:** Host-boundary delivery, log capture, or quiet state does not prove agent reception.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C28 — Recommendation, decision, and load telemetry

- **English / Spanish (paired):** Why are a recommended optional skill and a loaded skill separate observations? / ¿Por qué una skill opcional recomendada y una skill cargada son observaciones distintas?
- **Candidate range set for owner review (not accepted):**
  - `docs/ROUTING_EVIDENCE_OBSERVATORY.md#Activation guarantee`, lines 48–67 [S29; file SHA-256 `154d4e173bde2244d7beada1827299ade54484c0a2745d455b9297d76b87ebae`; excerpt SHA-256 `a735b573608e934c8822c66d899a15f16c15000df423a86b95133c3ecf577455`] — bank anchor.
- **Sufficiency checks:** Keep recommendation, accepted/skipped decision, and loaded/materialized context distinct.
- **Negative / contradiction checks:** Recommended optional skill is not evidence it was accepted or loaded.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C29 — Calibration, holdout, and synthesis gates

- **English / Spanish (paired):** What evidence is required before treating Jev confidence as calibrated probability or allowing a synthesis preview? / ¿Qué evidencia hace falta antes de tratar el confidence de Jev como probabilidad calibrada o permitir una síntesis?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/jev-confidence-merge-evaluation.md#Confidence and merge policy`, lines 131–158 [S07; file SHA-256 `3f183932dccfb55ac83c0c875d6aa2d0d4e96b9efa8ada4378304587d92b7763`; excerpt SHA-256 `b24f389ca98e9b78cb6fda6fa99e302da0883c913784a34541595479c247651e`] — bank calibration/preview gates.
  - `.mssr/knowledge/architecture/jev-confidence-merge-evaluation.md#Confidence and merge policy`, lines 160–175 [S07; file SHA-256 `3f183932dccfb55ac83c0c875d6aa2d0d4e96b9efa8ada4378304587d92b7763`; excerpt SHA-256 `8f6623a17ac53eb7712fb4d0749d0f160f8a04ab4d253ea1c280619bf410467c`] — candidate synthesis/freshness/write limits.
- **Sufficiency checks:** Require independent project-grouped holdout calibration before probability claims; synthesis preview needs exact comparable evidence and stays non-writing; contradictions/unresolved/unverified cases excluded.
- **Negative / contradiction checks:** Raw confidence/threshold is not correctness probability; caller asserted verification/freshness is not authenticated; preview is not canonical apply.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C30 — Historical Git/evidence lineage; not current branch status

- **English / Spanish (paired):** According to the historical handoff, why keep the product branch and benchmark runs separate, and what evidence must be preserved during integration? / Según el handoff histórico, ¿por qué se separan la rama de producto y los runs del benchmark, y qué evidencia se preserva al integrar?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/operations/jev-librarian-integration-handoff.md#Repository snapshot and preservation`, lines 15–28 [S19; file SHA-256 `1dc376f55aae107bfed3bbda060b49659d5402312b36d9fc61d41a1a4f7ef8f3`; excerpt SHA-256 `a7792454963f7feaa38267824f4fe7fcc1a0869932f4714bde18d1274ca9e663`] — historical snapshot/preserved-run evidence.
  - `.mssr/knowledge/operations/jev-librarian-integration-handoff.md#Repository snapshot and preservation`, lines 30–38 [S19; file SHA-256 `1dc376f55aae107bfed3bbda060b49659d5402312b36d9fc61d41a1a4f7ef8f3`; excerpt SHA-256 `ab25f09d6605412488426800273724469f39cd7ad09547f9721e549a927ebb78`] — separation rationale and integration evidence.
- **Sufficiency checks:** Explain product/run coupling risk and what exact paths, run IDs, manifests, outputs, labels/reviews, hashes/build evidence are preserved.
- **Negative / contradiction checks:** Keep it historical; do not substitute current branch state or treat run labels as validated gold.
- **Source/query review flag:** SOURCE DRIFT: handoff changed after bank seeding; owner must re-review historical wording on frozen snapshot.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C31 — Historical receipt identity and invalidation rules

- **English / Spanish (paired):** In the 0.2.41–0.2.43 history, when can a reviewed-current receipt suppress another review, and what invalidates it? / En el historial 0.2.41–0.2.43, ¿cuándo puede un comprobante reviewed-current evitar otra revisión y qué lo invalida?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/architecture/architecture-impact-review-history.md#Derived invariants, context feedback, and reviewed-current receipts (0.2.41-0.2.43)`, lines 11–13 [S03; file SHA-256 `e1f817f4de9d44505708e95d75f552376fe0da6413ec30ce2c5ad39ee0baf514`; excerpt SHA-256 `7a492a4f0a4216b55a137b6231eb2c39ae98e073e9a67bdbaf82afb8e7c57cd7`] — bank anchor.
- **Sufficiency checks:** List explicit completed review, exact receipt identity/fingerprint match and integrity; name fail-open invalidators.
- **Negative / contradiction checks:** Missing/corrupt/incomplete evidence or relevant identity change cannot suppress review.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

### C32 — Evidence-only drift detection and owner-controlled persistence

- **English / Spanish (paired):** Which signals activate a knowledge-maintenance review, and who may persist the change to canonical authority? / ¿Qué señales activan una revisión de mantenimiento y quién puede persistir el cambio en la autoridad canónica?
- **Candidate range set for owner review (not accepted):**
  - `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md#Project knowledge drift review decision`, lines 1–7 [S20; file SHA-256 `9a3ad7239843f468a72f7555668195670a767b1c9ebc7b0e2444047058837692`; excerpt SHA-256 `9a3ad7239843f468a72f7555668195670a767b1c9ebc7b0e2444047058837692`] — bank anchor.
- **Sufficiency checks:** Name observable maintenance signals, WATCH versus REVIEW/REQUIRED, canonical-owner selection, and explicit host-owned write transaction.
- **Negative / contradiction checks:** Drift detector/telemetry does not mutate canonical owner.
- **Owner labels — leave blank until reviewed:** answerability/status (sufficient / partial / unanswerable / ambiguous): ____; accepted exact ranges (all valid alternatives): ____; sufficiency decision: ____; abstention expected (yes/no + why): ____; contradiction/temporal label if applicable: ____; owner/adjudicator + date: ____.

## Required pre-freeze review

- Re-review every candidate range and any alternate against the frozen source bytes; do not promote proposed ranges to gold without owner confirmation.
- Resolve flags on C02, C03, C13, C16, C18, C19, C25, and C30. C18’s original 0.2.98 receipt anchor is unsupported; the worksheet substitutes a current-release question.
- Keep same-file sets together: C02/C03/C18 (PROJECT_STATE), C07/C08 (reference lifecycle), C12/C19/C20 (semantic evidence plane). Review conceptual grouping before splits, including learning/calibration (C02/C05/C29), Jev use/confidence (C04/C29), adoption/integration (C17/C30), coverage/absence (C19/C23), maintenance review (C01/C32), temporal truth/relations (C09/C10), and task/trace identity (C13/C14). These are proposed split checks, not adjudicated clusters.
- Keep labels/rationales out of provider requests. Freeze rubrics, candidate ranges, exclusions, split groups, and analysis plan before inference. Open holdout labels only after calibration choices are locked.

## Mechanical anchor check

Mechanical range audit (2026-10-04): all 38 cited file hashes and headings match
the frozen source `e3e03912d63231ebf646fdaec9353ee1e28fe403`; headings are unique.
The first audit found ten ranges one line beyond the physical end of a file and
two in-bounds excerpt hashes that did not match. Those twelve anchors were
normalized to one-based inclusive physical lines and re-hashed; a second pass
verified all 38 ranges in-bounds with matching file/range SHA-256 values. This
repairs mechanical citations only; answerability, sufficiency, abstention,
contradiction, and owner labels remain pending. Detailed before/after evidence
is in `review-proposals/2026-10-04-owner-range-integrity-audit.md`.

C18’s original bank anchor does not exist in this snapshot and is explicitly
replaced with `.mssr/PROJECT_STATE.md#Current release`. The original C13 bank
anchor does not contain the requested checkpoint list; the worksheet marks it
unsupported and gives a separate `docs/AGENT_PROTOCOL.md#User-visible progress
contract` candidate for owner review.
