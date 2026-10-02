import { createHash } from "node:crypto";
import { z } from "zod";
import { mssrEvidenceAtomSchema, type MssrEvidenceAtom } from "./evidence-atom.js";
import {
  evaluateMssrSemanticJudgment,
  mssrSemanticJudgmentSchema,
  type MssrSemanticJudgment,
} from "./semantic-judgment.js";
import {
  mssrLibrarianEvidenceHandleId,
  mssrLibrarianEvidenceHandleSchema,
  type MssrLibrarianEvidenceHandle,
} from "./librarian-retrieval.js";

export const MSSR_SEMANTIC_SYNTHESIS_PROPOSAL_SCHEMA_VERSION = 1 as const;
export const MSSR_SEMANTIC_SYNTHESIS_LIMITS = { maxInputs: 64, maxTextCharsPerInput: 20_000, maxTotalTextChars: 200_000 } as const;

const atomId = z.string().regex(/^evidence-atom:[0-9a-f]{24}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export const mssrSemanticSynthesisSourceEvidenceSchema = z.object({
  atomId,
  handle: mssrLibrarianEvidenceHandleSchema,
  text: z.string().min(1).max(MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxTextCharsPerInput),
}).strict();

export type MssrSemanticSynthesisSourceEvidence = z.infer<typeof mssrSemanticSynthesisSourceEvidenceSchema>;

function hash(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function verifyMssrSemanticSynthesisSourceEvidence(evidence: MssrSemanticSynthesisSourceEvidence, atom: MssrEvidenceAtom): void {
  const { id, ...handleFields } = evidence.handle;
  if (id !== mssrLibrarianEvidenceHandleId(handleFields)) throw new Error(`Evidence handle for atom '${atom.id}' has an invalid content id.`);
  if (!atom.source.revision || evidence.handle.revision !== atom.source.revision || evidence.handle.sourceRef !== atom.source.ref) {
    throw new Error(`Evidence handle for atom '${atom.id}' does not match its exact source ref/revision.`);
  }
  if (evidence.handle.owner !== atom.provenance.canonicalOwner) {
    throw new Error(`Evidence handle owner for atom '${atom.id}' does not match its canonical owner.`);
  }
  if (evidence.handle.privacyClass !== atom.privacyClass) {
    throw new Error(`Evidence handle privacy class for atom '${atom.id}' does not match its EvidenceAtom classification.`);
  }
  if (!atom.source.range
    || evidence.handle.startLine < atom.source.range.startLine
    || evidence.handle.endLine > atom.source.range.endLine) {
    throw new Error(`Evidence handle for atom '${atom.id}' is outside the atom's exact source range.`);
  }
  if (evidence.handle.fingerprint !== hash(evidence.text.trim())) {
    throw new Error(`Fetched text for atom '${atom.id}' does not match the revision-bound range fingerprint.`);
  }
  if (atom.fingerprints.payload !== evidence.handle.fingerprint) {
    throw new Error(`Fetched range fingerprint for atom '${atom.id}' does not exactly match its payload fingerprint.`);
  }
}

function relationComparable(relation: MssrSemanticJudgment["relations"][number]): boolean {
  const { scope, temporal } = relation.comparability;
  if (!scope.left || !scope.right || scope.left !== scope.right) return false;
  if (!temporal.leftValidity || temporal.leftValidity === "unknown"
    || temporal.leftValidity !== temporal.rightValidity
    || !temporal.leftValidFrom || !temporal.rightValidFrom) return false;
  const leftEnd = temporal.leftValidUntil ? Date.parse(temporal.leftValidUntil) : Number.POSITIVE_INFINITY;
  const rightEnd = temporal.rightValidUntil ? Date.parse(temporal.rightValidUntil) : Number.POSITIVE_INFINITY;
  return Math.max(Date.parse(temporal.leftValidFrom), Date.parse(temporal.rightValidFrom)) <= Math.min(leftEnd, rightEnd);
}

type SynthesisRelation = {
  leftAtomId: string;
  rightAtomId: string;
  kind: MssrSemanticJudgment["relations"][number]["kind"];
  rawConfidence: number;
  status: "candidate" | "review" | "separate";
  reasonCodes: string[];
};

export type MssrSemanticSynthesisProposal = {
  schemaVersion: typeof MSSR_SEMANTIC_SYNTHESIS_PROPOSAL_SCHEMA_VERSION;
  id: string;
  judgmentId: string;
  disposition: "candidate" | "review" | "abstain";
  policy: {
    minimumRawRelationConfidence: number;
    thresholdIsCalibrated: false;
    requiresIndependentConfirmed: true;
    verificationEvidenceIsCallerAsserted: true;
    sourceFreshnessIsCallerAsserted: true;
    hostMustRevalidateCurrentRevisions: true;
  };
  relations: SynthesisRelation[];
  groups: Array<{
    atomIds: string[];
    disposition: "consolidation-candidate" | "separate" | "review";
    reasonCodes: string[];
    sourceSnapshots: Array<{ atomId: string; sourceRef: string; revision: string; range: MssrLibrarianEvidenceHandle; fingerprint: string; text: string }>;
    markdown: string | null;
    markdownSha256: string | null;
  }>;
  sourceEvidenceRetained: true;
  reversible: true;
  advisoryOnly: true;
  canonicalRewriteAllowed: false;
  applyAllowed: false;
};

/**
 * Build an immutable exact-text preview from exact caller-supplied Librarian
 * snapshots and a judgment carrying independent-verification evidence. This
 * helper checks consistency, not verifier authenticity or current host state.
 * Only comparable support/duplicate edges can
 * consolidate. Contradictions, unknown edges, stale ranges and unverified
 * judgments remain separate or review-only; this function never writes sources.
 */
export function buildMssrSemanticSynthesisProposal(args: {
  judgment: unknown;
  inputAtoms: readonly MssrEvidenceAtom[];
  sourceEvidence: readonly MssrSemanticSynthesisSourceEvidence[];
  minimumRawRelationConfidence?: number;
}): MssrSemanticSynthesisProposal {
  const judgment = mssrSemanticJudgmentSchema.parse(args.judgment);
  if (judgment.inputs.length > MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxInputs) throw new Error(`Synthesis accepts at most ${MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxInputs} atoms.`);
  if (judgment.decisionFamily !== "relation") throw new Error("Synthesis proposals require a typed relation judgment.");
  const minimumConfidence = args.minimumRawRelationConfidence ?? 0.75;
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) throw new Error("Minimum raw relation confidence must be between 0 and 1.");
  if (args.inputAtoms.length > MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxInputs) throw new Error(`Synthesis accepts at most ${MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxInputs} input atoms.`);
  if (args.sourceEvidence.length > MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxInputs) throw new Error(`Synthesis accepts at most ${MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxInputs} source evidence records.`);
  const rawTextChars = args.sourceEvidence.reduce((total, evidence) => total + (typeof evidence?.text === "string" ? evidence.text.length : 0), 0);
  if (rawTextChars > MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxTotalTextChars) throw new Error(`Synthesis source text exceeds ${MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxTotalTextChars} total characters.`);
  const evaluation = evaluateMssrSemanticJudgment({ judgment, inputAtoms: args.inputAtoms });
  const atoms = args.inputAtoms.map((atom) => mssrEvidenceAtomSchema.parse(atom));
  const atomsById = new Map(atoms.map((atom) => [atom.id, atom]));
  if (atomsById.size !== atoms.length) throw new Error("Synthesis input atoms must have unique ids.");
  const judgmentInputIds = new Set(judgment.inputs.map((input) => input.atomId));
  if (atoms.length !== judgmentInputIds.size || atoms.some((atom) => !judgmentInputIds.has(atom.id))) throw new Error("Synthesis atoms must exactly match the judgment input set.");
  const sourceEvidence = args.sourceEvidence.map((evidence) => mssrSemanticSynthesisSourceEvidenceSchema.parse(evidence));
  const evidenceById = new Map(sourceEvidence.map((evidence) => [evidence.atomId, evidence]));
  if (evidenceById.size !== sourceEvidence.length) throw new Error("Synthesis source evidence must have unique atom ids.");
  if (evidenceById.size !== judgmentInputIds.size || sourceEvidence.some((evidence) => !judgmentInputIds.has(evidence.atomId))) throw new Error("Synthesis source evidence must exactly match the judgment input set.");
  let totalTextChars = 0;
  for (const evidence of sourceEvidence) {
    const atom = atomsById.get(evidence.atomId);
    if (!atom) throw new Error(`Source evidence atom '${evidence.atomId}' was not supplied.`);
    verifyMssrSemanticSynthesisSourceEvidence(evidence, atom);
    totalTextChars += evidence.text.length;
  }
  if (totalTextChars > MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxTotalTextChars) throw new Error(`Synthesis source text exceeds ${MSSR_SEMANTIC_SYNTHESIS_LIMITS.maxTotalTextChars} total characters.`);
  for (const input of judgment.inputs) {
    if (!evidenceById.has(input.atomId)) throw new Error(`Synthesis requires an exact fetched source range for atom '${input.atomId}'.`);
  }
  for (const relation of judgment.relations) {
    if (!relation.citedAtomIds.includes(relation.leftAtomId) || !relation.citedAtomIds.includes(relation.rightAtomId)) {
      throw new Error("Synthesis relation must cite exact source evidence for both endpoints.");
    }
  }

  const relations: SynthesisRelation[] = judgment.relations.map((relation) => {
    const reasons: string[] = [];
    const comparable = relationComparable(relation);
    if (!comparable) reasons.push("scope-or-valid-time-not-comparable");
    if (relation.status === "unresolved" || relation.kind === "unresolved") reasons.push("relation-unresolved");
    if (relation.rawConfidence < minimumConfidence) reasons.push("raw-confidence-below-preview-threshold");
    const positive = relation.kind === "supports" || relation.kind === "duplicate";
    const safePositive = positive && relation.status === "candidate" && comparable && relation.rawConfidence >= minimumConfidence;
    const disposition = safePositive && evaluation.disposition === "candidate"
      ? "candidate"
      : relation.kind === "unrelated" || relation.kind === "supersedes" ? "separate" : "review";
    if (relation.kind === "contradicts") reasons.push("contradiction-blocks-consolidation");
    if (relation.kind === "supersedes") reasons.push("supersession-keeps-both-time-bound-sources");
    if (!safePositive && positive && !reasons.length) reasons.push("relation-not-eligible-for-consolidation");
    return { leftAtomId: relation.leftAtomId, rightAtomId: relation.rightAtomId, kind: relation.kind, rawConfidence: relation.rawConfidence, status: disposition, reasonCodes: [...new Set(reasons)].sort() };
  });

  const parent = new Map(judgment.inputs.map((input) => [input.atomId, input.atomId]));
  const find = (value: string): string => {
    const current = parent.get(value);
    if (!current) throw new Error(`Unknown synthesis atom '${value}'.`);
    if (current === value) return value;
    const root = find(current);
    parent.set(value, root);
    return root;
  };
  const union = (left: string, right: string) => { const a = find(left); const b = find(right); if (a !== b) parent.set(b, a); };
  for (const relation of relations) if (relation.status === "candidate") union(relation.leftAtomId, relation.rightAtomId);
  const componentIds = new Map<string, string[]>();
  for (const input of judgment.inputs) {
    const root = find(input.atomId);
    const group = componentIds.get(root) ?? [];
    group.push(input.atomId);
    componentIds.set(root, group);
  }
  const blockedAtomIds = new Set<string>();
  for (const relation of relations) {
    if (relation.status === "review") {
      blockedAtomIds.add(relation.leftAtomId);
      blockedAtomIds.add(relation.rightAtomId);
    }
  }
  const groups = [...componentIds.values()].map((ids) => {
    const orderedIds = ids.sort((left, right) => {
      const a = evidenceById.get(left)!.handle;
      const b = evidenceById.get(right)!.handle;
      return a.sourceRef.localeCompare(b.sourceRef) || a.startLine - b.startLine || left.localeCompare(right);
    });
    const componentRelations = relations.filter((relation) => ids.includes(relation.leftAtomId) || ids.includes(relation.rightAtomId));
    const reasons = new Set<string>();
    if (orderedIds.some((id) => blockedAtomIds.has(id))) reasons.add("relation-conflict-or-uncertainty");
    if (evaluation.disposition !== "candidate") for (const reason of evaluation.reasons) reasons.add(reason);
    const disposition = orderedIds.length === 1 && reasons.size === 0
      ? "separate" as const
      : reasons.size > 0 || componentRelations.some((relation) => relation.status !== "candidate" && ids.includes(relation.leftAtomId) && ids.includes(relation.rightAtomId))
        ? "review" as const
        : "consolidation-candidate" as const;
    const snapshots = orderedIds.map((id) => {
      const source = evidenceById.get(id)!;
      return { atomId: id, sourceRef: source.handle.sourceRef, revision: source.handle.revision, range: source.handle, fingerprint: source.handle.fingerprint, text: source.text };
    });
    const markdown = disposition === "review" ? null : snapshots.map((source) => source.text).join("\n\n");
    return {
      atomIds: orderedIds,
      disposition,
      reasonCodes: [...reasons].sort(),
      sourceSnapshots: snapshots,
      markdown,
      markdownSha256: markdown === null ? null : hash(markdown),
    };
  });
  const proposalProjection = {
    schemaVersion: MSSR_SEMANTIC_SYNTHESIS_PROPOSAL_SCHEMA_VERSION,
    judgmentId: judgment.id,
    disposition: evaluation.disposition,
    policy: {
      minimumRawRelationConfidence: minimumConfidence,
      thresholdIsCalibrated: false as const,
      requiresIndependentConfirmed: true as const,
      verificationEvidenceIsCallerAsserted: true as const,
      sourceFreshnessIsCallerAsserted: true as const,
      hostMustRevalidateCurrentRevisions: true as const,
    },
    relations,
    groups,
    sourceEvidenceRetained: true as const,
    reversible: true as const,
    advisoryOnly: true as const,
    canonicalRewriteAllowed: false as const,
    applyAllowed: false as const,
  };
  return deepFreeze({ ...proposalProjection, id: `semantic-synthesis:${hash(stableJson(proposalProjection)).slice(0, 24)}` });
}
