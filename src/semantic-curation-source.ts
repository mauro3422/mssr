import fs from "node:fs/promises";
import path from "node:path";
import { hashSemanticCurationText, mssrSemanticCurationBlockSchema, type MssrSemanticCurationBlock } from "./semantic-curation.js";
import { mssrJevSemanticCurationJobSchema, type MssrJevSemanticCurationJob } from "./semantic-curation-jev.js";
import { safeMarkdownPath } from "./project-context-loader.js";
import type { MssrSemanticCurationQueueReason } from "./semantic-curation-queue.js";

const MAX_SOURCE_BYTES = 262_144;
const MAX_BLOCK_CHARS = 6_000;
const WINDOW_BLOCKS = 8;
const WINDOW_STRIDE = 7;
const MAX_EXTRA_SIMILAR_PAIRS = 3;

const stopWords = new Set([
  "the", "and", "for", "that", "with", "from", "this", "into", "when", "then", "than", "must", "should", "would", "could",
  "que", "los", "las", "una", "uno", "para", "por", "con", "del", "como", "pero", "sus", "este", "esta", "esto", "cuando", "donde",
  "project", "current", "actual", "file", "archivo", "system", "sistema",
]);

function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function keywordCandidates(text: string): string[] {
  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []) {
    if (stopWords.has(token) || /^\d+$/.test(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 4).map(([token]) => token);
}

function headingCandidate(text: string): string | null {
  const match = text.match(/^\s{0,3}#{1,6}\s+(.+)$/m);
  return match ? slug(match[1]) || null : null;
}

function topicCandidates(text: string, inheritedHeading: string | null): string[] {
  const values = [headingCandidate(text), inheritedHeading, ...keywordCandidates(text), "current-state", "decisions", "architecture", "procedure", "history", "verification", "reference"]
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)].slice(0, 16);
}

function protectedHeuristic(text: string): boolean {
  return /\b(?:must|never|do not|don't|required|invariant|decision|constraint|no commit|no push|preserve|debe|nunca|no hacer|obligatorio|invariante|decisi[oó]n|restricci[oó]n|conservar)\b/i.test(text);
}

function lineNumberAt(text: string, offset: number): number {
  let lines = 1;
  for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) lines += 1;
  return lines;
}

type RawBlock = { text: string; start: number; end: number; startLine: number; endLine: number; inheritedHeading: string | null };

function splitOversizedBlock(block: RawBlock, source: string): RawBlock[] {
  if (block.text.length <= MAX_BLOCK_CHARS) return [block];
  const pieces: RawBlock[] = [];
  let cursor = block.start;
  const end = block.end;
  while (cursor < end) {
    let next = Math.min(end, cursor + MAX_BLOCK_CHARS);
    if (next < end) {
      const lineBreak = source.lastIndexOf("\n", next);
      if (lineBreak > cursor + Math.floor(MAX_BLOCK_CHARS * 0.5)) next = lineBreak + 1;
    }
    const text = source.slice(cursor, next).trim();
    if (text) {
      const leading = source.slice(cursor, next).indexOf(text);
      const absoluteStart = cursor + Math.max(0, leading);
      const absoluteEnd = absoluteStart + text.length;
      pieces.push({
        text,
        start: absoluteStart,
        end: absoluteEnd,
        startLine: lineNumberAt(source, absoluteStart),
        endLine: lineNumberAt(source, absoluteEnd),
        inheritedHeading: block.inheritedHeading,
      });
    }
    cursor = next;
  }
  return pieces;
}

export function blockizeMarkdownForSemanticCuration(source: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  const separator = /(?:\r?\n)[ \t]*(?:\r?\n)+/g;
  let cursor = 0;
  let inheritedHeading: string | null = null;
  const pushRange = (start: number, end: number) => {
    const raw = source.slice(start, end);
    const text = raw.trim();
    if (!text) return;
    const local = raw.indexOf(text);
    const absoluteStart = start + Math.max(0, local);
    const absoluteEnd = absoluteStart + text.length;
    const ownHeading = headingCandidate(text);
    const block: RawBlock = {
      text,
      start: absoluteStart,
      end: absoluteEnd,
      startLine: lineNumberAt(source, absoluteStart),
      endLine: lineNumberAt(source, absoluteEnd),
      inheritedHeading,
    };
    blocks.push(...splitOversizedBlock(block, source));
    if (ownHeading) inheritedHeading = ownHeading;
  };
  for (const match of source.matchAll(separator)) {
    const index = match.index ?? cursor;
    pushRange(cursor, index);
    cursor = index + match[0].length;
  }
  pushRange(cursor, source.length);
  return blocks;
}

