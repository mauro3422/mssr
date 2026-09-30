import assert from "node:assert/strict";
import {
  MSSR_DOCUMENT_SURFACE_REVISION_SCHEME,
  buildMssrMarkdownDocumentSurface,
  findMssrDocumentSurfaceHeadingBySelector,
  materializeMssrDocumentSurfaceBlock,
  materializeMssrDocumentSurfaceSection,
} from "../dist/index.js";

const markdown = [
  "Intro preamble for the librarian.",
  "",
  "# System Map",
  "",
  "Top-level overview with café unicode and enough prose to expose a useful bounded hint.",
  "",
  "## Routing",
  "",
  "Routing chooses bounded capabilities and preserves authority boundaries.",
  "",
  "### Selection",
  "",
  "Selection starts from metadata and only opens source evidence when needed.",
  "",
  "```md",
  "# fake heading inside a fence",
  "## another fake heading",
  "```",
  "",
  "## Routing",
  "",
  "A duplicate heading title is valid and must retain a distinct identity.",
  "",
  "- first item",
  "- second item",
  "",
  "###### Deep Leaf",
  "",
  "Deep evidence is acquired only on demand.",
  "",
].join("\n");

const surface = buildMssrMarkdownDocumentSurface({
  sourceRef: "docs/system-map.md",
  markdown,
  maxHintChars: 80,
});

assert.equal(surface.schemaVersion, 1);
assert.equal(surface.revisionScheme, MSSR_DOCUMENT_SURFACE_REVISION_SCHEME);
assert.equal(surface.sourceRef, "docs/system-map.md");
assert.equal(surface.title, "System Map");
assert.equal(surface.lineCount, markdown.split("\n").length);
assert.equal(surface.charCount, markdown.length);
assert.equal(surface.byteCount, Buffer.byteLength(markdown, "utf8"));
assert.equal(surface.headingCount, 5, "fenced Markdown headings must not enter the surface");
assert.equal(surface.maxHeadingLevel, 6);
assert.ok(surface.blockCount >= 7);
assert.equal(surface.preambleBlockIds.length, 1);

const [system, routingOne, selection, routingTwo, deepLeaf] = surface.headings;
assert.equal(system.title, "System Map");
assert.deepEqual(system.headingPath, ["System Map"]);
assert.equal(routingOne.title, "Routing");
assert.equal(routingOne.selector, "## Routing");
assert.deepEqual(routingOne.headingPath, ["System Map", "Routing"]);
assert.equal(selection.parentId, routingOne.id);
assert.deepEqual(selection.headingPath, ["System Map", "Routing", "Selection"]);
assert.equal(routingTwo.title, "Routing");
assert.notEqual(routingOne.id, routingTwo.id, "duplicate headings need distinct revision-scoped identities");
assert.equal(findMssrDocumentSurfaceHeadingBySelector(surface, "  ## Routing  ")?.id, routingOne.id, "exact selector lookup should trim caller whitespace and keep first occurrence");
assert.equal(findMssrDocumentSurfaceHeadingBySelector(surface, "## fake heading inside a fence"), null, "selector lookup must share fence-aware Markdown semantics");
assert.equal(deepLeaf.level, 6);
assert.equal(deepLeaf.parentId, routingTwo.id);

assert.ok(system.startLine < system.endLine);
assert.ok(routingOne.endLine < routingTwo.startLine);
assert.ok(system.startByte < system.endByte);
assert.ok(surface.byteCount > surface.charCount, "unicode fixture should prove byte/character accounting differs");
assert.ok(routingOne.hint?.includes("Routing chooses bounded capabilities"));
assert.ok((routingOne.hint?.length ?? 0) <= 80);
assert.ok(routingOne.terms.includes("routing"));
assert.ok(routingOne.descendantHeadingCount >= 1);

const codeBlock = surface.blocks.find((block) => block.kind === "code");
assert.ok(codeBlock, "fenced code should be represented as a metadata block");
assert.equal(codeBlock.hint, "code block: md");
assert.equal(codeBlock.sectionId, selection.id);
assert.equal(codeBlock.hint.includes("fake heading"), false, "code bodies must not leak into metadata hints");

const listBlock = surface.blocks.find((block) => block.kind === "list");
assert.ok(listBlock);
assert.equal(listBlock.sectionId, routingTwo.id);
assert.ok(listBlock.hint.includes("first item"));

const section = materializeMssrDocumentSurfaceSection({ markdown, surface, sectionId: routingOne.id });
assert.ok(section.text.startsWith("## Routing"));
assert.ok(section.text.includes("### Selection"), "a section includes descendant headings");
assert.equal(section.text.includes("A duplicate heading title"), false, "a section stops at the next equal/higher heading");
assert.equal(section.startLine, routingOne.startLine);
assert.equal(section.endLine, routingOne.endLine);

const selectionBlock = surface.blocks.find((block) => block.sectionId === selection.id && block.kind === "prose");
assert.ok(selectionBlock);
const materializedBlock = materializeMssrDocumentSurfaceBlock({ markdown, surface, blockId: selectionBlock.id });
assert.equal(materializedBlock.text, "Selection starts from metadata and only opens source evidence when needed.");
assert.equal(materializedBlock.fingerprint, selectionBlock.fingerprint);

assert.throws(
  () => materializeMssrDocumentSurfaceSection({ markdown: `${markdown}\nchanged`, surface, sectionId: routingOne.id }),
  /revision mismatch/,
  "a stale surface must never materialize ranges against a different revision",
);

const crlfSurface = buildMssrMarkdownDocumentSurface({
  sourceRef: "docs/crlf.md",
  markdown: "# A\r\n\r\nParagraph.\r\n",
});
const lfSurface = buildMssrMarkdownDocumentSurface({
  sourceRef: "docs/crlf.md",
  markdown: "# A\n\nParagraph.\n",
});
assert.equal(crlfSurface.revision, lfSurface.revision, "surface revisions normalize line endings deterministically");
assert.equal(crlfSurface.lineCount, lfSurface.lineCount);

console.log("document surface tests passed");
