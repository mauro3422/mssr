# Live WidgetForge relation diagnostic

- Run: `mssr-semantic-relation-widgetforge-source-conflict-20261012T1945Z-v1`
- Completed: 2026-10-12T19:48:06Z
- Source: `D:\Dev\WigdetForge\TODO.md`, SHA-256 `45a996f4cde2778f0e49f008a6a9637134395a0f81ca4a879459acc84bef2ad5`, Git HEAD `3270c9a8f9cb9332ad080f941a8504cc20b1242d`.
- Bridge/MSSR: 0.6.175 / 0.2.127; Jev provider/model: `typesafe-jev` / `jev-1.13.0`.
- Calls: 2 local searches, 2 exact fetches, 1 Jev relation review, 1 synthesis preview.
- Jev result: `contradicts`, raw selected-option score `0.95`; input/output usage 1685/71 tokens; 1340 ms.
- The source-derived analyst label matched; it is not owner-verified gold. This is one pair in one exposed historical document, not an accuracy or calibration estimate.
- Deterministic evaluation and synthesis preview both returned `review`; preview says `applyAllowed: false`, `canonicalRewriteAllowed: false`, and requires independent confirmation. The default 0.75 preview threshold is not calibrated.
- No source project was modified, no threshold was tuned, and no raw vendor response or credential was persisted. The local Bridge transport worked for this call; lower-level provider transport invocations were not observable.
