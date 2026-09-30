import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { retrieveMssrLexicalTextCandidates } from "./semantic-candidate-retrieval.js";
import { createMssrSemanticCurationBlocksFromMarkdown } from "./semantic-curation-source.js";
import {
  executeMssrJevSemanticCurationJobs,
  mssrJevSemanticCurationJobSchema,
  type MssrJevSemanticCurationJob,
  type MssrJevSemanticCurationRun,
  type MssrJevSemanticCuratorOptions,
} from "./semantic-curation-jev.js";
import type { MssrSemanticCurationBlock } from "./semantic-curation.js";
import {
  classifyMssrSemanticRelationDeterministically,
  createMssrSemanticDistillationObservation,
  semanticDistillationFeatureSignature,
  semanticDistillationLengthRatio,
  semanticDistillationScoreBucket,
  type MssrSemanticDistillationFeature,
  type MssrSemanticTraceProjection,
} from "./semantic-curation-distillation.js";
import {
  appendMssrSemanticDistillationObservations,
  buildMssrSemanticDistillationProfile,
  defaultMssrSemanticDistillationStorePath,
} from "./semantic-curation-distillation-store.js";
import { createMssrSemanticExperienceObservation } from "./semantic-experience.js";
import {
  appendMssrSemanticExperienceObservations,
  defaultMssrSemanticExperienceStorePath,
} from "./semantic-experience-store.js";
import { defaultMssrStateRoot } from "./state-root.js";

const DEFAULT_MAX_SOURCES = 64;
const DEFAULT_MAX_BLOCKS = 384;
const DEFAULT_MAX_PAIRS = 24;
const DEFAULT_MIN_SCORE = 0.24;
const MAX_MARKDOWN_BYTES = 96 * 1024;
const MAX_EVIDENCE_JSON_BYTES = 6_000;
const MAX_BLOCKS_PER_SOURCE = 24;
const MAX_PAIRS_PER_SOURCE_PAIR = 3;
const MAX_PAIRS_PER_SOURCE = 8;
const MAX_PAIRS_PER_BLOCK = 3;
const sourceKindCaps: Record<MssrProjectEvidenceSourceKind, number> = {
  "project-state": 1,
  "project-context": 1,
  "project-memory": 1,
  phase: 16,
  decision: 24,
  architecture: 16,
  knowledge: 20,
  roadmap: 12,
  docs: 28,
  changelog: 12,
  "root-document": 10,
  "evidence-json": 8,
};

export const MSSR_PROJECT_EVIDENCE_SOURCE_KINDS = [
  "project-state",
  "project-context",
  "project-memory",
  "phase",
  "decision",
  "architecture",
  "knowledge",
  "roadmap",
  "docs",
  "changelog",
  "root-document",
  "evidence-json",
] as const;
export type MssrProjectEvidenceSourceKind = typeof MSSR_PROJECT_EVIDENCE_SOURCE_KINDS[number];

const sourceKindPriority: Record<MssrProjectEvidenceSourceKind, number> = {
  "project-state": 100,
  "project-context": 96,
  phase: 92,
  decision: 88,
  architecture: 86,
  knowledge: 82,
  "project-memory": 80,
  "evidence-json": 78,
  roadmap: 74,
  docs: 68,
  "root-document": 64,
  changelog: 50,
};

export type MssrProjectEvidenceSource = {
  sourceRef: string;
  absolutePath: string;
  kind: MssrProjectEvidenceSourceKind;
  priority: number;
  bytes: number;
  mtimeMs: number;
  mtime: string;
};

export type MssrProjectEvidenceNode = {
  block: MssrSemanticCurationBlock;
  source: MssrProjectEvidenceSource;
};

type MssrProjectEvidenceRetrievalMethod = "exact-hash" | "tfidf" | "fact-anchor";

export type MssrProjectEvidenceEdge = {
  id: string;
  leftBlockId: string;
  rightBlockId: string;
  leftSourceRef: string;
  rightSourceRef: string;
  retrieval: {
    methods: MssrProjectEvidenceRetrievalMethod[];
    score: number;
    sourceScore: number;
  };
  orderingHint: {
    method: "mtime" | "source-priority" | "stable-path";
    leftMtime: string;
    rightMtime: string;
    leftSourcePriority: number;
    rightSourcePriority: number;
    authority: false;
  };
  evidenceTier: "candidate";
  truthAuthority: false;
  freshnessAuthority: false;
  advisoryOnly: true;
};

export type MssrProjectEvidenceGraph = {
  schemaVersion: 1;
  projectRoot: string;
  createdAt: string;
  sources: MssrProjectEvidenceSource[];
  nodes: MssrProjectEvidenceNode[];
  edges: MssrProjectEvidenceEdge[];
  policy: {
    maxSources: number;
    maxBlocks: number;
    maxPairs: number;
    minScore: number;
    sourceTextDuplicated: false;
    lexicalTruthAuthority: false;
    freshnessAuthority: false;
    advisoryOnly: true;
  };
};

