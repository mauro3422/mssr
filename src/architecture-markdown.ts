import { createHash } from "node:crypto";
import { architectureMarkdownAnchorIdSchema } from "./architecture-impact-structure.js";

const MARKDOWN_ANCHOR_RE = /^[ \t]*<!--\s*mssr-arch-anchor:\s*([a-z0-9][a-z0-9._-]{0,79})\s*-->[ \t]*$/;
const MARKDOWN_HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/;
const FENCE_START_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export type MarkdownArchitectureSection = {
  anchorId: string;
  heading: string;
  headingLevel: number;
  headingLine: number;
  markerLine: number;
  contentStartLine: number;
  contentEndLine: number;
  content: string;
  fingerprint: string;
};

type MarkdownHeading = { lineIndex: number; level: number; text: string };
type MarkdownAnchorMarker = { anchorId: string; lineIndex: number; heading: MarkdownHeading };

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function semanticFingerprint(label: string, parts: readonly string[]): string {
  const input = [label, ...parts].map((part) => `${part.length}:${part}`).join("|");
  return `sha256:${sha256(input)}`;
}

function normalizeHeadingText(raw: string): string {
  return raw.replace(/[ \t]+#+[ \t]*$/, "").trim();
}

function scanMarkdownStructure(markdown: string): {
  lines: string[];
  headings: MarkdownHeading[];
  markers: MarkdownAnchorMarker[];
  markerLineIndexes: Set<number>;
} {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const headings: MarkdownHeading[] = [];
  const markers: MarkdownAnchorMarker[] = [];
  const markerLineIndexes = new Set<number>();
  const seenAnchors = new Set<string>();
  let fence: { char: "`" | "~"; length: number } | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const fenceMatch = line.match(FENCE_START_RE);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length
        && fenceMatch[2].trim().length === 0) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = { char: fenceMatch[1][0] as "`" | "~", length: fenceMatch[1].length };
      continue;
    }

    const headingMatch = line.match(MARKDOWN_HEADING_RE);
    if (headingMatch) {
      const text = normalizeHeadingText(headingMatch[2]);
      if (text.length > 0) headings.push({ lineIndex, level: headingMatch[1].length, text });
      continue;
    }

    const anchorMatch = line.match(MARKDOWN_ANCHOR_RE);
    if (!anchorMatch) continue;
    const anchorId = architectureMarkdownAnchorIdSchema.parse(anchorMatch[1]);
    if (seenAnchors.has(anchorId)) throw new Error(`Duplicate Markdown architecture anchor: ${anchorId}`);

    let previous = lineIndex - 1;
    while (previous >= 0 && lines[previous].trim().length === 0) previous -= 1;
    const heading = headings.find((candidate) => candidate.lineIndex === previous);
    if (!heading) {
      throw new Error(`Markdown architecture anchor must immediately follow a heading (blank lines allowed): ${anchorId}`);
    }

    seenAnchors.add(anchorId);
    markerLineIndexes.add(lineIndex);
    markers.push({ anchorId, lineIndex, heading });
  }

  return { lines, headings, markers, markerLineIndexes };
}

function normalizeMarkdownSectionBody(
  lines: readonly string[],
  startIndex: number,
  endIndexExclusive: number,
  markerLineIndexes: ReadonlySet<number>,
): string {
  const normalized: string[] = [];
  let previousBlank = false;
  for (let index = startIndex; index < endIndexExclusive; index += 1) {
    if (markerLineIndexes.has(index)) continue;
    const line = lines[index].replace(/[ \t]+$/g, "");
    const blank = line.trim().length === 0;
    if (blank && previousBlank) continue;
    normalized.push(blank ? "" : line);
    previousBlank = blank;
  }
  while (normalized.length > 0 && normalized[0] === "") normalized.shift();
  while (normalized.length > 0 && normalized[normalized.length - 1] === "") normalized.pop();
  return normalized.join("\n");
}

/**
 * Parse sparse explicit Markdown architecture anchors. The root heading text and
 * anchor marker are metadata, not fingerprint content, so a heading rename with
 * the same stable anchor and body stays aligned. Nested subsections remain part
 * of the body until the next heading of equal/higher level.
 */
export function parseMarkdownArchitectureSections(markdown: string): MarkdownArchitectureSection[] {
  const scanned = scanMarkdownStructure(markdown);
  return scanned.markers.map((marker) => {
    const nextBoundary = scanned.headings.find(
      (heading) => heading.lineIndex > marker.lineIndex && heading.level <= marker.heading.level,
    );
    const endIndexExclusive = nextBoundary?.lineIndex ?? scanned.lines.length;
    const content = normalizeMarkdownSectionBody(
      scanned.lines,
      marker.lineIndex + 1,
      endIndexExclusive,
      scanned.markerLineIndexes,
    );
    return {
      anchorId: marker.anchorId,
      heading: marker.heading.text,
      headingLevel: marker.heading.level,
      headingLine: marker.heading.lineIndex + 1,
      markerLine: marker.lineIndex + 1,
      contentStartLine: marker.lineIndex + 2,
      contentEndLine: Math.max(marker.lineIndex + 1, endIndexExclusive),
      content,
      fingerprint: semanticFingerprint("architecture-markdown-section-v1", [marker.anchorId, content]),
    };
  });
}

export type MarkdownArchitectureAnchorFingerprint = Pick<
  MarkdownArchitectureSection,
  "anchorId" | "fingerprint" | "heading" | "headingLine" | "contentStartLine" | "contentEndLine"
>;

export function fingerprintMarkdownArchitectureAnchors(
  markdown: string,
  requestedAnchors: readonly string[],
): MarkdownArchitectureAnchorFingerprint[] {
  const sections = parseMarkdownArchitectureSections(markdown);
  const byId = new Map(sections.map((section) => [section.anchorId, section] as const));
  const result: MarkdownArchitectureAnchorFingerprint[] = [];
  const seen = new Set<string>();
  for (const raw of requestedAnchors) {
    const anchorId = architectureMarkdownAnchorIdSchema.parse(raw);
    if (seen.has(anchorId)) continue;
    seen.add(anchorId);
    const section = byId.get(anchorId);
    if (!section) throw new Error(`Requested Markdown architecture anchor is missing: ${anchorId}`);
    result.push({
      anchorId: section.anchorId,
      fingerprint: section.fingerprint,
      heading: section.heading,
      headingLine: section.headingLine,
      contentStartLine: section.contentStartLine,
      contentEndLine: section.contentEndLine,
    });
  }
  return result;
}
