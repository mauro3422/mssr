import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  blockizeMarkdownForSemanticCuration,
  buildMssrSemanticCurationJobsFromMarkdown,
  enqueueMssrOwnedSkillCurationCandidates,
  enqueueMssrSemanticCurationSource,
  readMssrSemanticCurationQueue,
} from "../dist/index.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-semantic-curation-source-"));
const queuePath = path.join(root, "state", "queue.json");
try {
  await fs.writeFile(path.join(root, "MEMORY.md"), `# Decisions\n\nCurrent invariant: never drop the no-push restriction.\n\n## Provider\n\nProvider timeout is 20 seconds.\n\nOlder provider timeout was 5 seconds.\n\nProvider timeout=20 seconds is the active configuration.\n\n## UI\n\nThe settings icon is circular.\n`, "utf8");

  const raw = await fs.readFile(path.join(root, "MEMORY.md"), "utf8");
  const blocks = blockizeMarkdownForSemanticCuration(raw);
  assert.ok(blocks.length >= 5);
  assert.equal(blocks[0].text, "# Decisions");

  const jobs = await buildMssrSemanticCurationJobsFromMarkdown({
    projectRoot: root,
    sourceRef: "MEMORY.md",
    reasons: ["project-root-file-growing", "duplicate-candidate"],
  });
  assert.ok(jobs.length >= 1);
  assert.ok(jobs.every((job) => job.projectKey === path.resolve(root)));
  assert.ok(jobs.every((job) => job.blocks.every((block) => block.sha256.length === 64)));
  assert.ok(jobs.every((job) => job.blocks.every((block) => block.sourceRef === "MEMORY.md")));
  assert.ok(jobs.every((job) => job.pairCandidates.length >= Math.max(0, job.blocks.length - 1)));
  assert.ok(jobs.every((job) => job.blocks.length * 4 + job.pairCandidates.length * 3 <= 64));
  assert.ok(jobs.some((job) => job.blocks.some((block) => block.protected)));

  const first = await enqueueMssrSemanticCurationSource({
    projectRoot: root,
    sourceRef: "MEMORY.md",
    reasons: ["project-root-file-growing"],
    priority: 10,
    queuePath,
  });
  assert.equal(first.inserted, true);
  const second = await enqueueMssrSemanticCurationSource({
    projectRoot: root,
    sourceRef: "MEMORY.md",
    reasons: ["duplicate-candidate"],
    priority: 20,
    queuePath,
  });
  assert.equal(second.inserted, false);
  assert.equal(second.merged, true);
  const queue = await readMssrSemanticCurationQueue(queuePath);
  assert.equal(queue.entries.length, 1);
  assert.equal(queue.entries[0].priority, 20);
  assert.deepEqual([...queue.entries[0].reasons].sort(), ["duplicate-candidate", "project-root-file-growing"]);

  const skillsRoot = path.join(root, "skills");
  const modularDir = path.join(skillsRoot, "modular");
  const monolithicDir = path.join(skillsRoot, "monolithic");
  const oversizedRefDir = path.join(skillsRoot, "oversized-ref");
  await Promise.all([
    fs.mkdir(modularDir, { recursive: true }),
    fs.mkdir(monolithicDir, { recursive: true }),
    fs.mkdir(path.join(oversizedRefDir, "references"), { recursive: true }),
  ]);

  await fs.writeFile(path.join(modularDir, "SKILL.md"), `---\nname: modular\ndescription: fixture\n---\n\n## Core\n\nSmall active core.\n\n## Historical Detail\n\n${"historical detail ".repeat(500)}\n`, "utf8");
  await fs.writeFile(path.join(modularDir, "context-modules.json"), `${JSON.stringify({
    schemaVersion: 1,
    core: { sections: ["## Core"] },
    modules: [],
  }, null, 2)}\n`, "utf8");

  await fs.writeFile(path.join(monolithicDir, "SKILL.md"), `---\nname: monolithic\ndescription: fixture\n---\n\n## Core\n\n${"monolithic procedure ".repeat(400)}\n`, "utf8");

  await fs.writeFile(path.join(oversizedRefDir, "SKILL.md"), `---\nname: oversized-ref\ndescription: fixture\n---\n\n## Core\n\nSmall active core.\n`, "utf8");
  await fs.writeFile(path.join(oversizedRefDir, "references", "deep.md"), `# Deep Reference\n\n${"durable reference detail ".repeat(150)}\n`, "utf8");
  await fs.writeFile(path.join(oversizedRefDir, "context-modules.json"), `${JSON.stringify({
    schemaVersion: 1,
    core: { sections: ["## Core"] },
    modules: [{
      id: "deep-reference",
      description: "Deep selective reference",
      source: { path: "references/deep.md" },
      maxChars: 1000,
    }],
  }, null, 2)}\n`, "utf8");

  const skillQueuePath = path.join(root, "state", "skill-queue.json");
  const skillCandidates = await enqueueMssrOwnedSkillCurationCandidates({
    roots: [skillsRoot],
    queuePath: skillQueuePath,
    skillCharsThreshold: 4000,
    referenceCharsThreshold: 4000,
  });
  const queuedSkillRefs = skillCandidates.queued.map((item) => item.entry.sourceRef).sort();
  assert.deepEqual(queuedSkillRefs, ["monolithic/SKILL.md", "oversized-ref/references/deep.md"]);
  assert.ok(!queuedSkillRefs.includes("modular/SKILL.md"));
  assert.equal((await readMssrSemanticCurationQueue(skillQueuePath)).entries.length, 2);

  console.log("semantic-curation-source tests passed");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
