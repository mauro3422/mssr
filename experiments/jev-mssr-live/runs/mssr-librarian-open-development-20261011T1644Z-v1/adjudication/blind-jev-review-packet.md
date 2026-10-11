# Blind Jev selection review packet

Do not look for or infer reference labels. For each case, assess whether the supplied exact selected excerpt is relevant and sufficient to support an answer to the query. If no selection is present, assess only that an abstention happened; do not call it correct/incorrect unless the query itself can be resolved from the visible corpus. Identify unsupported claim parts or ambiguity. Do not assess provider confidence.

## cutover-01

Query: ¿Qué cambió MSSR 0.2.18 respecto al fallback de .bridge y cómo trató el inbox anterior a esa versión?

Selected source: .mssr/knowledge/decision/canonical-project-context-cutover.md
Range: block block-2, lines 5-5

Exact fetched text:

> The cutover deliberately discards the obsolete pre-0.2.18 runtime inbox instead of migrating its receipts, because those receipts may preserve stale `.bridge` provenance. Durable legacy authorities are never deleted unless their canonical counterpart already exists; otherwise initialization reports a blocked cleanup requiring explicit review.

## identity-01

Query: ¿De dónde debe venir taskKey y qué señales del texto o del flujo están prohibidas para derivarlo?

Selected source: .mssr/knowledge/decision/human-task-identity.md
Range: block block-1, lines 3-3

Exact fetched text:

> Human-task identity is a correlation layer above trace ownership. `taskKey` is explicit host evidence, never derived from task prose, `workflowKey`, similarity, recency, or inactivity. Optional `parentTraceId` and `supersedesTraceId` preserve lineage inside a task; they do not close, cancel, replace, validate, or mutate another trace.

## identity-02

Query: ¿Qué pueden y qué no pueden hacer parentTraceId y supersedesTraceId con otro trace?

Selected source: .mssr/knowledge/decision/human-task-identity.md
Range: block block-1, lines 3-3

Exact fetched text:

> Human-task identity is a correlation layer above trace ownership. `taskKey` is explicit host evidence, never derived from task prose, `workflowKey`, similarity, recency, or inactivity. Optional `parentTraceId` and `supersedesTraceId` preserve lineage inside a task; they do not close, cancel, replace, validate, or mutate another trace.

## skills-01

Query: ¿Qué precedencia tienen los nombres de skills first-party y qué implica el bundle acerca de cargarlos en cada tarea?

Selected source: .mssr/knowledge/decision/mssr-first-party-skill-direction.md
Range: block block-1, lines 3-3

Exact fetched text:

> MSSR-owned operational skills have one canonical bundled source for the five names in `config/first-party-skills.json`. Native, Codex-local, and OpenCode-local source providers discover that package with reserved-name precedence; a custom catalog may not reclaim one of those names as an editable owner. The package boundary does not imply loading every first-party skill on every task; required/on-demand/closing activation remains explicit. In 0.2.54 each root became a compact control plane and selected direct parent-owned references through its manifest; routing metadata/fixtures remained unchanged. The 0.2.55 maintenance follow-up makes progressive disclosure apply to reference units too: a compact root is not sufficient when a generic signal still selects one monolithic reference, so broad anomaly evidence loads only a compact index and detailed procedures require conjunctive stage/intent selectors. The v1 distribution gate proves package dry-run, routing/context selection, safe opt-in junction migration and audit without publishing externally.

## skills-02

Query: ¿Qué cambió MSSR 0.2.55 para evitar que señales genéricas carguen referencias procedimentales monolíticas?

Selection: none (Jev abstained). No excerpt to assess.

## learning-01

Query: ¿En qué modo corre el aprendizaje operativo y qué condiciones mantienen la influencia histórica fuera del routing?

Selected source: .mssr/knowledge/decision/mssr-learning-activation-decision.md
Range: section heading-1, lines 1-4

Exact fetched text:

> ## Learning activation decision
>
> Operational learning remains external to model weights and currently runs in `observe-only` mode. MSSR 0.2.54 implements dataset-quality audit, chronological replay/frozen holdout, Beta(1,1)+Wilson support-aware calibration and counterfactual shadow evaluation, but every result fixes `routingInfluence=false` and `automaticPromotionPerformed=false`; the module has no router import/consumption path and sparse or unmeasurable evidence abstains. Historical influence on routing/context remains zero until representative real data demonstrates repeatable net benefit. Activation still requires an explicit reviewed versioned feature flag, exploration floor and instant rollback.
>
>

## learning-02

Query: ¿Qué requisitos distintos se exigen para generar una regla shadow y para preferir un fallback en un holdout?

