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
      "command": ["node", "C:\\path\\to\\mssr\\dist\\mcp-server.js"],
      "enabled": true,
      "environment": {
        "MSSR_MCP_PROVIDERS_PATH": "C:\\path\\to\\providers.json"
      },
      "timeout": 120000
    }
  }
}
```

Use the portable tools such as `mssr_route_plan`,
`mssr_registry_status`, `mssr_capability_search`, and
`mssr_capability_inspect`. OpenCode is represented by `caller="other"`; the
Codex-only stateful entrypoint is not required. Project and global `AGENTS.md`
files should tell OpenCode when to route, re-plan, and load selected skill files
through its own file tools.

Run `opencode mcp list` to verify the connection. External provider health is
visible through `mssr_registry_status`; a catalog entry remains planning
metadata and never grants permission to execute its tool.
