# Electronics Modular System

Last updated: 2026-08-08

## Purpose

Define the reusable internal-electronics asset architecture for Electronics Repair Simulator without coupling component geometry to gameplay code or to one specific device shell.

Current source foundation and promoted assemblies:

```text
electronics_modular_library_v001_B001     : model-review
multimeter_internal_core_v001_B001         : model-review
soldering_iron_serviceable_v001_B001       : isolated-game-ready
multimeter_serviceable_v001_B002            : isolated-game-ready
bench_multimeter_serviceable_v001_B003      : isolated-game-ready
service_flashlight_v001_B002                : isolated-game-ready
```

The library and multimeter core remain reusable modeling sources. The four concrete serviceable assemblies have deterministic GLBs, isolated Godot wrappers, simple selection collisions, stable service anchors, canonical external A4/A3/F001 instances where applicable, and passing Godot 4.7.1 validation. Historical approved exteriors were not overwritten.

No reference images were generated for either pass; dashboard evidence is rendered from the actual Blender assembled/exploded sources.

## Layer model

Use three explicit layers instead of building every device as one monolithic mesh.

### Layer 1 — atomic component

Small reusable pieces with their own stable local interface:

- PCB carriers;
- processors / IC packages;
- resistors, capacitors, diodes and transistors;
- fuses and regulators;
- switches and potentiometers;
- headers, wire connectors, terminal blocks and test jacks;
- buzzers, LEDs and inductors;
- existing reusable fasteners, battery cells and battery contacts.

Atomic components should remain independent from the device shell and should normally be instanced at scale `1,1,1`.

### Layer 2 — functional module

A bounded assembly that combines atomic components for one purpose, for example:

- mainboard;
- display daughterboard;
- power/input board;
- LED board;
- driver board;
- selector/contact module;
- connector board.

A module owns the placement of its atomics, but those atomics retain source lineage and detachable identities when the repair loop may expose them.

### Layer 3 — serviceable assembly

The device-specific interior and shell contract:

- covers;
- screw interfaces;
- PCB/module mount points;
- battery cradle/contact placement;
- cable routing;
- optical/mechanical interfaces;
- removal order.

The serviceable assembly decides which reusable pieces are instantiated and which device-specific geometry must be derived or created.

## Mandatory metadata contract

Every new reusable component or serviceable part should preserve, as applicable:

```text
asset_id
source_revision
stage
asset_role
family_id
variant_id
detachable
reusable
source_lineage / prototype_instance_of
units
gameplay_logic = false
```

Device/module manifests should additionally record:

```text
required external instances
instance | derive | create decision
stable anchors
coordinate contract
service/disassembly order
dimensions / envelopes
validation result
reference policy
```

Geometry metadata describes interfaces. It must not claim electrical simulation, real component ratings, manufacturing tolerances or brand-specific behavior unless a later gameplay/system layer explicitly owns those facts.

## Coordinate and transform contract

Canonical atomic-component convention:

```text
1 Blender unit = 1 meter
root scale = 1,1,1
mount plane = local Z=0
mount normal = +Z
component origin = functional center or mount center
```

Serviceable assemblies may use another explicit axis contract, but must store it in their dimensions/part contract instead of relying on visual inference.

Do not solve incompatible interfaces by arbitrary non-uniform scaling. If connector spacing, mount topology, screw interface or functional proportions change, use `derive` or `create`.

## Standard anchor vocabulary

Use the smallest relevant subset:

```text
ComponentOrigin
MountPlaneAnchor
TopSideAnchor
MountHoleAnchor_*
Pin1Anchor
PinAnchor_*
LeadAnchor_*
MatingAnchor
SolderAnchor
WireEntryAnchor_*
ActuationAnchor
ActuationAxis
ShaftAxisAnchor
OpticalAxisAnchor
TerminalAnchor_*
BatteryCellMountAnchor_*
PositiveContactMountAnchor_*
NegativeContactMountAnchor_*
RearCoverScrewAnchor_*
ServiceCoverAnchor
GripAnchor
DriverPcbMountAnchor
LedPcbMountAnchor
```

Anchors are the reusable interface. Mesh centroids are not a substitute for a declared mount, mating, optical, tool or service axis.

## Current canonical component matrix

Machine-readable authority:

```text
assets/components/electronics_modular_library/electronics_modular_library_v001/catalog.json
```

Current B001 contains 34 variants across 19 families.

### PCB carriers

