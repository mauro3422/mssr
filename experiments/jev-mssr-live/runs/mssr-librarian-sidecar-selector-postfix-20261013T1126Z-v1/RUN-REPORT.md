# Live post-fix Librarian selector diagnostic

- Run: mssr-librarian-sidecar-selector-postfix-20261013T1126Z-v1
- Date: 2026-10-13 11:26:09 UTC
- Source: .mssr/knowledge/research/jev-decision-model-use-cases.md
- Branch/HEAD at run: codex/mssr-librarian-query-variants-0.2.112 / dc5752afe1ef1837850c895d700386bf4d0940fc; the metadata fix was in the working tree.
- Source revision/fingerprint: a44d90231af23eb9fc6123a7c06bfc53c9a058d7cc556c4c476a8e18ab5c3469 / b7faec4cd33612b70896fa7740d3669d667e2a7cf7f1a504d84c85a8907e6f5d

## Retrieval comparison

The same Spanish query returned 20 candidates in metadata-off mode; the composition section ranked 3. With the exact Librarian sidecar and domain=agent-orchestration filter, it returned 2 candidates and the target ranked 1.

## Live Jev decision

Jev received the two exact candidates and selected the composition section (heading-8). Choice=0.97; Noul sufficiency=0.56; provider=typesafe-jev; model=jev-1.13.0; usage=901 input and 67 output tokens.

## Evidence integrity

Fetch returned 2843 characters and fingerprint b7faec4cd33612b70896fa7740d3669d667e2a7cf7f1a504d84c85a8907e6f5d, matching the selected handle. The evidence pack contained one verbatim range; exact text comparison passed: true.

## Limits

This is useful live integration evidence for one exposed document/query. It does not establish general accuracy, confidence calibration, independent holdout performance, or quality of generated prose. The document describes a composed system: host search/provenance, code filtering and rendering, bounded Jev decisions, and independent verification.

## Bridge setup observation

The connector wrapper initially submitted `documents`, while the live Bridge registry schema required `projectRoot` and explicit `sourceRefs`; inspecting the runtime schema resolved the call before Jev. The first fetch was blocked with `mssr-lifecycle-preflight-required` because the Bridge trace had no compatible route. An explicit trace reuse was then rejected for owner mismatch; a local MSSR route/bootstrap allowed the exact Bridge fetch and evidence pack to complete. This operational friction is excluded from retrieval and selection metrics. The trace-owner mismatch remains a separate Bridge follow-up; no Bridge runtime or permission policy changed.
