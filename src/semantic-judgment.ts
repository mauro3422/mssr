import { z } from "zod";
import { buildMssrEvidenceAtom, mssrEvidenceAtomSchema, type MssrEvidenceAtom } from "./evidence-atom.js";
import {
  evaluateMssrExplicitVerificationIndependence,
  mssrExplicitVerificationEvidenceSchema,
  type MssrExplicitVerificationEvidence,
} from "./explicit-verification.js";
import { createHash } from "node:crypto";

/** A semantic proposal is immutable and separate from the source EvidenceAtoms. */
export const MSSR_SEMANTIC_JUDGMENT_SCHEMA_VERSION = 1 as const;

const token = z.string().trim().min(1).max(120).regex(/^[a-z0-9][a-z0-9._:-]*$/);
const text = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/[\r\n]/.test(value));
const probability = z.number().finite().min(0).max(1);
const atomId = z.string().regex(/^evidence-atom:[0-9a-f]{24}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const instant = z.string().datetime({ offset: true });

export const MSSR_SEMANTIC_JUDGMENT_FAMILIES = [
  "relevance", "placement", "lifecycle", "relation", "selection", "synthesis", "verification-request",
] as const;
export const MSSR_SEMANTIC_JUDGMENT_RELATIONS = [
  "supports", "contradicts", "supersedes", "duplicate", "unrelated", "unresolved",
] as const;
export const MSSR_SEMANTIC_JUDGMENT_VALIDITIES = ["current", "historical", "superseded", "unknown"] as const;
export const MSSR_SEMANTIC_JUDGMENT_CITATION_ROLES = ["supports", "contradicts", "context", "supersession-source", "supersession-target"] as const;
export const MSSR_SEMANTIC_JUDGMENT_HEADS = {
  relevance: ["relevance", "novelty", "priority"],
  placement: ["destination", "baseline-need", "reference-value", "topic"],
  lifecycle: ["validity", "temporal-scope"],
  relation: ["relation-kind", "relation-direction"],
  selection: ["select", "skip", "review"],
  synthesis: ["include", "omit", "separate", "faithfulness"],
  "verification-request": ["evidence-sufficiency", "verifier-needed"],
} as const;
const headNames = Object.values(MSSR_SEMANTIC_JUDGMENT_HEADS).flat() as [string, ...string[]];

export const mssrSemanticJudgmentInputSchema = z.object({
  atomId,
  sourceRef: text(1_000),
  revision: text(256),
  fingerprints: z.object({ record: sha256, payload: text(256).optional() }).strict(),
}).strict();

export const mssrSemanticJudgmentCitationSchema = z.object({
  atomId,
  sourceRef: text(1_000),
  revision: text(256),
  fingerprint: sha256,
  role: z.enum(MSSR_SEMANTIC_JUDGMENT_CITATION_ROLES),
  range: z.object({ startLine: z.number().int().min(1), endLine: z.number().int().min(1) }).strict().optional(),
}).strict().superRefine((citation, ctx) => {
  if (citation.range && citation.range.endLine < citation.range.startLine) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["range", "endLine"], message: "Citation range endLine must be >= startLine." });
  }
});

export const mssrSemanticJudgmentRelationSchema = z.object({
  leftAtomId: atomId,
  rightAtomId: atomId,
  kind: z.enum(MSSR_SEMANTIC_JUDGMENT_RELATIONS),
  rawConfidence: probability,
  citedAtomIds: z.array(atomId).min(1).max(16),
  comparability: z.object({
    scope: z.object({ left: text(320).nullable(), right: text(320).nullable() }).strict(),
    temporal: z.object({
      leftValidity: z.enum(MSSR_SEMANTIC_JUDGMENT_VALIDITIES).nullable(),
      leftValidFrom: instant.nullable(),
      leftValidUntil: instant.nullable(),
      rightValidity: z.enum(MSSR_SEMANTIC_JUDGMENT_VALIDITIES).nullable(),
      rightValidFrom: instant.nullable(),
      rightValidUntil: instant.nullable(),
    }).strict(),
  }).strict(),
  status: z.enum(["candidate", "unresolved"]),
}).strict().superRefine((relation, ctx) => {
  if (relation.leftAtomId === relation.rightAtomId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Relation endpoints must differ." });
  if (!relation.citedAtomIds.includes(relation.leftAtomId) || !relation.citedAtomIds.includes(relation.rightAtomId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["citedAtomIds"], message: "A relation must cite exact evidence for both endpoints." });
  }
  if (relation.kind === "unresolved" && relation.status !== "unresolved") ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Unresolved relations must retain unresolved status." });
  const temporal = relation.comparability.temporal;
  for (const side of ["left", "right"] as const) {
    const validity = temporal[`${side}Validity`];
    const from = temporal[`${side}ValidFrom`];
    const until = temporal[`${side}ValidUntil`];
    if (from && until && Date.parse(until) < Date.parse(from)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["comparability", "temporal", `${side}ValidUntil`], message: `Relation ${side} validUntil must be >= validFrom.` });
    }
    if (validity === "unknown" && (from || until)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["comparability", "temporal", `${side}Validity`], message: `Relation ${side} temporal range cannot be asserted with unknown validity.` });
    }
  }
});

