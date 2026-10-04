# Bridge MCP Jev benchmark — frozen corpus v2

## Status and gate

This run directory is reserved for a fresh live Jev Librarian benchmark using
the isolated Bridge candidate, with the exact 21-document corpus frozen from
MSSR commit `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. Frozen inputs and
separate query-corpus/control-support inventories are under `inputs/`. The
Git-backed MCP project root and separate Git metadata live outside this
benchmark repository; `staged-project-identity.json` records both paths and
the exact source/snapshot revisions. Control-support files satisfy bootstrap
project rules but are not added to the 21 `sourceRefs` sent to search or Jev.
Existing run directories are never modified.

This is an **exploratory build regression / paired comparison**, not a
confirmatory evaluation or threshold trial. The 52 language-specific requests
are paired within 26 concepts; report the concept count as 26 and do not pool
reruns or individual provider calls as independent observations. Do not tune a
confidence or sufficiency threshold from this run. A future calibration claim
requires a new, document-grouped holdout with owner-adjudicated acceptable
evidence ranges, independent labels and abstention judgments, and complete
per-option probability vectors; the same 21 documents and existing concepts do
not supply that validation.

**Provider gate: coordinator-confirmed, with a final receipt review.**
`runner.mjs` defaults to an offline preflight. The live mode launches the
isolated MCP process, completes MSSR bootstrap, writes a bounded receipt, and
waits for `START_JEV` on stdin before the first provider request. The exact
candidate confirmation is:

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
- `inputs/control-support-inventory.json`: exact `AGENTS.md`, `.mssr/PROJECT_*`,
  manifest/segments, and manifest-declared project modules from the source
  commit; refs also present in the query corpus remain in the 21-document
  inventory only.
- `inputs/staged-project-identity.json`: source and snapshot commits, separate
  external project/Git paths, manifest hash, and both corpus/support counts.

Every staged document is checked byte-for-byte against both the frozen corpus
payload and its Git blob at the source commit before any live operation.

## Execution protocol after approval

1. Run `node runner.mjs --preflight` with Node.js 20 or newer. Preflight checks
   only frozen inputs, staged project bytes/Git identity, candidate artifact
   versions/hashes, and the static MCP probability-vector contract. It does
   not connect to Bridge and does not read labels.
2. Start the same MCP session through bootstrap and pause before Jev:

   ```powershell
   node .\runner.mjs --live --pause-after-bootstrap --confirmation 0.6.156:0.2.104:714e9d0997e4bc92c2981e1aeb3e5b8a98beef91efc04f82e92d001748a7e4ca
   ```

   The runner launches `dist/index.js` directly from
   `D:\Dev\bridge-mcp-jev-mssr-0.2.103` over MCP stdio. It never contacts or
   restarts the active Bridge `.153` HTTP service. It uses Windows Credential
   Manager target `TypeSafe:MSSR:JevLab`; it removes inherited
   `TYPESAFE_API_KEY` from the child environment. Review `manifest.json`,
   `preflight.json`, and `bootstrap-receipt.json` plus their hashes before
   writing `START_JEV` to that same process stdin. The manifest is immutable
   and remains `prepared`; `run-completion.json` records terminal state.
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
5. Bootstrap failures retain a bounded sanitized status/reason-code receipt and
   do not invoke the Jev selector. Outputs are opened with exclusive file
   creation. This run is single-use; an
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
