# Human-task identity decision

Human-task identity is a correlation layer above trace ownership. `taskKey` is explicit host evidence, never derived from task prose, `workflowKey`, similarity, recency, or inactivity. Optional `parentTraceId` and `supersedesTraceId` preserve lineage inside a task; they do not close, cancel, replace, validate, or mutate another trace.

Task identity is additive and immutable per trace. Unknown fields may bind once; known task, parent, or supersedes values never migrate. Relation fields require `taskKey`; a trace cannot parent or supersede itself, and parent/superseded refs must differ. Referenced traces may exist only in persisted or cross-process history.

Hosts may group retries, delegated children, parallel agents, or resumed conversations by explicit `taskKey` while retaining trace ids and provenance. Lifecycle/outcome evidence remains completion authority. Dashboard task status is projection-only unless an authorized owner records it.
