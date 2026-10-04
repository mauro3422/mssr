# Librarian / Jev benchmark candidate bank

**Status:** unadjudicated candidate inventory. These are query seeds and source anchors, not gold labels, accepted-answer ranges, or benchmark outcomes. Do not send this file to Jev with the candidate cases. No candidate has been declared correct.

## Provenance and limits

- Seeded from MSSR source commit `cbc4f355d2e3dc322f23acfab26a790b1957daeb` and the reviewed repository knowledge modules.
- 18 bilingual query pairs span 15 distinct source files. Multiple cases and Spanish/English variants that share a source or concept must remain in one split.
- Source anchors identify where a reviewer may look while authoring labels. They must not be included in the blind selection prompt.
- Gold labels, acceptable alternate ranges, abstention labels, stale/fresh judgments, contradiction relations, and reviewer identities are all **pending**.
- This inventory is below the 30-independent-unit reporting floor. Even reaching 30 is only a reporting floor, not a sample-size guarantee; independent source/concept clusters still need to be added and justified.
- The live smoke in the sibling run directory exercised declared selector values, not these natural-language queries. Its measurements do not label or validate this bank.

## Candidate query seeds

| ID | Source anchor for later human review | Spanish query seed | English query seed | Candidate dimension |
|---|---|---|---|---|
| C01 | `.mssr/knowledge/architecture/architecture-impact-review-decision.md#Architecture impact review decision` | Si dos señales del repositorio discrepan sobre una decisión de arquitectura, ¿cómo se decide si el cambio requiere revisión? | When repository evidence disagrees about an architecture decision, how should a change be routed for review? | Architecture-impact evidence and conflict handling |
| C02 | `.mssr/PROJECT_STATE.md#Learning dataset state` | ¿Qué ejemplos de aprendizaje tenemos realmente y cuáles siguen sin etiquetas independientes? | Which learning examples are actually available, and which still lack independent labels? | Dataset state and label provenance |
| C03 | `.mssr/PROJECT_STATE.md#Core skill package state` | ¿Qué advertencia afecta al paquete de skills y qué se verificó después? | What warning affects the skills package, and what was verified afterward? | Current skill-package state |
| C04 | `.mssr/knowledge/research/jev-decision-model-use-cases.md#100 hipótesis de uso` | ¿Dónde está el inventario de usos posibles de Jev para MSSR? | Where is the inventory of possible Jev uses for MSSR? | Research discovery; proposals versus demonstrated uses |
| C05 | `.mssr/knowledge/decision/mssr-learning-activation-decision.md#Learning activation decision` | ¿Las observaciones de aprendizaje pueden cambiar el enrutamiento automáticamente hoy? | Can learning observations change routing automatically today? | Activation gates and authority |
| C06 | `.mssr/knowledge/pattern/mssr-change-history-contract.md#Change-history contract` | ¿Qué debe declarar el changelog sobre PROJECT_* para permitir persistir una versión? | What must a release changelog say about PROJECT_* before persistence can proceed? | Release-history gate |
| C07 | `.mssr/knowledge/architecture/project-document-reference-lifecycle.md#States` | ¿Cuándo se considera que un documento del proyecto ya está registrado como referencia? | When is a project document considered registered as a reference? | Reference lifecycle states |
| C08 | `.mssr/knowledge/architecture/project-document-reference-lifecycle.md#Reference-on-miss` | Si una búsqueda no encuentra un documento leído antes, ¿eso lo registra automáticamente? | If retrieval misses a document that was previously read, does that automatically register it? | Miss handling versus registration |
| C09 | `.mssr/knowledge/decision/semantic-consistency-current-truth.md#R4 temporal validity` | ¿Cómo debe tratarse una afirmación histórica cuando existe un estado actual más reciente? | How should a historical claim be treated when a newer current-state observation exists? | Temporal validity and supersession |
| C10 | `.mssr/knowledge/decision/semantic-consistency-relations-retrieval.md#Semantic consistency relations and retrieval decision` | ¿Una similitud alta demuestra que dos afirmaciones se apoyan o se contradicen? | Does high similarity prove that two claims support or contradict each other? | Candidate similarity versus verified relation |
| C11 | `.mssr/knowledge/architecture/project-context-plane.md#Maintenance and write preflight` | Antes de aplicar una recomendación que toca conocimiento del proyecto, ¿qué debe verificarse? | What must be checked before applying a recommendation that changes project knowledge? | Maintenance and write preflight |
| C12 | `.mssr/knowledge/architecture/semantic-evidence-plane.md#Progressive section retrieval` | ¿Cómo pasa el sistema de recuperar secciones a verificar rangos exactos sin tratar el ranking como verdad? | How does the system move from section retrieval to exact-range verification without treating rank as truth? | Progressive retrieval and exact evidence |
| C13 | `.mssr/knowledge/decision/trace-lifecycle-integrity.md#Trace lifecycle integrity decision` | ¿Qué checkpoints necesita una tarea MSSR larga antes de verificarla y cerrarla? | Which checkpoints does a long MSSR task need before verification and closure? | Trace lifecycle |
| C14 | `.mssr/knowledge/decision/human-task-identity.md#Human-task identity decision` | ¿Cómo evitamos mezclar dos tareas cuando comparten proyecto y herramientas? | How do we keep two tasks separate when they share a project and tools? | Human-task identity |
| C15 | `.mssr/knowledge/architecture/context-economy-v2.md#Context Economy v2` | ¿Cómo se reduce el contexto sin descartar en silencio información obligatoria? | How should context be reduced without silently dropping required information? | Context budgeting and omission |
| C16 | `.mssr/knowledge/architecture/canonical-ownership.md#Canonical ownership` | ¿Qué fuente es dueña de la arquitectura estable, las decisiones y el estado mutable? | Which source owns stable architecture, durable decisions, and mutable status? | Canonical ownership |
| C17 | `.mssr/knowledge/architecture/context-plane-history.md#Host delivery and canonical project-context cutover` | Si el código y los tests existen, ¿qué evidencia demuestra que el host realmente adoptó esa versión? | If code and tests exist, what evidence proves the host actually adopted that version? | Source readiness versus runtime adoption |
| C18 | `.mssr/PROJECT_STATE.md#0.2.98 package release receipt — historical` | ¿0.2.98 sigue siendo la versión vigente o ese comprobante ya es histórico? | Is 0.2.98 still current, or is that release receipt historical? | Temporal negative control |

## Labeling and split gate

Before any Jev run, freeze an immutable case file and source snapshot, then have two reviewers independently record acceptable exact ranges (including valid alternatives), answerability, sufficiency, contradiction relation where applicable, and abstention expectation. Adjudicate disagreements without showing Jev output. Keep bilingual variants, same-document sections, near-misses, and source/concept relatives in the same partition. Separate retrieval relevance, Jev selection, Noul sufficiency, deterministic contradiction baselines, and metadata-binding integrity.

Do not calculate a confidence threshold from exploratory runs or from the metadata smoke. Once the independent labels and source-cluster count are adequate, lock the analysis plan, choose thresholds only on calibration groups, and evaluate a previously unopened holdout once. Report source-clustered uncertainty, accepted-set selection accuracy, recall at k, exact-fetch integrity, abstention risk/coverage, Brier or log-loss where probabilities are well-defined, and Noul sufficiency separately.
