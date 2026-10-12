# Run plan — fresh skill-reference live selection diagnostic

Status: frozen before any Jev provider call. Labels are source-derived exploratory judgments, not owner-gold.

For each case, search is constrained to exactly one sourceRef with metadata off and no query variants. The returned handles from that same query are the only candidates passed to Jev. If search returns no handles, Jev sees its documented heading-selection fallback. For a non-abstaining Jev choice, fetch the exact handle and build a cited evidence pack; validate returned range text against the frozen source snapshot.

This run has 12 linked prompts over six distinct source files in one MSSR project: six answerable positives and six unanswerable-in-source controls. The positive/negative pair for each file counts as one source cluster. LIFECYCLE-POS is intentionally compound; one selected range may not cover both cross-repository ownership and close requirements, so mechanical target selection is not semantic-completeness proof.

The Bridge runtime is observed as 0.6.173, boot 9b1323c6-9499-4700-81d0-6b14de9d6e41, catalog 189 tools. Its process cwd is D:\Dev\bridge-mcp, while that checkout reports package 0.6.144 and has a dirty worktree. The local template runner is therefore not used as evidence for the live server. Calls will use the connected Bridge MCP surface directly and preserve request and response artifacts. This is an exploratory connected-runtime diagnostic, not release provenance or confidence calibration.