export function mssrProjectEvidenceDistillationFeature(args: {
  edge: MssrProjectEvidenceEdge;
  left: MssrProjectEvidenceNode;
  right: MssrProjectEvidenceNode;
}): MssrSemanticDistillationFeature {
  const exact = args.edge.retrieval.methods.includes("exact-hash") || args.left.block.sha256 === args.right.block.sha256;
  const priorityDirection = args.edge.orderingHint.leftSourcePriority > args.edge.orderingHint.rightSourcePriority
    ? "left-higher"
    : args.edge.orderingHint.leftSourcePriority < args.edge.orderingHint.rightSourcePriority
      ? "right-higher"
      : "equal";
  return {
    retrievalMethods: [...args.edge.retrieval.methods].sort(),
    scoreBucket: semanticDistillationScoreBucket(args.edge.retrieval.score, exact),
    sourceScoreBucket: semanticDistillationScoreBucket(args.edge.retrieval.sourceScore),
    orderingMethod: args.edge.orderingHint.method,
    priorityDirection,
    leftSourceKind: args.left.source.kind,
    rightSourceKind: args.right.source.kind,
    leftValidity: args.left.block.validity,
    rightValidity: args.right.block.validity,
    leftProtected: args.left.block.protected,
    rightProtected: args.right.block.protected,
    sameHash: exact,
    lengthRatio: semanticDistillationLengthRatio(Buffer.byteLength(args.left.block.text, "utf8"), Buffer.byteLength(args.right.block.text, "utf8")),
  };
}

function normalizeRef(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function insideRoot(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sourceKind(sourceRef: string): MssrProjectEvidenceSourceKind | null {
  const ref = normalizeRef(sourceRef);
  const lower = ref.toLowerCase();
  if (lower === ".mssr/project_state.md") return "project-state";
  if (lower === ".mssr/project_context.md") return "project-context";
  if (lower === ".mssr/project_memory.md") return "project-memory";
  if (lower.startsWith(".mssr/knowledge/phase/")) return "phase";
  if (lower.startsWith(".mssr/knowledge/decision/")) return "decision";
  if (lower.startsWith(".mssr/knowledge/architecture/")) return "architecture";
  if (lower.startsWith(".mssr/knowledge/")) return "knowledge";
  if (lower.startsWith("changelogs/") || lower === "changelog.md") return "changelog";
  if (lower.startsWith("docs/roadmap") || lower.includes("/roadmap") || /^roadmap(?:\.md|\/)/.test(lower)) return "roadmap";
  if (lower.startsWith("docs/")) return "docs";
  if (!lower.includes("/") && lower.endsWith(".md")) return "root-document";
  if (lower.endsWith(".json") && lower.startsWith("evidence/")) return "evidence-json";
  return null;
}

function shouldSkipDirectory(relativeRef: string): boolean {
  const ref = normalizeRef(relativeRef).toLowerCase();
  const parts = ref.split("/");
  if (parts.some((part) => [".git", "node_modules", "dist", "build", "coverage", ".cache", "cache", "target", "vendor"].includes(part))) return true;
  if (ref.startsWith(".mssr/runtime/") || ref.startsWith(".mssr/sessions/")) return true;
  if (parts.some((part) => /^(?:frames?|captures?|screenshots?|videos?|assets?|reference)$/i.test(part))) return true;
  return false;
}

function looksLikeEvidenceJson(sourceRef: string): boolean {
  const name = path.basename(sourceRef).toLowerCase();
  return /(?:result|results|summary|report|qa|audit|benchmark|smoke|verification|metrics)/.test(name);
}

async function collectFiles(root: string, relativeDir: string, maxDepth: number): Promise<string[]> {
  if (maxDepth < 0 || shouldSkipDirectory(relativeDir)) return [];
  const absolute = path.join(root, relativeDir);
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  const output: string[] = [];
  for (const entry of entries) {
    const relative = normalizeRef(path.join(relativeDir, entry.name));
    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(relative)) output.push(...await collectFiles(root, relative, maxDepth - 1));
      continue;
    }
    if (!entry.isFile()) continue;
    const lower = relative.toLowerCase();
    if (lower.endsWith(".md")) output.push(relative);
    else if (lower.endsWith(".json") && relative.toLowerCase().startsWith("evidence/") && looksLikeEvidenceJson(relative)) output.push(relative);
  }
  return output;
}

async function discoverCandidateRefs(projectRoot: string): Promise<string[]> {
  const refs = new Set<string>();
  for (const fixed of [".mssr/PROJECT_STATE.md", ".mssr/PROJECT_CONTEXT.md", ".mssr/PROJECT_MEMORY.md", "README.md", "ROADMAP.md", "CHANGELOG.md", "LEEME.md", "HANDOFF.md"]) {
    refs.add(fixed);
  }
  for (const relative of [".mssr/knowledge", "docs", "changelogs", "evidence"]) {
    for (const ref of await collectFiles(projectRoot, relative, relative === "evidence" ? 1 : 5)) refs.add(ref);
  }
  let rootEntries: import("node:fs").Dirent[] = [];
  try {
    rootEntries = await fs.readdir(projectRoot, { withFileTypes: true });
  } catch {
    // The caller gets an empty graph rather than accidental traversal outside root.
  }
  for (const entry of rootEntries) if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) refs.add(entry.name);
  return [...refs];
}