function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []).filter((token) => !stopWords.has(token)));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function pairCandidates(blocks: readonly MssrSemanticCurationBlock[]): Array<{ leftId: string; rightId: string }> {
  const pairs: Array<{ leftId: string; rightId: string }> = [];
  const keys = new Set<string>();
  const add = (leftIndex: number, rightIndex: number) => {
    const leftId = blocks[leftIndex].id;
    const rightId = blocks[rightIndex].id;
    const key = `${leftId}:${rightId}`;
    if (keys.has(key)) return;
    keys.add(key);
    pairs.push({ leftId, rightId });
  };
  for (let index = 0; index + 1 < blocks.length; index += 1) add(index, index + 1);
  const vectors = blocks.map((block) => tokens(block.text));
  const candidates: Array<{ left: number; right: number; score: number }> = [];
  for (let left = 0; left < blocks.length; left += 1) {
    for (let right = left + 2; right < blocks.length; right += 1) {
      const score = jaccard(vectors[left], vectors[right]);
      if (score >= 0.2) candidates.push({ left, right, score });
    }
  }
  candidates.sort((left, right) => right.score - left.score || left.left - right.left || left.right - right.right);
  for (const candidate of candidates.slice(0, MAX_EXTRA_SIMILAR_PAIRS)) add(candidate.left, candidate.right);
  return pairs;
}

function goalFor(reasons: readonly MssrSemanticCurationQueueReason[], sourceRef: string): string {
  return `Curate ${sourceRef} for MSSR. Keep current state compact, preserve protected durable information, identify duplicate/superseded/history material, and propose selective references. Triggers: ${reasons.join(", ")}.`;
}

export function createMssrSemanticCurationBlocksFromMarkdown(args: {
  sourceRef: string;
  source: string;
  maxBlocks?: number;
}): MssrSemanticCurationBlock[] {
  const rawBlocks = blockizeMarkdownForSemanticCuration(args.source);
  const sourceHash = hashSemanticCurationText(args.sourceRef).slice(0, 8);
  const sourceSlug = `${slug(args.sourceRef) || "source"}-${sourceHash}`;
  const maxBlocks = Math.max(1, Math.min(128, Math.floor(args.maxBlocks ?? 128)));
  return rawBlocks.slice(0, maxBlocks).map((block, index) => {
    const textHash = hashSemanticCurationText(block.text);
    return mssrSemanticCurationBlockSchema.parse({
      id: `${sourceSlug}:${index + 1}:${textHash.slice(0, 10)}`.slice(0, 120),
      text: block.text,
      sourceRef: args.sourceRef,
      sha256: textHash,
      startLine: block.startLine,
      endLine: block.endLine,
      protected: protectedHeuristic(block.text),
      validity: "unknown",
      topicCandidates: topicCandidates(block.text, block.inheritedHeading),
    });
  });
}

export async function buildMssrSemanticCurationJobsFromMarkdown(args: {
  projectRoot: string;
  sourceRef: string;
  reasons: readonly MssrSemanticCurationQueueReason[];
}): Promise<MssrJevSemanticCurationJob[]> {
  const absolute = safeMarkdownPath(args.projectRoot, args.sourceRef);
  const stat = await fs.stat(absolute);
  if (!stat.isFile()) throw new Error(`Semantic curation source is not a file: ${args.sourceRef}`);
  if (stat.size > MAX_SOURCE_BYTES) throw new Error(`Semantic curation source exceeds ${MAX_SOURCE_BYTES} bytes: ${args.sourceRef}`);
  const source = await fs.readFile(absolute, "utf8");
  const projectKey = path.resolve(args.projectRoot);
  const blocks = createMssrSemanticCurationBlocksFromMarkdown({ sourceRef: args.sourceRef, source });
  const sourceHash = hashSemanticCurationText(args.sourceRef).slice(0, 8);
  const sourceSlug = `${slug(args.sourceRef) || "source"}-${sourceHash}`;
  const jobs: MssrJevSemanticCurationJob[] = [];
  for (let start = 0, windowIndex = 1; start < blocks.length; start += WINDOW_STRIDE, windowIndex += 1) {
    const window = blocks.slice(start, start + WINDOW_BLOCKS);
    if (window.length === 0) break;
    const pairs = pairCandidates(window);
    jobs.push(mssrJevSemanticCurationJobSchema.parse({
      id: `${sourceSlug}:window-${windowIndex}`.slice(0, 120),
      projectKey,
      corpusKey: args.sourceRef,
      goal: goalFor(args.reasons, args.sourceRef),
      blocks: window,
      pairCandidates: pairs,
    }));
    if (start + WINDOW_BLOCKS >= blocks.length) break;
  }
  return jobs;
}
