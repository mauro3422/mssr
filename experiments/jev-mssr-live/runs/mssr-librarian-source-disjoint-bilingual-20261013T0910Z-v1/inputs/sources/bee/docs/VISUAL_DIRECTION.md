# Visual Direction

## Chosen format

Godot 2D with faux-2.5D depth.

The honeycomb is presented almost front-on, with enough illustrated perspective to make wax walls, cells and bees feel dimensional without using a 3D world.

## Why not full isometric or 3D

The honeycomb itself is an interface. Cells must remain easy to read, hover and click. A strong isometric angle would distort the hex grid, reduce usable screen space and make interaction less immediate. Real 3D would add modeling, rigging, camera, lighting and navigation work before the core clicker is proven.

## Recommended camera language

- Main comb plane: near frontal.
- Suggested visual tilt: mild 3/4 illusion only, produced mostly by art rather than by a camera transform.
- Cells: preserve clear hex silhouettes and generous hit areas.
- Foreground: occasional flying bees can cross in front of UI-free parts of the hive.
- Surface bees: crawl on the comb and use ordering/Y-sort-like rules to overlap naturally.
- Background: subtle hive cavity/wood/wax depth layers can move slightly with parallax.

## How to fake depth cheaply

1. Cell rims have a highlighted top edge and darker inner edge.
2. Filled cells gain visible content depth: pollen, nectar, honey, brood or capped wax.
3. Bees cast tiny soft sprite shadows beneath them.
4. Bee scale can change slightly on entrance/exit flight paths.
5. Flying bees use a separate foreground/background layer from crawling bees.
6. Subtle parallax and particles create atmosphere without changing gameplay coordinates.

## Bee animation budget

For the MVP, each visible bee can be extremely cheap:

- body sprite;
- 2-4 wing frames or a tiny procedural wing flap;
- simple walk/fly bob;
- task icon or tiny carried pollen cue when useful;
- occasional idle rotation/turn.

The displayed bee count does not need to equal the numerical colony population. Later, visual population can be capped and sampled while the economy represents thousands or millions of bees.

## Confirmed art style

The target is **stylized illustrated naturalism**: bees should remain recognizably honey-bee-like in anatomy, silhouette and behavior, but the final sprites should be visibly more illustrated and simplified than the current concept-art mockups rather than approaching photorealism.

Priority order:
1. recognizable bee anatomy and believable proportions;
2. readable silhouettes, wings and carried-resource cues;
3. appealing illustrated treatment;
4. stylization only where it improves clarity or animation.

Avoid turning workers into generic round mascots if doing so erases useful biological features. Cute is allowed; biologically anonymous is not the goal.

## Hive-first interface rule

The honeycomb is the main game board, not decorative background. The player should spend most of the time looking at the colony itself.

Panels, counters and temporary interaction areas may appear at the sides/bottom or as contextual overlays, but they should expose actions that correspond to visible activity in the hive. As automation grows, the screen should become *more* about watching the colony and *less* about navigating menus.

## Connected primary views

The first playable may switch between two lightweight 2D presentation scenes while preserving one continuous colony state:

- `HiveView`: honeycomb, brood, storage and visible worker activity;
- `ForageView`: flowers/plants, forage clicking and visible bees collecting resources.

These are different views of the same simulation/economy, not separate runs. Resource counters and automation continue consistently while the player changes view. Later forage zones can reuse the same `ForageView` contract with different plant sets, art, yields and unlock rules.

## Asset strategy

### MVP
Use pure 2D assets made as sprites/shapes. No Blender dependency.

Minimum useful set:
- empty comb cell;
- filled resource variants;
- egg/larva/pupa/capped brood states;
- queen/worker bee sprites;
- wing frames;
- pollen/nectar/honey indicators;
- simple flower panel or field vignette;
- UI icons.

### Later
Blender may be used only if it genuinely helps with:
- pre-rendered sprite bases;
- cinematic/promotional renders;
- consistent high-detail reference turnarounds.

It should never become necessary merely to add a new gameplay upgrade.

## Desired end-state

A late-game screenshot should still read instantly as a honeycomb, but it should feel dramatically busier than the opening screen: dozens of visible bees moving between tasks, wing motion everywhere, cell states changing, stored resources accumulating and local activity making production understandable without reading every number.


