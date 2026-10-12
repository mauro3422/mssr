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
