# Blind Jev output review

Review only BLIND-JEV-REVIEW.json and the byte-identical source snapshots referenced by each item. Do not inspect RUN-PLAN.json, the source-derived labels, or aggregate metrics.

For each query, independently judge:
1. Whether the candidate set contains enough text to answer the question.
2. Whether Jev's selected exact text answers the question, partially answers it, is unsupported, or is a reasonable explicit statement that the requested fact is unspecified.
3. Whether the selected range is proportionate to the answer or unnecessarily broad.
4. For Jev abstentions, whether abstention was appropriate given the supplied candidates and source snapshot.
5. For a not-run item, note that search returned no candidates; do not score Jev.

Do not see or infer the expected answer key from another file. Return a compact table by reviewId with labels: sufficient / partial / insufficient / unsupported / abstention-appropriate / abstention-missed / no-candidates, plus a brief evidence-based reason and selected-span breadth. Treat this as a blind quality review, not owner gold.
