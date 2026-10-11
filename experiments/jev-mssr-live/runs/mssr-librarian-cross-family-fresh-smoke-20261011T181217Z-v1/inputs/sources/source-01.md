# Activation across hosts

Read when integrating Codex, ChatGPT Web, Bridge, or a caller profile.

The caller produces `domains`, `actions`, `artifacts`, `needs`, `signals`,
`risk`, and `ambiguity`; MSSR then applies deterministic routing. Use `nominal`
only for clean work. Signals may select discovery/recovery/maintenance but never
authorize execution.

Codex discovers local skills natively. ChatGPT Web must call `skill_route_plan`
or `skill_bootstrap`, load only the current phase, and re-plan at verify,
persist, and close. Bridge rescans the runtime tree on these calls; it is not a
background watcher. Use `caller=codex-local` or `chatgpt-web` when known.
`skill_route_plan` inspects a route; bootstrap is for actually applying context.