const headConfidenceSchema = z.object({
  head: z.enum(headNames),
  candidates: z.array(token).min(2).max(32),
  selectedId: token,
  rawConfidence: probability,
  // Some decision providers return confidence for the selected option, not a
  // full distribution. Keep that distinction explicit instead of inventing
  // probabilities for unselected candidates.
  probabilities: z.array(z.object({ candidateId: token, probability }).strict()).min(2).max(32).nullable(),
}).strict().superRefine((head, ctx) => {
  const candidates = new Set(head.candidates);
  if (candidates.size !== head.candidates.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["candidates"], message: "Candidate ids must be unique." });
  if (!candidates.has(head.selectedId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["selectedId"], message: "Selected id must be one of the declared candidates." });
  if (head.probabilities !== null) {
    const returned = new Set(head.probabilities.map((item) => item.candidateId));
    if (returned.size !== head.probabilities.length || candidates.size !== returned.size || [...candidates].some((id) => !returned.has(id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["probabilities"], message: "Returned probabilities must contain exactly one value for every candidate id." });
    }
    const sum = head.probabilities.reduce((total, item) => total + item.probability, 0);
    if (Math.abs(sum - 1) > 1e-6) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["probabilities"], message: "Candidate probabilities must sum to 1." });
    const selected = head.probabilities.find((item) => item.candidateId === head.selectedId);
    if (selected && Math.abs(selected.probability - head.rawConfidence) > 1e-6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rawConfidence"], message: "Raw confidence must equal the selected candidate's returned probability." });
    }
  }
});
const calibratedConfidenceSchema = z.object({
  value: probability,
  projectKey: text(320),
  decisionFamily: z.enum(MSSR_SEMANTIC_JUDGMENT_FAMILIES),
  calibrationId: text(160),
  calibrationVersion: text(120),
  holdoutFingerprint: sha256,
  calibratedAt: instant,
}).strict();

const mssrSemanticJudgmentProposalBaseSchema = z.object({
  schemaVersion: z.literal(MSSR_SEMANTIC_JUDGMENT_SCHEMA_VERSION),
  immutable: z.literal(true),
  advisoryOnly: z.literal(true),
  canonicalRewriteAllowed: z.literal(false),
  decisionFamily: z.enum(MSSR_SEMANTIC_JUDGMENT_FAMILIES),
  inputs: z.array(mssrSemanticJudgmentInputSchema).min(1).max(64),
  heads: z.array(headConfidenceSchema).min(1).max(32),
  calibratedConfidence: calibratedConfidenceSchema.nullable(),
  claim: z.object({
    validity: z.enum(MSSR_SEMANTIC_JUDGMENT_VALIDITIES).nullable(),
    scope: text(320).nullable(),
    validFrom: instant.nullable(),
    validUntil: instant.nullable(),
  }).strict(),
  citations: z.array(mssrSemanticJudgmentCitationSchema).max(128),
  relations: z.array(mssrSemanticJudgmentRelationSchema).max(128),
  evidenceCoverage: z.object({
    requestedAtomIds: z.array(atomId).max(64),
    returnedAtomIds: z.array(atomId).max(64),
    complete: z.boolean(),
  }).strict(),
  abstainReasons: z.array(token).max(24),
  reviewReasons: z.array(token).max(24),
  provider: text(120),
  model: text(120),
  promptVersion: text(120),
  providerSchemaVersion: text(120),
  traceId: text(128).nullable(),
  verificationEvidence: mssrExplicitVerificationEvidenceSchema.nullable(),
}).strict();

