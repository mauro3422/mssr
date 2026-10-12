# Atlas Routing Architecture

## Goal

Keep Atlas connection behavior predictable while allowing new geometry, routing-quality and interaction fixes to be added without turning `AtlasGraphEdit` into a policy monolith.

This subsystem uses a **functional-core / imperative-shell** architecture with explicit ownership boundaries. Pure or deterministic services own decisions; the Godot `GraphEdit` adapter owns engine lifecycle and rendering side effects.

## Non-goals

- No second `GraphEdit`, viewer or renderer.
- No routing policy hidden inside draw callbacks.
- No route fix that compensates for structurally invalid placement.
- No global rewrite when one fixture exposes one missing property.
- No test that freezes an accidental screenshot shape when a smaller invariant explains the bug.

## Layers and owners

```text
accepted card placement / graph topology
                |
                v
AtlasConnectionGeometry
  card perimeter, endpoint candidates, side feasibility + endpoint-pair scoring
                |
                v
AtlasRouteTransformGeometry
  canonical point/rect/polyline transforms for mirrored/vertical routing
                |
                v
AtlasEdgeRouter
  strategy composition after valid endpoints
  uses AtlasRoutePathGeometry + AtlasRouteChannelSearch for reusable path/search rules
                |
                v
Route quality / route-set policy
  choose among valid candidates; crossings/congestion/stability
  (extract when a fixture earns this independent owner)
                |
                v
AtlasRouteInteractionLifecycle + AtlasRouteCacheReuse
  drag refresh state + deterministic nearby-route reuse/endpoint warp
                |
                v
AtlasGraphEdit
  Godot adapter: live descriptors/cache dictionary, signals, deferred scheduling,
  native invalidation, route-set orchestration/publication, hit-testing/hover, redraw
```

`AtlasGraphEdit` may orchestrate the layers, but a new mathematical or lifecycle rule should live in the smallest owner that can express and test it without the editor.

## Canonical state and ownership

- Card positions/topology come from the current Atlas projection/workspace; routing does not move cards.
- Connection attachment geometry and endpoint-pair scoring are derived by `AtlasConnectionGeometry`.
- Canonical mirror/vertical transforms are derived by `AtlasRouteTransformGeometry`; GraphEdit chooses when a transform applies.
- Path/search primitives are derived by `AtlasRoutePathGeometry` + `AtlasRouteChannelSearch`; `AtlasEdgeRouter` composes the accepted routing strategies.
- Route caches/snapshots are derived acceleration state; `AtlasRouteSnapshotCache` owns reusable snapshot storage while `AtlasRouteCacheReuse` owns bounded same-frame nearby-route reuse/endpoint warp. Neither defines the correct route.
- `AtlasRouteInteractionLifecycle` owns only interaction transition state. It does not call `GraphEdit`, schedule deferred work or compute paths.
- `AtlasGraphEdit` owns the boundary with Godot: live GraphNode descriptors/cache dictionary, route-set orchestration/publication, native signals, `call_deferred`, native connection invalidation and the rendered surface.

## Interaction state machine

```text
IDLE
  begin_move
    -> MOVING

MOVING
  position_changed
    -> QUEUED      (only the first request; later changes coalesce)

QUEUED
  deferred callback while still moving
    -> REFRESHING
  mouse-up first
    -> IDLE + one final synchronous refresh

REFRESHING
  publish complete route snapshot
    -> MOVING
  mouse-up while refresh owns publication
    -> IDLE without duplicate final publication
```

The adapter must keep the previously complete route cache visible until Godot has finished native endpoint bookkeeping for the callback that moved the card. New route geometry is then published atomically.

## Core invariants

