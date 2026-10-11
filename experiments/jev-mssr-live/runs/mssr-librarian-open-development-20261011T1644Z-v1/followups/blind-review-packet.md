# Blind review: post-hoc Jev probes

These are targeted post-hoc diagnostic queries created after reviewing the initial cohort. Assess only whether each exact fetched excerpt answers its query. No reference labels or provider scores are included. Treat no selection as an observed abstention and do not infer it was correct without enough evidence in the query/excerpt packet.

## cutover-fallback

Query: ¿Qué cambió MSSR 0.2.18 respecto a usar .bridge/ como fallback activo para el contexto del proyecto?

Selected exact range: .mssr/knowledge/decision/canonical-project-context-cutover.md (block block-1, lines 3-3)

> MSSR 0.2.18 removes active project-context fallback to `.bridge/`. A managed repository must be explicitly initialized under `.mssr/`; missing/invalid initialization is observable maintenance evidence rather than permission to guess or load old authorities.

## cutover-inbox

Query: ¿Qué se decidió hacer con los recibos del inbox runtime anterior a MSSR 0.2.18 y por qué?

Selected exact range: .mssr/knowledge/decision/canonical-project-context-cutover.md (block block-2, lines 5-5)

> The cutover deliberately discards the obsolete pre-0.2.18 runtime inbox instead of migrating its receipts, because those receipts may preserve stale `.bridge` provenance. Durable legacy authorities are never deleted unless their canonical counterpart already exists; otherwise initialization reports a blocked cleanup requiring explicit review.

## drift-integration

Query: ¿Qué cadena debe probarse para distinguir adopción runtime real de código exportado o un ítem del roadmap?

Selected exact range: .mssr/knowledge/operations/mssr-project-knowledge-drift-review.md (block block-2, lines 5-5)

> Semantic/document inconsistency uses the same evidence-first boundary. First classify whether a capability is actually integrated (`producer -> evaluator -> host consumer -> notice/context surface -> regression`) instead of treating exported code/tests/roadmap checkboxes as runtime adoption. For prose/current-state drift, exact declared identities and deterministic typed claims are authoritative comparison inputs. Similarity/fuzzy/vector retrieval may only find candidate pairs; it must not prove contradiction. Temporal scope, subject identity, authority class and comparable value/revision must agree before deterministic rules can elevate evidence to a proven conflict. Otherwise the system emits bounded review/abstention evidence. This preserves useful heuristics without granting semantic rewrite authority.

## learning-preference

Query: ¿Qué condiciones del holdout se requieren para preferir un fallback en el host?

Selected exact range: .mssr/knowledge/decision/mssr-learning-activation-decision.md (block block-3, lines 9-9)

> The leave-one-project-out preference benchmark separately requires at least 24 independently verified holdout decisions, 4 distinct projects containing verified truth, fallback precision of at least 0.95, coverage of at least 0.25, and zero wrong fallback decisions. Project breadth counts only projects with independently confirmed/corrected truth; projects containing only shadow or rejected observations cannot satisfy it. Meeting the benchmark permits advisory host preference only; authority, routing, canonical rewrite and auto-apply remain false. A reviewed versioned feature flag, exploration floor and immediate rollback are still required for activation. Implementation owners: `src/semantic-experience.ts` and `src/semantic-experience-benchmark.ts`.

## learning-shadow

Query: ¿Qué evidencia y umbrales requiere generar una regla shadow?

Selected exact range: .mssr/knowledge/decision/mssr-learning-activation-decision.md (block block-2, lines 7-7)

> Generating a deterministic Semantic Experience rule and preferring that fallback in a held-out benchmark are separate gates. The shadow-rule distiller uses only independently confirmed/corrected evidence, keeps the latest observation per evidence family, and by default requires at least 8 evidence units from 2 distinct projects, observed dominance of at least 0.80 and a 95% Wilson lower bound of at least 0.65. Semantic-relation contradictions remain excluded from distillation. These support thresholds create an advisory shadow rule; they do not qualify the fallback for host preference.

## skills-progressive-en

Query: How does MSSR 0.2.55 prevent broad anomaly signals from loading detailed monolithic references, and what selectors must detailed procedures match?

Selected exact range: .mssr/knowledge/decision/mssr-first-party-skill-direction.md (section heading-1, lines 1-3)

> ## First-party core skill direction
>
> MSSR-owned operational skills have one canonical bundled source for the five names in `config/first-party-skills.json`. Native, Codex-local, and OpenCode-local source providers discover that package with reserved-name precedence; a custom catalog may not reclaim one of those names as an editable owner. The package boundary does not imply loading every first-party skill on every task; required/on-demand/closing activation remains explicit. In 0.2.54 each root became a compact control plane and selected direct parent-owned references through its manifest; routing metadata/fixtures remained unchanged. The 0.2.55 maintenance follow-up makes progressive disclosure apply to reference units too: a compact root is not sufficient when a generic signal still selects one monolithic reference, so broad anomaly evidence loads only a compact index and detailed procedures require conjunctive stage/intent selectors. The v1 distribution gate proves package dry-run, routing/context selection, safe opt-in junction migration and audit without publishing externally.
>

## skills-progressive-es-direct

Query: En MSSR 0.2.55, ¿qué se carga ante una anomalía amplia y qué selectores conjuntivos se requieren para cargar procedimientos detallados?

Selection: none.

## skills-progressive-es-short

Query: ¿Qué hizo MSSR 0.2.55 para que una señal general de anomalía no cargue una referencia monolítica? ¿Qué selectores se exigen para cargar procedimientos detallados?

Selection: none.

## skills-progressive-es-simple

Query: ¿Qué cambió en la carga de referencias detalladas en MSSR 0.2.55?

Selection: none.

## skills-progressive

Query: ¿Qué cambia MSSR 0.2.55 sobre las referencias seleccionadas por señales amplias de anomalía y qué deben cumplir los procedimientos detallados?

Selection: none.
