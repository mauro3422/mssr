# Run 61 — MCP live Project Context sidecar pilot

Status: preregistered before scored Jev calls. The first unfiltered sidecar search used to confirm the canonical Bridge route is an excluded smoke. The initial batch was schema-rejected before reading sources because it requested 260 snippet characters; that attempt is excluded. Runtime schema discovery then showed that `queryVariants` is supported, so this plan was corrected before any Jev call.

Frozen live tool schema: `mssr_librarian_search`, runtime boot `165f4d43-61f9-4ba7-89d4-19e0add66d00`, schema hash `b931631885199014`. Use `maxSnippetChars=160` (allowed range 40–240).

## Question

Does the production MCP path (Bridge 0.6.175 / MSSR 0.2.127) project the four exact owner-declared sidecar selectors, retrieve their target ranges for English and Spanish questions, and let live Jev select a useful exact range that fetches and packs unchanged?

This is a four-source pilot. Language arms on one source are paired; neither the 8 queries nor 16 arms are independent gold cases. It does not estimate general Jev reliability, calibration, skills/refs/telemetry coverage, or semantic synthesis quality.

## Frozen sources and targets

Source revisions are SHA-256 as returned by the live sidecar projection on 2026-10-12:

- `.mssr/knowledge/architecture/architecture-impact-review-decision.md` — `e1ab8240b1edc4c6aad10d25a84b4bef4e9b7470663a7649cb415f0cd17c68df`; target heading `Architecture impact review decision`.
- `.mssr/knowledge/state/mssr-learning-dataset-state.md` — `5dfa844a0d0bc18da4251aa34734b453485e90044af72e0d67f3de9858905188`; target heading `Learning dataset state`.
- `.mssr/PROJECT_STATE.md` — `2acc7788a21973eeb8cc9413c33f96d156aff45b5cb0ef3dab40a09769f6f887`; target heading path `MSSR project state > Core skill package state`.
- `.mssr/knowledge/research/jev-decision-model-use-cases.md` — `a44d90231af23eb9fc6123a7c06bfc53c9a058d7cc556c4c476a8e18ab5c3469`; target heading path `Jev, decisiones tipadas y casos de uso para MSSR > 100 hipótesis de uso`.

## Frozen query set

Each query is run against the same four explicit source paths in two search arms. Each call uses the language in the primary query and supplies its paired translation as one explicit `queryVariants` item. The primary-language query remains distinguishable from the variant for matched-query reporting:

- Control: metadata off.
- Treatment: project-context-librarian-sidecar with the exact five-field metadata filter declared for the expected target.

| Case | Expected target | English query | Spanish query | Treatment filter |
|---|---|---|---|---|
| A1 | Architecture impact review decision | Which authority decides whether linked structural change means the architecture changed? | ¿Qué autoridad decide si un cambio estructural enlazado significa que cambió la arquitectura? | domain=coding; action=review; artifact=repository; need=integrity-verification; signal=conflicting-evidence |
| A2 | Learning dataset state | Is the learning dataset ready to influence routing or promote rules? | ¿El conjunto de datos de aprendizaje ya puede influir en el routing o promover reglas? | domain=skill-system; action=review; artifact=document; need=integrity-verification; signal=uncertainty |
| A3 | Core skill package state | Does semantic evidence count as a sixth first-party skill root? | ¿La evidencia semántica cuenta como una sexta skill de primera parte? | domain=skill-system; action=verify; artifact=skill; need=version-control; signal=warning-observed |
| A4 | 100 hypotheses of use | Are all 100 proposed use cases demonstrated Jev capabilities? | ¿Los 100 casos propuestos son capacidades de Jev ya demostradas? | domain=agent-orchestration; action=discover; artifact=mcp; need=cross-agent; signal=reusable-pattern |

Each case is run twice, once with English primary and Spanish variant, and once with Spanish primary and English variant. The caller supplies these translations explicitly; no automatic translation is inferred. `queryVariants` was verified in the exact live runtime schema above.

## Measurements

1. Sidecar projection completeness and omissions.
2. Target-range recall in the top eight results, rank, and which explicit query index matched; record control/treatment and primary language separately.
3. Whether Jev selects the frozen target handle from the exact returned candidate pool; do not interpret raw Choice confidence or Noul score as calibrated probability.
4. Exact fetch and evidence-pack identity/integrity for selected handles.
5. Record each provider response and error without retrying or replacing a result silently. Keep all arms, including abstentions and failures.

Labels were read from the frozen source headings before Jev calls. No case is owner-gold or independent human adjudication. Report only this pilot's descriptive counts.

## Exclusions and limits

- The preliminary smoke search is excluded from scores.
- No threshold tuning, source edits, selector changes, or canonical writes.
- This run covers only the four Project Context sidecar entries. Skill, reference, telemetry, contradiction-discovery and multi-atom projection remain separate unresolved coverage.
- Search, Jev selection, fetch and evidence pack are separate gates; a correct pack proves bytes and range integrity, not that the answer is complete.
