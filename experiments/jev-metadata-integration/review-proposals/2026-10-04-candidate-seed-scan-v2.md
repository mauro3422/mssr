# Supplementary candidate-seed scan — 2026-10-04

**Status:** six bilingual query seeds proposed for owner review only. They are not
benchmark cases, answer keys, accepted ranges, labels, independent units, or
split assignments. Do not add them to the candidate bank until an owner accepts
their scope and wording.

## Provenance and frozen source

The proposals below were generated in a read-only Luna scan against MSSR
candidate commit
`e3e03912d63231ebf646fdaec9353ee1e28fe403` (MSSR 0.2.104). Every file and
inclusive line-range SHA-256 was independently checked against that commit.
A different read-only Luna reviewer then compared the proposals with the
preservation branch's C01–C32 bank and suggested scope and possible concept
links. The existing bank remains unchanged. These source files do not occur
among its 27 primary anchor paths or the worksheet's 28 cited paths, but unique
source files alone do not establish independent concepts. The owner must accept
scope and adjudicate labels; any later labels must be authored without seeing
Jev output.

## Proposed seeds

| Proposal | Scope | Frozen source anchor | Spanish query seed | English query seed | Review caveat |
| --- | --- | --- | --- | --- | --- |
| P01 | Proposed portable MSSR event-evaluator invariants | `docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md`, lines 55–74; file SHA-256 `cc1469488ff63b316a88769d608d9237150c2c7b2699424ae973c3d16fdee4fa`; range SHA-256 `aec8fd92359eb1948cfce29530707abb4108f20ca5a73f9ec6e3c7a146eee5b7` | Según el contrato propuesto, ¿qué resultados puede producir la evaluación de un evento y qué invariantes impiden que una entrega duplicada o no autenticada dispare acciones? | According to the proposed contract, what outcomes can event evaluation produce, and which invariants keep duplicate or unauthenticated deliveries from triggering actions? | Best candidate for core review if limited to pure, advisory evaluation, deduplication, provenance, and freshness. This handoff proposes behavior; it does not prove implementation. See possible links below. |
| P02 | OpenCode host adapter | `docs/OPENCODE.md`, lines 103–111; file SHA-256 `5291e63d16cc42c32c1a6dcf6b17739dc084c2fba9a61cd23ad61afd88e6d714`; range SHA-256 `fdd68d870a9a77377044132179fe525652cae9d6698179a69e74705054f2e42c` | En OpenCode CLI 1.18.15, ¿por qué funciona el lifecycle MCP desde el proyecto global pero no se emiten host-call hooks, y qué uso recomienda el documento? | In OpenCode CLI 1.18.15, why do MCP lifecycle events work in the global project while host-call hooks do not, and what invocation does the document recommend? | Explicitly version-bound snapshot, not a claim about newer OpenCode. Possible but weak overlap with C17 runtime adoption. Include only if host-adapter behavior is in benchmark scope. |
| P03 | Routing and fixture governance sub-suite | `docs/REPOSITORY_STRUCTURE.md`, lines 54–70; file SHA-256 `6e5c5f4c1e9940596ca806cc7f378da899000ace157560c95dc5d3b23d9e41a1`; range SHA-256 `879a9f982ffba9aa0d6e5cc762d746557214f9f7d1e04326429a83e1304be1b1` | ¿Qué garantías debe añadir una futura agregación determinista antes de dividir los JSON canónicos de routing? | What guarantees must a deterministic aggregation system add before the canonical routing JSON files can be split? | A possible MSSR-core governance case only if routing-artifact governance is in scope; it is not ordinary Librarian retrieval. Review C21/C28/C25/C32 links without automatic grouping. |
| P04 | Cross-project visual evidence integrity | `skills/skill-maintenance-loop/references/friction-visual-payload-integrity.md`, lines 11–33; file SHA-256 `5dec8b3e7c9a25d91e865e03d98e163447166877a06c4b71a9b6b4787a070124`; range SHA-256 `0b654e0308f0a29960ae0b309d167cf6db70c14e8ba1047cdc14ec9bff3727cc` | ¿Qué debe leerse del archivo real para demostrar tamaño y hash de una imagen, y cómo se tratan diferencias con su manifest? | What must be read from the actual image to establish its dimensions and hash, and how should manifest mismatches be handled? | Cross-project skill procedure, not MSSR-specific retrieval. C24 already tests sidecar fingerprint integrity; owner must decide whether the modality boundary yields a distinct concept. |
| P05 | Historical Git/worktree safety | `docs/skill-routing/INCIDENTS.md`, lines 228–251; file SHA-256 `fc274d9f888c21dbce0b52f96ee8446814fbedcae9c9d7fe95e0236db2ef00b0`; range SHA-256 `9a00e727207227650b1924074e33b7d3f2d00cdf6d408d58991a1c30d5ffc0e1` | ¿Cómo una junction de una dependencia `file:` hizo que la eliminación del worktree temporal alcanzara el repo canónico, y qué preflight evita repetirlo? | How did a `file:` dependency junction let temporary worktree removal reach the canonical repo, and what preflight prevents recurrence? | Historical incident only. C30 also concerns Git/evidence preservation; test whether the shared lesson creates leakage before treating as separate. |
| P06 | Roblox/Bridge multi-client adapter | `docs/skill-routing/TESTING.md`, lines 92–104; file SHA-256 `0ce399dcdf13797a09d52ac35b2e96dbd521d42456ade41872465397725564b4`; range SHA-256 `f69241492274aceee14ed94022ae8487119ad86b4a914fc1f0b6325c360e8078` | ¿Qué invariantes de concurrencia y selección exige el test cuando hay varias instancias de Studio? | Which concurrency and selection invariants must the tests enforce when several Studio instances are open? | Adapter-specific. Keep out of an MSSR-core split unless Bridge/Roblox integration is explicitly part of the target population. |

