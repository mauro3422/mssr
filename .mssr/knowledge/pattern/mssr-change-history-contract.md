## Change-history contract

Every release uses `changelogs/X.Y.Z.md` with explicit PROJECT_CONTEXT/PROJECT_MEMORY/PROJECT_STATE impact. The portable core parses/evaluates this contract; host adapters observe Git/filesystem state. `reviewed-none` is a valid deliberate result, `updated` should correspond to an observed authority change, and `pending` blocks persistence. The evaluator never writes project knowledge automatically.
