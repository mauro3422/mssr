import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  enqueueMssrSemanticCurationSource,
  processMssrSemanticCurationQueue,
  readMssrSemanticCurationQueue,
} from "../dist/index.js";

if (!process.env.TYPESAFE_API_KEY) throw new Error("TYPESAFE_API_KEY is required for the live semantic-curation smoke.");

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-semantic-curation-live-"));
const projectRoot = path.join(root, "project");
const queuePath = path.join(root, "state", "semantic-curation-queue.json");
const reviewRoot = path.join(root, "state", "reviews");
try {
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.writeFile(path.join(projectRoot, "MEMORY.md"), `# Project Memory\n\nCurrent provider timeout is 20 seconds.\n\nProvider timeout=20 seconds is the active configuration.\n\nOlder provider timeout was 5 seconds.\n\nDecision: never retry POST /charge without an idempotency key.\n\nA duplicate charge was observed when POST /charge was retried without an idempotency key.\n\nThe settings panel icon is circular.\n`, "utf8");

  await enqueueMssrSemanticCurationSource({
    projectRoot,
    sourceRef: "MEMORY.md",
    reasons: ["project-root-file-growing", "duplicate-candidate"],
    priority: 50,
    queuePath,
  });

  const result = await processMssrSemanticCurationQueue({
    queuePath,
    reviewRoot,
    maxEntries: 1,
    concurrency: 2,
    maxHeadsPerRequest: 64,
    maxStateChars: 24_000,
    jev: { model: "jev-1.13.0", timeoutMs: 30_000, maxRetries: 0, logLevel: "off" },
  });

  assert.equal(result.failedEntries.length, 0);
  assert.equal(result.processedEntries.length, 1);
  assert.equal(result.reviewFiles.length, 1);
  assert.ok(result.run);
  assert.ok(result.run.batches.length >= 1);
  assert.ok(result.run.batches.every((batch) => batch.heads <= 64));
  assert.ok(result.run.batches.every((batch) => batch.corpusKey === "MEMORY.md"));
  assert.ok(result.run.batches.every((batch) => batch.projectKey === path.resolve(projectRoot)));
  const queue = await readMssrSemanticCurationQueue(queuePath);
  assert.equal(queue.entries.length, 0);
  const review = JSON.parse(await fs.readFile(result.reviewFiles[0], "utf8"));
  assert.equal(review.sourceTextDuplicated, false);
  assert.equal(review.canonicalRewriteAllowed, false);
  assert.ok(review.jobs.length >= 1);
  assert.ok(review.jobs.every((job) => Array.isArray(job.blockProvenance)));

  console.log(JSON.stringify({
    ok: true,
    batches: result.run.batches.map((batch) => ({ heads: batch.heads, stateChars: batch.stateChars, inputTokens: batch.usage.input_tokens, outputTokens: batch.usage.output_tokens, elapsedMs: Math.round(batch.elapsedMs) })),
    totalHeads: result.run.totalHeads,
    totalInputTokens: result.run.totalInputTokens,
    totalOutputTokens: result.run.totalOutputTokens,
    reviewFiles: result.reviewFiles.length,
    queueRemaining: queue.entries.length,
  }, null, 2));
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
