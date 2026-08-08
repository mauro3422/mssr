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

## Host metadata plugin

The MCP child process cannot reliably know which OpenCode agent and model
actually selected a tool. Install the companion plugin from
`dist/opencode-plugin.js` in OpenCode's global plugin directory to observe that
host-owned boundary. The plugin uses `chat.message`, `chat.params`, and terminal
`message.part.updated` tool events to deliver `mssr-host-call-v1` envelopes to
the same authenticated endpoint configured for the `mssr` MCP entry.

It records only salted SHA-256 session/message/call/project identifiers,
agent, provider/model, explicit reasoning effort or `unknown`, variant, tool
name, status, timestamps, duration, and an optional MSSR trace. When OpenCode
explicitly publishes a session `parentID` through `session.created` or
`session.updated`, the plugin adds a salted `parentSessionKey`. If a terminal
child-session tool event arrives before that lifecycle event, the plugin may make
one bounded, read-only SDK `GET /session/:id` lookup and uses a parent only when
that exact returned session exposes `parentID`. A missing, failed, or mismatched
response remains absent. It never infers parent/subagent relationships from agent
names, tool order, recency, or sibling sessions. It never sends
prompt text, tool arguments, tool output, raw errors, transcripts, secrets, or
private reasoning.

Delivery is best-effort and never delays an OpenCode hook. If the authenticated
endpoint is temporarily unavailable, the plugin stores only the already
validated, privacy-bounded host-call envelope in a local queue (default:
`%LOCALAPPDATA%\\MauroPrime\\MSSR\\opencode-host-call-queue.json` on Windows).
The queue holds at most 128 entries, retries with bounded exponential backoff,
cleans up delivered/expired entries, and stops after five attempts. Override the
path only for operations/testing with `MSSR_OPENCODE_TELEMETRY_QUEUE_PATH`; do
not point it at a shared or cloud-synced location. Multiple local OpenCode CLI
processes coordinate queue read/modify/write operations through a short-lived
lock; an abandoned lock is recovered after a bounded timeout.

For a source checkout, a minimal global loader can re-export the built plugin:

```js
export { default } from "file:///C:/Dev/mssr/dist/opencode-plugin.js";
```

Official references: <https://opencode.ai/docs/plugins/>,
<https://opencode.ai/docs/models/>, <https://opencode.ai/docs/agents/>, and
<https://opencode.ai/docs/server/>.

### OpenCode global-project limitation

OpenCode CLI 1.18.15 classifies `~/.config/opencode` itself as the special
`global` project. Controlled tests showed that MSSR MCP lifecycle events still
work there, but neither the normal global plugin loader nor an explicit/project
loader emits host-call hooks. The same model, agent, prompt, and `--variant low`
emit host calls normally from a repository workspace. Until OpenCode changes
that behavior, do not use the config directory as the working project when host
call attribution is required; run with `--dir C:\path\to\project` instead.

The config dependency files may also describe different
`@opencode-ai/plugin` versions when npm and Bun locks coexist. The MSSR loader
imports the built plugin directly and has no runtime import from that package,
so version drift is not a demonstrated cause of missing host calls. Reconcile
to one package manager only during a separate dependency upgrade with a CLI
smoke test; do not rewrite locks merely to improve an audit result.

An OpenCode `task` delegation is observable as a terminal tool call in the
parent session. In the tested 1.18.15 CLI, the primary plugin did not receive
the delegated agent's internal tool events or an exposed `parentID`; therefore
the dashboard correctly reports zero observed parent sessions for that run.
The read-only SDK fallback can recover an explicit parent only for a child
session whose terminal tool event reaches this plugin; it cannot invent events
for a delegated agent that OpenCode never delivers to the plugin.
This does not mean no subagent ran—it means the relationship was not exposed to
this plugin boundary.
