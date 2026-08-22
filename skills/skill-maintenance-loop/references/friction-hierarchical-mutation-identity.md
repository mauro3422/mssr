# Hierarchical target identity and bounded mutation friction

Read when editing, moving or recovering hierarchical game, asset, UI, model, placement or network objects with protected state.

## Hierarchical target identity and bounded mutation

### Visible content expands scope to the wrong container

A request may identify an object by what is visible on it or where it appears: “the mushrooms”, “the cards under the camera”, “that row beside the platform”. Those clues locate candidates but do not authorize their parent, siblings, support surface, factory, archive, or runtime copies.

Gate:

1. convert the request into exact `targets`, `protected`, `expectedAbsent`, and `unknown` sets;
2. resolve targets by path, class, parent, purpose attributes, identity, bounds and owner;
3. inspect the nearest parent/child/sibling/spatial alternatives explicitly;
4. require `unknown` to be empty before a destructive mutation;
5. never broaden to a common ancestor merely because several visible descendants match.

### Protected list treated as commentary instead of a postcondition

A workflow can remove the requested candidate successfully while silently losing another required root. “Do not touch X” is not enforced until X is fingerprinted at baseline and asserted after every mutation and across relevant runtime/persistence layers.

Gate:

1. make protected entries required invariants with identity and structural fingerprints;
2. fail when a protected entry is missing at baseline, even if the current operation did not cause it;
3. compare the complete protected set after each write, not only at the end;
4. report intended protection separately from observed presence;
5. do not close on candidate absence alone.

### Broad rollback or stale reconstruction used for subtree recovery

Restoring a whole document, scene, database, or place from an older backup can recover one object while overwriting unrelated newer work. Rebuilding from an older generator can also preserve appearance while losing current metadata, children or behavior.

Gate:

1. prefer reparenting the exact archived object;
2. otherwise extract only the exact subtree or record from the matching last-known-good version;
3. compare version, identity, hierarchy, properties, bounds and dependent references before installation;
4. keep the current artifact as authority and apply the smallest recoverable delta;
5. verify no unrelated state changed and preserve a rollback of the current version.

### Auxiliary application becomes an accidental second authority

Opening a backup or comparison artifact in a second editor instance is useful for inspection but creates ambiguous ownership. A tool may inspect one instance and save or mutate another.

Gate:

1. identify every open instance by exact file/project path and role;
2. designate one canonical writable authority;
3. keep auxiliary instances read-only;
4. close auxiliaries before mutation or persistence;
5. verify the target identity again immediately before the write and save.
