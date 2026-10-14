const record = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const fail = (message) => { throw new Error(message); };
const SUPPORT_STATUSES = new Set(["supported", "partial", "unsupported", "contradicted", "unreviewed"]);
const LABEL_PROVENANCE = new Set(["synthetic-fixture", "independent-human-review", "owner-adjudication"]);
const ERROR_CODES = new Set([
  "contradiction",
  "unsupported-claim",
  "citation-scope-mismatch",
  "required-facet-omission",
]);
const CROSS_FACET_STATUSES = new Set(["not-applicable", "supported", "unsupported", "unresolved"]);

function exactKeys(value, keys, label) {
  if (!record(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) {
    fail(label + " does not match the composition-review schema.");
  }
}

function uniqueStringArray(value, label, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== "string" || !item.trim()) || new Set(value).size !== value.length) {
    fail(label + " must be a bounded array of unique non-empty strings.");
  }
}

function boundedText(value, label, maxChars) {
  if (typeof value !== "string" || !value.trim() || value.length > maxChars) fail(label + " must be non-empty text within its size limit.");
}

/**
 * Score an externally labeled paragraph composition against the exact
 * revision-bound evidence selected by the composed Librarian replay.
 * This records reviewer labels; it does not infer semantic truth or authorize
 * synthesis, production writes, confidence calibration, or benchmark claims.
 */
