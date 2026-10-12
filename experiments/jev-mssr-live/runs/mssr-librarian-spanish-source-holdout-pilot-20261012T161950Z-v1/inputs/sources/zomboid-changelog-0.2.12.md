# 0.2.12

Date: 2026-08-26

Status: published and independently verified on Steam Workshop item `3785955820`.

## Scope

Multiplayer lifecycle hotfix plus install-integrity hardening. This release fixes immediate local GPS cleanup when the local player dies or loses the last usable powered watch, and adds diagnostics that make stale/manual/mixed installations easier to identify without changing the normal Steam Workshop install path.

## Multiplayer GPS lifecycle fix

- `SGPS_ClientSession` now treats death and loss of the last usable powered compatible watch as immediate local ineligibility.
- The local tracker projection is cleared immediately instead of waiting for the next server snapshot/stale timeout, while a normal server `disconnect` command is sent so authoritative membership is removed as well.
- Client state lookup now falls back to the concrete `IsoPlayer` object across online-ID/key transitions so lifecycle cleanup cannot strand a connected projection under an obsolete key.
- An in-flight positive server status cannot revive local tracker rendering while the player is dead or has no usable watch.
- Multi-watch behavior is preserved: if another powered compatible watch can take over, eligibility remains valid and the GPS session is not disconnected.

## Install integrity and support tooling

- The runtime now reports `version`, deterministic `build`, expected runtime file count and module-integrity status after the shared bootstrap loads.
- `tools/build_sgps_integrity_manifest.py` fingerprints the exact canonical 45-file payload and records per-file size/SHA-256 independently from `modversion`.
- `tools/sgps_install_doctor.ps1` diagnoses Workshop/manual copies, exact payload mismatches and duplicate installations. Manual discovery is by `mod.info` `id=SmartwatchGPSNetwork`, not only by folder name, so renamed historical ZIP copies can still be found.
- `EJECUTAR_DIAGNOSTICO.bat` generates a bounded support ZIP with install identity plus relevant filtered logs/server-profile lines; it does not collect whole server configuration files.
- Manual/private recovery uses clean staging, verification, whole-folder backup and atomic activation. It refuses to overwrite Steam Workshop managed folders.
- Previously uploaded description GIFs are now validated through the durable `STEAM_PREVIEWS.json` publication record and Steam CDN references; transient `incoming-gifs` files are no longer required after verified upload.

## Backward compatibility

- This remains a forward-compatible update for existing Smartwatch GPS saves/state.
- Legacy pre-managed watch power `raw=1` is still recognized as `legacy-full` and adopted into the current managed battery representation by the existing lifecycle path.
- Existing persistent IDs/legacy meanings are not repurposed. Future persistent-format changes remain required to provide explicit forward migration rather than silently breaking older saves.
- Battery drain semantics, physical battery charge transfer, shared-map semantics, GPS key format and live server-authoritative position ownership are unchanged.
- Multiplayer still requires matching client/server mod payloads; backward save compatibility does not mean mixed mod versions can join the same server.

## Runtime acceptance

- The new watch-loss path was exercised against the isolated Build 42.20.3 single-client synthetic-peer MP harness: before loss the peer was present; after removing the usable watch the client state became disconnected with zero members, the server received `disconnect`, and the user visually confirmed the synthetic GPS teammate disappeared from the map/minimap.
- This focused harness validates the lifecycle/member-projection regression without requiring a second graphical PZ client. Existing two-real-client B42.20.3 evidence remains the broader tracker/MapSync/battery baseline.

## Verification

Pre-publication release gate:

- `python tools/test_device_power.py` -> **108/108 PASS**.
- `python tools/validate.py` -> **473/473 PASS**.
- `python tools/scenario_tests.py` -> **63/63 PASS**, including immediate dead/watchless client teammate cleanup.
- `python tools/verify_b42_power_contract.py` -> **45/45 PASS**.
- `python tools/verify_local_pz.py` -> **51/51 PASS** against installed Build 42.20.3; Workshop scan found **0 foreign critical hook/namespace conflicts**.
- `python tools/test_sgps_install_doctor.py` -> **9/9 PASS**, including renamed legacy-folder discovery by Mod ID, safe diagnostic collection and whole-folder repair/idempotency.
- `python tools/build_sgps_integrity_manifest.py --check` -> **OK**, version `0.2.12`, build `88938e4fe212ab79`, exact **45 files**.
- `python -m compileall -q tools` and `git diff --check` -> PASS.
- Technical ZIP `release/SmartwatchGPSNetwork-B42-v0.2.12.zip` -> exact **45/45**, `testzip/manifest-sync/required/extras` PASS, SHA-256 `5038a08343f283c3ceec8904aedec954d91ec988fb6fc66837be5b5ba18305f1`.
- Recovery-only support ZIP `release/SmartwatchGPSNetwork-v0.2.12-SOPORTE.zip` -> build `88938e4fe212ab79`, exact 45-file source, SHA-256 `44c58cccfb1e4a972d7edc46a377cd4288ee2f99e3b02b5ba3ebb52eb78f4759`.
- Workshop staging regenerated successfully. Payload publication dry-run emitted only `appid`, `publishedfileid`, `contentfolder` and `changenote`; no description/preview/title/tags/visibility mutation was present.
- Native localization dry-run staged English/default (**2727 chars**) and Spanish (**3043 chars**) with `submit=no`; no Workshop mutation was submitted.

## Publication policy

- Canonical payload source: `dist/SmartwatchGPSNetwork`.
- Workshop item: `3785955820`; Mod ID: `SmartwatchGPSNetwork`.
- Payload upload must preserve title, tags, visibility, main preview and additional previews by omission.
- English/default and Spanish descriptions are native Steam localizations and, if updated for v0.2.12, are published separately with `tools/publish_workshop_localizations.ps1` after payload verification.
- Publication closes only after remote metadata readback and a fresh isolated Workshop download match the canonical v0.2.12 payload.

## Publication result

- Git release commit `6d6a2cddb2f17fd0f3e6571be1757730055f0ebb` is published on `origin/main`; local HEAD, tracking ref and direct remote ref were verified identical.
- SteamCMD payload publication completed successfully for item `3785955820`.
- Fresh anonymous SteamCMD download reports `modversion=0.2.12`, exact **45/45** canonical files, missing 0, extra 0 and hash mismatches 0; runtime build is `88938e4fe212ab79`.
- Native English/default description readback is exact at **2727 chars**, SHA-256 `41767CF1EB2EE7D6F5D8A137FA17342A47264E8BD8B3284B0C84D817387A2FE2`.
- Native Spanish description readback is exact at **3043 chars**, SHA-256 `14F8DDDB210138ED7B6CD6F16ACC0F70B8B176D0CF0C13A68633ED75043E89E7`.
- Public metadata preserves title `Smartwatch GPS Network[BUILD 42][WIP]`, public visibility, tags `Build 42|Interface|Map|Multiplayer`, main preview, and all four Steam-hosted description GIF URLs.
- Publication is closed; remaining checks are optional exhaustive runtime coverage or future feature work, not v0.2.12 release blockers.
