import assert from "node:assert/strict";
import {
  MssrJevSemanticCuratorProvider,
  executeMssrJevProjectContextBaselineVerifier,
  executeMssrJevProjectContextSplitJudgments,
  executeMssrJevSemanticCurationJobs,
  hashSemanticCurationText,
  mssrJevDecisionRequestSchema,
  validateMssrJevDecisionResponse,
} from "../dist/index.js";

const requests = [];
const hostProvider = {
  async executeSystemOne(request) {
    requests.push(request);
    const answers = Object.fromEntries(Object.entries(request.questions).map(([key, question]) => {
      if (question.kind === "noul") return [key, { type: "noul", noul: 0.5 }];
      const choice = key === "action" && question.options.review ? "review"
        : key === "lifecycle" && question.options.unknown ? "unknown"
          : key === "parentRelation" && question.options.unknown ? "unknown"
            : Object.keys(question.options)[0];
      return [key, { type: "choice", choice, confidence: 0.9 }];
    }));
    return { provider: "fixture-host", model: "fixture-model", answers, usage: { input_tokens: 11, output_tokens: 7 } };
  },
};
const options = {
  decisionProvider: hostProvider,
  // Compatibility values must be ignored when the host supplies its transport.
  apiKey: "fixture-secret-must-not-cross-boundary",
  baseURL: "https://invalid.example",
};
const block = (id, text) => ({
  id,
  text,
  sourceRef: `docs/${id}.md`,
  sha256: hashSemanticCurationText(text),
  validity: "unknown",
  protected: false,
  topicCandidates: ["reference", "architecture"],
});
const parent = {
  id: "project-context",
  kind: "context",
  description: "Stable project context authority.",
  sourceRef: ".mssr/PROJECT_CONTEXT.md",
  selectors: { stages: [], domains: [], actions: [], artifacts: [], needs: [], signals: [] },
  priority: 1,
  required: false,
  maxChars: 2000,
};
const splitJob = {
  id: "split-job",
  projectKey: "fixture-project",
  corpusKey: "fixture-corpus",
  goal: "Place one section safely.",
  semanticContext: { operation: "project-context-ref-split", parent },
  blocks: [block("section-a", "Historical detail that remains useful.")],
  pairCandidates: [],
};

const single = new MssrJevSemanticCuratorProvider(options);
const singleResult = await single.curate({ goal: "Classify a block.", blocks: [block("b1", "A bounded evidence block.")], pairCandidates: [] });
assert.equal(singleResult.provider, "fixture-host");

const batch = await executeMssrJevSemanticCurationJobs({ jobs: [{ ...splitJob, semanticContext: undefined }], options });
assert.equal(batch.results.length, 1);
assert.equal(batch.results[0].providerResult.provider, "fixture-host");
assert.equal(batch.batches[0].usage.input_tokens, 11);

const split = await executeMssrJevProjectContextSplitJudgments({ jobs: [splitJob], options });
assert.equal(split.judgments.length, 1);
assert.equal(split.judgments[0].action.value, "review");
assert.equal(split.judgments[0].modelId, "fixture-model");

const verifier = await executeMssrJevProjectContextBaselineVerifier({
  semanticContext: splitJob.semanticContext,
  anchor: block("anchor", "Current baseline anchor."),
  candidates: [block("candidate", "Candidate section.")],
  options,
});
assert.equal(verifier.verifications.length, 1);
assert.equal(verifier.verifications[0].action.value, "review");
assert.equal(verifier.verifications[0].usage.output_tokens, 7);

assert.equal(requests.length, 4);
assert.ok(requests.every((request) => Object.keys(request).every((key) => ["state", "questions", "model"].includes(key))));
assert.ok(requests.every((request) => !JSON.stringify(request).includes("fixture-secret-must-not-cross-boundary")));
assert.ok(requests.every((request) => Object.values(request.questions).every((question) => question.kind === "choice" || question.kind === "noul")));

const validRequest = { state: {}, questions: { q0: { kind: "choice", prompt: "Choose.", options: { a: "A", b: "B" } } } };
assert.throws(() => mssrJevDecisionRequestSchema.parse({ ...validRequest, state: "x".repeat(262_145) }), /262144-character/);
assert.throws(() => validateMssrJevDecisionResponse(validRequest, {
  provider: "fixture", model: "fixture", answers: {}, usage: { input_tokens: 0, output_tokens: 0 },
}), /exactly match/);
assert.throws(() => validateMssrJevDecisionResponse(validRequest, {
  provider: "fixture", model: "fixture", answers: { q0: { type: "choice", choice: "outside", confidence: 1 } }, usage: { input_tokens: 0, output_tokens: 0 },
}), /invalid choice/);
assert.throws(() => validateMssrJevDecisionResponse(validRequest, {
  provider: "fixture", model: "fixture", answers: { q0: { type: "noul", noul: 0.5 } }, usage: { input_tokens: 0, output_tokens: 0 },
}), /invalid choice/);
assert.throws(() => validateMssrJevDecisionResponse(validRequest, {
  provider: "fixture", model: "fixture", answers: { q0: { type: "choice", choice: "a", confidence: 1.1 } }, usage: { input_tokens: 0, output_tokens: 0 },
}), /confidence/);

console.log("semantic curation Jev transport tests passed");
