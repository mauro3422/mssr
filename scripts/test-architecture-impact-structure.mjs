import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  DEFAULT_ARCHITECTURE_STRUCTURE_MANIFEST_RELATIVE,
  architectureStructureManifestSchema,
  findArchitectureImpactForTouchedRefs,
  findArchitectureTouchContext,
  fingerprintMarkdownArchitectureAnchors,
  loadArchitectureImpactManifest,
  loadArchitectureStructureManifest,
  parseMarkdownArchitectureSections,
  validateArchitectureStructureAgainstImpactManifest,
} from "../dist/index.js";

const projectRoot = process.cwd();
const loadedImpact = await loadArchitectureImpactManifest(projectRoot);
assert.equal(loadedImpact.found, true, "self-hosted architecture impact manifest must exist");
const impactManifest = loadedImpact.manifest;

assert.equal(DEFAULT_ARCHITECTURE_STRUCTURE_MANIFEST_RELATIVE, ".mssr/architecture-structure.json");
const loadedStructure = await loadArchitectureStructureManifest(projectRoot, impactManifest);
assert.equal(loadedStructure.found, true, "self-hosted architecture structure manifest must exist");
const structureManifest = loadedStructure.manifest;
assert.equal(architectureStructureManifestSchema.safeParse(structureManifest).success, true);

// Pre-edit awareness: shared touched refs must return every declared surrounding architecture.
const sharedTouch = findArchitectureImpactForTouchedRefs(impactManifest, [
  "src/project-home.ts",
  "src/project-home.ts",
]);
assert.deepEqual(
  sharedTouch.map((item) => item.architectureId),
  ["architecture-impact-plane", "project-context-plane"],
  "a shared implementation file must map to every declared architecture in manifest order",
);
assert.ok(sharedTouch.every((item) => item.matchedRefs.length === 1));
assert.ok(sharedTouch.every((item) => item.matchedRefs[0].role === "impact"));

const authorityTouch = findArchitectureImpactForTouchedRefs(
  impactManifest,
  ["docs/decisions/0005-architecture-impact-drift-links.md"],
);
assert.equal(authorityTouch.length, 1);
assert.equal(authorityTouch[0].architectureId, "architecture-impact-plane");
assert.equal(authorityTouch[0].matchedRefs[0].role, "authority");
assert.throws(
  () => findArchitectureImpactForTouchedRefs(impactManifest, ["../escape.ts"]),
  /Architecture-impact refs|project-relative|normalized exact paths/,
);

const sharedStructuredTouch = findArchitectureTouchContext(
  impactManifest,
  structureManifest,
  ["src/project-home.ts"],
);
assert.deepEqual(
  sharedStructuredTouch.map((item) => item.architectureId),
  ["architecture-impact-plane", "project-context-plane"],
  "optional structural refinement must never hide the coarse declared relation",
);
assert.ok(sharedStructuredTouch.every((item) => item.matchedRefs[0].selectors.length === 0));

const loaderTouch = findArchitectureTouchContext(
  impactManifest,
  structureManifest,
  ["src/project-context-loader.ts"],
);
assert.equal(loaderTouch.length, 1);
assert.equal(loaderTouch[0].architectureId, "project-context-plane");
assert.equal(loaderTouch[0].authorityRef, "docs/decisions/0001-context-plane-v1.md");
assert.equal(loaderTouch[0].contextRef, "mssr-project-context-plane-architecture");
assert.deepEqual(loaderTouch[0].authorityAnchors, ["context-plane-ownership"]);
assert.deepEqual(
  loaderTouch[0].matchedRefs[0].selectors.map((item) => [item.name, item.aspect]),
  [
    ["loadProjectContextModuleManifest", "signature"],
    ["loadProjectContextModules", "body"],
  ],
);
assert.equal("fingerprint" in loaderTouch[0].matchedRefs[0], false, "C2f-C.5 A+B must not pretend AST evidence exists");

const syntheticImpact = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    authorityRef: "docs/alpha.md",
    contextRef: "alpha-context",
    impactRefs: ["src/alpha.ts", "src/shared.ts"],
  }],
};
const syntheticStructure = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    authorityAnchors: ["ownership"],
    implementation: [{
      ref: "src/alpha.ts",
      selectors: [{ kind: "symbol", language: "typescript", name: "alpha", aspect: "signature" }],
    }],
  }],
};
assert.deepEqual(
  validateArchitectureStructureAgainstImpactManifest(syntheticStructure, syntheticImpact),
  syntheticStructure,
);

assert.throws(
  () => validateArchitectureStructureAgainstImpactManifest({
    schemaVersion: 1,
    architectures: [{ architectureId: "unknown-plane", authorityAnchors: ["ownership"] }],
  }, syntheticImpact),
  /undeclared architectureId/,
);
assert.throws(
  () => validateArchitectureStructureAgainstImpactManifest({
    schemaVersion: 1,
    architectures: [{
      architectureId: "alpha-plane",
      implementation: [{
        ref: "src/not-declared.ts",
        selectors: [{ kind: "symbol", language: "typescript", name: "alpha", aspect: "body" }],
      }],
    }],
  }, syntheticImpact),
  /cannot widen declared impactRefs/,
);
assert.equal(architectureStructureManifestSchema.safeParse({
  schemaVersion: 1,
  architectures: [{ architectureId: "alpha-plane", authorityAnchors: [] }],
}).success, false, "present structural arrays may not be empty");
assert.equal(architectureStructureManifestSchema.safeParse({
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    implementation: [{
      ref: "src/alpha.ts",
      selectors: [
        { kind: "symbol", language: "typescript", name: "alpha", aspect: "body" },
        { kind: "symbol", language: "typescript", name: "alpha", aspect: "body" },
      ],
    }],
  }],
}).success, false, "duplicate symbol selectors must fail");

