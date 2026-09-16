# MSSR project state

## Current release

MSSR `0.2.62` is the current verified source/package release candidate for MSSR-owned safe Project Context structural maintenance and preventive write-pressure gating. `release:gate` passed `npm run verify` and produced `mauroprime-mssr-0.2.62.tgz` (`695537` bytes, SHA-256 `3373d2c7846db4d5ed9738f9ca13bc3a658f818870ec7738ff2803bb398c872b`, alias `pkg:0.2.62#3373d2c7`); receipt: `.mssr/runtime/releases/0.2.62.json`. Bridge `0.6.125` remains live on its previously packaged MSSR `0.2.61` artifact; no Bridge adoption of `0.2.62` and no public npm-registry publication are claimed.

## Learning dataset state

Strict `learning-digest-v1` collection remains observe-only with `routingInfluence=false`. MSSR `0.2.62` does not change learning influence: dataset-quality audit, replay/calibration and shadow evaluation remain separate, and no learned score is consumed by routing or context selection.

## Core skill package state

The five first-party skill packages remain unchanged. MSSR `0.2.62` changes the portable project-control surface and Context Plane maintenance, not skill routing metadata. Bridge `0.6.125` still consumes packaged MSSR `0.2.61`; source/package adoption of `0.2.62` is a separate deployment step and is not inferred from this repository working tree.

## Context-economy follow-up

Context-economy follow-up now includes the two remaining whole-file history pressure cases. `0.2.62` prevents new writes from silently growing indexed entries into REVIEW and makes safe exact structural relocation executable, but current whole-file histories still require explicit semantic segmentation before MSSR can retrieve smaller fragments without changing meaning.

## Future event-trigger capability handoff

`docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md` remains a separate future design candidate. It is not part of the `0.2.62` Context Plane maintenance contract.
