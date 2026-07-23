# Changelog

All notable changes to MSSR are documented here.

## 0.1.0 — 2026-07-23

- Established MSSR as an independent Git repository and routing contract.
- Defined the advisory core, immutable multi-provider registry, and optional
  MCP facade boundaries.
- Added the transversal agent protocol and managed `AGENTS.md` bootstrap.
- Documented auto-registry behavior, capability chaining, re-planning, and the
  separation between routing recommendations and host permissions.
- Preserved a Bridge-compatible integration path while making Bridge a consumer
  rather than the canonical owner.
- Added deterministic routing signals for capability discovery, provider
  refresh, tool chaining, and re-planning.
- Restricted Roblox MCP incident recovery to the Roblox domain so generic MSSR
  recovery and tool-chain work cannot open a Roblox-only branch.
- Added filesystem/plugin skill discovery through junctions, concurrent
  single-flight provider refresh, immutable snapshots, and degraded cached
  capability semantics.
- Added five standalone MCP tools plus core, registry, MCP-handshake, junction,
  fixture, and routing-audit regressions.
- Recorded and recovered MSSR-008, where unsafe cleanup of a temporary
  `file:`-dependency junction traversed into the canonical repository.
