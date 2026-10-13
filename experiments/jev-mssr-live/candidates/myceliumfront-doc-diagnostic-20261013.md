# MyceliumFront candidate cohort — owner review required

Status: **candidate only**. No Jev/Bridge provider calls have been made for these cases. This file is outside `runs/` and does not count as an executed run.

## Exposure and validity

- Candidate source root: `D:\Dev\MyceliumFront`.
- Pinned revision: `6bc411943c80be6ef844e4b5ac6847ae57465926` (`main`).
- The checkout is dirty from unrelated `.bridge` → `.mssr` migration and documentation changes. The four source files below were checked unchanged against the pinned commit; no other worktree content is part of this cohort.
- A fresh literal search for the MyceliumFront root/name and pinned commit across run plans, manifests, frozen inputs, and diagnostics returned no matches. The earlier broader ledger audit also found no exact root/source match. This does not exclude alias exposure or conceptual/domain overlap. The project is still adjacent to prior Roblox asset/visual work, so this can be a **project-new diagnostic**, not a strict domain-family holdout or broad reliability estimate.
- Thirty-five question units have Spanish and English variants (70 possible request arms); language variants remain paired within one case and must not inflate the independent sample count. All cases belong to one project family, so this cannot establish cross-project generalization or a cluster-based uncertainty interval.
- Candidate labels are author-derived and **pending owner adjudication**. They are not gold labels. Do not call Jev until the owner approves the project-family boundary, expected disposition, exact evidence ranges, and frozen corpus.
- Before a future run, freeze exact source bytes into that run's `inputs/`, freeze labels in a separate file with `exposedToRequests: false`, and hash the instrument and all inputs. This document alone is not a run manifest.

## Frozen-source identity

SHA-256 values below were computed from the worktree files after confirming they match `HEAD` byte-for-byte with `git diff --exit-code`.

| Source | SHA-256 |
|---|---|
| `README.md` | `C231C3619FC62049BD5ED301DF0E80A39658031D242B760ACF8DC0381177E208` |
| `ROADMAP.md` | `094E423BA73E5E0C022BC9393225E65314AC43BE1C732E9F534F8D68D0E743F9` |
| `docs/ARCHITECTURE.md` | `E86150020CDF7E183B54925667F74B6E8FA54383E710A88979BA99F1E054A3F6` |
| `docs/PROJECT_NOTES.md` | `89FFF1330B53F1059CE76E72C94425025955470A7D2C007415499E688026F2EF` |

## Candidate cases

`support` means the frozen corpus appears to state the fact. `documented-absence` means the docs explicitly mark the capability incomplete or pending. `unauthorized` means the docs record an operation the system rejects. `scope/unknown` is an abstention or scope-resolution candidate; the nearby source may discuss the topic without establishing the requested current value. The listed line ranges are review anchors, not MSSR candidate handles; generate exact handles from the future frozen corpus before any Jev call. Every disposition and range remains pending owner review.

