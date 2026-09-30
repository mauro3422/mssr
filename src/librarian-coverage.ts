import { z } from "zod";

export const MSSR_LIBRARIAN_COVERAGE_VERSION = 1 as const;

export const MSSR_LIBRARIAN_PRODUCER_STATUSES = [
  "instrumented",
  "partial",
  "missing",
  "not-applicable",
] as const;

export const MSSR_LIBRARIAN_PRODUCER_REQUIREMENTS = [
  "required",
  "conditional",
  "optional",
] as const;

export const MSSR_LIBRARIAN_AUTHORITY_CLASSES = [
  "canonical",
  "observed",
  "inferred",
  "learned",
  "mixed",
] as const;

export const MSSR_LIBRARIAN_PRIVACY_CLASSES = [
  "project-metadata",
  "operational-metadata",
  "public-metadata",
  "sensitive-excluded",
] as const;

export const MSSR_LIBRARIAN_RETENTION_CLASSES = [
  "durable",
  "runtime",
  "ephemeral",
  "owner-defined",
] as const;

const idSchema = z.string().min(2).max(120).regex(/^[a-z0-9][a-z0-9._:-]*$/);
const boundedText = (max: number) => z.string().min(1).max(max);

export const mssrLibrarianProducerCoverageSchema = z.object({
  id: idSchema,
  family: idSchema,
  description: boundedText(320),
  canonicalOwner: boundedText(160),
  requirement: z.enum(MSSR_LIBRARIAN_PRODUCER_REQUIREMENTS),
  status: z.enum(MSSR_LIBRARIAN_PRODUCER_STATUSES),
  authorityClass: z.enum(MSSR_LIBRARIAN_AUTHORITY_CLASSES),
  privacyClass: z.enum(MSSR_LIBRARIAN_PRIVACY_CLASSES),
  retentionClass: z.enum(MSSR_LIBRARIAN_RETENTION_CLASSES),
  stableIdentity: boundedText(320),
  canProve: z.array(boundedText(220)).min(1).max(12),
  cannotProve: z.array(boundedText(220)).min(1).max(12),
  namespaces: z.array(idSchema).max(12).default([]),
  adapterRef: boundedText(300).optional(),
  sourceRef: boundedText(300).optional(),
  note: boundedText(400).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.status === "instrumented" && !value.adapterRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Instrumented Librarian producers must declare adapterRef.",
      path: ["adapterRef"],
    });
  }
  if (value.status === "not-applicable" && value.requirement === "required") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A required Librarian producer cannot be marked not-applicable.",
      path: ["status"],
    });
  }
});