## Second-review scope and possible links

These are review edges, not labels or forced unions. Group only where the
owner confirms that the same underlying rule or example could leak between
partitions.

| Proposal | Scope recommendation | Existing cases to inspect | Boundary |
| --- | --- | --- | --- |
| P01 | Review for MSSR core, limited to portable, pure, advisory evaluation and event deduplication/provenance/freshness. | C13 trace/checkpoints; C20 bounded reads; C23 provider health/absence; C27 host-delivery boundary; C28 recommendation/decision/load; possibly C17 source versus host adoption. | Event intake, authentication/secrets, polling and host actions are adapter/host concerns. Do not turn a proposed contract into an implementation claim or permission grant. |
| P02 | OpenCode conformance suite. | C17 runtime adoption; C27 host event boundary; C28 host-call observation; C14 only if a direct identity relation is established. | Freeze the CLI version. Do not generalize 1.18.15 behavior to newer versions. |
| P03 | Optional MSSR-core routing-governance sub-suite, if that population is intended. | C21 skill distribution; C28 fixture/activation observations; C25 evaluation-suite integrity; C32 canonical authority. | Distinguish aggregate-generation requirements from the content of each fixture. This is not a retrieval case. |
| P04 | Skill/visual-evidence suite. | C24 sidecar/range/fingerprint integrity; C12 exact evidence acquisition; C19 coverage claims. | Similarity of hashing/provenance vocabulary does not establish that a visual-pipeline rule belongs in MSSR core. |
| P05 | Windows/Git/worktree operational-safety suite. | C30 repository/run preservation; C26 replacement with backup/review. | Historical junction incident, not current repository state; its specific reparse-point failure may remain a distinct cluster. |
| P06 | Roblox/Bridge integration suite. | C23 cached catalog versus capability absence; C28 selection versus load; C17 host adoption; C13 only if the same verification checkpoints are exercised. | Keep adapter concurrency, dispatch and shutdown behavior out of portable MSSR-core unless scope says otherwise. |

## Owner-review decisions still needed

For each proposal, decide whether it belongs in the evaluation population, repair
the Spanish/English pair if needed, identify all acceptable exact ranges in the
frozen source, label sufficiency and abstention behavior, and assess source and
concept links against C01–C32 and the other proposals. Keep any accepted
English/Spanish pair and related concept cluster together. Recompute the
connected components only after those decisions. No reporting-floor or
calibration claim follows from these six proposals.

No Jev, Noul, provider, or external MCP call was made for this scan.
