import { z } from "zod";
import {
  mssrSituationSemanticClaimBatchSchema,
  type MssrSituationSemanticClaim,
  type MssrSituationSemanticClaimInput,
} from "./situation-claims.js";
import {
  mssrSemanticRelationBatchSchema,
  type MssrSemanticRelationInput,
} from "./semantic-relations.js";

export const MSSR_SEMANTIC_CANDIDATE_METHODS = [
  "declared-relation",
  "same-subject",
  "exact-ref",
  "tfidf",
] as const;
export type MssrSemanticCandidateMethod = typeof MSSR_SEMANTIC_CANDIDATE_METHODS[number];

export const mssrSemanticCandidateSchema = z.object({
  leftIndex: z.number().int().min(0).max(127),
  rightIndex: z.number().int().min(0).max(127),
  method: z.enum(MSSR_SEMANTIC_CANDIDATE_METHODS),
  score: z.number().min(0).max(1),
  evidenceTier: z.literal("candidate"),
  truthAuthority: z.literal(false),
  relationId: z.string().max(120).optional(),
}).strict();
export type MssrSemanticCandidate = z.infer<typeof mssrSemanticCandidateSchema>;

function claimScalar(claim: MssrSituationSemanticClaim): string {
  return claim.kind === "decision-revision" ? claim.revision ?? "" : claim.value ?? "";
}

function candidateText(claim: MssrSituationSemanticClaim): string {
  return [claim.subject, claim.kind, claim.sourceRef, claim.scope, claimScalar(claim)]
    .join(" ")
    .toLowerCase();
}

function tokenize(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !/^\d+$/.test(token));
}

function tfidfVectors(texts: string[]): Array<Map<string, number>> {
  const tokens = texts.map((text) => tokenize(text));
  const documentFrequency = new Map<string, number>();
  for (const document of tokens) {
    for (const token of new Set(document)) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
  return tokens.map((document) => {
    const counts = new Map<string, number>();
    for (const token of document) counts.set(token, (counts.get(token) ?? 0) + 1);
    const vector = new Map<string, number>();
    const denominator = Math.max(1, document.length);
    for (const [token, count] of counts) {
      const tf = count / denominator;
      const df = documentFrequency.get(token) ?? 1;
      const idf = Math.log((texts.length + 1) / (df + 1)) + 1;
      vector.set(token, tf * idf);
    }
    return vector;
  });
}

function cosine(left: Map<string, number>, right: Map<string, number>): number {
  let dot = 0;
  let leftSq = 0;
  let rightSq = 0;
  for (const value of left.values()) leftSq += value * value;
  for (const value of right.values()) rightSq += value * value;
  for (const [token, value] of left) dot += value * (right.get(token) ?? 0);
  if (leftSq === 0 || rightSq === 0) return 0;
  return dot / (Math.sqrt(leftSq) * Math.sqrt(rightSq));
}

function pairKey(left: number, right: number): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

/**
 * Retrieve bounded semantic comparison candidates. Exact declared structure is
 * ranked first; lexical TF-IDF is only a candidate generator and never truth.
 */
export function retrieveMssrSemanticCandidates(args: {
  claims: readonly MssrSituationSemanticClaimInput[];
  relations?: readonly MssrSemanticRelationInput[];
  maxCandidates?: number;
  minTfidfScore?: number;
}): { candidates: MssrSemanticCandidate[]; advisoryOnly: true; lexicalTruthAuthority: false } {
  const claims = mssrSituationSemanticClaimBatchSchema.parse(args.claims).filter((claim) => claim.validity === "current");
  const relations = mssrSemanticRelationBatchSchema.parse(args.relations ?? []).filter((relation) => relation.validity === "current");
  const maxCandidates = Math.max(0, Math.min(64, Math.floor(args.maxCandidates ?? 24)));
  const minTfidfScore = Math.max(0, Math.min(1, args.minTfidfScore ?? 0.32));
  const byKey = new Map<string, MssrSemanticCandidate>();

  const add = (candidate: MssrSemanticCandidate) => {
    const key = pairKey(candidate.leftIndex, candidate.rightIndex);
    const current = byKey.get(key);
    const order = MSSR_SEMANTIC_CANDIDATE_METHODS;
    if (!current || order.indexOf(candidate.method) < order.indexOf(current.method) || (candidate.method === current.method && candidate.score > current.score)) {
      byKey.set(key, mssrSemanticCandidateSchema.parse(candidate));
    }
  };

  for (const relation of relations) {
    if (relation.relationshipClass !== "declared") continue;
    const leftIndices = claims.flatMap((claim, index) => claim.scope === relation.scope && claim.subject === relation.fromSubject ? [index] : []);
    const rightIndices = claims.flatMap((claim, index) => claim.scope === relation.scope && claim.subject === relation.toSubject ? [index] : []);
    for (const leftIndex of leftIndices) {
      for (const rightIndex of rightIndices) {
        if (leftIndex === rightIndex) continue;
        add({ leftIndex, rightIndex, method: "declared-relation", score: 1, evidenceTier: "candidate", truthAuthority: false, relationId: relation.id });
      }
    }
  }

  for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
      const left = claims[leftIndex];
      const right = claims[rightIndex];
      if (left.scope !== right.scope) continue;
      if (left.subject === right.subject) {
        add({ leftIndex, rightIndex, method: "same-subject", score: 1, evidenceTier: "candidate", truthAuthority: false });
        continue;
      }
      if (left.sourceRef === right.sourceRef) {
        add({ leftIndex, rightIndex, method: "exact-ref", score: 1, evidenceTier: "candidate", truthAuthority: false });
      }
    }
  }

  const vectors = tfidfVectors(claims.map(candidateText));
  for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
      const left = claims[leftIndex];
      const right = claims[rightIndex];
      if (left.scope !== right.scope || left.kind !== right.kind) continue;
      const score = cosine(vectors[leftIndex], vectors[rightIndex]);
      if (score < minTfidfScore) continue;
      add({ leftIndex, rightIndex, method: "tfidf", score: Number(score.toFixed(6)), evidenceTier: "candidate", truthAuthority: false });
    }
  }

  const methodRank = new Map(MSSR_SEMANTIC_CANDIDATE_METHODS.map((method, index) => [method, index]));
  const candidates = [...byKey.values()]
    .sort((left, right) => (methodRank.get(left.method) ?? 99) - (methodRank.get(right.method) ?? 99)
      || right.score - left.score
      || left.leftIndex - right.leftIndex
      || left.rightIndex - right.rightIndex)
    .slice(0, maxCandidates);

  return { candidates, advisoryOnly: true, lexicalTruthAuthority: false };
}