| ID | Candidate type | Pregunta (ES) | Question (EN) | Candidate expected fact/disposition | Exact source range |
|---|---|---|---|---|---|
| P01 | support | ¿Qué versión del prototipo indica el README? | What prototype version does the README identify? | `0.0.4` | `README.md:7-9` |
| P02 | support | ¿Dónde vive hoy el código Luau y qué limita clonar el repo para editar scripts? | Where does the Luau code currently live, and what does cloning the repo not enable? | It is embedded in the place; external Rojo script editing is not yet available. | `README.md:20` |
| P03 | support | ¿Cómo separa el dashboard los historiales de assets lógicos que comparten un paquete técnico? | How does the dashboard keep histories separate for logical assets that share a technical package? | History/comparison is scoped by `assetTrack`; dependencies are shown without merging asset versions. | `README.md:32` |
| P04 | support | ¿Qué identifica de forma estable una entidad construida? | What provides stable identity for a built entity? | `EntityId`, under the common `BuildEntity` contract. | `README.md:83`; `ROADMAP.md:38`; `docs/ARCHITECTURE.md:26-35` |
| P05 | support | ¿Cuáles son los cuatro puertos lógicos de una planta? | What are the four logical ports on a plant? | `North`, `East`, `South`, `West`. | `README.md:86` |
| P06 | support | ¿Cuántas conexiones simultáneas admite un puerto? | How many simultaneous connections can one port accept? | One; the server enforces capacity one. | `README.md:88`; `docs/PROJECT_NOTES.md:87-89` |
| P07 | support | Al reubicar un extremo con `RewireConnection`, ¿qué ocurre con la identidad del enlace? | When `RewireConnection` moves an endpoint, what happens to link identity? | The selected endpoint moves while link identity is preserved. | `README.md:90`; `docs/PROJECT_NOTES.md:88-89` |
| P08 | support | ¿Quién calcula `Flow` y qué hace el cliente con ese valor? | Who calculates `Flow`, and what does the client do with it? | `NutrientGraph`/the authoritative ledger calculates it; Client observes it for visual pulses. | `README.md:94`; `docs/PROJECT_NOTES.md:82-83` |
| P09 | support | ¿Durante cuánto tiempo se deduplica un `requestId`, y con qué clave? | For how long is a `requestId` deduplicated, and by which key? | 180 seconds per player and request ID. | `README.md:97`; `ROADMAP.md:40` |
| P10 | support | ¿Qué roles cumplen `SolarBloom`, `MyceliumLink` y `CactusSentry` en el ledger? | What roles do `SolarBloom`, `MyceliumLink`, and `CactusSentry` have in the nutrient ledger? | Producer, transporter, and consumer respectively; the consumer retains reserve and may become `Starved`. | `README.md:100` |
| P11 | support | ¿Qué dimensiones y elementos principales documenta C002 para el arena? | What dimensions and main elements does C002 document for the arena? | `120 × 80`, three anthills, five spawn mouths, routes by origin. | `README.md:102`; `ROADMAP.md:304` |
| P12 | support | ¿Qué incluye la sesión C004 ya completada? | What does the completed C004 session include? | Contextual arena entry, five complete waves, verifiable victory, Client/Server state synchronization. | `README.md:103`; `ROADMAP.md:305` |
| P13 | support | ¿Qué decisión se aprobó para B003? | What design decision was approved for B003? | One individual mushroom as a reusable base for family B. | `README.md:222` |
| P14 | support | ¿`Tres hongos unidos` se fusionó con B003? ¿Qué relación conserva? | Was `Tres hongos unidos` merged into B003, and what relation does it retain? | No; it remains an independent logical asset and B003 is only a visual reference. | `README.md:224` |
| P15 | support | ¿Qué pieza es la única hitbox consultable del puerto-hongo visual? | Which component is the only queryable hitbox for the mushroom port visual? | `InteractionRoot`; the meshes remain visual, with a shared controller and at most one Hero. | `README.md:225`; `docs/PROJECT_NOTES.md:105-109` |
| D01 | documented-absence | ¿Ya están completas las prioridades, el almacenamiento especializado y la economía de nutrientes? | Are nutrient priorities, specialized storage, and the full nutrient economy complete? | No; these remain unimplemented. | `README.md:111-114` |
| D02 | documented-absence | ¿Ya están implementados el crecimiento biológico avanzado y las variaciones por especie? | Are advanced biological growth and species variations implemented? | No; both remain unimplemented. | `README.md:114` |
| D03 | documented-absence | ¿El constructor ya busca caminos automáticamente entre nodos? | Does the builder already search paths between nodes automatically? | No; automatic routes/path search remain unimplemented. | `README.md:115`; `ROADMAP.md:50` |
| D04 | documented-absence | ¿El combate ya tiene balance final, jefe y progresión terminados? | Are final combat balance, a boss, and progression complete? | No; these are still listed as unimplemented. | `README.md:116` |
| D05 | documented-absence | ¿Se guardan las colonias entre sesiones? | Are colonies persisted across sessions? | No; cross-session colony persistence remains unimplemented/future. | `README.md:117`; `README.md:228`; `docs/ARCHITECTURE.md:306-318` |
| D06 | documented-absence | ¿Se puede plantar ya sobre varias superficies o materiales? | Can the player already plant on multiple surfaces or materials? | No; multiple plantable surfaces/materials remain unimplemented. | `README.md:118` |
| D07 | documented-absence | ¿Ya existen el cooperativo y las múltiples bases? | Do co-op and multiple bases exist yet? | No; both remain future scope. | `README.md:119`; `ROADMAP.md:418-431` |
| D08 | unauthorized | ¿Se acepta modificar una muestra de la galería? | Is modification of a gallery sample accepted? | No; the test record says gallery modification is rejected, and the samples are protected. | `README.md:98`; `README.md:132` |
| D09 | documented-absence | ¿Se midió una mejora de calidad de código con un benchmark A/B? | Was code-quality improvement measured with an A/B benchmark? | No; notes explicitly say no A/B code-quality benchmark was measured. | `docs/PROJECT_NOTES.md:176-180` |
| D10 | documented-absence | ¿Qué condición exige la hoja de ruta antes de iniciar la Fase 8? | What condition must be met before Roadmap Phase 8 begins? | Validate performance, persistence, and fun of the first map first. | `ROADMAP.md:418-431` |
| D11 | documented-absence | ¿Una prueba en Play demuestra que el guardado llegó a Edit o al disco? | Does a Play test prove that saved state reached Edit or disk? | No; the architecture explicitly says Play is not persistence proof for Edit/disk. | `docs/ARCHITECTURE.md:320-328` |
| D12 | documented-absence | ¿Está cerrada la revisión humana de C007? | Is the human review gate for C007 complete? | No; the automated pass is complete, but human feel/readability and deliberate defeat remain. | `README.md:226`; `ROADMAP.md:531` |
| D13 | documented-absence | ¿Las rutas alternativas sencillas ya forman parte de lo implementado? | Are simple alternate routes already implemented? | No; alternate routes are listed as future work. | `ROADMAP.md:258-264`; `README.md:113-115` |
| D14 | documented-absence | ¿La geometría B003 participa en colisiones o consultas? | Does B003 geometry participate in collisions or queries? | No; it is presentation only; `InteractionRoot` is the queryable hitbox. | `docs/PROJECT_NOTES.md:105-108` |
| D15 | documented-absence | ¿`BuildPaletteSlot` representa una posición del mundo que puede ocuparse? | Is `BuildPaletteSlot` an occupiable world position? | No; it is a HUD presentation slot, not a world coordinate. | `ROADMAP.md:165-168`; `docs/PROJECT_NOTES.md:62-66` |
| U01 | scope/unknown | ¿Cuál es el daño por disparo del `CactusSentry` en el runtime actual? | What is the `CactusSentry` per-shot damage in the current runtime? | Not established as a current runtime value in this corpus; a Roadmap configuration example is not proof of the live value. | `docs/PROJECT_NOTES.md:135-137`; `ROADMAP.md:128-135` |
| U02 | scope/unknown | ¿Cuál es el cooldown exacto del `CactusSentry` en el runtime actual? | What is the exact `CactusSentry` cooldown in the current runtime? | Not established as a current runtime value; keep the Roadmap example separate from implementation evidence. | `docs/PROJECT_NOTES.md:135-137`; `ROADMAP.md:128-135` |
| U03 | not-specified-in-corpus | ¿Cuál es el costo exacto en esporas de reparar una conexión? | What is the exact spore cost to repair a connection? | No exact cost located in the four-file frozen corpus; verify abstention vs nearby general mentions of spore economy. | `README.md:104-105`; `docs/PROJECT_NOTES.md:221` |
| U04 | not-specified-in-corpus | ¿Cada cuántos segundos ejecuta el `NutrientGraph` el tick de simulación? | How many seconds apart are `NutrientGraph` simulation ticks? | The corpus says the ledger is tick-based but gives no interval; verify the abstention label against the frozen corpus. | `docs/PROJECT_NOTES.md:111-117`; `ROADMAP.md:526` |
| U05 | scope/unknown | ¿Cuántas hormigas aparecen en cada una de las cinco oleadas C004? | How many ants spawn in each of the five C004 waves? | Not established: C001 mentions five ants and C004 mentions five waves; those counts must not be conflated. | `README.md:101-103`; `ROADMAP.md:303-305` |

## Call gate

No live calls until an owner review records, for every case, `approve`, `reject`, or `revise`; verifies the exact answer range and the corpus-scoped unknowns; and confirms the project-family exposure classification. If approved, create a separate immutable run folder, keep labels out of requests, and report case-level retrieval, selection sufficiency, abstention, range breadth, exact-fetch integrity, and token use separately. Even a clean result here applies to one adjacent project family and cannot establish cross-domain calibration.
