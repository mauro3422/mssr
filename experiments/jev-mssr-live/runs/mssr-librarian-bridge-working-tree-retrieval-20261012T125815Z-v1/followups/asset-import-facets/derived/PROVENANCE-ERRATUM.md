# Provenance erratum — discarded shell-roundtrip follow-up

Append-only record. These search, Jev, fetch and pack outputs are retained for audit but excluded from all scored results.

- Intended frozen source: `../../inputs/sources/ASSET_FILE_INGEST.md`, 5,221 bytes, 40 lines, SHA-256 `8e2478f18ce30c41a8d2352189079053676253f48da7446e79e8e1430e42ad48`.
- The source was read through PowerShell stdout and passed into the tool request from the captured command output. That round-trip added a trailing LF: the Librarian derived a 5,167-code-unit / 41-line document revision `707fb9a59d40a85bf4a3c5a474214ddbd879f06bd979749ba16af60babd3dbdd`, which did not match the frozen source SHA/revision.
- Jev selections and exact fetches were internally consistent against the modified text, but not against the frozen source. Therefore all six Jev calls in this directory (three broad-pool and three block-only) are invalid for the frozen experiment. Their raw outputs remain unchanged.
- The same attempt's diagnostic target for `DOWNLOAD-METADATA` also named L10 instead of the actual L8. See `LABEL-ERRATUM.md`.
- The corrective `../asset-import-facets-exact-v2/` follow-up read the frozen snapshot via Bridge `read_text_file`, verified exact file SHA and 40-line revision before provider calls, and revalidated Jev, fetch and pack against the frozen revision.

The invalid attempt caused no edits to Bridge source or runtime.