export function evaluateLibrarianCompositionReview({ plan, receipts, review }) {
  exactKeys(review, ["schemaVersion", "labelProvenance", "reviewer", "requiredClaims", "paragraphs"], "Composition review");
  if (review.schemaVersion !== 1 || !LABEL_PROVENANCE.has(review.labelProvenance)) fail("Composition review schema or label provenance is unsupported.");
  exactKeys(review.reviewer, ["id", "reviewedAt", "blindToProviderScores"], "Composition reviewer");
  boundedText(review.reviewer.id, "Reviewer id", 120);
  if (typeof review.reviewer.reviewedAt !== "string" || !/^\d{4}-\d\d-\d\dT/.test(review.reviewer.reviewedAt) || !Number.isFinite(Date.parse(review.reviewer.reviewedAt))) fail("Reviewer timestamp must be an ISO date-time.");
  if (review.reviewer.blindToProviderScores !== true) fail("Composition labels must be recorded by a reviewer blind to provider scores.");
  if (!Array.isArray(review.paragraphs) || review.paragraphs.length < 1 || review.paragraphs.length > 64) fail("Composition review must contain 1-64 paragraphs.");

  const facets = new Map(plan.facets.map((facet) => [facet.id, facet]));
  const receiptsByFacet = new Map(receipts.map((receipt) => [receipt.facetId, receipt]));
  if (!Array.isArray(review.requiredClaims) || review.requiredClaims.length < 1 || review.requiredClaims.length > 128) fail("Composition review must declare 1-128 required claims.");
  const requiredClaims = new Map();
  for (const required of review.requiredClaims) {
    exactKeys(required, ["id", "description", "facetIds"], "Required composition claim");
    boundedText(required.id, "Required claim id", 120);
    if (requiredClaims.has(required.id)) fail("Required claim ids must be unique.");
    boundedText(required.description, "Required claim description", 2000);
    uniqueStringArray(required.facetIds, "Required claim facetIds", facets.size);
    if (!required.facetIds.length || required.facetIds.some((facetId) => !facets.has(facetId))) fail("Required claim facets must refer to the frozen plan.");
    requiredClaims.set(required.id, required);
  }
  const claimIds = new Set();
  const paragraphIds = new Set();
  const claimResults = [];
  const invalidCitations = [];
  const supportedFacetIds = new Set();
  const coveredRequiredClaimIds = new Set();
  const counts = { supported: 0, partial: 0, unsupported: 0, contradicted: 0, unreviewed: 0 };
  let citationCount = 0;
  let validCitationCount = 0;
  let addressableClaimCount = 0;
  let fullyCitedClaimCount = 0;
  const crossFacetCounts = { supported: 0, unsupported: 0, unresolved: 0 };
  let multiFacetClaimCount = 0;

  for (const paragraph of review.paragraphs) {
    exactKeys(paragraph, ["id", "text", "claims"], "Composition paragraph");
    boundedText(paragraph.id, "Paragraph id", 120);
    if (paragraphIds.has(paragraph.id)) fail("Paragraph ids must be unique.");
    paragraphIds.add(paragraph.id);
    boundedText(paragraph.text, "Paragraph text", 20000);
    if (!Array.isArray(paragraph.claims) || paragraph.claims.length < 1 || paragraph.claims.length > 256) fail("Each reviewed paragraph needs 1-256 claims.");

    for (const claim of paragraph.claims) {
      exactKeys(claim, ["id", "text", "addressesFacetIds", "satisfiesRequiredClaimIds", "citations", "supportStatus", "crossFacetJoinStatus", "errorCodes"], "Composition claim");
      boundedText(claim.id, "Claim id", 120);
      if (claimIds.has(claim.id)) fail("Claim ids must be unique across the review.");
      claimIds.add(claim.id);
      boundedText(claim.text, "Claim text", 4000);
      if (!paragraph.text.includes(claim.text)) fail("Claim text must be an exact substring of its reviewed paragraph.");
      uniqueStringArray(claim.addressesFacetIds, "Claim addressesFacetIds", facets.size);
      if (claim.addressesFacetIds.some((facetId) => !facets.has(facetId))) fail("Claim references a facet outside the frozen plan.");
      uniqueStringArray(claim.satisfiesRequiredClaimIds, "Claim satisfiesRequiredClaimIds", requiredClaims.size);
      if (claim.satisfiesRequiredClaimIds.some((claimId) => !requiredClaims.has(claimId))) fail("Claim references an undeclared required claim.");
      if (!SUPPORT_STATUSES.has(claim.supportStatus)) fail("Claim supportStatus is unsupported.");
      if (!CROSS_FACET_STATUSES.has(claim.crossFacetJoinStatus)) fail("Claim crossFacetJoinStatus is unsupported.");
      uniqueStringArray(claim.errorCodes, "Claim errorCodes", 8);
      if (claim.errorCodes.some((code) => !ERROR_CODES.has(code))) fail("Claim contains an unknown review error code.");
      if ((claim.addressesFacetIds.length >= 2) !== (claim.crossFacetJoinStatus !== "not-applicable")) fail("Cross-facet join status must match the number of addressed facets.");
      if (!Array.isArray(claim.citations) || claim.citations.length > facets.size) fail("Claim citations must be a bounded array.");

      counts[claim.supportStatus] += 1;
      if (claim.addressesFacetIds.length) addressableClaimCount += 1;
      const citationFacetIds = new Set();
      const citationPairs = new Set();
      for (const [citationIndex, citation] of claim.citations.entries()) {
        exactKeys(citation, ["facetId", "handleId"], "Composition citation");
        citationCount += 1;
        const duplicateKey = `${citation.facetId}\u0000${citation.handleId}`;
        if (citationPairs.has(duplicateKey)) fail("A claim cannot repeat the same facet/handle citation.");
        citationPairs.add(duplicateKey);
        let reasonCode = null;
        if (!facets.has(citation.facetId)) reasonCode = "unknown-facet";
        else {
          const receipt = receiptsByFacet.get(citation.facetId);
          if (!receipt || receipt.status !== "selected" || receipt.fetch?.status !== "verified") reasonCode = "facet-has-no-verified-selection";
          else if (receipt.selectedHandle?.id !== citation.handleId) reasonCode = "handle-does-not-match-facet-selection";
        }
        if (reasonCode) {
          invalidCitations.push({ paragraphId: paragraph.id, claimId: claim.id, citationIndex, reasonCode });
        } else {
          validCitationCount += 1;
          citationFacetIds.add(citation.facetId);
        }
      }

      const missingCitationFacetIds = claim.addressesFacetIds.filter((facetId) => !citationFacetIds.has(facetId));
      const citationsCoverClaimFacets = claim.addressesFacetIds.length > 0 && missingCitationFacetIds.length === 0;
      if (claim.addressesFacetIds.length && citationsCoverClaimFacets) fullyCitedClaimCount += 1;
      if (claim.supportStatus === "supported") for (const facetId of claim.addressesFacetIds) if (citationFacetIds.has(facetId)) supportedFacetIds.add(facetId);
      if (claim.addressesFacetIds.length >= 2) {
        multiFacetClaimCount += 1;
        if (claim.crossFacetJoinStatus !== "not-applicable") crossFacetCounts[claim.crossFacetJoinStatus] += 1;
      }
      for (const requiredId of claim.satisfiesRequiredClaimIds) {
        const required = requiredClaims.get(requiredId);
        const coversRequiredFacets = required.facetIds.every((facetId) => claim.addressesFacetIds.includes(facetId) && citationFacetIds.has(facetId));
        if (claim.supportStatus === "supported" && coversRequiredFacets) coveredRequiredClaimIds.add(requiredId);
      }
      claimResults.push({
        paragraphId: paragraph.id,
        claimId: claim.id,
        supportStatus: claim.supportStatus,
        addressedFacetIds: claim.addressesFacetIds,
        citedFacetIds: [...citationFacetIds].sort(),
        missingCitationFacetIds,
        citationsCoverClaimFacets,
        satisfiesRequiredClaimIds: claim.satisfiesRequiredClaimIds,
        crossFacetJoinStatus: claim.crossFacetJoinStatus,
        errorCodes: claim.errorCodes,
      });
    }
  }

  const reviewedClaimCount = claimResults.length - counts.unreviewed;
  const nonFullySupportedCount = counts.partial + counts.unsupported + counts.contradicted;
  const requiredFacetIds = [...facets.keys()];
  const missingSupportedFacetIds = requiredFacetIds.filter((facetId) => !supportedFacetIds.has(facetId));
  const missingRequiredClaimIds = [...requiredClaims.keys()].filter((claimId) => !coveredRequiredClaimIds.has(claimId));
  const resolvedCrossFacetJoinCount = crossFacetCounts.supported + crossFacetCounts.unsupported;
  const paragraphCoverage = review.paragraphs.map((paragraph) => {
    const claims = claimResults.filter((claim) => claim.paragraphId === paragraph.id && claim.addressedFacetIds.length > 0);
    return { paragraphId: paragraph.id, addressableClaimCount: claims.length, fullyCitedClaimCount: claims.filter((claim) => claim.citationsCoverClaimFacets).length, allAddressableClaimsCited: claims.length > 0 && claims.every((claim) => claim.citationsCoverClaimFacets) };
  });
  const addressableParagraphs = paragraphCoverage.filter((paragraph) => paragraph.addressableClaimCount > 0);
  return {
    schemaVersion: 1,
    mode: "offline-composition-review",
    labelProvenance: review.labelProvenance,
    reviewer: { id: review.reviewer.id, reviewedAt: review.reviewer.reviewedAt, blindToProviderScores: true },
    ownerGold: false,
    benchmark: false,
    confidenceCalibration: "none",
    synthesisAuthority: false,
    productionWritesAllowed: false,
    metrics: {
      paragraphCount: review.paragraphs.length,
      claimCount: claimResults.length,
      reviewedClaimCount,
      supportCounts: counts,
      fullySupportedClaimRate: reviewedClaimCount ? counts.supported / reviewedClaimCount : null,
      notFullySupportedClaimRate: reviewedClaimCount ? nonFullySupportedCount / reviewedClaimCount : null,
      citationCount,
      validCitationCount,
      invalidCitationCount: invalidCitations.length,
      citationIntegrityRate: citationCount ? validCitationCount / citationCount : null,
      addressableClaimCount,
      fullyCitedClaimCount,
      claimFacetCitationCoverageRate: addressableClaimCount ? fullyCitedClaimCount / addressableClaimCount : null,
      requiredFacetCount: requiredFacetIds.length,
      supportedFacetCount: supportedFacetIds.size,
      supportedFacetCoverageRate: requiredFacetIds.length ? supportedFacetIds.size / requiredFacetIds.length : null,
      missingSupportedFacetIds,
      requiredClaimCount: requiredClaims.size,
      coveredRequiredClaimCount: coveredRequiredClaimIds.size,
      requiredClaimRecallRate: requiredClaims.size ? coveredRequiredClaimIds.size / requiredClaims.size : null,
      missingRequiredClaimIds,
      addressableParagraphCount: addressableParagraphs.length,
      fullyCitedParagraphCount: addressableParagraphs.filter((paragraph) => paragraph.allAddressableClaimsCited).length,
      paragraphCitationCoverageRate: addressableParagraphs.length ? addressableParagraphs.filter((paragraph) => paragraph.allAddressableClaimsCited).length / addressableParagraphs.length : null,
      multiFacetClaimCount,
      crossFacetJoinCounts: crossFacetCounts,
      resolvedCrossFacetJoinCount,
      unsupportedCrossFacetJoinRate: resolvedCrossFacetJoinCount ? crossFacetCounts.unsupported / resolvedCrossFacetJoinCount : null,
      unresolvedCrossFacetJoinCount: crossFacetCounts.unresolved,
    },
    invalidCitations,
    paragraphs: paragraphCoverage,
    claims: claimResults,
  };
}
