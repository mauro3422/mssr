import { z } from "zod";
import {
  MSSR_SITUATION_CLAIM_VALIDITIES,
  mssrSituationSemanticClaimBatchSchema,
  type MssrSituationSemanticClaim,
  type MssrSituationSemanticClaimInput,
} from "./situation-claims.js";

export const MSSR_SEMANTIC_RELATION_KINDS = [
  "summarizes",
  "depends-on",
  "implements",
  "adopts",
  "supersedes",
  "mirrors",
  "documents",
  "tests",
  "produces",
  "consumes",
] as const;
export type MssrSemanticRelationKind = typeof MSSR_SEMANTIC_RELATION_KINDS[number];

export const MSSR_SEMANTIC_RELATION_CLASSES = ["declared", "derived"] as const;
export type MssrSemanticRelationClass = typeof MSSR_SEMANTIC_RELATION_CLASSES[number];

const stableIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,119}$/);
const subjectSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/);
const boundedRefSchema = z.string().min(1).max(240).refine(
  (value) => !/[\r\n]/.test(value),
  "Semantic relation refs must be bounded single-line references.",
);

export const mssrSemanticRelationSchema = z.object({
  id: stableIdSchema,
  kind: z.enum(MSSR_SEMANTIC_RELATION_KINDS),
  fromSubject: subjectSchema,
  toSubject: subjectSchema,
  scope: subjectSchema.default("project"),
  owner: z.string().min(1).max(120).refine((value) => !/[\r\n]/.test(value)),
  sourceRef: boundedRefSchema,
  fromRef: boundedRefSchema.optional(),
  toRef: boundedRefSchema.optional(),
  relationshipClass: z.enum(MSSR_SEMANTIC_RELATION_CLASSES).default("declared"),
  validity: z.enum(MSSR_SITUATION_CLAIM_VALIDITIES).default("current"),
  required: z.boolean().default(false),
}).strict().superRefine((relation, ctx) => {
  if (relation.fromSubject === relation.toSubject && relation.kind !== "supersedes") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Semantic relation endpoints must differ unless the relation is an explicit supersession revision edge.",
    });
  }
});

export const mssrSemanticRelationBatchSchema = z.array(mssrSemanticRelationSchema).max(256).superRefine((relations, ctx) => {
  const ids = new Set<string>();
  for (const [index, relation] of relations.entries()) {
    if (ids.has(relation.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, "id"], message: `Duplicate semantic relation id '${relation.id}'.` });
    }
    ids.add(relation.id);
  }
});

export type MssrSemanticRelationInput = z.input<typeof mssrSemanticRelationSchema>;
export type MssrSemanticRelation = z.output<typeof mssrSemanticRelationSchema>;

export const MSSR_SEMANTIC_RELATION_INACTIVE_REASONS = [
  "historical-valid",
  "superseded-information",
  "validity-unknown",
] as const;
export type MssrSemanticRelationInactiveReason = typeof MSSR_SEMANTIC_RELATION_INACTIVE_REASONS[number];

export type MssrSemanticUnresolvedReference = {
  relationId: string;
  kind: MssrSemanticRelationKind;
  scope: string;
  owner: string;
  sourceRef: string;
  fromSubject: string;
  toSubject: string;
  targetRef?: string;
  reasonCode: "target-subject-unresolved" | "target-ref-unresolved" | "required-lifecycle-target-unresolved";
  evidenceTier: "proven";
  advisoryOnly: true;
};

export type MssrSemanticRelationPair = {
  relation: MssrSemanticRelation;
  sourceClaim: MssrSituationSemanticClaim;
  targetClaim: MssrSituationSemanticClaim;
  comparisonAuthority: "declared-equivalence";
};

export type MssrSemanticRelationResolution = {
  currentRelations: MssrSemanticRelation[];
  inactiveRelations: Array<{ relation: MssrSemanticRelation; reason: MssrSemanticRelationInactiveReason }>;
  comparisonPairs: MssrSemanticRelationPair[];
  unresolvedReferences: MssrSemanticUnresolvedReference[];
  derivedCandidates: MssrSemanticRelation[];
  advisoryOnly: true;
  canonicalRewriteAllowed: false;
};

function inactiveReason(validity: MssrSemanticRelation["validity"]): MssrSemanticRelationInactiveReason | null {
  if (validity === "historical") return "historical-valid";
  if (validity === "superseded") return "superseded-information";
  if (validity === "unknown") return "validity-unknown";
  return null;
}

function comparableValue(claim: MssrSituationSemanticClaim): string | undefined {
  return claim.kind === "decision-revision" ? claim.revision : claim.value;
}

function claimIdentity(claim: MssrSituationSemanticClaim): string {
  return `${claim.scope}:${claim.kind}:${claim.subject}:${claim.source}:${claim.sourceRef}:${comparableValue(claim) ?? claim.state}`;
}

