import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeMssrProject } from "../dist/project-initialization.js";
import { auditMssrProjectContextHealth } from "../dist/project-context-health.js";
import {
  applyMssrProjectDocumentReferenceRegistration,
  planMssrProjectDocumentReferenceRegistration,
  readMssrProjectDocumentReferenceOnMiss,
} from "../dist/project-document-references.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-project-doc-refs-"));
try {
  const repo = path.join(root, "repo");
  await fs.mkdir(path.join(repo, ".git"), { recursive: true });
  await initializeMssrProject(repo);
  await fs.mkdir(path.join(repo, "docs"), { recursive: true });

  const architecturePath = path.join(repo, "docs", "ARCHITECTURE.md");
  const roadmapPath = path.join(repo, "docs", "ROADMAP.md");
  const architectureText = "# Architecture\n\nThe runtime routes requests through the context plane.\n";
  await fs.writeFile(architecturePath, architectureText, "utf8");
  await fs.writeFile(roadmapPath, "# Roadmap\n\nNext milestones.\n", "utf8");

  const health = await auditMssrProjectContextHealth(repo);
  assert.equal(health.referenceAudit?.highPriorityCount, 2);
  assert.equal(health.referenceAudit?.candidates.some((item) => item.path === "docs/ARCHITECTURE.md"), true);

  const noMatch = await readMssrProjectDocumentReferenceOnMiss({ projectRoot: repo, query: "database migrations" });
  assert.equal(noMatch.status, "no-match");
  assert.equal(noMatch.truthAuthority, false);
  assert.equal(noMatch.canonicalRewriteAllowed, false);

  const ambiguous = await readMssrProjectDocumentReferenceOnMiss({ projectRoot: repo, query: "architecture roadmap" });
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(ambiguous.candidates.length, 2);

  const recovered = await readMssrProjectDocumentReferenceOnMiss({ projectRoot: repo, query: "architecture" });
  assert.equal(recovered.status, "selected");
  assert.equal(recovered.candidate.path, "docs/ARCHITECTURE.md");
  assert.match(recovered.content, /context plane/);
  assert.equal(recovered.authority, "candidate-only");
  assert.equal(recovered.registrationRequired, true);
  assert.equal(recovered.routingInfluence, false);

  const exactRecovered = await readMssrProjectDocumentReferenceOnMiss({
    projectRoot: repo,
    query: "",
    candidatePath: "docs/ROADMAP.md",
    maxChars: 500,
  });
  assert.equal(exactRecovered.status, "selected");
  assert.equal(exactRecovered.candidate.path, "docs/ROADMAP.md");

  const manifestPath = path.join(repo, ".mssr", "project-context.json");
  const manifestBefore = await fs.readFile(manifestPath, "utf8");
  const module = {
    id: "external-architecture-reference",
    kind: "context",
    topic: "architecture",
    area: "core",
    description: "Current project architecture.",
    source: { path: "docs/ARCHITECTURE.md" },
    stages: [],
    domains: ["coding", "agent-orchestration"],
    actions: ["review", "analyze", "maintain"],
    artifacts: ["project", "repository", "document"],
    needs: ["integrity-verification"],
    signals: [],
    required: false,
    priority: 70,
    maxChars: 4000,
  };

  const plan = await planMssrProjectDocumentReferenceRegistration({
    projectRoot: repo,
    sourcePath: "docs/ARCHITECTURE.md",
    module,
  });
  assert.equal(plan.created, true);
  assert.equal(plan.advisoryOnly, true);
  assert.equal(plan.canonicalRewriteAllowed, false);
  assert.equal((await fs.readFile(manifestPath, "utf8")), manifestBefore, "planning must not mutate the manifest");

  await assert.rejects(
    applyMssrProjectDocumentReferenceRegistration({
      projectRoot: repo,
      sourcePath: "docs/ARCHITECTURE.md",
      confirmSourcePath: "docs/ROADMAP.md",
      module,
      expectedSourceSha256: plan.sourceSha256,
      expectedManifestSha256: plan.expectedManifestSha256,
    }),
    /exact sourcePath confirmation/,
  );

  await fs.writeFile(architecturePath, `${architectureText}\nConcurrent edit.\n`, "utf8");
  await assert.rejects(
    applyMssrProjectDocumentReferenceRegistration({
      projectRoot: repo,
      sourcePath: "docs/ARCHITECTURE.md",
      confirmSourcePath: "docs/ARCHITECTURE.md",
      module,
      expectedSourceSha256: plan.sourceSha256,
      expectedManifestSha256: plan.expectedManifestSha256,
    }),
    /changed before registration/,
  );
  await fs.writeFile(architecturePath, architectureText, "utf8");

  const freshPlan = await planMssrProjectDocumentReferenceRegistration({
    projectRoot: repo,
    sourcePath: "docs/ARCHITECTURE.md",
    module,
  });
  const applied = await applyMssrProjectDocumentReferenceRegistration({
    projectRoot: repo,
    sourcePath: "docs/ARCHITECTURE.md",
    confirmSourcePath: "docs/ARCHITECTURE.md",
    module,
    expectedSourceSha256: freshPlan.sourceSha256,
    expectedManifestSha256: freshPlan.expectedManifestSha256,
  });
  assert.equal(applied.registered, true);
  assert.equal(applied.authorityBasis, "explicit-reviewed-registration");

  const persistedManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  assert.equal(persistedManifest.modules.some((entry) => entry.id === "external-architecture-reference" && entry.source?.path === "docs/ARCHITECTURE.md"), true);
  const after = await auditMssrProjectContextHealth(repo);
  assert.equal(after.referenceAudit?.candidates.some((item) => item.path === "docs/ARCHITECTURE.md"), false);
  assert.equal(after.referenceAudit?.candidates.some((item) => item.path === "docs/ROADMAP.md"), true);

  await assert.rejects(
    planMssrProjectDocumentReferenceRegistration({
      projectRoot: repo,
      sourcePath: "docs/ARCHITECTURE.md",
      module: { ...module, id: "duplicate-architecture-owner" },
    }),
    /already registered/,
  );
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

console.log("project document reference lifecycle tests passed");
