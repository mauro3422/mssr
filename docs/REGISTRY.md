# Registry and autoregistry

The registry is the runtime inventory of capabilities, not a permanent prompt
listing of tools.

## Provider model

Each provider supplies a catalog plus metadata: provider id, source, refresh
time, health, errors, and optional TTL. Initial providers include filesystem
skill roots and host/MCP catalogs. Providers may include dynamic MCP servers and
project-local skill roots.

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

## Dynamic MCP tool catalogs

`McpToolsProvider` connects to an operator-configured MCP client and discovers
only `tools/list` metadata: a tool's name, description and input schema become
immutable `Capability` entries with explicit `providerId`, `source` and optional
`location`. It accepts `tools/list_changed` through the MCP SDK and asks the
registry for an isolated refresh of that provider.

The provider never exports `callTool` and MSSR never proxies tool execution.
The host that owns authorization and the selected MCP connection remains solely
responsible for invoking a tool. If refresh or connection fails, the registry
keeps the provider's last known-good entries, marks its health degraded and
labels the cached data as planning evidence rather than live availability.

Use `createStdioMcpClientFactory` only with local, operator-provided stdio
parameters. Runtime catalog metadata cannot register a command or cause MSSR to
launch an arbitrary process.

## Operator provider file

The standalone stdio entrypoints load optional external providers from the JSON
file named by `MSSR_MCP_PROVIDERS_PATH`. The file is operator-owned and versioned:

```json
{
  "schemaVersion": 1,
  "providers": [
    {
      "id": "local-tools",
      "transport": "stdio",
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\path\\to\\server.js"],
      "cwd": "C:\\path\\to",
      "source": "mcp:local-tools"
    }
  ]
}
```

Only local stdio is accepted. Unknown fields and invalid provider identifiers
are rejected. The configuration starts metadata connections for `tools/list`;
it does not give MSSR a tool-call surface or change host permissions.
