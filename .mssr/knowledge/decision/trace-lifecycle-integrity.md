# Trace lifecycle integrity decision

`canCloseSuccess` is a prospective pre-outcome gate, not a historical completion flag. While a compatible trace is still open, the outcome obligation becomes `ready` only after every required precondition is complete. Once an accepted outcome checkpoint closes the lifecycle, that same obligation must project as `complete`, `canCloseSuccess` returns false, and `nextRequiredAction` is `none`; a closed trace must never visually regress its persisted outcome to `pending`.

Project/workflow ownership is part of logical trace identity. Portable MSSR owns lifecycle semantics, while host adapters own session/project attribution and recovery. A host must not merge unrelated project/workflow activity into one logical trace or learning digest merely because it shares a session or recent activity; cross-project work requires an explicit new owner trace or bounded related-evidence handoff.
