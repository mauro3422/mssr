# Canonical project-context cutover

MSSR 0.2.18 removes active project-context fallback to `.bridge/`. A managed repository must be explicitly initialized under `.mssr/`; missing/invalid initialization is observable maintenance evidence rather than permission to guess or load old authorities.

The cutover deliberately discards the obsolete pre-0.2.18 runtime inbox instead of migrating its receipts, because those receipts may preserve stale `.bridge` provenance. Durable legacy authorities are never deleted unless their canonical counterpart already exists; otherwise initialization reports a blocked cleanup requiring explicit review.

Repository initialization is portable MSSR behavior. Hosts such as Bridge, Codex, and OpenCode may expose/invoke it, but they must not fork the initialization, health, topic, or project-home semantics.