async function sourceMetadata(projectRoot: string, sourceRef: string): Promise<MssrProjectEvidenceSource | null> {
  const normalizedRef = normalizeRef(sourceRef);
  if (normalizedRef.length > 320) return null;
  const kind = sourceKind(normalizedRef);
  if (!kind) return null;
  const absolutePath = path.resolve(projectRoot, normalizedRef);
  if (!insideRoot(projectRoot, absolutePath)) return null;
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(absolutePath);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  const maxBytes = kind === "evidence-json" ? MAX_EVIDENCE_JSON_BYTES : MAX_MARKDOWN_BYTES;
  if (stat.size <= 0 || stat.size > maxBytes) return null;
  return {
    sourceRef: normalizeRef(sourceRef),
    absolutePath,
    kind,
    priority: sourceKindPriority[kind],
    bytes: stat.size,
    mtimeMs: stat.mtimeMs,
    mtime: stat.mtime.toISOString(),
  };
}

export async function discoverMssrProjectEvidenceSources(args: {
  projectRoot: string;
  maxSources?: number;
}): Promise<MssrProjectEvidenceSource[]> {
  const projectRoot = path.resolve(args.projectRoot);
  const maxSources = Math.max(1, Math.min(128, Math.floor(args.maxSources ?? DEFAULT_MAX_SOURCES)));
  const refs = await discoverCandidateRefs(projectRoot);
  const sources = (await Promise.all(refs.map((ref) => sourceMetadata(projectRoot, ref))))
    .filter((source): source is MssrProjectEvidenceSource => source !== null)
    .sort((left, right) => right.priority - left.priority || right.mtimeMs - left.mtimeMs || left.sourceRef.localeCompare(right.sourceRef));
  const counts = new Map<MssrProjectEvidenceSourceKind, number>();
  const selected: MssrProjectEvidenceSource[] = [];
  for (const source of sources) {
    if (selected.length >= maxSources) break;
    const count = counts.get(source.kind) ?? 0;
    if (count >= sourceKindCaps[source.kind]) continue;
    selected.push(source);
    counts.set(source.kind, count + 1);
  }
  return selected;
}

function edgeId(projectRoot: string, leftBlockId: string, rightBlockId: string): string {
  return `evidence:${createHash("sha256").update(`${path.resolve(projectRoot)}\0${leftBlockId}\0${rightBlockId}`).digest("hex").slice(0, 24)}`;
}

