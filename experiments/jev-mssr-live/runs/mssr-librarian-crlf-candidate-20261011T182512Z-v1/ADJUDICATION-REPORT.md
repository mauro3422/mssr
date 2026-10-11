# CRLF candidate smoke — 2026-10-11

MSSR 0.2.126 through the isolated Bridge 0.6.169 adapter selected the frozen
`Target evidence` heading on a synthetic CRLF Markdown file with a Unicode
marker before it. Exact fetch reproduced the selected fingerprint. Choice was
0.92, `evidenceSufficiency` was 0.91, latency was 979 ms, and Jev reported 985
input / 77 output tokens. A blind Luna reviewer judged the exact fetched range
complete and focused.

The linked 0.2.121 control selected the same heading and also passed exact
fetch (Choice/Noul 0.92/0.92). Therefore this short fixture does not distinguish
the fix. The run is a route smoke, not a regression proof, benchmark sample,
owner-gold, reliability estimate, or calibration evidence. See
[`RUN-ERRATUM.md`](RUN-ERRATUM.md) for the inaccurate freeze-time worktree flag.

Production Bridge was not restarted or changed. The candidate tarball was
installed only in `D:\Dev\bridge-mcp-mssr-0.2.112-query-variants` for the call;
the checkout was restored to packaged MSSR 0.2.121 and verified clean.