1. **Graph-world determinism:** zoom/pan never change route topology for unchanged graph geometry.
2. **Atomic publication:** drawing sees either the previous complete route set or the next complete route set, never a partially rebuilt mixture.
3. **Native synchronization:** after Atlas publishes/restores a route set, Godot's native connection geometry is invalidated in the same lifecycle.
4. **Drag continuity:** a same-callback native request for old endpoints still resolves the previous exact route; the deferred drag-frame refresh publishes the candidate geometry; mouse-up with unchanged geometry preserves it.
5. **Coalescing:** many position signals inside one pending drag frame request at most one deferred rebuild.
6. **Endpoint validity before path search:** a router is not asked to hide an attachment that already folds back into a card.
7. **Hard vs soft constraints:** cards/invalid endpoint flow are hard constraints. Future route crossings, overlap, local congestion and route-change hysteresis are quality costs unless a fixture proves otherwise.
8. **Placement authority:** routing never moves cards or legitimizes a bad branch layout.

## How a new fixture-discovered bug becomes a durable fix

```text
real Atlas anomaly
-> smallest deterministic reproduction
-> classify owner
-> add lowest-layer invariant test
-> implement in that owner
-> keep/add GraphEdit integration regression when lifecycle matters
-> run Layout Lab regressions
-> verify on the real Atlas editor surface
-> only then persist/sync consumer
```

Owner selection:

- Wrong point/side on a card -> `AtlasConnectionGeometry`.
- Valid endpoints but bad obstacle path/curve -> `AtlasEdgeRouter`.
- Several individually valid routes make a bad combined picture -> route-set quality policy; do not overload the low-level router with UI state.
- Route is correct after release/zoom but wrong transiently during interaction -> `AtlasRouteInteractionLifecycle` + `AtlasGraphEdit` adapter integration.
- Route cache identity/reuse is wrong -> route snapshot/cache owner; extract it when another independent cache rule proves that boundary.
- Cards themselves are badly placed -> Spatial Grammar/layout, not routing.

## Test tiers

### Tier 1 — pure owner tests

Fast deterministic tests for geometry, path construction and lifecycle transitions. These should not require an editor window.

### Tier 2 — `AtlasGraphEdit` integration

Prove route-cache publication, Godot coordinate transforms, native invalidation, deferred drag timing and adapter compatibility.

### Tier 3 — Layout Lab fixtures

A/B/C/D and future fixtures prove accepted layout + routing properties together on real GraphNodes.

### Tier 4 — real editor visual gate

Human-visible Atlas is the acceptance surface for interaction/aesthetic claims. A mathematical PASS does not prove visual quality.

## Current extraction status

- `AtlasConnectionGeometry`, `AtlasRouteTransformGeometry`, `AtlasRoutePathGeometry` and `AtlasRouteChannelSearch`: extracted and independently tested deterministic geometry/search owners. `AtlasRoutePathGeometry` also owns direct-spline shaping and cubic sampling; `AtlasEdgeRouter` keeps only the strategy decision that requests that geometry.
- `AtlasEdgeRouter`: ~676 lines and now primarily composes detour/external/channel strategies around the focused geometry/search owners; do not subdivide its remaining strategy orchestration without a fixture-backed contract.
- `AtlasRouteInteractionLifecycle`, `AtlasRouteCacheReuse`, `AtlasRouteSnapshotCache`, `AtlasRouteSnapshotIdentity`, `AtlasRouteAnalysis`, `AtlasRouteAuditGeometry` and `AtlasAnnotationChannelRouter`: independently tested focused owners for interaction state, same-frame reuse, snapshot storage/identity and routing diagnostics.
- `AtlasRouteDescriptorPolicy`, `AtlasRouteQualityPolicy` and `AtlasRouteFanoutPolicy`: own normalized relationship priority/classification, local fallback thresholds/comparison and shared-port border-slot fanout respectively; none reads live `GraphNode`s.
- `AtlasGraphEdit`: ~1480 lines and remains the imperative Godot adapter plus live candidate-generation, route-set acceptance/publication, native invalidation and render-interaction boundary. Crossing-splice and `RouteSetQuality` remain here because their independent policy boundary is not yet earned.

## Next routing-quality boundary

The congested Fixture A manual arrangement is evidence for a future **route-set quality** owner. Its first contract should compare valid candidate routes using soft costs such as crossings, shared-segment overlap, near-parallel crowding, tiny zigzags and route-change hysteresis. That feature should consume normalized routes/descriptors and remain independent of GraphEdit rendering.
