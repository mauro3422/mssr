# Atlas Capture & UX Audit Loop

This loop exists so Atlas can be iterated from observable evidence instead of asking a human to pan/zoom and manually photograph each state.

## Goal

Produce a paired evidence bundle:

1. structured Atlas geometry/state metrics;
2. a trustworthy capture of the Godot editor with Atlas active.

The image answers "does this read well?" while metrics answer "why does it read this way?". Neither is sufficient alone.

## Standard loop

1. Load project context and route with MSSR for the current Atlas/Godot task.
2. Inspect Git/work writers before edits. Never appropriate concurrent Companion/gameplay work.
3. Choose an exact scene (`res://...`) relevant to the UX complaint.
4. When addon files were synchronized externally, call Godot MCP `rescan_filesystem` and let the editor settle before reloading `godot_atlas`; otherwise Godot may keep stale GDScript resources even when disk hashes are correct.
5. Reload only `godot_atlas` when addon source changed; preserve notes/tasks/branch/UI/project-override state.
6. Refresh Atlas and run `Ver todo / Revisar`.
7. Capture structured metrics:
   - total scene nodes;
   - visible/materialized cards;
   - hidden nodes;
   - connections;
   - zoom + `zoom_geometry_policy`;
   - layout bounds/density/wasted area;
   - x/y largest gaps;
   - `overlap_count` and exact pairs;
   - `edge_crossings`, exact crossing pairs and routing compute time;
   - minimap state/size;
   - collapsed/expanded branch summaries;
   - card rects.
8. Capture Godot visually using the safe editor-window capture path.
9. Attach/read the PNG at full quality.
10. Critique one or more concrete dimensions: hierarchy, naming, whitespace, branch grouping, script placement, card size, cable dominance, focus, minimap, toolbar, readability at zoom, performance.
11. Change the smallest owner that explains the observed problem.
12. Run focused service/editor tests.
13. Resync addon; call `rescan_filesystem`; reload only Atlas; recapture metrics + image.
14. Compare before/after. Do not declare improvement from code or metrics alone when the complaint is visual.
15. Check Godot Debugger/Output for fresh errors.
16. Persist coherent Atlas changes; leave unrelated project/gameplay/MCP concurrent work untouched.

## Capture safety contract

Never read the Godot editor root `ViewportTexture` to capture the whole editor UI. On Godot 4.7.1 this path caused a real native editor crash (`0xc0000005`).

Use the external Windows editor-window capture helper instead.

### Two-monitor policy

- Detect a visible League of Legends/LeagueClientUx window and its monitor.
- If Godot is already on the opposite monitor, do not move it.
- If Godot shares the League monitor and another monitor is available, temporarily move Godot to the other monitor.
- Preserve and restore original window position and maximized/minimized state in `finally`.
- Capture only after either:
  - Godot is verified foreground, or
  - Godot is verified topmost and League-safe (League is absent or Godot is isolated on a different monitor).
- If neither condition is true, abort before reading screen pixels.
- Never fall back to capturing whatever application happens to cover the rectangle.

## Coordinate caveat

Godot `Control.get_global_rect()` inside the central editor main-screen is not guaranteed to map 1:1 to Win32 client coordinates when docks/editor chrome are present. Do not blindly crop the OS capture using Atlas `global_rect`.

Preferred evidence:

- **JSON:** exact GraphEdit/card geometry from Atlas;
- **PNG:** full Godot editor client with Atlas active.

If a reliable dock-aware transform is implemented later, a GraphEdit-only crop may be added after explicit verification.

## Navigation/focus audit

For an expand/collapse complaint:

1. record zoom and changed branch id/path;
2. trigger the branch through the chevron/safe Atlas control;
3. ensure no card is freed during signal emission;
4. after layout settles, verify the branch/card intersects the corrected world view;
5. collapse must preserve zoom;
6. expansion may zoom out only if necessary;
7. screenshot the resulting view to confirm the branch is perceptually located, not merely mathematically intersecting.

GraphEdit transformation contract:

`screen_position = position_offset * zoom - scroll_offset`

So world view is:

`Rect2(scroll_offset / zoom, GraphEdit.size / zoom)`.

## Suggested visual gates

These are diagnostic guides, not arbitrary optimization targets:

- overlap count: `0`;
- no toolbar/workspace overflow;
- all important top-level branches visible after explicit Fit;
- collapsed large assets show useful counts rather than hundreds of internals;
- scripts remain near their owners;
- Panorama has no tiny path/preview text pretending to be readable;
- minimap is present when enabled but does not dominate the canvas;
- largest gaps and wasted area are investigated only when the screenshot also shows unhelpful whitespace;
- panning should remain responsive with the projected/materialized graph, not with the full raw scene hierarchy.

## Evidence naming

A useful audit report should keep:

- scene path;
- timestamp/id;
- PNG SHA-256;
- JSON path/hash when available;
- Godot editor/runtime identity;
- current Atlas layout version;
- before/after metrics relevant to the change;
- any fresh Debugger errors.

## Stop conditions

Stop an iteration and report partial instead of guessing when:

- Atlas or Godot provider is disconnected;
- a concurrent writer owns the same files;
- capture cannot prove it is looking at Godot;
- the editor crashes or reports new unexplained errors;
- metrics and screenshot contradict each other and the coordinate/capture path has not been resolved.
