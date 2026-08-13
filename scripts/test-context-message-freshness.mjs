import assert from "node:assert/strict";
import {
  mssrContextEvidenceReferenceSchema,
  mssrContextObservationSchema,
  revalidateMssrContextEvidence,
} from "../dist/index.js";

const stored = (overrides = {}) => mssrContextEvidenceReferenceSchema.parse({
  kind: "changelog",
  ref: "0.3.0",
  summary: "Source revision note.",
  canonicalOwner: "mssr",
  provenance: "project",
  freshness: "fresh",
  revision: "abc123",
  ...overrides,
});

const current = (overrides = {}) => ({
  ref: "0.3.0",
  canonicalOwner: "mssr",
  provenance: "project",
  availability: true,
  revision: "abc123",
  ...overrides,
});

const fresh = revalidateMssrContextEvidence(stored(), current());
assert.equal(fresh, "fresh");

const staleRevision = revalidateMssrContextEvidence(stored(), current({ revision: "def456" }));
assert.equal(staleRevision, "stale");

const freshTimestamp = revalidateMssrContextEvidence(
  stored({ revision: undefined, observedAt: "2026-08-13T12:00:00.000Z" }),
  current({ revision: undefined, observedAt: "2026-08-13T12:00:00.000Z" }),
);
assert.equal(freshTimestamp, "fresh");

const staleTimestamp = revalidateMssrContextEvidence(
  stored({ revision: undefined, observedAt: "2026-08-13T12:00:00.000Z" }),
  current({ revision: undefined, observedAt: "2026-08-13T13:00:00.000Z" }),
);
assert.equal(staleTimestamp, "stale");

const conflictingOwner = revalidateMssrContextEvidence(stored(), current({ canonicalOwner: "other-host" }));
assert.equal(conflictingOwner, "conflicting");

const conflictingProvenance = revalidateMssrContextEvidence(stored(), current({ provenance: "host" }));
assert.equal(conflictingProvenance, "conflicting");

const conflictingRef = revalidateMssrContextEvidence(stored(), current({ ref: "0.4.0" }));
assert.equal(conflictingRef, "conflicting");

const unavailable = revalidateMssrContextEvidence(stored(), current({ availability: false }));
assert.equal(unavailable, "unavailable");

const unknown = revalidateMssrContextEvidence(stored(), current({ revision: undefined }));
assert.equal(unknown, "unknown");

const rejectedRawPrompt = mssrContextObservationSchema.safeParse(current({ rawPrompt: "secret" }));
assert.equal(rejectedRawPrompt.success, false);

const rejectedStoredRawPrompt = mssrContextEvidenceReferenceSchema.safeParse({
  ...stored(),
  rawPrompt: "secret",
});
assert.equal(rejectedStoredRawPrompt.success, false);

const rejectedMissing = mssrContextObservationSchema.safeParse(current({ revision: undefined, observedAt: undefined }));
assert.equal(rejectedMissing.success, false);

const unavailableWithoutStamp = mssrContextObservationSchema.safeParse(
  current({ availability: false, revision: undefined, observedAt: undefined }),
);
assert.equal(unavailableWithoutStamp.success, true);

const unavailableNoStamp = revalidateMssrContextEvidence(
  stored(),
  current({ availability: false, revision: undefined, observedAt: undefined }),
);
assert.equal(unavailableNoStamp, "unavailable");

console.log("context message freshness tests passed");