| Variant | Envelope | Intended use |
|---|---:|---|
| `pcb_mainboard_micro_30x22` | 30 × 22 × 1.6 mm | tiny daughterboards / compact devices |
| `pcb_mainboard_small_45x30` | 45 × 30 × 1.6 mm | small control/power boards |
| `pcb_mainboard_medium_80x50` | 80 × 50 × 1.6 mm | handheld devices / meters |
| `pcb_mainboard_large_120x80` | 120 × 80 × 1.6 mm | larger appliances / controllers |
| `pcb_round_led_20` | Ø20 × 1.6 mm | LED emitter board |
| `pcb_round_driver_32` | Ø32 × 1.6 mm | flashlight / compact driver board |

These are generic carriers, not manufacturing CAD. A device whose outline, connector placement or mount pattern materially differs should derive a device-specific board rather than stretch a canonical carrier.

### IC / processor package families

```text
ic_dip8
ic_dip16
ic_soic8
processor_qfp32
processor_qfn32
```

These are generic package representations. `processor_*` means a processor/MCU-shaped package for repair visualization; it does not imply a real CPU model, instruction set or electrical specification.

### Passives / power / protection

```text
resistor_axial_8mm
diode_axial_6p5mm
capacitor_electrolytic_6x11
capacitor_electrolytic_8x12
smd_resistor_1206
smd_capacitor_1206
transistor_to92
regulator_to220
fuse_cartridge_5x20
inductor_radial_9mm
```

### Controls / connectors / transducers

```text
switch_tactile_6mm
switch_slide_mini
potentiometer_rotary_12mm
pin_header_2p
pin_header_4p
pin_header_6p
wire_header_2p
wire_header_3p
terminal_block_2p
banana_jack_4mm
piezo_buzzer_12mm
led_throughhole_5mm
led_high_power_5mm
```

## Existing assets reused by contract

### F001 micro screw family

Default decision: `instance` when the verified drive, envelope and mount contract match.

For the new meter cores and flashlight, rear service covers reserve anchors for the existing M2×4 low-profile Phillips variant rather than embedding duplicate screw geometry.

Important: the portable radio has its own already-verified B002 slotted derivative. This modular system does not rewrite that radio-specific contract.

### A4 battery cell

Default decision: `instance`.

The meter cores and flashlight reserve exact 52 × 17 mm cell envelopes and cell-mount anchors rather than copying the A4 mesh into each canonical source.

### A3 battery contacts

Default decision: `instance`.

Positive/negative contact mount anchors are reserved so the existing healthy/corroded/cleaned state family can be reused.

### A8 radio PCB / speaker

- radio PCB: `derive` only when its coarse visual vocabulary helps; the current A8 board is device-specific and its components are monolithic;
- large radio speaker: do not non-uniformly scale into tiny devices; use the smaller transducer family or create a compatible speaker variant.

## `instance | derive | create`

Use `instance` when all relevant interfaces match:

- physical envelope;
- mount plane/origin;
- connector/tool interface;
- anchors;
- state contract;
- scale `1,1,1`.

Use `derive` when the family is correct but the device needs meaningful dimension/topology/interface changes. Preserve lineage and stable gameplay-facing identity when replacing an integrated bespoke part.

Use `create` only when no validated candidate has a compatible role/interface.

## Multimeter serviceability

The historical approved multimeter exteriors remain untouched. `multimeter_internal_core_v001_B001` stays as reusable source infrastructure, while two derived service shells now expose those cores without rewriting the approved revisions:

```text
multimeter_serviceable_v001_B002
  core: compact_075x145
  source lineage: multimeter_v001_B001

bench_multimeter_serviceable_v001_B003
  core: toolkit_085x170
  source lineage: bench_toolkit_v001_B002 / bench multimeter
```

Both serviceable derivatives provide a detachable front faceplate, rear service cover, battery door, main PCB, display daughterboard, processor/IC pieces, passives, fuse, piezo buzzer, selector rotor/pads and test-jack backs. The assembled faceplate hides the PCB correctly; the exploded review exposes the internal stack without requiring a fake open-front meter.

Service order:

1. remove four F001 rear-cover fasteners;
2. remove the rear service cover;
3. remove the battery door;
4. remove the two A4 cells and inspect/remove A3 contacts;
5. remove the main PCB;
6. remove the front faceplate only when servicing display/selector/jacks;
7. remove the display board, selector and test-jack pieces.

