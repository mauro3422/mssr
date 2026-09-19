# Trace lifecycle integrity decision

`canCloseSuccess` is prospective. An open compatible trace reports outcome `ready` only after all required preconditions complete. After an accepted outcome closes the trace, outcome projects `complete`, `canCloseSuccess=false`, and `nextRequiredAction=none`; persisted success must never regress to pending.

Project/workflow ownership is logical trace identity. Hosts observe and canonicalize owner evidence; portable MSSR decides compatibility. Unknown fields may bind once, but known owner values never migrate or get erased. A known project/workflow mismatch is incompatible even for an explicit `traceId` and must fail before trace adoption or unrelated Project Context selection. Explicit `traceId` means continuation, not owner authority.

Legitimate cross-project work uses a separately owned/delegated trace or bounded related-project/evidence relation; the relationship never mutates either owner. Canonical path/name equivalence remains host-observed evidence while MSSR keeps the compatibility rule pure.
