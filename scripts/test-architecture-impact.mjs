import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import {
  DEFAULT_ARCHITECTURE_IMPACT_MANIFEST_RELATIVE,
  architectureImpactManifestSchema,
  loadArchitectureImpactManifest,
  resolveArchitectureImpactProjectPath,
  validateArchitectureImpactContextRefs,
} from "../dist/index.js";

const validManifest = {
  schemaVersion: 1,
  architectures: [
    {
      architectureId: "project-context-plane",
      authorityRef: "docs/decisions/0001-context-plane-v1.md",
      contextRef: "project-context-architecture",
      impactRefs: [
        "src/project-context.ts",
        "src/project-context-loader.ts",
        "src/context-plane-host.ts",
      ],
    },
  ],
};

const parsed = architectureImpactManifestSchema.parse(validManifest);
assert.deepEqual(parsed, validManifest);
assert.equal(DEFAULT_ARCHITECTURE_IMPACT_MANIFEST_RELATIVE, ".mssr/architecture-impact.json");

const sharedSourceAllowed = architectureImpactManifestSchema.safeParse({
  schemaVersion: 1,
  architectures: [
    { architectureId: "architecture-a", authorityRef: "docs/a.md", impactRefs: ["src/shared.ts"] },
    { architectureId: "architecture-b", authorityRef: "docs/b.md", impactRefs: ["src/shared.ts"] },
  ],
});
assert.equal(sharedSourceAllowed.success, true, "one implementation file may affect multiple declared architectures");

const invalidManifests = [
  {
    name: "unknown top-level field",
    value: { ...validManifest, inferredLinks: [] },
  },
  {
    name: "unknown entry field",
    value: {
      schemaVersion: 1,
      architectures: [{ ...validManifest.architectures[0], authority: "inferred" }],
    },
  },
  {
    name: "duplicate architecture id",
    value: {
      schemaVersion: 1,
      architectures: [validManifest.architectures[0], { ...validManifest.architectures[0] }],
    },
  },
  {
    name: "duplicate impact ref",
    value: {
      schemaVersion: 1,
      architectures: [{
        architectureId: "dup-impact",
        authorityRef: "docs/dup.md",
        impactRefs: ["src/a.ts", "src/a.ts"],
      }],
    },
  },
  {
    name: "invalid context ref",
    value: {
      schemaVersion: 1,
      architectures: [{
        architectureId: "bad-context",
        authorityRef: "docs/a.md",
        contextRef: "Invalid Context Ref",
        impactRefs: ["src/a.ts"],
      }],
    },
  },
];
for (const fixture of invalidManifests) {
  assert.equal(architectureImpactManifestSchema.safeParse(fixture.value).success, false, fixture.name);
}

const invalidRefs = [
  "/absolute/file.ts",
  "C:/absolute/file.ts",
  "src\\windows.ts",
  "../escape.ts",
  "src/../escape.ts",
  "./src/file.ts",
  "src//file.ts",
  "src/**/*.ts",
  "src/file?.ts",
  "src/[ab].ts",
  "docs/adr.md#section",
];
for (const ref of invalidRefs) {
  const result = architectureImpactManifestSchema.safeParse({
    schemaVersion: 1,
    architectures: [{ architectureId: "bad-ref", authorityRef: "docs/authority.md", impactRefs: [ref] }],
  });
  assert.equal(result.success, false, `v1 must reject non-exact ref: ${ref}`);
}

const projectContextManifest = {
  schemaVersion: 1,
  core: [{
    id: "project-context-architecture",
    kind: "context",
    description: "Architecture context fixture.",
    source: { path: "docs/architecture.md" },
  }],
  modules: [],
};
assert.equal(validateArchitectureImpactContextRefs(parsed, projectContextManifest).architectures.length, 1);
assert.throws(
  () => validateArchitectureImpactContextRefs(parsed, { ...projectContextManifest, core: [] }),
  /not indexed/,
);

const schemaText = await fs.readFile(new URL("../config/project-context/architecture-impact-manifest.schema.json", import.meta.url), "utf8");
const jsonSchema = JSON.parse(schemaText);
const ajv = new Ajv2020({ allErrors: true, strict: true, validateSchema: true });
assert.equal(ajv.validateSchema(jsonSchema), true, JSON.stringify(ajv.errors));
const validateJson = ajv.compile(jsonSchema);
assert.equal(validateJson(validManifest), true, JSON.stringify(validateJson.errors));
assert.equal(validateJson({ ...validManifest, extra: true }), false, "JSON schema must stay strict");
assert.equal(validateJson({
  schemaVersion: 1,
  architectures: [{ architectureId: "glob", authorityRef: "docs/a.md", impactRefs: ["src/**/*.ts"] }],
}), false, "JSON schema must reject glob refs too");

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-architecture-impact-"));
try {
  const missing = await loadArchitectureImpactManifest(tempRoot);
  assert.equal(missing.found, false);
  assert.equal(missing.path, path.join(tempRoot, ".mssr", "architecture-impact.json"));

  await fs.mkdir(path.join(tempRoot, ".mssr"), { recursive: true });
  await fs.writeFile(
    path.join(tempRoot, ".mssr", "project-context.json"),
    JSON.stringify(projectContextManifest, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(tempRoot, ".mssr", "architecture-impact.json"),
    JSON.stringify(validManifest, null, 2),
    "utf8",
  );

  const loaded = await loadArchitectureImpactManifest(tempRoot);
  assert.equal(loaded.found, true);
  assert.deepEqual(loaded.manifest, validManifest);
  assert.equal(loaded.projectContextPath, path.join(tempRoot, ".mssr", "project-context.json"));

  const absoluteImpact = resolveArchitectureImpactProjectPath(tempRoot, "src/project-context.ts");
  assert.equal(absoluteImpact, path.join(tempRoot, "src", "project-context.ts"));
  assert.throws(() => resolveArchitectureImpactProjectPath(tempRoot, "../outside.ts"));

  await fs.writeFile(
    path.join(tempRoot, ".mssr", "architecture-impact.json"),
    JSON.stringify({
      schemaVersion: 1,
      architectures: [{
        architectureId: "unknown-context",
        authorityRef: "docs/a.md",
        contextRef: "missing-context-id",
        impactRefs: ["src/a.ts"],
      }],
    }),
    "utf8",
  );
  await assert.rejects(() => loadArchitectureImpactManifest(tempRoot), /not indexed/);

  await fs.rm(path.join(tempRoot, ".mssr", "project-context.json"));
  await assert.rejects(() => loadArchitectureImpactManifest(tempRoot), /project-context\.json is missing/);

  await fs.writeFile(
    path.join(tempRoot, ".mssr", "architecture-impact.json"),
    JSON.stringify({
      schemaVersion: 1,
      architectures: [{ architectureId: "no-context", authorityRef: "docs/a.md", impactRefs: ["src/a.ts"] }],
    }),
    "utf8",
  );
  const withoutContextIndex = await loadArchitectureImpactManifest(tempRoot);
  assert.equal(withoutContextIndex.found, true, "context index is optional when no contextRef is declared");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}

console.log("MSSR architecture-impact C2f-A contract tests PASS");