/**
 * Resolve explicit semantic relations without inventing new authority.
 * Only current declared `mirrors`/`summarizes` relations can create exact
 * comparison pairs. Derived relations remain candidate evidence only.
 */
export function resolveMssrSemanticRelations(args: {
  claims: readonly MssrSituationSemanticClaimInput[];
  relations?: readonly MssrSemanticRelationInput[];
  availableRefs?: readonly string[];
}): MssrSemanticRelationResolution {
  const claims = mssrSituationSemanticClaimBatchSchema.parse(args.claims);
  const relations = mssrSemanticRelationBatchSchema.parse(args.relations ?? []);
  const availableRefs = new Set(args.availableRefs ?? claims.map((claim) => claim.sourceRef));
  const currentClaims = claims.filter((claim) => claim.validity === "current");
  const currentSubjectKeys = new Set(currentClaims.map((claim) => `${claim.scope}:${claim.subject}`));
  const currentRelations: MssrSemanticRelation[] = [];
  const inactiveRelations: MssrSemanticRelationResolution["inactiveRelations"] = [];
  const comparisonPairs: MssrSemanticRelationPair[] = [];
  const unresolvedReferences: MssrSemanticUnresolvedReference[] = [];
  const derivedCandidates: MssrSemanticRelation[] = [];
  const pairIds = new Set<string>();

  for (const relation of relations) {
    const reason = inactiveReason(relation.validity);
    if (reason) {
      inactiveRelations.push({ relation, reason });
      continue;
    }
    currentRelations.push(relation);
    if (relation.relationshipClass === "derived") {
      derivedCandidates.push(relation);
      continue;
    }

    const targetSubjectResolved = currentSubjectKeys.has(`${relation.scope}:${relation.toSubject}`);
    const targetRefResolved = relation.toRef === undefined || availableRefs.has(relation.toRef);
    const lifecycleKind = relation.kind === "produces" || relation.kind === "consumes" || relation.kind === "adopts" || relation.kind === "implements";

    if (!targetSubjectResolved) {
      unresolvedReferences.push({
        relationId: relation.id,
        kind: relation.kind,
        scope: relation.scope,
        owner: relation.owner,
        sourceRef: relation.sourceRef,
        fromSubject: relation.fromSubject,
        toSubject: relation.toSubject,
        ...(relation.toRef ? { targetRef: relation.toRef } : {}),
        reasonCode: relation.required && lifecycleKind ? "required-lifecycle-target-unresolved" : "target-subject-unresolved",
        evidenceTier: "proven",
        advisoryOnly: true,
      });
    } else if (!targetRefResolved) {
      unresolvedReferences.push({
        relationId: relation.id,
        kind: relation.kind,
        scope: relation.scope,
        owner: relation.owner,
        sourceRef: relation.sourceRef,
        fromSubject: relation.fromSubject,
        toSubject: relation.toSubject,
        targetRef: relation.toRef,
        reasonCode: "target-ref-unresolved",
        evidenceTier: "proven",
        advisoryOnly: true,
      });
    }

    if (relation.kind !== "mirrors" && relation.kind !== "summarizes") continue;
    const sourceClaims = currentClaims.filter((claim) => claim.scope === relation.scope && claim.subject === relation.fromSubject && claim.state === "observed");
    const targetClaims = currentClaims.filter((claim) => claim.scope === relation.scope && claim.subject === relation.toSubject && claim.state === "observed");
    for (const sourceClaim of sourceClaims) {
      for (const targetClaim of targetClaims) {
        if (sourceClaim.kind !== targetClaim.kind) continue;
        const pairId = `${relation.id}:${claimIdentity(sourceClaim)}=>${claimIdentity(targetClaim)}`;
        if (pairIds.has(pairId)) continue;
        pairIds.add(pairId);
        comparisonPairs.push({ relation, sourceClaim, targetClaim, comparisonAuthority: "declared-equivalence" });
      }
    }
  }

  const sortRelation = (left: MssrSemanticRelation, right: MssrSemanticRelation) => left.id.localeCompare(right.id);
  currentRelations.sort(sortRelation);
  derivedCandidates.sort(sortRelation);
  inactiveRelations.sort((left, right) => left.relation.id.localeCompare(right.relation.id));
  comparisonPairs.sort((left, right) => left.relation.id.localeCompare(right.relation.id)
    || claimIdentity(left.sourceClaim).localeCompare(claimIdentity(right.sourceClaim))
    || claimIdentity(left.targetClaim).localeCompare(claimIdentity(right.targetClaim)));
  unresolvedReferences.sort((left, right) => left.relationId.localeCompare(right.relationId) || left.reasonCode.localeCompare(right.reasonCode));

  return {
    currentRelations,
    inactiveRelations,
    comparisonPairs,
    unresolvedReferences,
    derivedCandidates,
    advisoryOnly: true,
    canonicalRewriteAllowed: false,
  };
}