// Markdown structural fingerprints: stable explicit anchors, no paragraph-by-paragraph linking.
const baseMarkdown = `# Architecture\n\n## Ownership\n<!-- mssr-arch-anchor: ownership -->\n\nPortable core owns semantics.\n\n### Nested rule\nNo host filesystem I/O.\n\n## Notes\nUnrelated note A.\n`;
const outsideChanged = baseMarkdown.replace("Unrelated note A.", "Unrelated note B.");
const headingRenamed = baseMarkdown.replace("## Ownership", "## Ownership and authority");
const bodyChanged = baseMarkdown.replace("Portable core owns semantics.", "Portable core owns portable semantics only.");
const nestedChanged = baseMarkdown.replace("No host filesystem I/O.", "No host filesystem or transport I/O.");

const baseFingerprint = fingerprintMarkdownArchitectureAnchors(baseMarkdown, ["ownership"])[0];
assert.equal(
  fingerprintMarkdownArchitectureAnchors(outsideChanged, ["ownership"])[0].fingerprint,
  baseFingerprint.fingerprint,
  "changes outside the selected anchored section must not invalidate its fingerprint",
);
assert.equal(
  fingerprintMarkdownArchitectureAnchors(headingRenamed, ["ownership"])[0].fingerprint,
  baseFingerprint.fingerprint,
  "heading rename with stable anchor/body must keep the structural fingerprint",
);
assert.notEqual(
  fingerprintMarkdownArchitectureAnchors(bodyChanged, ["ownership"])[0].fingerprint,
  baseFingerprint.fingerprint,
  "body change inside the selected section must change its fingerprint",
);
assert.notEqual(
  fingerprintMarkdownArchitectureAnchors(nestedChanged, ["ownership"])[0].fingerprint,
  baseFingerprint.fingerprint,
  "nested subsection content belongs to the anchored parent section",
);

assert.throws(
  () => parseMarkdownArchitectureSections("## A\n<!-- mssr-arch-anchor: same -->\nx\n## B\n<!-- mssr-arch-anchor: same -->\ny\n"),
  /Duplicate Markdown architecture anchor/,
);
assert.throws(
  () => parseMarkdownArchitectureSections("<!-- mssr-arch-anchor: orphan -->\ntext\n"),
  /must immediately follow a heading/,
);
assert.throws(
  () => fingerprintMarkdownArchitectureAnchors(baseMarkdown, ["missing"]),
  /anchor is missing/,
);
const fenced = `## Real\n<!-- mssr-arch-anchor: real -->\nbody\n\n\`\`\`md\n## Fake\n<!-- mssr-arch-anchor: fake -->\n\`\`\`\n`;
assert.deepEqual(parseMarkdownArchitectureSections(fenced).map((item) => item.anchorId), ["real"]);

const adr0001 = await fs.readFile("docs/decisions/0001-context-plane-v1.md", "utf8");
const adr0005 = await fs.readFile("docs/decisions/0005-architecture-impact-drift-links.md", "utf8");
assert.deepEqual(
  fingerprintMarkdownArchitectureAnchors(adr0001, ["context-plane-ownership"]).map((item) => item.anchorId),
  ["context-plane-ownership"],
);
assert.deepEqual(
  fingerprintMarkdownArchitectureAnchors(adr0005, [
    "impact-relation-meaning",
    "impact-ownership",
    "impact-structural-map",
  ]).map((item) => item.anchorId),
  ["impact-relation-meaning", "impact-ownership", "impact-structural-map"],
);

const schemaText = await fs.readFile("config/project-context/architecture-impact-structure.schema.json", "utf8");
const jsonSchema = JSON.parse(schemaText);
const ajv = new Ajv2020({ allErrors: true, strict: true, validateSchema: true });
assert.equal(ajv.validateSchema(jsonSchema), true, JSON.stringify(ajv.errors));
const validateJson = ajv.compile(jsonSchema);
assert.equal(validateJson(structureManifest), true, JSON.stringify(validateJson.errors));
assert.equal(validateJson({ ...structureManifest, extra: true }), false, "structure JSON schema must stay strict");
assert.equal(validateJson({
  schemaVersion: 1,
  architectures: [{ architectureId: "alpha-plane", authorityAnchors: [] }],
}), false, "JSON schema must reject empty present authorityAnchors");
assert.equal(validateJson({
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    implementation: [{
      ref: "src/alpha.ts",
      selectors: [{ kind: "symbol", language: "typescript", name: " alpha ", aspect: "body" }],
    }],
  }],
}), false, "JSON schema must match bounded symbol-name whitespace rules");

console.log("MSSR architecture-impact C2f-C.5 A+B structural map tests PASS");
