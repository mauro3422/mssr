# Open Questions

These questions are intentionally unresolved. They should be answered through small prototypes or user decisions rather than assumptions.

## Highest priority

1. **Working/final name**
   - Keep `BeeIncremental` internally for now.
   - Later choose whether the public name should sound scientific, cozy, funny or addictive/arcade-like.

## Recently resolved

- **First manual action:** begin with flower/forage clicking, then route gathered food into brood support until the first worker emerges.
- **Art direction:** stylized illustrated naturalism; recognizable honey-bee anatomy, but clearly less photorealistic than the current concept-art references.
- **Primary spaces:** `HiveView` is hive-first and centered on the living comb; `ForageView` is the interchangeable flowers/plants scene. Both share one continuous colony/economy state.

## Medium priority

5. Desktop-first only, or design UI from the beginning so mobile/touch remains possible?
6. Should the player control one colony forever between swarms, or unlock multiple colony environments later?
7. How active should clicking remain in late game? Optional bursts may be better than forcing permanent spam-clicking.
8. Should offline progress exist in the first public build or only after the basic economy is stable?
9. What is the permanent prestige resource called? Avoid pseudo-genetics until the biological framing is researched.
10. How literal should worker roles be? Use enough specialization to teach concepts without requiring individual bee management.

## Prototype questions

The first playable should answer these empirically:

- Does clicking feel satisfying before art is polished?
- How many seconds before the first automation reward feels good?
- Is seeing one bee take over a task more satisfying than only seeing `+1/sec`?
- Can a second manual panel appear without confusing the player?
- Does near-frontal faux-2.5D preserve easy cell clicking?
- How many representative bees can be visible before the comb becomes noisy rather than alive?

## Current defaults until changed

- Engine: Godot.
- Rendering/gameplay plane: 2D.
- Perspective: near-frontal faux-2.5D.
- Blender: optional, not required.
- Main progression: manual task -> automation -> new task.
- Prestige fantasy: swarming/new colony.