function retrievalEligible(node: MssrProjectEvidenceNode): boolean {
  const text = node.block.text.trim();
  if (text.length < 24) return false;
  if (/^\s{0,3}#{1,6}\s+[^\r\n]{1,160}\s*$/.test(text)) return false;
  if (/^[\s{}\[\],:"'0-9._-]+$/.test(text)) return false;
  const terms = (text.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? [])
    .filter((term) => !["the", "and", "for", "that", "with", "this", "from", "project", "current", "section", "title"].includes(term));
  return new Set(terms).size >= 3;
}

function selectRepresentativeBlocks(blocks: readonly MssrSemanticCurationBlock[], limit = MAX_BLOCKS_PER_SOURCE): MssrSemanticCurationBlock[] {
  if (blocks.length <= limit) return [...blocks];
  const selected = new Set<number>();
  const edgeCount = Math.min(8, Math.floor(limit / 3));
  for (let index = 0; index < edgeCount; index += 1) selected.add(index);
  for (let index = Math.max(edgeCount, blocks.length - edgeCount); index < blocks.length; index += 1) selected.add(index);
  const remaining = limit - selected.size;
  if (remaining > 0) {
    const start = edgeCount;
    const end = blocks.length - edgeCount - 1;
    for (let slot = 1; slot <= remaining; slot += 1) {
      const ratio = slot / (remaining + 1);
      selected.add(Math.round(start + (end - start) * ratio));
    }
  }
  return [...selected].sort((left, right) => left - right).slice(0, limit).map((index) => blocks[index]);
}

function factSignals(text: string): { strong: Set<string>; numbers: Set<string>; terms: Set<string>; statuses: Set<string> } {
  const lower = text.toLowerCase();
  const strong = new Set<string>();
  for (const match of lower.matchAll(/`([^`\r\n]{3,100})`/g)) {
    const value = match[1].trim().replace(/\s+/g, " ");
    if (!/^[0-9a-f]{16,}$/i.test(value)) strong.add(value);
  }
  for (const match of lower.matchAll(/\b[a-z][a-z0-9]*(?:[_:-][a-z0-9]+)+\b/g)) strong.add(match[0]);
  for (const match of lower.matchAll(/\bgate\s*#?\s*(\d{1,4})\b/g)) strong.add(`gate:${match[1]}`);
  for (const match of lower.matchAll(/\b\d+(?:\.\d+)?\/\d+(?:\.\d+)?\b/g)) strong.add(match[0]);
  const numbers = new Set((lower.match(/\b\d{1,4}(?:\.\d+)?\b/g) ?? []).filter((value) => !/^20\d{2}$/.test(value)));
  const termStop = new Set(["about", "after", "again", "before", "current", "desde", "entre", "estado", "estos", "hacia", "hasta", "other", "project", "sobre", "their", "there", "these", "those", "through", "using", "where", "which", "while"]);
  const terms = new Set((lower.match(/[a-záéíóúñ][a-záéíóúñ0-9_-]{4,}/g) ?? []).filter((term) => !termStop.has(term)));
  const statuses = new Set((lower.match(/\b(?:pass|passed|fail|failed|error|errors|warning|warnings|red|green|pending|closed|open|blocked|review)\b/g) ?? []));
  return { strong, numbers, terms, statuses };
}

function setsDiffer(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return true;
  for (const value of left) if (!right.has(value)) return true;
  return false;
}

function localFacts(text: string, anchor: string): { numbers: Set<string>; statuses: Set<string> } {
  const lower = text.toLowerCase();
  const index = lower.indexOf(anchor.toLowerCase());
  if (index < 0) return { numbers: new Set(), statuses: new Set() };
  const start = Math.max(0, index - 140);
  const end = Math.min(lower.length, index + anchor.length + 180);
  const window = lower.slice(start, end);
  return {
    numbers: new Set((window.match(/\b\d{1,4}(?:\.\d+)?\b/g) ?? []).filter((value) => !/^20\d{2}$/.test(value))),
    statuses: new Set(window.match(/\b(?:pass|passed|fail|failed|error|errors|warning|warnings|red|green|pending|closed|open|blocked|review)\b/g) ?? []),
  };
}

function factAnchorScore(leftText: string, rightText: string): number {
  const left = factSignals(leftText);
  const right = factSignals(rightText);
  const sharedStrong = [...left.strong].filter((value) => right.strong.has(value));
  const sharedNumbers = [...left.numbers].filter((value) => right.numbers.has(value));
  const sharedTerms = [...left.terms].filter((value) => right.terms.has(value));
  if (sharedStrong.length > 0) {
    for (const anchor of sharedStrong) {
      const leftLocal = localFacts(leftText, anchor);
      const rightLocal = localFacts(rightText, anchor);
      const localDivergence = (leftLocal.numbers.size > 0 && rightLocal.numbers.size > 0 && setsDiffer(leftLocal.numbers, rightLocal.numbers))
        || (leftLocal.statuses.size > 0 && rightLocal.statuses.size > 0 && setsDiffer(leftLocal.statuses, rightLocal.statuses));
      if (localDivergence) return 1;
    }
    return Math.min(0.94, 0.82 + sharedStrong.length * 0.04);
  }
  const divergentFacts = (left.numbers.size > 0 && right.numbers.size > 0 && setsDiffer(left.numbers, right.numbers))
    || (left.statuses.size > 0 && right.statuses.size > 0 && setsDiffer(left.statuses, right.statuses));
  if (sharedNumbers.length > 0 && sharedTerms.length > 0 && divergentFacts) return Math.min(0.94, 0.82 + sharedNumbers.length * 0.04 + Math.min(2, sharedTerms.length) * 0.03);
  if (sharedNumbers.length > 0 && sharedTerms.length > 0) return Math.min(0.78, 0.58 + sharedNumbers.length * 0.05 + sharedTerms.length * 0.03);
  return 0;
}

function orientPair(left: MssrProjectEvidenceNode, right: MssrProjectEvidenceNode): {
  left: MssrProjectEvidenceNode;
  right: MssrProjectEvidenceNode;
  method: MssrProjectEvidenceEdge["orderingHint"]["method"];
} {
  if (Math.abs(left.source.mtimeMs - right.source.mtimeMs) >= 1000) {
    return left.source.mtimeMs >= right.source.mtimeMs ? { left, right, method: "mtime" } : { left: right, right: left, method: "mtime" };
  }
  if (left.source.priority !== right.source.priority) {
    return left.source.priority >= right.source.priority ? { left, right, method: "source-priority" } : { left: right, right: left, method: "source-priority" };
  }
  return left.source.sourceRef.localeCompare(right.source.sourceRef) <= 0
    ? { left, right, method: "stable-path" }
    : { left: right, right: left, method: "stable-path" };
}

function selectEdges(args: {
  projectRoot: string;
  nodes: readonly MssrProjectEvidenceNode[];
  maxPairs: number;
  minScore: number;
}): MssrProjectEvidenceEdge[] {
  const eligible = args.nodes.map((node, index) => ({ node, index })).filter(({ node }) => retrievalEligible(node));
  const lexical = retrieveMssrLexicalTextCandidates({
    items: eligible.map(({ node }) => ({ text: node.block.text, sourceRef: node.source.sourceRef })),
    maxCandidates: Math.min(256, Math.max(args.maxPairs * 8, args.maxPairs)),
    minTfidfScore: args.minScore,
    crossSourceOnly: true,
  });
  const byPair = new Map<string, { leftIndex: number; rightIndex: number; methods: Set<MssrProjectEvidenceRetrievalMethod>; score: number; sourceScore: number }>();
  const add = (leftIndex: number, rightIndex: number, method: MssrProjectEvidenceRetrievalMethod, score: number, sourceScore = 0) => {
    if (args.nodes[leftIndex].source.sourceRef === args.nodes[rightIndex].source.sourceRef) return;
    const key = leftIndex < rightIndex ? `${leftIndex}:${rightIndex}` : `${rightIndex}:${leftIndex}`;
    const current = byPair.get(key) ?? { leftIndex: Math.min(leftIndex, rightIndex), rightIndex: Math.max(leftIndex, rightIndex), methods: new Set(), score: 0, sourceScore: 0 };
    current.methods.add(method);
    current.score = Math.max(current.score, score);
    current.sourceScore = Math.max(current.sourceScore, sourceScore);
    byPair.set(key, current);
  };
  for (const candidate of lexical.candidates) add(eligible[candidate.leftIndex].index, eligible[candidate.rightIndex].index, "tfidf", candidate.score);

  const eligibleBySource = new Map<string, Array<{ node: MssrProjectEvidenceNode; index: number }>>();
  for (const item of eligible) {
    const current = eligibleBySource.get(item.node.source.sourceRef) ?? [];
    current.push(item);
    eligibleBySource.set(item.node.source.sourceRef, current);
  }
  const authorityRefs = [...eligibleBySource.entries()]
    .filter(([, items]) => (items[0]?.node.source.priority ?? 0) >= sourceKindPriority.phase)
    .map(([sourceRef]) => sourceRef);
  for (const authorityRef of authorityRefs) {
    const authorityItems = eligibleBySource.get(authorityRef) ?? [];
    const authorityProfile = authorityItems.map(({ node }) => node.block.text).join("\n\n");
    for (const [otherRef, otherItems] of eligibleBySource.entries()) {
      if (otherRef === authorityRef) continue;
      const otherProfile = otherItems.map(({ node }) => node.block.text).join("\n\n");
      const sourceRelation = retrieveMssrLexicalTextCandidates({
        items: [
          { text: authorityProfile, sourceRef: authorityRef },
          { text: otherProfile, sourceRef: otherRef },
        ],
        maxCandidates: 1,
        minTfidfScore: 0,
        crossSourceOnly: true,
      });
      const sourceScore = sourceRelation.candidates[0]?.score ?? 0;
      const focusedItems = [...authorityItems, ...otherItems];
      const focused = retrieveMssrLexicalTextCandidates({
        items: focusedItems.map(({ node }) => ({ text: node.block.text, sourceRef: node.source.sourceRef })),
        maxCandidates: MAX_PAIRS_PER_SOURCE_PAIR,
        minTfidfScore: Math.min(args.minScore, 0.05),
        crossSourceOnly: true,
      });
      for (const candidate of focused.candidates) {
        add(focusedItems[candidate.leftIndex].index, focusedItems[candidate.rightIndex].index, "tfidf", candidate.score, sourceScore);
      }
    }
  }

  for (let leftEligibleIndex = 0; leftEligibleIndex < eligible.length; leftEligibleIndex += 1) {
    for (let rightEligibleIndex = leftEligibleIndex + 1; rightEligibleIndex < eligible.length; rightEligibleIndex += 1) {
      const leftIndex = eligible[leftEligibleIndex].index;
      const rightIndex = eligible[rightEligibleIndex].index;
      if (args.nodes[leftIndex].block.sha256 === args.nodes[rightIndex].block.sha256) add(leftIndex, rightIndex, "exact-hash", 1);
      const anchorScore = factAnchorScore(args.nodes[leftIndex].block.text, args.nodes[rightIndex].block.text);
      if (anchorScore > 0) add(leftIndex, rightIndex, "fact-anchor", anchorScore);
    }
  }
  const ranked = [...byPair.values()].sort((left, right) => {
    const leftPriority = Math.max(args.nodes[left.leftIndex].source.priority, args.nodes[left.rightIndex].source.priority);
    const rightPriority = Math.max(args.nodes[right.leftIndex].source.priority, args.nodes[right.rightIndex].source.priority);
    const leftAnchor = left.methods.has("fact-anchor") ? 1 : 0;
    const rightAnchor = right.methods.has("fact-anchor") ? 1 : 0;
    const leftExact = left.methods.has("exact-hash") ? 1 : 0;
    const rightExact = right.methods.has("exact-hash") ? 1 : 0;
    return rightPriority - leftPriority || rightAnchor - leftAnchor || right.score - left.score || right.sourceScore - left.sourceScore || rightExact - leftExact || left.leftIndex - right.leftIndex || left.rightIndex - right.rightIndex;
  });
  const sourcePairCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const blockCounts = new Map<string, number>();
  const selected: MssrProjectEvidenceEdge[] = [];
  for (const candidate of ranked) {
    if (selected.length >= args.maxPairs) break;
    const rawLeft = args.nodes[candidate.leftIndex];
    const rawRight = args.nodes[candidate.rightIndex];
    const sourcePair = [rawLeft.source.sourceRef, rawRight.source.sourceRef].sort().join("\0");
    if ((sourcePairCounts.get(sourcePair) ?? 0) >= MAX_PAIRS_PER_SOURCE_PAIR) continue;
    if ((sourceCounts.get(rawLeft.source.sourceRef) ?? 0) >= MAX_PAIRS_PER_SOURCE || (sourceCounts.get(rawRight.source.sourceRef) ?? 0) >= MAX_PAIRS_PER_SOURCE) continue;
    if ((blockCounts.get(rawLeft.block.id) ?? 0) >= MAX_PAIRS_PER_BLOCK || (blockCounts.get(rawRight.block.id) ?? 0) >= MAX_PAIRS_PER_BLOCK) continue;
    const oriented = orientPair(rawLeft, rawRight);
    selected.push({
      id: edgeId(args.projectRoot, oriented.left.block.id, oriented.right.block.id),
      leftBlockId: oriented.left.block.id,
      rightBlockId: oriented.right.block.id,
      leftSourceRef: oriented.left.source.sourceRef,
      rightSourceRef: oriented.right.source.sourceRef,
      retrieval: { methods: [...candidate.methods].sort(), score: candidate.score, sourceScore: candidate.sourceScore },
      orderingHint: {
        method: oriented.method,
        leftMtime: oriented.left.source.mtime,
        rightMtime: oriented.right.source.mtime,
        leftSourcePriority: oriented.left.source.priority,
        rightSourcePriority: oriented.right.source.priority,
        authority: false,
      },
      evidenceTier: "candidate",
      truthAuthority: false,
      freshnessAuthority: false,
      advisoryOnly: true,
    });
    sourcePairCounts.set(sourcePair, (sourcePairCounts.get(sourcePair) ?? 0) + 1);
    sourceCounts.set(rawLeft.source.sourceRef, (sourceCounts.get(rawLeft.source.sourceRef) ?? 0) + 1);
    sourceCounts.set(rawRight.source.sourceRef, (sourceCounts.get(rawRight.source.sourceRef) ?? 0) + 1);
    blockCounts.set(rawLeft.block.id, (blockCounts.get(rawLeft.block.id) ?? 0) + 1);
    blockCounts.set(rawRight.block.id, (blockCounts.get(rawRight.block.id) ?? 0) + 1);
  }
  return selected;
}

export async function buildMssrProjectEvidenceGraph(args: {
  projectRoot: string;
  maxSources?: number;
  maxBlocks?: number;
  maxPairs?: number;
  minScore?: number;
}): Promise<MssrProjectEvidenceGraph> {
  const projectRoot = path.resolve(args.projectRoot);
  const maxSources = Math.max(1, Math.min(128, Math.floor(args.maxSources ?? DEFAULT_MAX_SOURCES)));
  const maxBlocks = Math.max(2, Math.min(1024, Math.floor(args.maxBlocks ?? DEFAULT_MAX_BLOCKS)));
  const maxPairs = Math.max(0, Math.min(64, Math.floor(args.maxPairs ?? DEFAULT_MAX_PAIRS)));
  const minScore = Math.max(0, Math.min(1, args.minScore ?? DEFAULT_MIN_SCORE));
  const sources = await discoverMssrProjectEvidenceSources({ projectRoot, maxSources });
  const nodes: MssrProjectEvidenceNode[] = [];
  for (const source of sources) {
    if (nodes.length >= maxBlocks) break;
    const text = await fs.readFile(source.absolutePath, "utf8");
    const remaining = maxBlocks - nodes.length;
    const allBlocks = createMssrSemanticCurationBlocksFromMarkdown({
      sourceRef: source.sourceRef,
      source: text,
      maxBlocks: 128,
    });
    const blocks = selectRepresentativeBlocks(allBlocks, Math.min(MAX_BLOCKS_PER_SOURCE, remaining));
    for (const block of blocks) nodes.push({ block, source });
  }
  const edges = maxPairs === 0 ? [] : selectEdges({ projectRoot, nodes, maxPairs, minScore });
  return {
    schemaVersion: 1,
    projectRoot,
    createdAt: new Date().toISOString(),
    sources,
    nodes,
    edges,
    policy: {
      maxSources,
      maxBlocks,
      maxPairs,
      minScore,
      sourceTextDuplicated: false,
      lexicalTruthAuthority: false,
      freshnessAuthority: false,
      advisoryOnly: true,
    },
  };
}

export function summarizeMssrProjectEvidenceGraph(graph: MssrProjectEvidenceGraph) {
  return {
    schemaVersion: graph.schemaVersion,
    projectRoot: graph.projectRoot,
    createdAt: graph.createdAt,
    sources: graph.sources.map(({ absolutePath: _absolutePath, mtimeMs: _mtimeMs, ...source }) => source),
    nodes: graph.nodes.map((node) => ({
      id: node.block.id,
      sourceRef: node.block.sourceRef,
      sha256: node.block.sha256,
      startLine: node.block.startLine,
      endLine: node.block.endLine,
      protected: node.block.protected,
      validity: node.block.validity,
      sourceKind: node.source.kind,
    })),
    edges: graph.edges,
    policy: graph.policy,
    sourceTextDuplicated: false as const,
    advisoryOnly: true as const,
  };
}

export function buildMssrProjectEvidenceJobs(graph: MssrProjectEvidenceGraph): MssrJevSemanticCurationJob[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.block.id, node]));
  const projectKey = path.resolve(graph.projectRoot);
  return graph.edges.flatMap((edge, index) => {
    const left = nodeById.get(edge.leftBlockId);
    const right = nodeById.get(edge.rightBlockId);
    if (!left || !right) return [];
    const goal = [
      "Review one cross-document evidence pair for MSSR.",
      "Classify semantic relation as duplicate/supports/supersedes/contradicts/unrelated using only the exact blocks.",
      "Retrieval similarity is candidate evidence only, never truth.",
      `Left source: ${edge.leftSourceRef}; modified ${edge.orderingHint.leftMtime}; category ${left.source.kind}.`,
      `Right source: ${edge.rightSourceRef}; modified ${edge.orderingHint.rightMtime}; category ${right.source.kind}.`,
      "Modification time and source category are non-authoritative freshness hints only; do not infer truth from them alone.",
      "If both claims can be true at different times, prefer supersedes/history over contradicts. If scope/subject do not actually match, prefer unrelated.",
    ].join(" ");
    return [mssrJevSemanticCurationJobSchema.parse({
      id: `evidence-pair-${index + 1}-${edge.id.slice(-12)}`.slice(0, 120),
      projectKey,
      corpusKey: "project-evidence-graph",
      goal,
      blocks: [left.block, right.block],
      pairCandidates: [{ leftId: left.block.id, rightId: right.block.id }],
    })];
  });
}

export function defaultMssrProjectEvidenceReviewRoot(stateRoot = defaultMssrStateRoot()): string {
  return path.join(stateRoot, "semantic-curation-project-reviews");
}

function reviewFileName(projectRoot: string): string {
  const projectHash = createHash("sha256").update(path.resolve(projectRoot)).digest("hex").slice(0, 16);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `project-evidence-${projectHash}-${stamp}.json`;
}

export async function reviewMssrProjectEvidenceGraph(args: {
  projectRoot: string;
  maxSources?: number;
  maxBlocks?: number;
  maxPairs?: number;
  minScore?: number;
  concurrency?: number;
  maxHeadsPerRequest?: number;
  maxStateChars?: number;
  jev?: MssrJevSemanticCuratorOptions;
  persist?: boolean;
  reviewRoot?: string;
  distillationStorePath?: string;
  experienceStorePath?: string;
  trace?: MssrSemanticTraceProjection;
  execute?: typeof executeMssrJevSemanticCurationJobs;
}): Promise<{
  graph: ReturnType<typeof summarizeMssrProjectEvidenceGraph>;
  jobs: Array<{ jobId: string; edgeId: string; blockProvenance: Array<Omit<MssrSemanticCurationBlock, "text" | "topicCandidates"> & { topicCandidates: string[] }> }>;
  run: MssrJevSemanticCurationRun;
  reviewPath: string | null;
  learning: { observationsRecorded: number; storePath: string | null };
  experienceLearning: { observationsRecorded: number; storePath: string | null };
  advisoryOnly: true;
  canonicalRewriteAllowed: false;
}> {
  const graph = await buildMssrProjectEvidenceGraph(args);
  const jobs = buildMssrProjectEvidenceJobs(graph);
  const execute = args.execute ?? executeMssrJevSemanticCurationJobs;
  const run = await execute({
    jobs,
    options: args.jev,
    concurrency: args.concurrency,
    maxHeadsPerRequest: args.maxHeadsPerRequest,
    maxStateChars: args.maxStateChars,
  });
  const persistedJobs = jobs.map((job, index) => ({
    jobId: job.id,
    edgeId: graph.edges[index]?.id ?? "",
    blockProvenance: job.blocks.map(({ text: _text, ...block }) => block),
  }));
  const review = {
    schemaVersion: 1,
    projectRoot: graph.projectRoot,
    createdAt: new Date().toISOString(),
    advisoryOnly: true as const,
    canonicalRewriteAllowed: false as const,
    sourceTextDuplicated: false as const,
    retrievalTruthAuthority: false as const,
    freshnessAuthority: false as const,
    graph: summarizeMssrProjectEvidenceGraph(graph),
    jobs: persistedJobs,
    results: run.results,
    batches: run.batches,
    rejected: run.rejected,
    totals: {
      heads: run.totalHeads,
      inputTokens: run.totalInputTokens,
      outputTokens: run.totalOutputTokens,
    },
  };
  let reviewPath: string | null = null;
  let learning: { observationsRecorded: number; storePath: string | null } = { observationsRecorded: 0, storePath: null };
  let experienceLearning: { observationsRecorded: number; storePath: string | null } = { observationsRecorded: 0, storePath: null };
  if (args.persist !== false) {
    const reviewRoot = args.reviewRoot ?? defaultMssrProjectEvidenceReviewRoot();
    await fs.mkdir(reviewRoot, { recursive: true });
    reviewPath = path.join(reviewRoot, reviewFileName(graph.projectRoot));
    await fs.writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");

    const nodeById = new Map(graph.nodes.map((node) => [node.block.id, node]));
    const resultByJobId = new Map(run.results.map((result) => [result.jobId, result]));
    const observations = graph.edges.flatMap((edge, index) => {
      const left = nodeById.get(edge.leftBlockId);
      const right = nodeById.get(edge.rightBlockId);
      const result = resultByJobId.get(jobs[index]?.id ?? "");
      const judgment = result?.providerResult.pairJudgments[0];
      if (!left || !right || !judgment) return [];
      return [createMssrSemanticDistillationObservation({
        projectKey: graph.projectRoot,
        edgeSignature: createHash("sha256").update(`${edge.id}|${left.block.sha256}|${right.block.sha256}`).digest("hex"),
        observedAt: review.createdAt,
        feature: mssrProjectEvidenceDistillationFeature({ edge, left, right }),
        jev: {
          relation: judgment.relation.value,
          confidence: judgment.relation.confidence,
          provider: result.providerResult.provider,
          modelId: result.providerResult.modelId,
        },
        ...(args.trace ? { trace: args.trace } : {}),
      })];
    });
    if (observations.length > 0) {
      const stored = await appendMssrSemanticDistillationObservations({ observations, ...(args.distillationStorePath ? { storePath: args.distillationStorePath } : {}) });
      learning = { observationsRecorded: stored.added, storePath: stored.storePath };
    } else {
      learning = { observationsRecorded: 0, storePath: args.distillationStorePath ?? defaultMssrSemanticDistillationStorePath() };
    }

    const experienceObservations = graph.edges.flatMap((edge, index) => {
      const left = nodeById.get(edge.leftBlockId);
      const right = nodeById.get(edge.rightBlockId);
      const result = resultByJobId.get(jobs[index]?.id ?? "");
      const judgment = result?.providerResult.pairJudgments[0];
      if (!left || !right || !judgment || !result) return [];
      return [createMssrSemanticExperienceObservation({
        projectKey: graph.projectRoot,
        decisionKind: "semantic-relation",
        observedAt: review.createdAt,
        feature: {
          subjectKind: "cross-document-pair",
          candidateKinds: [left.source.kind, right.source.kind],
          signals: edge.retrieval.methods,
          flags: {
            sameHash: left.block.sha256 === right.block.sha256,
            leftProtected: left.block.protected,
            rightProtected: right.block.protected,
          },
          buckets: {
            retrievalScore: semanticDistillationScoreBucket(edge.retrieval.score),
            leftValidity: left.block.validity,
            rightValidity: right.block.validity,
            leftSourceKind: left.source.kind,
            rightSourceKind: right.source.kind,
          },
        },
        evidenceUnits: [
          { sourceRef: left.source.sourceRef, sha256: left.block.sha256, startLine: left.block.startLine, endLine: left.block.endLine, role: left.source.kind, selected: true, reasonCode: "evidence-graph-candidate" },
          { sourceRef: right.source.sourceRef, sha256: right.block.sha256, startLine: right.block.startLine, endLine: right.block.endLine, role: right.source.kind, selected: true, reasonCode: "evidence-graph-candidate" },
        ],
        proposal: {
          value: judgment.relation.value,
          confidence: judgment.relation.confidence,
          provider: result.providerResult.provider,
          modelId: result.providerResult.modelId,
        },
        ...(args.trace ? { trace: args.trace } : {}),
      })];
    });
    if (experienceObservations.length > 0) {
      const stored = await appendMssrSemanticExperienceObservations({
        observations: experienceObservations,
        ...(args.experienceStorePath ? { storePath: args.experienceStorePath } : {}),
      });
      experienceLearning = { observationsRecorded: stored.added, storePath: stored.storePath };
    } else {
      experienceLearning = { observationsRecorded: 0, storePath: args.experienceStorePath ?? defaultMssrSemanticExperienceStorePath() };
    }
  }
  return { graph: review.graph, jobs: persistedJobs, run, reviewPath, learning, experienceLearning, advisoryOnly: true, canonicalRewriteAllowed: false };
}

export async function reviewMssrProjectEvidenceGraphDeterministically(args: {
  projectRoot: string;
  maxSources?: number;
  maxBlocks?: number;
  maxPairs?: number;
  minScore?: number;
  distillationStorePath?: string;
}) {
  const graph = await buildMssrProjectEvidenceGraph(args);
  const profile = await buildMssrSemanticDistillationProfile(args.distillationStorePath ? { storePath: args.distillationStorePath } : {});
  const nodeById = new Map(graph.nodes.map((node) => [node.block.id, node]));
  const decisions = graph.edges.flatMap((edge) => {
    const left = nodeById.get(edge.leftBlockId);
    const right = nodeById.get(edge.rightBlockId);
    if (!left || !right) return [];
    const feature = mssrProjectEvidenceDistillationFeature({ edge, left, right });
    return [{
      edgeId: edge.id,
      leftBlockId: edge.leftBlockId,
      rightBlockId: edge.rightBlockId,
      leftSourceRef: edge.leftSourceRef,
      rightSourceRef: edge.rightSourceRef,
      featureSignature: semanticDistillationFeatureSignature(feature),
      decision: classifyMssrSemanticRelationDeterministically({ feature, profile }),
    }];
  });
  return {
    graph: summarizeMssrProjectEvidenceGraph(graph),
    profile: {
      generatedAt: profile.generatedAt,
      metrics: profile.metrics,
      policy: profile.policy,
      ruleCount: profile.rules.length,
    },
    decisions,
    mode: "deterministic-fallback" as const,
    rawTraceLoaded: false as const,
    rawSourceTextStored: false as const,
    advisoryOnly: true as const,
    canonicalRewriteAllowed: false as const,
  };
}
