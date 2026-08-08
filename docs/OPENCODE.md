# OpenCode CLI

OpenCode can use the portable MSSR stdio facade directly. MSSR remains an
advisory metadata and routing service; OpenCode keeps ownership of file edits,
shell commands, MCP calls, permissions, and execution.

For OpenCode 1.x, add a local MCP entry to
`~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "mssr": {
      "type": "local",
      "command": ["node", "C:\\path\\to\\mssr\\dist\\opencode-mcp-server.js"],
      "enabled": true,
      "environment": {
        "MSSR_MCP_PROVIDERS_PATH": "C:\\path\\to\\providers.json",
        "MSSR_TELEMETRY_ENDPOINT": "http://127.0.0.1:3001/api/mssr/events",
        "MSSR_TELEMETRY_TOKEN_FILE": "C:\\path\\to\\bridge-mcp\\data\\mssr-ingest.token"
      },
      "timeout": 120000
    }
  }
}
```

Use `mssr_skill_bootstrap` when applying a route, `mssr_route_plan` for
inspection, and `mssr_trace_record` for explicit verification, persistence and
outcome checkpoints. The adapter identifies the surface as
`caller="opencode-local"` and can deliver privacy-bounded events to an optional
authenticated telemetry endpoint. It never records success or acceptance from
idle time, process exit, or an omitted checkpoint.

`mssr_registry_status`, `mssr_capability_search`, and
`mssr_capability_inspect` remain metadata-only. Project and global `AGENTS.md`
files tell OpenCode when to route and re-plan; OpenCode retains execution and
permission ownership.

Run `opencode mcp list` to verify the connection. External provider health is
visible through `mssr_registry_status`; a catalog entry remains planning
metadata and never grants permission to execute its tool.
