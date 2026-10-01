import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  fetchMssrLibrarianEvidence,
  mssrLibrarianEvidenceHandleSchema,
  mssrLibrarianRetrievalDocumentSchema,
  mssrLibrarianRetrievalQuerySchema,
  searchMssrLibrarianEvidence,
} from "./librarian-retrieval.js";
import { MssrJevSemanticCuratorProvider } from "./semantic-curation-jev.js";
import type { MssrJevDecisionProvider } from "./semantic-curation-jev-contract.js";
import { mssrEvidenceAtomSchema } from "./evidence-atom.js";
import {
  mssrSemanticEvidenceRelationReviewInputSchema,
  reviewMssrSemanticEvidenceRelations,
} from "./semantic-evidence-review.js";
import {
  buildMssrSemanticSynthesisProposal,
  mssrSemanticSynthesisSourceEvidenceSchema,
} from "./semantic-synthesis-proposal.js";
import {
  MSSR_LIBRARIAN_JEV_SELECTION_LIMITS,
  mssrLibrarianJevSelectInputSchema,
  selectMssrLibrarianEvidenceWithJev,
} from "./librarian-jev-selection.js";

export const MSSR_SEMANTIC_EVIDENCE_TOOL_NAMES = [
  "mssr_librarian_search",
  "mssr_librarian_fetch",
  "mssr_semantic_evidence_relation_review",
  "mssr_semantic_evidence_synthesis_preview",
  "mssr_librarian_jev_select",
] as const;

export const mssrLibrarianSearchToolInputSchema = z.object({
  documents: z.array(mssrLibrarianRetrievalDocumentSchema).max(32),
  query: mssrLibrarianRetrievalQuerySchema,
}).strict().superRefine((value, ctx) => {
  const chars = value.documents.reduce((sum, document) => sum + document.markdown.length, 0);
  const records = value.documents.reduce((sum, document) => sum + (document.records?.length ?? 0), 0);
  if (chars > 4_000_000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["documents"], message: "MCP Librarian search is capped at 4,000,000 total Markdown characters." });
  if (records > 2_048) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["documents"], message: "MCP Librarian search is capped at 2,048 total catalog records." });
});

export const mssrLibrarianFetchToolInputSchema = z.object({
  handle: mssrLibrarianEvidenceHandleSchema,
  owner: z.string().trim().min(1).max(240),
  sourceRef: z.string().trim().min(1).max(1_000),
  markdown: z.string().max(2_000_000),
  privacyClass: z.enum(["project-metadata", "operational-metadata", "public-metadata", "sensitive-excluded"]),
}).strict();

export const mssrSemanticEvidenceSynthesisPreviewToolInputSchema = z.object({
  judgment: z.record(z.unknown()),
  inputAtoms: z.array(mssrEvidenceAtomSchema).min(1).max(64),
  sourceEvidence: z.array(mssrSemanticSynthesisSourceEvidenceSchema).min(1).max(64),
  minimumRawRelationConfidence: z.number().min(0).max(1).optional(),
}).strict();

function response(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

export type MssrSemanticEvidenceToolOptions = {
  /** Optional host-owned transport, also useful for deterministic MCP integration tests. */
  decisionProvider?: MssrJevDecisionProvider;
};

/** Register advisory evidence search/review tools for each MSSR MCP host. */
export function registerMssrSemanticEvidenceTools(server: McpServer, options: MssrSemanticEvidenceToolOptions = {}): void {
  server.registerTool(MSSR_SEMANTIC_EVIDENCE_TOOL_NAMES[0], {
    description: "Search only caller-supplied Markdown and bounded catalog records. Returns advisory exact-source candidate handles. It does not scan the filesystem, authenticate owner/privacy/catalog provenance, decide truth, or grant read/write authority.",
    inputSchema: mssrLibrarianSearchToolInputSchema,
  }, async (args) => response(searchMssrLibrarianEvidence(args)));

  server.registerTool(MSSR_SEMANTIC_EVIDENCE_TOOL_NAMES[1], {
    description: "Revalidate and fetch one exact Librarian range from Markdown supplied by the caller. The host must authorize and read the source itself; this tool checks source revision, handle identity, range, fingerprint and caller-supplied privacy label. It is not an authorization boundary.",
    inputSchema: mssrLibrarianFetchToolInputSchema,
  }, async (args) => response(fetchMssrLibrarianEvidence(args)));

  server.registerTool(MSSR_SEMANTIC_EVIDENCE_TOOL_NAMES[2], {
    description: "Ask Jev bounded relation questions over exact fetched evidence grouped into compatible project/corpus batches. Returns content-addressed atom-bound judgments and reports selected-option confidence without fabricating a class distribution. Every judgment remains unverified/advisory; the host must independently verify before synthesis or any write.",
    inputSchema: mssrSemanticEvidenceRelationReviewInputSchema,
  }, async ({ model, ...input }) => {
    const provider = options.decisionProvider ?? new MssrJevSemanticCuratorProvider(model ? { model } : {}).decisionProvider;
    return response(await reviewMssrSemanticEvidenceRelations({ input: { ...input, ...(model ? { model } : {}) }, provider }));
  });

  server.registerTool(MSSR_SEMANTIC_EVIDENCE_TOOL_NAMES[3], {
    description: "Build an immutable exact-text preview from caller-supplied snapshots. MSSR validates internal hashes/bindings but cannot authenticate verifier evidence or prove that source revisions are still current; both are explicitly marked caller-asserted, and the host must re-read sources before consuming a candidate. Contradictions, unknown comparability, non-fresh sources and unverified judgments stay review-only. Never writes or applies canonical changes.",
    inputSchema: mssrSemanticEvidenceSynthesisPreviewToolInputSchema,
  }, async (args) => response(buildMssrSemanticSynthesisProposal(args)));

  server.registerTool(MSSR_SEMANTIC_EVIDENCE_TOOL_NAMES[4], {
    description: `Explicitly select one exact-source range from caller-supplied Markdown with a live Jev Choice call. It can consider at most ${MSSR_LIBRARIAN_JEV_SELECTION_LIMITS.maxHeadingCandidates} heading candidates, or up to ${MSSR_LIBRARIAN_JEV_SELECTION_LIMITS.maxCandidateHandles} previously searched revision-bound section/block handles, plus a none option. Returns an advisory revision-bound handle that the caller must re-read with mssr_librarian_fetch. It does not search the filesystem, establish truth, generate prose or write canonical sources.`,
    inputSchema: mssrLibrarianJevSelectInputSchema,
  }, async (args) => {
    const provider = options.decisionProvider ?? new MssrJevSemanticCuratorProvider(args.model ? { model: args.model } : {}).decisionProvider;
    return response(await selectMssrLibrarianEvidenceWithJev(args, provider));
  });
}
