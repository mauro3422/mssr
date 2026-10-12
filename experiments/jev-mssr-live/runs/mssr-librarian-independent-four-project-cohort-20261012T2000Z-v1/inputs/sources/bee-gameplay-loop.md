# Gameplay Loop

## Core progression grammar

The game's distinctive structure is not just `click -> buy upgrade -> number grows`.

It is:

`perform task manually -> improve task -> recruit/enable bees -> bees automate task -> new task becomes manual`

The player should periodically stop doing an old action because the colony learned to do it for them.

## Confirmed early-game direction

The opening should begin with a biologically understandable resource chain rather than `click queen = +1 bee`.

### Layer A - Forage from flowers
The first manual action is a simple flower/forage interaction. The player clicks flowers or short-lived forage targets to gather an intentionally simplified floral-food resource.

The shipped terminology should eventually distinguish nectar and pollen correctly, but the first prototype may use one combined resource while the interaction is being tested.

### Layer B - Support brood care
Collected food is routed into a small brood-care panel/area. The player helps sustain developing brood rather than directly purchasing a bee from a shop.

The exact nursing/feeding abstraction must be researched before final educational copy, but the causal idea is fixed: colony food enables brood development.

### Layer C - First worker emerges
Brood progress produces the first worker bee. That bee becomes the player's first visible automation reward and begins taking over part of the forage/support loop.

This is the first important emotional beat: something the player had to do manually is now visibly being done by an actual bee.

### Layer D - Expand usable comb
Once the first worker loop feels good, the next manual layer can involve opening/building usable hex cells for brood or storage.

### Layer E - Process/store and specialize
Later layers introduce more accurate handling of pollen, nectar/honey, brood states and task specialization. Each new layer should appear only after the previous one has started automating.

## Click variety rule

Different click phases should not be cosmetic reskins of the exact same large button.

Candidate interaction families:
- repeated click;
- clicking specific cells;
- short hold/charge;
- choosing among several panels;
- timed burst window;
- clicking appearing targets such as flowers/resources;
- allocating a small amount of a resource before automation takes over.

The game should avoid high-precision or stressful minigames. It remains an incremental game first.

## Automation as reward

Automation has three simultaneous rewards:

1. **economic** - production continues without clicking;
2. **cognitive** - the player no longer babysits an old task;
3. **visual** - bees appear and visibly perform the work.

That third reward is essential to the project's identity.

## Representative simulation

Economy and visuals do not need one-to-one agents.

Example:
- economy: 12,400 worker bees;
- visible hive: 35 representative bee sprites;
- scheduler assigns those sprites to visible activities according to current production ratios.

This lets late game look alive without simulating 12,400 navigation agents.

## Prestige hypothesis: swarming

At colony maturity, the player can initiate a swarm/founding event.

Potential structure:
- build enough colony strength;
- prepare/raise a queen;
- choose to swarm;
- restart with a tiny colony;
- retain a persistent meta resource/trait system;
- early layers automate much sooner on subsequent runs.

The permanent progression should be biologically inspired but must not claim false genetics. Exact wording waits for research.

## First prototype economy

Keep intentionally crude:

- one simplified floral-food resource from clicking flowers/forage targets;
- brood progress consumes/uses that resource;
- the first worker emerges at a brood threshold instead of being bought directly;
- that worker contributes passive production/automation;
- one click-efficiency upgrade;
- one worker-efficiency upgrade;
- one unlock threshold revealing the next manual layer.

Numbers can be retuned later. The first question is whether the transition from manual action to visible worker automation feels good.