The runtime wrappers instance two canonical A4 cells, four A3 contacts and four F001 fasteners at unit scale. The B001 guide proxies had placed their long battery-guide dimension on Z; the promoted derivatives explicitly correct the actual A4 long axis to canonical `+X` without rewriting B001 history. Both Godot 4.7.1 validators pass with zero errors/warnings, zero scripts and no shared-scene integration.

## Soldering iron serviceability

The approved soldering-kit source remains intact. A new serviceable derivative was created from its soldering-iron exterior:

```text
blender/workfiles/tools/soldering_iron_serviceable/soldering_iron_serviceable_v001_B001.blend
```

The assembly separates two shell halves, rear cap, strain relief, terminal block, live/neutral internal wires, ceramic heater, heater coil, front collar, outer sleeve, replaceable tip and power cable. Four F001 low-profile Phillips fasteners are canonical runtime instances rather than duplicated screw meshes.

Service order:

1. remove four F001 shell fasteners;
2. separate the two shell halves;
3. remove rear cap/strain relief and free the power cable;
4. disconnect terminal block and two internal wires;
5. remove the ceramic heater and heater coil;
6. remove front collar/outer sleeve;
7. remove the replaceable tip.

No power switch was invented because the established exterior did not define one. Heat, mains behavior and electrical simulation remain outside the geometry asset. The isolated Godot wrapper validates with 24 imported meshes, four canonical external fastener instances, one simple selection collision, root scale `1,1,1`, zero scripts and zero errors/warnings.

## Service flashlight

Promoted source:

```text
blender/workfiles/tools/service_flashlight/service_flashlight_v001_B002.blend
```

Target envelope remains approximately `108 × 46 × 30 mm`, optical direction `+X`, with a removable rear service cover. B002 preserves the B001 shell/interior concept while replacing review-only battery assumptions with canonical A4/A3/F001 runtime-instance contracts and the corrected A4 `+X` long axis.

Service order:

1. remove four F001 rear-cover fasteners;
2. remove the rear service cover;
3. remove two A4 cells and inspect/remove A3 contacts;
4. release the battery cradle when deeper access is required;
5. disconnect the three separate wire runs;
6. remove the driver PCB / switch module;
7. remove head bezel and lens;
8. remove reflector, LED PCB and LED emitter.

The flashlight contains geometry/interfaces only. Light emission, battery drain, faults and electrical behavior belong to later gameplay/simulation systems. Its isolated Godot wrapper passes with 19 imported meshes, ten canonical external instances, one simple selection collision, root scale `1,1,1`, zero scripts and zero errors/warnings.

## Scaling toward future devices

For radios, phones, controllers, small appliances and generic electronics, compose from the existing atomic families first.

For PC-class or denser electronics, do not stretch the current 120 × 80 mm board and call it a motherboard. Add new device-class families only when a concrete device requires them, for example:

```text
motherboard carrier families
CPU socket / heatsink interfaces
RAM / SO-DIMM modules
BGA packages
FPC / ribbon connectors
USB / HDMI / power connectors
M.2 / storage modules
VRM / choke families
shield cans
fans / thermal modules
phone battery / pouch-cell interfaces
camera / speaker / vibration modules
```

Those should reuse the same metadata, local-origin, anchor and lineage rules.

## Export / promotion policy

The current library is intentionally a modeling source, so multiple variants overlap at their own local origin.

Do not export the whole library as one runtime GLB.

When a component is promoted:

1. select/link the required canonical variant only;
2. verify scale, pivots/anchors, names and detachable identity;
3. create deterministic GLB output if the asset needs runtime geometry;
4. create an isolated Godot wrapper/collision contract when required;
5. validate before promoting to `game-ready`;
6. integrate into shared scenes only with explicit coordination.

## Current status

```text
electronics_modular_library_v001_B001     : model-review
multimeter_internal_core_v001_B001         : model-review
soldering_iron_serviceable_v001_B001       : isolated-game-ready
multimeter_serviceable_v001_B002            : isolated-game-ready
bench_multimeter_serviceable_v001_B003      : isolated-game-ready
service_flashlight_v001_B002                : isolated-game-ready
```

Dashboard authority for the promoted assemblies is `assets/serviceable_electronics_dashboard_index.json`; each entry points to real Blender assembled/exploded renders and its `completion.json`. No reference images were generated. No gameplay files or shared Godot scenes were modified by the serviceable-device promotion.
