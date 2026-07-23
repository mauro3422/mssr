# Registry and autoregistry

The registry is the runtime inventory of capabilities, not a permanent prompt
listing of tools.

## Provider model

Each provider supplies a catalog plus metadata: provider id, source, refresh
time, health, errors, and optional TTL. Initial providers include filesystem
skill roots and host/MCP catalogs. Future providers may include dynamic MCP
servers and project-local skill roots.

Refreshes run concurrently. The registry uses a single-flight refresh per
provider and atomically publishes a new immutable aggregate snapshot. A provider
failure retains its last known-good entries marked stale/degraded; it must not
erase unrelated capabilities.

## What updates automatically

- New or removed runtime tools/skills after a provider refresh.
- Tool descriptions, schemas, availability, and provider health.
- Search indexes derived from the current snapshot.

## What requires a tracked change

- Routing schema, tag semantics, phase semantics, and override rules.
- A durable skill activation rule or dependency.
- Bootstrap instructions, test fixtures, or compatibility policy.

This distinction keeps agents informed without spending context on every tool
name. An agent asks for a catalog/search/inspect only when the active task needs
it.

## Degradation

An empty catalog means that specific provider returned no entries at that time.
It is not evidence that the universe has no tools. Surface provider health and
offer alternate providers, direct paths, refresh, or manual recovery before
concluding a capability is unavailable.

