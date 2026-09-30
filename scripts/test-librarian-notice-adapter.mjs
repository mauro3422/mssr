import assert from "node:assert/strict";
import {
  auditMssrLibrarianCatalog,
  catalogMssrLibrarianRecord,
  getMssrLibrarianCoverageInventory,
  librarianRecordFromMssrNotice,
} from "../dist/index.js";

const notice = {
  schemaVersion: "mssr-notice-v1",
  noticeId: "mssr-notice:fixture-source|fixture-code|fixture-subject",
  kind: "operational-attention",
  origin: "mssr",
  attentionLevel: "review",
  severity: "warning",
  code: "fixture-review-due",
  source: "fixture-source",
  subject: "fixture-subject",
  message: "THIS HUMAN FACING MESSAGE MUST NOT BE COPIED INTO LIBRARIAN METADATA",
  recommendation: "THIS HUMAN FACING RECOMMENDATION MUST NOT BE COPIED EITHER",
  dedupeKey: "mssr-notice-dedupe:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  details: {
    event: "changed",
    previousLevel: "watch",
    currentLevel: "review",
    fingerprint: "fixture-fingerprint-v2",
    advisoryOnly: true,
  },
  advisoryOnly: true,
};

const record = librarianRecordFromMssrNotice(notice);
assert.equal(record.namespace, "notice");
assert.equal(record.kind, "changed");
assert.equal(record.identity, notice.noticeId);
assert.equal(record.revision, notice.dedupeKey);
assert.equal(record.payloadFingerprint, notice.dedupeKey);
assert.equal(record.provenance.producer, "operational-notices");
assert.equal(record.provenance.host, "mssr");
assert.equal(record.metadata.code, "fixture-review-due");
assert.equal(record.metadata.subject, "fixture-subject");
assert.equal(record.metadata.previousLevel, "watch");
assert.equal(record.metadata.currentLevel, "review");
assert.equal(record.metadata.event, "changed");
assert.equal(record.metadata.fingerprint, "fixture-fingerprint-v2");
assert.equal(record.metadata.advisoryOnly, true);
assert.equal(record.metadata.hasRecommendation, true);
assert.equal(record.metadata.messageFingerprint.length, 64);
assert.equal(record.metadata.recommendationFingerprint.length, 64);

const serialized = JSON.stringify(record);
assert.equal(serialized.includes("THIS HUMAN FACING MESSAGE MUST NOT BE COPIED"), false);
assert.equal(serialized.includes("THIS HUMAN FACING RECOMMENDATION MUST NOT BE COPIED"), false);
assert.equal(Object.hasOwn(record.metadata, "message"), false);
assert.equal(Object.hasOwn(record.metadata, "recommendation"), false);

const catalogued = catalogMssrLibrarianRecord(record);
assert.equal(catalogued.contractKey, `notice:changed:${notice.noticeId}`);
assert.equal(catalogued.metadataFingerprint.length, 64);
assert.equal(catalogued.recordFingerprint.length, 64);

const withoutRecommendation = librarianRecordFromMssrNotice({
  ...notice,
  noticeId: "mssr-notice:fixture-source|fixture-code|fixture-no-recommendation",
  subject: "fixture-no-recommendation",
  recommendation: undefined,
  dedupeKey: "mssr-notice-dedupe:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
});
assert.equal(withoutRecommendation.metadata.hasRecommendation, false);
assert.equal(withoutRecommendation.metadata.recommendationFingerprint, null);

const resolved = librarianRecordFromMssrNotice({
  ...notice,
  noticeId: "mssr-notice:fixture-source|fixture-code|fixture-resolved",
  subject: "fixture-resolved",
  attentionLevel: "ok",
  severity: "info",
  code: "fixture-review-due-resolved",
  dedupeKey: "mssr-notice-dedupe:sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  details: {
    event: "resolved",
    previousLevel: "review",
    currentLevel: "ok",
    fingerprint: null,
    advisoryOnly: true,
  },
});
assert.equal(resolved.kind, "resolved");
assert.equal(resolved.metadata.currentLevel, "ok");
assert.equal(resolved.metadata.fingerprint, null);

assert.throws(
  () => librarianRecordFromMssrNotice({ ...notice, advisoryOnly: false }),
  /Invalid literal value|Invalid input|expected true/i,
  "a notice that is not advisory must never enter through this adapter",
);

assert.throws(
  () => librarianRecordFromMssrNotice({
    ...notice,
    queueId: "HOST-QUEUE-ID-MUST-BE-REJECTED",
  }),
  /Unrecognized key|unrecognized/i,
  "host queue/delivery envelope metadata must remain outside portable notice ingress",
);

assert.throws(
  () => librarianRecordFromMssrNotice({
    ...notice,
    details: {
      ...notice.details,
      hostAction: "execute-dangerous-action",
    },
  }),
  /Unrecognized key|unrecognized/i,
  "arbitrary notice details or executable host actions must not cross the strict portable contract",
);

const sameSemanticNotice = librarianRecordFromMssrNotice({ ...notice });
const duplicateAudit = auditMssrLibrarianCatalog([record, sameSemanticNotice]);
assert.ok(duplicateAudit.audit.duplicateGroups.some((group) => group.classification === "exact-record"));

const changedEvent = librarianRecordFromMssrNotice({
  ...notice,
  attentionLevel: "error",
  severity: "error",
  dedupeKey: "mssr-notice-dedupe:sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  details: {
    event: "escalated",
    previousLevel: "review",
    currentLevel: "error",
    fingerprint: "fixture-fingerprint-v3",
    advisoryOnly: true,
  },
});
const lifecycleAudit = auditMssrLibrarianCatalog([record, changedEvent]);
assert.equal(
  lifecycleAudit.audit.duplicateGroups.some((group) => group.classification === "exact-record"),
  false,
  "a changed notice lifecycle revision must remain distinct evidence",
);

const coverage = getMssrLibrarianCoverageInventory(["operational-notices"]);
assert.equal(coverage.entries[0].status, "instrumented");
assert.equal(coverage.entries[0].adapterRef, "src/librarian-notice-adapter.ts#librarianRecordFromMssrNotice");
assert.equal(coverage.summary.requiredGaps, 0);
assert.equal(coverage.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);

console.log("librarian notice adapter tests passed");
