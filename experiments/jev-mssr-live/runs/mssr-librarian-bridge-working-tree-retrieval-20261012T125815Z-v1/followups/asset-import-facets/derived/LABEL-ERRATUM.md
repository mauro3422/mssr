# Label erratum — asset import facets

Append-only correction; frozen follow-up inputs and provider outputs are unchanged. The diagnostic target file was not sent to Jev.

- Case: `DOWNLOAD-METADATA`.
- `inputs/diagnostic-targets.json` incorrectly records expected line 10. In the frozen `ASSET_FILE_INGEST.md` snapshot, download metadata (SHA-256, length, detected MIME and provenance) is on L8. L10 is the target-path contract.
- Correct analyst-only target: L8. Exact fetch of the selected block confirms the metadata statement. Do not rewrite the frozen target file or the pre-call hashes.
- The other diagnostic targets remain L10 for path rules and L12 for file/batch limits.
- No target labels were included in any Jev request.