Selected source: .mssr/knowledge/decision/mssr-learning-activation-decision.md
Range: block block-2, lines 7-7

Exact fetched text:

> Generating a deterministic Semantic Experience rule and preferring that fallback in a held-out benchmark are separate gates. The shadow-rule distiller uses only independently confirmed/corrected evidence, keeps the latest observation per evidence family, and by default requires at least 8 evidence units from 2 distinct projects, observed dominance of at least 0.80 and a 95% Wilson lower bound of at least 0.65. Semantic-relation contradictions remain excluded from distillation. These support thresholds create an advisory shadow rule; they do not qualify the fallback for host preference.

## drift-01

Query: ¿Qué evidencia puede elevar el mantenimiento de WATCH a REVIEW o REQUIRED, y qué significan esos niveles?

Selected source: .mssr/knowledge/operations/mssr-project-knowledge-drift-review.md
Range: block block-1, lines 3-3

Exact fetched text:

> Drift detection and durable correction are separate responsibilities. `project_change_consistency` compares release diffs/changelog declarations with PROJECT_* authorities; Context Plane compares canonical source revisions with advisory evidence; Project Context Health inspects initialization, authority/module size, missing sources, unindexed `.mssr/knowledge/`, and old MSSR artifacts; `skill_route_audit` and structural Skill Health inspect routing and capability/reference debt. `evaluateMssrProjectKnowledgeMaintenance` combines bounded observable metadata from any host — trace stage, changed paths/tool categories, package/runtime adoption, routing/skill-structure changes, project initialization/health, freshness conflicts and user corrections — into `NONE`/`WATCH`/`REVIEW`/`REQUIRED` targets. These detectors produce evidence only. `WATCH` does not force extra context; `REVIEW`/`REQUIRED` activates maintenance, where `skill-maintenance-loop` chooses the canonical target (`AGENTS.md`, PROJECT_*, an indexed knowledge module, owning skill/reference, routing/fixture, or local documentation) and verifies the resulting diff. Reviewed durable statements may be normalized by `planMssrProjectKnowledgeCapture`, but the host owns the explicit write/manifest transaction. No detector silently writes the owner it is auditing.

## drift-02

Query: ¿Qué comprueba el sistema para distinguir una capacidad realmente integrada de código exportado o una casilla de roadmap?

Selection: none (Jev abstained). No excerpt to assess.

## drift-03

Query: ¿Cuándo una revisión de freshness obliga a revisar una guía y qué no demuestra sobre su contenido?

Selected source: .mssr/knowledge/operations/mssr-project-knowledge-drift-review.md
Range: section heading-1, lines 1-7

Exact fetched text:

> ## Project knowledge drift review decision
>
> Drift detection and durable correction are separate responsibilities. `project_change_consistency` compares release diffs/changelog declarations with PROJECT_* authorities; Context Plane compares canonical source revisions with advisory evidence; Project Context Health inspects initialization, authority/module size, missing sources, unindexed `.mssr/knowledge/`, and old MSSR artifacts; `skill_route_audit` and structural Skill Health inspect routing and capability/reference debt. `evaluateMssrProjectKnowledgeMaintenance` combines bounded observable metadata from any host — trace stage, changed paths/tool categories, package/runtime adoption, routing/skill-structure changes, project initialization/health, freshness conflicts and user corrections — into `NONE`/`WATCH`/`REVIEW`/`REQUIRED` targets. These detectors produce evidence only. `WATCH` does not force extra context; `REVIEW`/`REQUIRED` activates maintenance, where `skill-maintenance-loop` chooses the canonical target (`AGENTS.md`, PROJECT_*, an indexed knowledge module, owning skill/reference, routing/fixture, or local documentation) and verifies the resulting diff. Reviewed durable statements may be normalized by `planMssrProjectKnowledgeCapture`, but the host owns the explicit write/manifest transaction. No detector silently writes the owner it is auditing.
>
> Semantic/document inconsistency uses the same evidence-first boundary. First classify whether a capability is actually integrated (`producer -> evaluator -> host consumer -> notice/context surface -> regression`) instead of treating exported code/tests/roadmap checkboxes as runtime adoption. For prose/current-state drift, exact declared identities and deterministic typed claims are authoritative comparison inputs. Similarity/fuzzy/vector retrieval may only find candidate pairs; it must not prove contradiction. Temporal scope, subject identity, authority class and comparable value/revision must agree before deterministic rules can elevate evidence to a proven conflict. Otherwise the system emits bounded review/abstention evidence. This preserves useful heuristics without granting semantic rewrite authority.
>
> Document Freshness extends that boundary for explicitly current-state documentation. A repository may opt a roadmap/status/guide into `.mssr/document-freshness.json` and declare exact project-relative refs whose later host-observed revisions should force review. This is freshness evidence, not prose understanding: `review-due` never proves arbitrary text false, historical documents remain undeclared, and no freshness result may auto-edit project knowledge. This closes the class of lag where old Bridge/Roblox roadmaps could still look unfinished after the implementation had advanced.
>

