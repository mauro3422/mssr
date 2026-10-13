// Shared serializer for Jev evidence metrics. Preserve the canonical MSSR field
// and a separately returned raw Noul value without guessing aliases.
export function serializeJevEvidenceMetrics(selection) {
  const value = selection && typeof selection === "object" ? selection : {};
  return {
    rawChoiceConfidence: value.providerConfidence ?? null,
    confidenceCalibration: value.confidenceCalibration ?? "unknown",
    evidenceSufficiency: value.evidenceSufficiency ?? null,
    noul: value.noul ?? null,
  };
}

// Retain the bounded selector diagnostics returned by MSSR. These fields let
// later analysis distinguish one benchmark case from the provider calls used
// internally by a hierarchical selection and inspect each local shortlist.
export function serializeJevSelectionDiagnostics(selection) {
  const value = selection && typeof selection === "object" ? selection : {};
  const notRun = value.jevCallMade === false;
  return {
    selectionMode: value.selectionMode ?? (notRun ? "not-run" : null),
    selectionPasses: value.selectionPasses ?? (notRun ? 0 : null),
    providerCalls: value.providerCalls ?? (notRun ? 0 : null),
    finalistCount: value.finalistCount ?? (notRun ? 0 : null),
    candidateRangeDiagnostics: value.candidateRangeDiagnostics ?? null,
    rangeOverlapDiagnostics: value.rangeOverlapDiagnostics ?? null,
    batchAssessments: value.batchAssessments ?? (notRun ? [] : null),
    providersUsed: value.providersUsed ?? (notRun ? [] : null),
    modelsUsed: value.modelsUsed ?? (notRun ? [] : null),
  };
}

// Structural guard shared by derived summaries. Historical selection-only
// packets may not contain the full Bridge handle contract, so this checks for
// a usable locator and source consistency without pretending it proves an
// exact fetch. The live runner applies the stricter full-handle checks.
export function inspectSelectedDecision(selection, expectedSourceRef = null) {
  if (selection?.status !== "selected") return { valid: false, reason: "status-not-selected" };
  if (selection.choice === "none") return { valid: false, reason: "selected-choice-is-none" };

  const selected = selection.selected;
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) {
    return { valid: false, reason: "selected-payload-missing" };
  }
  const handle = selected.handle;
  if (!handle || typeof handle !== "object" || Array.isArray(handle)) {
    return { valid: false, reason: "selected-handle-missing" };
  }

  const hasSourceRef = typeof handle.sourceRef === "string" && handle.sourceRef.trim().length > 0;
  const hasRangeId = typeof handle.rangeId === "string" && handle.rangeId.trim().length > 0;
  const hasLineRange = Number.isSafeInteger(handle.startLine)
    && Number.isSafeInteger(handle.endLine)
    && handle.startLine > 0
    && handle.endLine >= handle.startLine;
  const hasOffsetRange = Number.isSafeInteger(handle.startOffset)
    && Number.isSafeInteger(handle.endOffset)
    && handle.startOffset >= 0
    && handle.endOffset >= handle.startOffset;
  if (!hasSourceRef && !hasRangeId && !hasLineRange && !hasOffsetRange) {
    return { valid: false, reason: "selected-handle-has-no-locator" };
  }
  if (expectedSourceRef && hasSourceRef && handle.sourceRef !== expectedSourceRef) {
    return { valid: false, reason: "selected-source-ref-mismatch" };
  }
  return { valid: true, reason: null };
}
