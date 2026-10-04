# Run 2 classification addendum

Run 2 reached the Bridge .156 MCP handshake, then terminated during the MSSR bootstrap block before producing a bootstrap receipt. The recorded terminal status is `bootstrap-failed`; the preserved failure envelope reports `failureClass=provider-or-tool-error`, `failureCode=bootstrap-error`, and no reason codes. The runner's catch path did not preserve the underlying MCP tool name or error details, so the exact cause and bridge status are unknown. This is not classified as a lifecycle preflight block.

The candidate process exited normally (exit code 0) after about 5.6 seconds. `providerCalls=0`; no Librarian search, Jev selection, fetch, labels, or target index were accessed. The manifest remains `prepared` and unchanged. Run 3 will diagnose bootstrap via an explicit route plan and bounded sanitized MCP error capture; it will use a fresh run directory.
