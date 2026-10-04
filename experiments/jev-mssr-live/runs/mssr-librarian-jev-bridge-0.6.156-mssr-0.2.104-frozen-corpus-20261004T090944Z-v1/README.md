# Bridge MCP Jev benchmark — frozen corpus v1

## Status and gate

This run directory is reserved for a fresh live Jev Librarian benchmark using
the isolated Bridge candidate, with the exact 21-document corpus frozen from
MSSR commit `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. The project snapshot is
materialized under `project/`; frozen inputs and a path/hash inventory are under
`inputs/`. Existing run directories are not read for output and are never
modified.

This is an **exploratory build regression / paired comparison**, not a
confirmatory evaluation or threshold trial. The 52 language-specific requests
are paired within 26 concepts; report the concept count as 26 and do not pool
reruns or individual provider calls as independent observations. Do not tune a
confidence or sufficiency threshold from this run. A future calibration claim
requires a new, document-grouped holdout with owner-adjudicated acceptable
evidence ranges, independent labels and abstention judgments, and complete
per-option probability vectors; the same 21 documents and existing concepts do
not supply that validation.

**Provider gate: coordinator-confirmed.** `runner.mjs` defaults to an offline preflight. It
will not start an MCP server or call Jev unless invoked with `--live` and the
exact confirmation value below, after the coordinator confirms that the
candidate build, package hash, and regression gates are final:

```text
0.6.156:0.2.104:714e9d0997e4bc92c2981e1aeb3e5b8a98beef91efc04f82e92d001748a7e4ca
```

The coordinator has confirmed the final candidate package and regression gates
for this run. Live execution is authorized once the final offline preflight
passes. Label access remains outside the live phase.

## Frozen source and inputs

- `inputs/cases.json`: 26 concepts, with English and Spanish query text (52
  requests); no expected answers.
- `inputs/corpus.json`: original frozen corpus payload and metadata.
- `inputs/source-inventory.json`: SHA-256 and byte length for each source.
- `inputs/staged-project-identity.json`: isolated staging Git commit and
  canonical project-context manifest hash.
- `project/`: a minimal isolated Git project containing only the frozen
  `.mssr/project-context.json` and the 21 explicit Markdown refs.

Every staged document is checked byte-for-byte against both the frozen corpus
payload and its Git blob at the source commit before any live operation.

## Execution protocol after approval

1. Run `node runner.mjs --preflight` with Node.js 20 or newer. Preflight checks
   only frozen inputs, staged project bytes/Git identity, candidate artifact
   versions/hashes, and the static MCP probability-vector contract. It does
   not connect to Bridge and does not read labels.
2. After the coordinator confirms the final candidate and opens the gate, run:

   ```powershell
   node .\runner.mjs --live --confirmation 0.6.156:0.2.104:714e9d0997e4bc92c2981e1aeb3e5b8a98beef91efc04f82e92d001748a7e4ca
   ```

   The runner launches `dist/index.js` directly from
   `D:\Dev\bridge-mcp-jev-mssr-0.2.103` over MCP stdio. It never contacts or
   restarts the active Bridge `.153` HTTP service. It uses Windows Credential
   Manager target `TypeSafe:MSSR:JevLab`; it removes inherited
   `TYPESAFE_API_KEY` from the child environment.
3. For each case/language pair, call deterministic
   `mssr_librarian_search` over the 21 explicit refs (maximum 100 results),
   then `mssr_librarian_jev_select` with those exact handles and model
   `jev-1.13.0`, then `mssr_librarian_fetch` for a non-abstaining selection.
   Calls are sequential. No labels, target mapping, expected answer, or scoring
   code is loaded by the runner.
4. The live runner persists normalized records only: candidate-ID-to-handle
   mapping, all `choiceCalls` and complete per-option probabilities, IDs/counts,
   provider/model, usage, latency, request fingerprints, and exact-fetch
   fingerprint/revision/character count. It does not persist fetched text,
   snippets, raw provider bodies, credentials, or free-form provider errors.
   Missing/incomplete vectors are recorded as missing; probabilities are never
   reconstructed or imputed.
5. Outputs are opened with exclusive file creation. This run is single-use; an
   interrupted or partial run must be preserved and a new timestamped run
   directory created for any retry.

After all 52 live records and exact-fetch checks are durably frozen and
checksummed, offline strict-target scoring is authorized as a separate process.
It must include failures and abstentions in the request denominator, remain
exploratory, and must not tune thresholds or claim calibration. This runner
does not implement or invoke scoring and never reads label files.

## Commands

Offline-only preparation check:

```powershell
node .\runner.mjs --preflight
```

The live command above is intentionally gated and must remain unused until the
coordinator confirms the final candidate regression gates.
