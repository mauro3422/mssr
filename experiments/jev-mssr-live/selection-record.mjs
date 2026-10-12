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
