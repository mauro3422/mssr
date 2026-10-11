# Linked CRLF baseline control — 2026-10-11

This is a repeated call against the same synthetic source and query as the
candidate smoke, using isolated Bridge 0.6.169 with packaged MSSR 0.2.121. Jev
selected `Target evidence`; exact fetch/fingerprint passed. Choice and Noul were
both 0.92, with 989 input / 77 output tokens. The source/query had already been
exposed to Jev in the parent run, so this is a linked control, not an independent
or unseen case.

This short fixture did not reproduce the heading-offset regression: the
candidate and baseline produced the same selected heading, offsets, fingerprint,
and fetched text. No production runtime changed. See the parent run's
[`RUN-ERRATUM.md`](../mssr-librarian-crlf-candidate-20261011T182512Z-v1/RUN-ERRATUM.md).