## history-01

Query: ¿Qué debe declarar cada changelog de release y qué estado impide persistir el cambio?

Selected source: .mssr/knowledge/pattern/mssr-change-history-contract.md
Range: block block-1, lines 3-3

Exact fetched text:

> Every release uses `changelogs/X.Y.Z.md` with explicit PROJECT_CONTEXT/PROJECT_MEMORY/PROJECT_STATE impact. The portable core parses/evaluates this contract; host adapters observe Git/filesystem state. `reviewed-none` is a valid deliberate result, `updated` should correspond to an observed authority change, and `pending` blocks persistence. The evaluator never writes project knowledge automatically.

## dataset-01

Query: ¿Cuál es el último readback local del store de Semantic Experience y cuántos registros tenían verdad verificada o reglas generadas?

Selected source: .mssr/knowledge/state/mssr-learning-dataset-state.md
Range: block block-3, lines 7-7

Exact fetched text:

> **Latest local MSSR store readback (2026-10-10 18:56:52 UTC):** the Semantic Experience status tool returned 7,198 observations, all shadow-only: 6,305 context-selection, 813 maintenance-disposition, 76 semantic-relation, 2 document-role, and 2 placement. Verified, corrected, rejected, unverified-feedback, eligible, and generated-rule counts were all zero. The live policy still requires independently verified, project-held-out evidence and keeps routing, authority, canonical rewrite, and auto-apply influence disabled. This is a local-store observation, distinct from the earlier Bridge readback above; it supersedes that older count for the local store only. The sidecar-selected 5,603 figure remains a correctly fetched historical snapshot, not present-day telemetry. Development follow-up: `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261009-v1\librarian-sidecar-learning-state-followup-20261010-v1\REPORT.md`.

## dataset-02

Query: ¿Qué diferencia hay entre el snapshot histórico de Bridge y el readback local más reciente?

Selected source: .mssr/knowledge/state/mssr-learning-dataset-state.md
Range: section heading-1, lines 1-7

Exact fetched text:

> ## Learning dataset state
>
> Semantic Experience remains separate from routing authority. `0.2.87` automatically projects the privacy-safe `learning-digest-v1` into bounded trace-linked context-selection, drift, maintenance and abstention shadows and records fallback abstentions without self-verification. The store is now accumulating real cross-project shadows, including context-selection, but independent confirmed/corrected evidence remains insufficient for promotion. Preference remains leave-one-project-out gated and blocked until the existing breadth/precision/coverage/zero-wrong thresholds pass. `0.2.88` near-match diagnostics are routing-repair metadata and do not grant Semantic Experience any routing influence. The entire learning plane remains advisory with `authorityInfluence=false`, `routingInfluence=false`, `canonicalRewriteAllowed=false` and `autoApplyAllowed=false`.
>
> Historical Bridge snapshot (2026-10-09 23:49 UTC): 5,603 observations, all shadow-only; zero verified, corrected, rejected, eligible, or generated rules. This is not current local telemetry; details are preserved in `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261009-v1\librarian-sidecar-learning-state-followup-20261010-v1\REPORT.md`.
>
> **Latest local MSSR store readback (2026-10-10 18:56:52 UTC):** the Semantic Experience status tool returned 7,198 observations, all shadow-only: 6,305 context-selection, 813 maintenance-disposition, 76 semantic-relation, 2 document-role, and 2 placement. Verified, corrected, rejected, unverified-feedback, eligible, and generated-rule counts were all zero. The live policy still requires independently verified, project-held-out evidence and keeps routing, authority, canonical rewrite, and auto-apply influence disabled. This is a local-store observation, distinct from the earlier Bridge readback above; it supersedes that older count for the local store only. The sidecar-selected 5,603 figure remains a correctly fetched historical snapshot, not present-day telemetry. Development follow-up: `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261009-v1\librarian-sidecar-learning-state-followup-20261010-v1\REPORT.md`.
>

## no-evidence-01

Query: ¿Qué precisión calibrada obtuvo Jev en un holdout owner-gold con 100 proyectos independientes?

Selection: none (Jev abstained). No excerpt to assess.

## no-evidence-02

Query: ¿Cuántos fallos de producción confirmó un verificador independiente durante octubre de 2026?

Selection: none (Jev abstained). No excerpt to assess.
