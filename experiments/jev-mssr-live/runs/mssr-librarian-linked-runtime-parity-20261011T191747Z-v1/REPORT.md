# Post-hoc linked production/candidate parity diagnostic

## Setup

This follow-up reused the exact source snapshot, source hash, question, expected heading, and labels from the previously exposed run [`mssr-librarian-parent-child-real-linked-20261011T190000Z-v1`](../mssr-librarian-parent-child-real-linked-20261011T190000Z-v1/). The comparison freeze lists production Bridge 0.6.170 / MSSR 0.2.121 as the live arm and the prior isolated Bridge 0.6.169 / MSSR 0.2.126 run as the candidate arm. The frozen inputs were checksummed before the live call; see `FREEZE-SHA256SUMS`.

## Result

The live production call made one TypeSafe Jev 1.13.0 Choice request over 20 eligible heading candidates (21 options including `none`) and selected `h010`, `B. Búsqueda, archivos y recuperación de conocimiento`. Choice confidence was 1.00, evidence sufficiency 0.91, provider elapsed time 881.9 ms, and usage was 4,103 input / 247 output tokens. Ten offered-range overlaps were parent-child nesting; there were no partial overlaps. The exact live fetch passed at the same source revision/fingerprint as selection. Its 791-character payload SHA-256 is identical to the candidate run's fetched payload: `9d25b9c90ecd6b9d8bb8bb79e0015b61838e15c0c8980c599eeb0971a828c150`.

The prior isolated 0.2.126 candidate run also selected the same exact heading and fetched the same bytes, with Choice 1.00 and evidence sufficiency 0.92. Thus this one linked case shows the same observable selection/fetch outcome on .121 and .126. The 0.01 sufficiency difference is not meaningful calibration evidence; timing boundaries also differ, so the elapsed values are not a controlled latency comparison.

## Limits

This is a post-hoc comparison on one real but previously exposed source cluster. It is not a holdout, owner-gold, independent benchmark, reliability estimate, or confidence calibration. The earlier blind Luna text review applies to the identical fetched payload, but this follow-up did not conduct a new independent blind review. No threshold or adoption decision follows from this case. The direct connector did not expose exact call ingress/egress timestamps; the event file records that gap rather than inventing timestamps.
