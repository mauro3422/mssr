# Review correction — v9 catalog gate

The v9 terminal failure was caused by the runner, not by a candidate capability
gap. The runner incorrectly added `mssr_route_plan` to its required MCP catalog
and then called it. Bridge .156 exposes `skill_route_plan`; its public response
provides the project-context route data needed here. Therefore
`candidate-catalog-blocked` is too broad as an interpretation: the exact event
was a runner catalog assertion error for an unsupported tool name. No route or
bootstrap request ran, so v9 provides no project-context or Jev-loading result.

The original v9 failure receipt and addendum remain unchanged as the initial
attempt record. This correction supersedes only the addendum's inference that
the candidate lacked an otherwise available context capability.
