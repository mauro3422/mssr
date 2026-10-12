# Live Bridge parity verification erratum

The original `live-bridge-runtime-parity.json` is preserved byte-for-byte as the raw MCP response record. Its first derived `checks.fetchOk=false` values came from applying the local adapter runner's fetch envelope (`status`, `passed`, `returnedFingerprint`) to the live Bridge fetch response. The Bridge contract returns `projectOwner`, the full selected `handle`, exact `text`, `fingerprint`, `advisoryOnly`, and `truthAuthority`; it does not include those adapter-only status fields.

Revalidation uses fields actually returned by live Bridge: selected/fetched handle identity, source, revision and range; fetch fingerprint equality; exact fetched-text equality with the provider-off pack paragraph; matching citation handle/fingerprint; and advisory/no-authority flags. All three cases pass. See `live-bridge-runtime-parity-verification.json`.

This correction is about the verifier's expected schema, not a Jev, fetch, Bridge or evidence-pack failure.