function validateSemanticJudgmentProposal(judgment: z.infer<typeof mssrSemanticJudgmentProposalBaseSchema>, ctx: z.RefinementCtx): void {
  if (judgment.claim.validFrom && judgment.claim.validUntil
    && Date.parse(judgment.claim.validUntil) < Date.parse(judgment.claim.validFrom)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["claim", "validUntil"], message: "Claim validUntil must be >= validFrom." });
  }
  if (judgment.traceId && !/^[A-Za-z0-9._:-]{6,128}$/.test(judgment.traceId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["traceId"], message: "Judgment traceId has invalid format." });
  }
  if (judgment.calibratedConfidence && judgment.calibratedConfidence.decisionFamily !== judgment.decisionFamily) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["calibratedConfidence", "decisionFamily"], message: "Calibration identity must match the judgment decision family." });
  }
  if (new Set(judgment.inputs.map((input) => input.atomId)).size !== judgment.inputs.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["inputs"], message: "Judgment input atom ids must be unique." });
  }
  if (new Set(judgment.heads.map((head) => head.head)).size !== judgment.heads.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["heads"], message: "Decision head names must be unique." });
  }
  for (const [index, head] of judgment.heads.entries()) {
    if (!(MSSR_SEMANTIC_JUDGMENT_HEADS[judgment.decisionFamily] as readonly string[]).includes(head.head)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["heads", index, "head"], message: "Decision head is not valid for this decision family." });
    }
  }
  if (judgment.decisionFamily === "relation" && judgment.relations.length > 0) {
    const relationHead = judgment.heads.find((head) => head.head === "relation-kind");
    if (!relationHead) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["heads"], message: "Relation judgments with relation edges require a typed relation-kind head." });
    else if (judgment.relations.some((relation) => !relationHead.candidates.includes(relation.kind) || relationHead.selectedId !== relation.kind)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["heads"], message: "Every relation edge must agree with the selected relation-kind head; split mixed relation kinds into separate judgments." });
    }
  }
  const inputIds = new Set(judgment.inputs.map((input) => input.atomId));
  const citationIds = new Set(judgment.citations.map((citation) => citation.atomId));
  for (const [index, relation] of judgment.relations.entries()) {
    for (const citedId of relation.citedAtomIds) {
      if (!citationIds.has(citedId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["relations", index, "citedAtomIds"], message: "Relation citations must also appear as exact judgment citations." });
    }
  }
  for (const [index, id] of judgment.evidenceCoverage.requestedAtomIds.entries()) {
    if (!inputIds.has(id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceCoverage", "requestedAtomIds", index], message: "Coverage request must name a supplied input atom." });
  }
  for (const [index, id] of judgment.evidenceCoverage.returnedAtomIds.entries()) {
    if (!inputIds.has(id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceCoverage", "returnedAtomIds", index], message: "Coverage result must name a supplied input atom." });
  }
  const returned = new Set(judgment.evidenceCoverage.returnedAtomIds);
  if (judgment.evidenceCoverage.complete && judgment.evidenceCoverage.requestedAtomIds.some((id) => !returned.has(id))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceCoverage", "complete"], message: "Coverage cannot be complete while requested atoms are missing." });
  }
}

const mssrSemanticJudgmentProposalSchema = mssrSemanticJudgmentProposalBaseSchema.superRefine(validateSemanticJudgmentProposal);

export const mssrSemanticJudgmentSchema = mssrSemanticJudgmentProposalBaseSchema.extend({
  id: z.string().regex(/^semantic-judgment:[0-9a-f]{24}$/),
  verification: z.object({
    status: z.enum(["unverified", "independent-confirmed", "independent-corrected", "independent-rejected"]),
    verificationId: text(200).nullable(),
    evidenceRef: text(320).nullable(),
    independenceReasons: z.array(token).max(8),
  }).strict(),
}).strict().superRefine(validateSemanticJudgmentProposal);

export type MssrSemanticJudgment = z.infer<typeof mssrSemanticJudgmentSchema>;
export type MssrSemanticJudgmentInput = z.infer<typeof mssrSemanticJudgmentInputSchema>;
export type MssrSemanticJudgmentCitation = z.infer<typeof mssrSemanticJudgmentCitationSchema>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function judgmentId(proposal: z.infer<typeof mssrSemanticJudgmentProposalSchema>): string {
  const { verificationEvidence: _verificationEvidence, ...decision } = proposal;
  return `semantic-judgment:${createHash("sha256").update(stableJson(decision), "utf8").digest("hex").slice(0, 24)}`;
}

function verificationProjection(proposal: z.infer<typeof mssrSemanticJudgmentProposalSchema>, expectedJudgmentId: string) {
  const evidence = proposal.verificationEvidence;
  if (!evidence) return { status: "unverified" as const, verificationId: null, evidenceRef: null, independenceReasons: ["verification-absent"] };
  const parsed = mssrExplicitVerificationEvidenceSchema.parse(evidence);
  const subjectMatches = parsed.subject.namespace === "mssr"
    && parsed.subject.kind === "semantic-judgment"
    && parsed.subject.identity === expectedJudgmentId;
  const proposalProviderMatches = parsed.subject.proposalProvider === proposal.provider;
  const proposalTraceKnown = Boolean(proposal.traceId);
  const proposalTraceMatches = proposalTraceKnown && parsed.subject.proposalTraceId === proposal.traceId;
  const independence = evaluateMssrExplicitVerificationIndependence(parsed);
  const reasons = [...independence.reasons];
  if (!subjectMatches) reasons.push("verification-subject-mismatch");
  if (!proposalProviderMatches) reasons.push("proposal-provider-mismatch-or-unknown");
  if (!proposalTraceKnown) reasons.push("proposal-trace-unknown");
  if (!proposalTraceMatches) reasons.push("proposal-trace-mismatch-or-unknown");
  const independent = independence.eligibleAsIndependentTruth && subjectMatches && proposalProviderMatches && proposalTraceMatches;
  return {
    status: independent ? `independent-${parsed.status}` as const : "unverified" as const,
    verificationId: parsed.verificationId,
    evidenceRef: parsed.evidenceRef,
    independenceReasons: [...new Set(reasons)].sort(),
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function exactBinding(atom: MssrEvidenceAtom): MssrSemanticJudgmentInput {
  const { schemaVersion: _schemaVersion, id, advisoryOnly: _advisoryOnly, canonicalRewriteAllowed: _canonicalRewriteAllowed, ...input } = atom;
  if (buildMssrEvidenceAtom(input).id !== id) throw new Error(`Input atom '${id}' identity does not match its normalized source and provenance fields.`);
  if (!atom.source.revision) throw new Error(`Input atom '${atom.id}' has no source revision.`);
  if (atom.source.freshness === "stale") throw new Error(`Input atom '${atom.id}' has stale source provenance.`);
  return mssrSemanticJudgmentInputSchema.parse({
    atomId: atom.id,
    sourceRef: atom.source.ref,
    revision: atom.source.revision,
    fingerprints: { record: atom.fingerprints.record, ...(atom.fingerprints.payload ? { payload: atom.fingerprints.payload } : {}) },
  });
}

function checkBindings(judgment: MssrSemanticJudgment, inputAtoms: readonly MssrEvidenceAtom[]): void {
  const atoms = inputAtoms.map((atom) => mssrEvidenceAtomSchema.parse(atom));
  const byId = new Map(atoms.map((atom) => [atom.id, atom]));
  if (byId.size !== atoms.length) throw new Error("Supplied input atoms must have unique ids.");
  if (judgment.calibratedConfidence && atoms.some((atom) => atom.provenance.projectKey !== judgment.calibratedConfidence?.projectKey)) {
    throw new Error("Calibrated confidence projectKey must match every supplied atom projectKey.");
  }
  for (const binding of judgment.inputs) {
    const atom = byId.get(binding.atomId);
    if (!atom) throw new Error(`Judgment input atom '${binding.atomId}' was not supplied.`);
    if (JSON.stringify(binding) !== JSON.stringify(exactBinding(atom))) throw new Error(`Judgment input atom '${binding.atomId}' has mismatched or stale provenance.`);
  }
  const inputIds = new Set(judgment.inputs.map((input) => input.atomId));
  for (const citation of judgment.citations) {
    const binding = judgment.inputs.find((input) => input.atomId === citation.atomId);
    const atom = byId.get(citation.atomId);
    if (!binding || binding.sourceRef !== citation.sourceRef || binding.revision !== citation.revision || binding.fingerprints.record !== citation.fingerprint) {
      throw new Error(`Citation '${citation.atomId}' is outside the exact supplied input provenance.`);
    }
    if (citation.range && (!atom?.source.range
      || citation.range.startLine < atom.source.range.startLine
      || citation.range.endLine > atom.source.range.endLine)) {
      throw new Error(`Citation '${citation.atomId}' range is outside the exact supplied source range.`);
    }
  }
  for (const relation of judgment.relations) {
    if (!inputIds.has(relation.leftAtomId) || !inputIds.has(relation.rightAtomId)
      || relation.citedAtomIds.some((id) => !inputIds.has(id))) {
      throw new Error("Relation endpoints and citations must be drawn from supplied input atoms.");
    }
  }
}

/** Parse and freeze a provider judgment after binding it to exact current input atoms. */
export function buildMssrSemanticJudgment(args: {
  judgment: unknown;
  inputAtoms: readonly MssrEvidenceAtom[];
}): MssrSemanticJudgment {
  const proposal = mssrSemanticJudgmentProposalSchema.parse(args.judgment);
  const id = judgmentId(proposal);
  const provisional = {
    ...proposal,
    id,
    verification: verificationProjection(proposal, id),
  };
  checkBindings(mssrSemanticJudgmentSchema.parse(provisional), args.inputAtoms);
  return deepFreeze(mssrSemanticJudgmentSchema.parse({ ...provisional, id }));
}

export type MssrSemanticJudgmentEvaluation = {
  disposition: "review" | "abstain" | "candidate";
  reasons: string[];
  advisoryOnly: true;
  canonicalRewriteAllowed: false;
};

/** Deterministic conservative routing; this helper never resolves truth or authorizes writes. */
export function evaluateMssrSemanticJudgment(args: {
  judgment: unknown;
  inputAtoms: readonly MssrEvidenceAtom[];
}): MssrSemanticJudgmentEvaluation {
  const judgment = mssrSemanticJudgmentSchema.parse(args.judgment);
  checkBindings(judgment, args.inputAtoms);
  const { id: _id, verification: _verification, ...proposalValue } = judgment;
  const proposal = mssrSemanticJudgmentProposalSchema.parse(proposalValue);
  if (judgment.id !== judgmentId(proposal)) throw new Error("Judgment id does not match its content-addressed decision payload.");
  const expectedVerification = verificationProjection(proposal, judgment.id);
  if (stableJson(judgment.verification) !== stableJson(expectedVerification)) {
    throw new Error("Judgment verification status does not match its explicit verifier evidence and independence evaluation.");
  }
  const reasons = new Set<string>(judgment.reviewReasons);
  for (const reason of judgment.abstainReasons) reasons.add(reason);
  if (judgment.claim.scope === null) reasons.add("missing-claim-scope");
  if (judgment.claim.validity === null || judgment.claim.validity === "unknown") reasons.add("missing-claim-validity");
  if (args.inputAtoms.some((atom) => atom.source.freshness !== "fresh" || !atom.source.freshnessEvidence)) {
    reasons.add("source-freshness-not-confirmed");
  }
  if (!judgment.evidenceCoverage.complete) reasons.add("incomplete-evidence-coverage");
  if (judgment.relations.some((relation) => relation.kind === "contradicts")) reasons.add("contradictory-relations");
  if (judgment.relations.some((relation) => relation.kind === "unresolved" || relation.status === "unresolved")) reasons.add("unresolved-relations");
  for (const relation of judgment.relations) {
    // An unrelated pair does not claim comparability. Different scopes or
    // validity windows are compatible with (and often explain) that result.
    if (relation.kind === "unrelated") continue;
    const { scope, temporal } = relation.comparability;
    if (!scope.left || !scope.right) reasons.add("relation-scope-unknown");
    else if (scope.left !== scope.right) reasons.add("relation-scope-conflict");
    if (!temporal.leftValidity || temporal.leftValidity === "unknown"
      || !temporal.rightValidity || temporal.rightValidity === "unknown"
      || !temporal.leftValidFrom || !temporal.rightValidFrom) {
      reasons.add("relation-temporal-comparability-unknown");
    } else {
      const leftEnd = temporal.leftValidUntil ? Date.parse(temporal.leftValidUntil) : Number.POSITIVE_INFINITY;
      const rightEnd = temporal.rightValidUntil ? Date.parse(temporal.rightValidUntil) : Number.POSITIVE_INFINITY;
      if (relation.kind === "supersedes") {
        // Supersession is directional and may intentionally cross validity states or
        // non-overlapping periods. Its temporal evidence is comparable when the
        // replacement (left) does not begin before the replaced claim (right).
        if (Date.parse(temporal.leftValidFrom) < Date.parse(temporal.rightValidFrom)) {
          reasons.add("relation-temporal-comparability-conflict");
        }
      } else if (temporal.leftValidity !== temporal.rightValidity
        || Math.max(Date.parse(temporal.leftValidFrom), Date.parse(temporal.rightValidFrom)) > Math.min(leftEnd, rightEnd)) {
        reasons.add("relation-temporal-comparability-conflict");
      }
    }
  }
  if (judgment.verification.status === "unverified") reasons.add("independent-verification-unavailable");
  else if (judgment.verification.status !== "independent-confirmed") reasons.add("independent-verification-not-confirmed");
  const orderedReasons = [...reasons].sort();
  const disposition = judgment.abstainReasons.length > 0
    ? "abstain"
    : orderedReasons.length > 0 ? "review" : "candidate";
  return { disposition, reasons: orderedReasons, advisoryOnly: true, canonicalRewriteAllowed: false };
}
