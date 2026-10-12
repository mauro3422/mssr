# Tomato full growth cycle

Status: integrated in gameplay on 2026-09-06.

## Runtime authority

- Scene: `scenes/prototypes/tomato_growth_cycle.tscn`
- Script: `scripts/prototypes/tomato_growth_cycle.gd`
- Adult visual authority: `assets/models/tomato_plant/tomato_plant_optimized.glb`
- Editable adult source: `assets/source_blender/tomato_plant_astra/game-style/tomato_plant_game_style.blend`
- Early-growth component: `scenes/prototypes/tomato_sprout_seedling_prototype.tscn`
- Derived reproductive/leaf organs: `assets/models/tomato_growth_organs/`

The growth script owns structural timing and attachment. The adult Blender asset owns the mature visual vocabulary.

## Phase contract

| Progress | Phase |
| --- | --- |
| 0.00–0.24 | BROTE → PLÁNTULA |
| 0.24–0.50 | VEGETATIVO |
| 0.50–0.62 | BOTONES FLORALES |
| 0.62–0.74 | FLORACIÓN |
| 0.74–0.84 | CUAJADO |
| 0.84–0.94 | FRUTO VERDE |
| 0.94–1.00 | MADURACIÓN → FRUTO MADURO |

These normalized windows are authored for readable game progression; they are not presented as real-world tomato chronology.

## Adult-reference reuse

The mature asset was inspected component-by-component rather than approximated from memory.

- `Warm weathered timber` supplies the wooden planter and the support stake/tutor. It is present from planting.
- `Rich soil` supplies the planter soil. Gameplay fertility drives a lightweight material tint without replacing the authored geometry.
- `Natural fiber` supplies the tutor ties. The merged optimized tie component appears once vegetative growth reaches the support.
- Vegetative compound leaves use `tomato_leaflet_optimized.glb`, a 376-triangle derivative of `Terminal 00_TomatoLeaf_Astra_Lamina`. It uses the same 0.025 leaf-decimation policy as the optimized adult export.
- Small companion seedlings in the planter reuse the same real leaflet instead of a generic primitive leaf.
- Flowers and fruit+calyx remain the previously extracted source organs. A fruit is always born at the exact `Site` that previously carried its flower.

The adult source blend SHA-256 remains `9d03a590d02e8c9fa11d2b03b2167c60407e4df22a066253f01c3271c41dafb1`; all derivatives were produced in background Blender without saving the source.

## Structure and distribution

The early BROTE→PLÁNTULA scene is lifted to the adult planter soil level; its tube caps and per-organ senescence now support a continuous handover to the authored adult stem. Later growth follows the source build recipe directly: each sprig uses its authored stem height, branch base, terminal tip and four lateral leaflet poses after Blender→Godot axis conversion. The runtime reuses the optimized leaflet mesh for all 13 five-leaflet sprigs and the single apical terminal leaflet; no whole-plant endpoint swap is used.

The reproductive layout follows the adult reference vertically through the gameplay phases: 3 low sites, 4 mid sites and 4 apical sites drive the readable flower-to-fruit progression. The final endpoint preserves the authored adult snapshot's original eight tomatoes plus three persistent yellow flowers, with source-oriented anchors and no abrupt whole-model transition.

No whole-plant scale animation is used.

## CropPlot integration

`scripts/crop_plot.gd` no longer draws the old 2.2 m primitive soil block or wood border. The visual planter and soil now come from the tomato asset itself. The separate physical collision is retained, but its footprint is matched to the wooden planter. The interaction hitbox remains independently sized so adjacent crop targeting stays non-overlapping.

Gameplay growth `GROWTH_RESET..1.0` maps to visual progress `0..1`; harvest therefore corresponds to the mature-fruit endpoint.

## Verification

Headless tests:
- `tests/tomato_growth_cycle_test.gd`
- `tests/smoke_test.gd`

Deterministic review evidence:
- `.mssr/evidence/godot-review/tomato-adult-alignment-20260906/`
- `.mssr/evidence/godot-review/tomato-apical-finish-20260906/`
- `.mssr/evidence/godot-review/tomato-flower-to-fruit-completion-20260906/`
- `.mssr/evidence/godot-review/tomato-flower-to-fruit-completion-20260906-full/`

The review harness captures fixed front and front-three-quarter cameras across seedling, vegetative, flowering/fruiting and mature states. The adult reference remains available under `.mssr/evidence/godot-review/tomato-harness-02/` for direct visual comparison.

Current acceptance and regression evidence: [Growth alignment review](TOMATO_GROWTH_ALIGNMENT_REVIEW.md). Earlier capture directories above are historical, not evidence of the latest code.