export const mssrLibrarianProducerCoverageBatchSchema = z.array(mssrLibrarianProducerCoverageSchema).max(128).superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const id = value[index]?.id;
    if (!id) continue;
    if (seen.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate Librarian producer id '${id}'.`,
        path: [index, "id"],
      });
    }
    seen.add(id);
  }
});

export type MssrLibrarianProducerCoverage = z.infer<typeof mssrLibrarianProducerCoverageSchema>;
export type MssrLibrarianProducerStatus = typeof MSSR_LIBRARIAN_PRODUCER_STATUSES[number];
export type MssrLibrarianProducerRequirement = typeof MSSR_LIBRARIAN_PRODUCER_REQUIREMENTS[number];

export const mssrLibrarianHostCoverageDeclarationSchema = z.object({
  schemaVersion: z.literal(1),
  producerId: idSchema,
  host: idSchema,
  status: z.enum(["instrumented", "partial", "not-applicable"]),
  conditional: z.literal(true),
  advisoryOnly: z.literal(true),
  canonicalRewriteAllowed: z.literal(false),
  adapterRef: boundedText(300).optional(),
  sourceRefs: z.array(boundedText(300)).min(1).max(12),
  capabilities: z.array(idSchema).max(24).default([]),
  canProve: z.array(boundedText(220)).min(1).max(12),
  cannotProve: z.array(boundedText(220)).min(1).max(12),
}).strict().superRefine((value, ctx) => {
  if ((value.status === "instrumented" || value.status === "partial") && !value.adapterRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Instrumented/partial host coverage declarations must declare adapterRef.",
      path: ["adapterRef"],
    });
  }
});

export const mssrLibrarianHostCoverageDeclarationBatchSchema = z.array(mssrLibrarianHostCoverageDeclarationSchema).max(64).superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const key = `${value[index]?.host}:${value[index]?.producerId}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate Librarian host coverage declaration '${key}'.`,
        path: [index, "producerId"],
      });
    }
    seen.add(key);
  }
});

export type MssrLibrarianHostCoverageDeclaration = z.infer<typeof mssrLibrarianHostCoverageDeclarationSchema>;

export const MSSR_LIBRARIAN_GAP_CODES = [
  "required-producer-missing",
  "required-producer-partial",
  "conditional-producer-missing",
  "conditional-producer-partial",
  "optional-producer-missing",
  "optional-producer-partial",
] as const;

export type MssrLibrarianGapCode = typeof MSSR_LIBRARIAN_GAP_CODES[number];

export type MssrLibrarianCoverageGap = {
  code: MssrLibrarianGapCode;
  producerId: string;
  family: string;
  requirement: MssrLibrarianProducerRequirement;
  status: Exclude<MssrLibrarianProducerStatus, "instrumented" | "not-applicable">;
  canonicalOwner: string;
  adapterRef: string | null;
  message: string;
  advisoryOnly: true;
};

function gapCode(entry: MssrLibrarianProducerCoverage): MssrLibrarianGapCode | null {
  if (entry.status !== "missing" && entry.status !== "partial") return null;
  if (entry.requirement === "required") return entry.status === "missing" ? "required-producer-missing" : "required-producer-partial";
  if (entry.requirement === "conditional") return entry.status === "missing" ? "conditional-producer-missing" : "conditional-producer-partial";
  return entry.status === "missing" ? "optional-producer-missing" : "optional-producer-partial";
}

function gapMessage(entry: MssrLibrarianProducerCoverage): string {
  const scope = entry.requirement === "required" ? "Required" : entry.requirement === "conditional" ? "Conditional" : "Optional";
  const state = entry.status === "missing" ? "does not currently cross" : "only partially crosses";
  return `${scope} producer '${entry.id}' ${state} the Librarian ingress contract; absence from the catalog is not evidence that its evidence or duplicates do not exist.`;
}

export function buildMssrLibrarianCoverageInventory(
  producers: readonly MssrLibrarianProducerCoverage[],
) {
  const entries = mssrLibrarianProducerCoverageBatchSchema.parse(producers)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));

  const gaps: MssrLibrarianCoverageGap[] = entries.flatMap((entry) => {
    const code = gapCode(entry);
    if (!code || (entry.status !== "missing" && entry.status !== "partial")) return [];
    return [{
      code,
      producerId: entry.id,
      family: entry.family,
      requirement: entry.requirement,
      status: entry.status,
      canonicalOwner: entry.canonicalOwner,
      adapterRef: entry.adapterRef ?? null,
      message: gapMessage(entry),
      advisoryOnly: true as const,
    }];
  });

  const required = entries.filter((entry) => entry.requirement === "required");
  const conditional = entries.filter((entry) => entry.requirement === "conditional");
  const optional = entries.filter((entry) => entry.requirement === "optional");
  const requiredGaps = gaps.filter((gap) => gap.requirement === "required");
  const conditionalGaps = gaps.filter((gap) => gap.requirement === "conditional");
  const optionalGaps = gaps.filter((gap) => gap.requirement === "optional");
  const globallyUncovered = entries.filter((entry) => entry.status === "missing" || entry.status === "partial");

  const statusCounts = Object.fromEntries(MSSR_LIBRARIAN_PRODUCER_STATUSES.map((status) => [status, 0])) as Record<MssrLibrarianProducerStatus, number>;
  for (const entry of entries) statusCounts[entry.status] += 1;

  return {
    schemaVersion: MSSR_LIBRARIAN_COVERAGE_VERSION,
    role: "librarian-coverage" as const,
    advisoryOnly: true as const,
    canonicalRewriteAllowed: false as const,
    jevRequired: false as const,
    entries,
    gaps,
    summary: {
      producers: entries.length,
      required: required.length,
      conditional: conditional.length,
      optional: optional.length,
      statusCounts,
      requiredGaps: requiredGaps.length,
      conditionalGaps: conditionalGaps.length,
      optionalGaps: optionalGaps.length,
      uncoveredProducers: globallyUncovered.length,
      requiredCoverageComplete: requiredGaps.length === 0,
      globalCoverageComplete: globallyUncovered.length === 0,
    },
    negativeClaimPolicy: {
      missingInstrumentationIsEvidenceOfAbsence: false as const,
      requiredScopeNegativeClaimAllowed: requiredGaps.length === 0,
      globalNegativeClaimAllowed: globallyUncovered.length === 0,
      rule: "A no-match/no-duplicate result is scoped only to instrumented producers; missing or partial producer coverage must remain visible." as const,
    },
  };
}

/**
 * R5.A initial declared producer inventory. Status means Librarian ingress adoption,
 * not whether the underlying subsystem exists or works.
 */
export const MSSR_LIBRARIAN_PRODUCER_COVERAGE = mssrLibrarianProducerCoverageBatchSchema.parse([
  {
    id: "document-surface",
    family: "documents",
    description: "Revision-bound Markdown document/section structure and exact fingerprints.",
    canonicalOwner: "source-document",
    requirement: "required",
    status: "instrumented",
    authorityClass: "observed",
    privacyClass: "project-metadata",
    retentionClass: "runtime",
    stableIdentity: "sourceRef + revision + heading/section identity",
    canProve: ["Exact document/section revision and structural fingerprint metadata crossed Librarian ingress."],
    cannotProve: ["Document authority, semantic truth, or equivalence between different fingerprints."],
    namespaces: ["document"],
    adapterRef: "src/librarian-contract.ts#librarianRecordsFromDocumentSurface",
    sourceRef: "src/document-surface.ts",
  },
  {
    id: "route-replan",
    family: "routing",
    description: "Structured route plans, intent normalization/correction and replans.",
    canonicalOwner: "mssr-routing-telemetry",
    requirement: "required",
    status: "instrumented",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "runtime",
    stableIdentity: "traceId + telemetry route event id + route action",
    canProve: ["Which privacy-bounded route/replan conclusions, skill selections, phase coverage and structured intent dimensions crossed Librarian ingress."],
    cannotProve: ["Raw task/context text, intent summaries, capability prose, transcripts, private reasoning, permission to act, or an unobserved route."],
    namespaces: ["route"],
    adapterRef: "src/librarian-route-adapter.ts#librarianRecordFromRouteTelemetry",
    sourceRef: "src/telemetry.ts",
  },
  {
    id: "project-context-selection",
    family: "context-selection",
    description: "Project-context module selection, Context Messages and delivery/receipt evidence.",
    canonicalOwner: "mssr-context-plane",
    requirement: "required",
    status: "instrumented",
    authorityClass: "mixed",
    privacyClass: "project-metadata",
    retentionClass: "runtime",
    stableIdentity: "project + module/message id + content fingerprint or receipt revision",
    canProve: ["Project-context module selection, Context Message selection/skips, selected-message fingerprints/provenance, and delivery/ack receipt state crossed Librarian ingress."],
    cannotProve: ["Current project truth, semantic correctness of a message, actual model use, retention after compaction, or omitted title/summary/persistence prose."],
    namespaces: ["context", "context-message"],
    adapterRef: "src/librarian-project-context-adapter.ts#librarianRecordFromProjectContextSelectionTelemetry+librarianRecordsFromContextMessageEvidence",
    sourceRef: "src/context-plane-host.ts",
    note: "Message title/summary, evidence summaries, selector scores/matches, persistence prose and continuation summaries are deliberately excluded from Librarian metadata.",
  },
  {
    id: "skill-selection-load",
    family: "skills",
    description: "Skill recommendation, host decision, load, redundancy and domain feedback.",
    canonicalOwner: "mssr-skill-routing",
    requirement: "required",
    status: "instrumented",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "runtime",
    stableIdentity: "traceId + telemetry skill event id + load/decision kind",
    canProve: ["Which privacy-bounded skill load and host-visible selection decision metadata crossed Librarian ingress, including typed reason codes and explicit redundancy peers."],
    cannotProve: ["Free-form warning/reason prose, semantic equivalence of different skills, routing truth beyond observed events, or permission to mutate skill sources."],
    namespaces: ["skill"],
    adapterRef: "src/librarian-skill-adapter.ts#librarianRecordFromSkillTelemetry",
    sourceRef: "src/telemetry.ts",
  },
  {
    id: "context-assembly-paging",
    family: "context-assembly",
    description: "Bounded skill/project context assembly, paging, retention and omission decisions.",
    canonicalOwner: "mssr-context-economy",
    requirement: "required",
    status: "instrumented",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "runtime",
    stableIdentity: "traceId + telemetry context assembly event id + stage/page",
    canProve: ["Which privacy-bounded context budget, delivery, paging, omission, retention-savings and continuation state crossed Librarian ingress."],
    cannotProve: ["Source/unit bodies, semantic relevance of omitted material, actual model use of delivered material, retention truth beyond the observed event, prompts/transcripts or private reasoning."],
    namespaces: ["context-assembly"],
    adapterRef: "src/librarian-context-assembly-adapter.ts#librarianRecordFromContextAssemblyTelemetry",
    sourceRef: "src/telemetry.ts",
  },
  {
    id: "trace-lifecycle-outcome",
    family: "lifecycle",
    description: "Trace checkpoints, verification, persistence, maintenance and outcomes.",
    canonicalOwner: "mssr-trace-contract",
    requirement: "required",
    status: "instrumented",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "durable",
    stableIdentity: "traceId + telemetry event id + lifecycle event type",
    canProve: ["Recorded privacy-bounded lifecycle checkpoint/outcome metadata and bounded evidence refs crossed Librarian ingress."],
    cannotProve: ["Project truth beyond the cited owner evidence, unrecorded activity, raw prompts/transcripts/tool arguments or private reasoning."],
    namespaces: ["trace", "outcome"],
    adapterRef: "src/librarian-trace-adapter.ts#librarianRecordFromTraceCheckpoint",
    sourceRef: "src/telemetry.ts",
  },
  {
    id: "semantic-experience",
    family: "learning",
    description: "Semantic Experience proposals, verification state and held-out learning evidence.",
    canonicalOwner: "mssr-semantic-experience",
    requirement: "required",
    status: "instrumented",
    authorityClass: "learned",
    privacyClass: "operational-metadata",
    retentionClass: "durable",
    stableIdentity: "experience observation id plus separate immutable verification-event identity",
    canProve: ["Which bounded shadow proposal/evidence metadata crossed Librarian ingress and which confirmed/corrected/rejected verification metadata was independently recorded."],
    cannotProve: ["Canonical truth, routing authority, provider self-verification, canonical rewrite or automatic application of learned output."],
    namespaces: ["experience"],
    adapterRef: "src/librarian-semantic-experience-adapter.ts#librarianRecordsFromSemanticExperienceObservation",
    sourceRef: "src/semantic-experience.ts",
  },
  {
    id: "operational-notices",
    family: "notices",
    description: "Operational Notice semantics, lifecycle transitions and bounded attention metadata.",
    canonicalOwner: "mssr-notice-plane",
    requirement: "required",
    status: "instrumented",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "runtime",
    stableIdentity: "noticeId + dedupeKey + event/current attention state",
    canProve: ["Which strict portable Notice v1 identity/transition metadata crossed Librarian ingress, including code/subject/levels/severity/fingerprint."],
    cannotProve: ["Underlying project truth, recovery completion, permission to act, host delivery/queue state, or human-facing message/recommendation prose."],
    namespaces: ["notice"],
    adapterRef: "src/librarian-notice-adapter.ts#librarianRecordFromMssrNotice",
    sourceRef: "src/mssr-notice.ts",
  },
  {
    id: "situation-consistency",
    family: "consistency",
    description: "Situation Model, semantic consistency, freshness and architecture-impact findings.",
    canonicalOwner: "mssr-consistency-plane",
    requirement: "required",
    status: "instrumented",
    authorityClass: "mixed",
    privacyClass: "project-metadata",
    retentionClass: "runtime",
    stableIdentity: "typed evaluator snapshot/finding id + source/evidence revision/fingerprint",
    canProve: ["Which typed Situation Model, semantic-consistency, Document Freshness and Architecture Impact findings/provenance crossed Librarian ingress."],
    cannotProve: ["Arbitrary prose truth, raw comparable scalar values, recovery/recommendation prose, permission, or semantic equivalence outside declared contracts."],
    namespaces: ["situation", "consistency", "architecture-impact"],
    adapterRef: "src/librarian-situation-consistency-adapter.ts",
    sourceRef: "src/situation-model.ts",
  },
  {
    id: "project-manifests",
    family: "manifests",
    description: "Project-context, architecture, freshness and other declared repository contracts.",
    canonicalOwner: "repository",
    requirement: "required",
    status: "instrumented",
    authorityClass: "canonical",
    privacyClass: "project-metadata",
    retentionClass: "durable",
    stableIdentity: "project + manifest path + declared contract/revision",
    canProve: ["Which validated project-context/segment/reference, architecture, document freshness/context, context-message and skill-context declarations crossed Librarian ingress with exact manifest/entry fingerprints."],
    cannotProve: ["Runtime adoption, current filesystem state, undeclared manifest families, or free-form declaration prose retained as catalog metadata."],
    namespaces: ["manifest"],
    adapterRef: "src/librarian-project-manifest-adapter.ts#librarianRecordsFromProjectManifest",
    sourceRef: ".mssr/project-context.json",
  },
  {
    id: "explicit-corrections-verifiers",
    family: "verification",
    description: "Explicit user/host corrections and independent verifier evidence.",
    canonicalOwner: "originating-verifier",
    requirement: "required",
    status: "instrumented",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "owner-defined",
    stableIdentity: "subject/decision id + verification id + verifier/provenance + evidence revision",
    canProve: ["That bounded explicit verification/correction evidence crossed Librarian ingress and whether provider/trace independence is proven by declared provenance."],
    cannotProve: ["Substantive truth beyond cited verifier evidence, hidden/raw corrections, provider self-confirmation, same-trace self-confirmation or canonical authority."],
    namespaces: ["verification", "correction"],
    adapterRef: "src/librarian-explicit-verification-adapter.ts#librarianRecordFromExplicitVerification",
  },
  {
    id: "host-tool-runtime-metrics",
    family: "host-runtime",
    description: "Host tool calls, failures, latency, provider/runtime health and runtime generations.",
    canonicalOwner: "host-runtime",
    requirement: "conditional",
    status: "partial",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "runtime",
    stableIdentity: "host + runtime generation + bounded call/metric event id",
    canProve: ["Portable MSSR can validate and catalog host-supplied privacy-bounded tool-call, runtime-generation, runtime-health and metric observations."],
    cannotProve: ["That any specific host actually emits the contract, raw arguments/results/error prose, portable MSSR semantics, project truth or absence on uninstrumented hosts."],
    namespaces: ["host", "tool", "metric"],
    adapterRef: "src/librarian-host-runtime-adapter.ts#librarianRecordFromHostRuntimeObservation",
    sourceRef: "src/librarian-host-runtime-adapter.ts",
    note: "Partial globally: the portable ingress contract exists, but host adoption is declared separately and cannot be inferred from MSSR source alone.",
  },
  {
    id: "git-filesystem-revisions",
    family: "source-observation",
    description: "Filesystem/Git/document revisions and bounded source availability observations.",
    canonicalOwner: "host-source-observer",
    requirement: "conditional",
    status: "partial",
    authorityClass: "observed",
    privacyClass: "project-metadata",
    retentionClass: "runtime",
    stableIdentity: "project + sourceRef + observed revision/hash/availability",
    canProve: ["Document Surface covers revision-bound Markdown; broader Git/filesystem observations remain outside Librarian ingress."],
    cannotProve: ["Complete workspace state while host source-observation adapters are missing."],
    namespaces: ["source", "revision", "document"],
    adapterRef: "src/librarian-contract.ts#librarianRecordsFromDocumentSurface",
    sourceRef: "src/document-surface.ts",
    note: "Partial because only the Document Surface slice currently crosses Librarian ingress.",
  },
  {
    id: "visual-qa-evidence",
    family: "visual-evidence",
    description: "Visual QA captures, regions, manifests and review evidence from capable hosts.",
    canonicalOwner: "visual-evidence-producer",
    requirement: "conditional",
    status: "missing",
    authorityClass: "observed",
    privacyClass: "project-metadata",
    retentionClass: "owner-defined",
    stableIdentity: "producer + capture/evidence id + source/project revision + manifest hash",
    canProve: ["What bounded visual evidence a capable host actually observed and retained."],
    cannotProve: ["Visual facts on hosts/projects where no visual evidence producer exists."],
    namespaces: ["visual-evidence"],
  },
]);

export function getMssrLibrarianCoverageInventory(ids?: readonly string[]) {
  if (!ids || ids.length === 0) return buildMssrLibrarianCoverageInventory(MSSR_LIBRARIAN_PRODUCER_COVERAGE);
  const requested = new Set(ids);
  return buildMssrLibrarianCoverageInventory(MSSR_LIBRARIAN_PRODUCER_COVERAGE.filter((entry) => requested.has(entry.id)));
}

export function getMssrLibrarianCoverageInventoryForHost(args: {
  host: string;
  declarations: readonly unknown[];
  ids?: readonly string[];
}) {
  const host = idSchema.parse(args.host);
  const declarations = mssrLibrarianHostCoverageDeclarationBatchSchema.parse(args.declarations);
  const byBaseId = new Map(MSSR_LIBRARIAN_PRODUCER_COVERAGE.map((entry) => [entry.id, entry] as const));
  const declarationByProducer = new Map<string, MssrLibrarianHostCoverageDeclaration>();

  for (const declaration of declarations) {
    if (declaration.host !== host) {
      throw new Error(`Librarian host coverage declaration for '${declaration.host}' cannot be applied to host '${host}'.`);
    }
    const base = byBaseId.get(declaration.producerId);
    if (!base) {
      throw new Error(`Unknown Librarian producer '${declaration.producerId}' in host coverage declaration.`);
    }
    if (base.requirement !== "conditional") {
      throw new Error(`Host coverage declarations may only refine conditional producers; '${declaration.producerId}' is '${base.requirement}'.`);
    }
    declarationByProducer.set(declaration.producerId, declaration);
  }

  const requested = args.ids && args.ids.length > 0 ? new Set(args.ids) : null;
  const selectedBase = requested
    ? MSSR_LIBRARIAN_PRODUCER_COVERAGE.filter((entry) => requested.has(entry.id))
    : MSSR_LIBRARIAN_PRODUCER_COVERAGE;
  const effectiveEntries = selectedBase.map<MssrLibrarianProducerCoverage>((entry) => {
    const declaration = declarationByProducer.get(entry.id);
    if (!declaration) return entry;
    return {
      ...entry,
      status: declaration.status,
      ...(declaration.adapterRef ? { adapterRef: declaration.adapterRef } : { adapterRef: undefined }),
      note: `Host-scoped coverage for '${host}'. Portable/global coverage remains unchanged.`,
    };
  });
  const inventory = buildMssrLibrarianCoverageInventory(effectiveEntries);

  return {
    ...inventory,
    hostScope: {
      schemaVersion: 1 as const,
      host,
      declarationCount: declarations.length,
      declarations,
      portableInventoryUnchanged: true as const,
      advisoryOnly: true as const,
      canonicalRewriteAllowed: false as const,
    },
  };
}
