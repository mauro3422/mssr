# Blind union coverage packet — changelog 0.2.121

Review target question:
“What changed about exact list-item ranges in 0.2.121, and what does that change explicitly leave unproven?”

Required claim facets frozen before provider calls:
- Continuation/nested list membership follows indentation across blank separators and stops before unindented prose/headings.
- Same-level siblings are separated by visual indentation columns; nested and continuation lines stay with their parent item.
- Aggregate `block-N` identities are preserved.
- Confidence, authority, privacy, and canonical-write policy stay unchanged; range completeness does not establish semantic answer quality or score calibration.

Evidence excerpts supplied for this independent review, in source order:
1. “Rebuild child list-item ranges from original source lines across blank separators only while indentation keeps the lines inside the list; stop before unindented prose or a heading.”
2. “Keep same-level siblings in separate exact ranges by visual indentation columns, preserve nested and continuation lines with their parent item, and exclude trailing blank separators from the fetched range.”
3. “Preserve aggregate `block-N` identities. The shared index remains the source for search, Jev candidate validation, exact fetch, and cited evidence packs.”
4. “Confidence, authority, privacy, and canonical-write policy are unchanged. This fixes evidence-range completeness and does not establish semantic answer quality or score calibration.”

Assess only whether the supplied union fully supports the question and required facets, with any overbreadth or unsupported inference noted. Do not infer correctness from any score or model decision. This is model-assisted review, not owner-gold.
