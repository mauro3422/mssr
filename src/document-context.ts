import { z } from "zod";
import {
  SKILL_ACTIONS,
  SKILL_ARTIFACTS,
  SKILL_DOMAINS,
  SKILL_NEEDS,
  SKILL_SIGNALS,
  SKILL_STAGES,
  type SkillStage,
  type StructuredSkillIntent,
} from "./skill-routing.js";
import { selectContextModules, type ContextModuleDecision } from "./context-selection.js";
import {
  MSSR_CONTEXT_DELIVERY_TIERS,
  MSSR_CONTEXT_SOURCE_CLASSES,
  evaluateMssrContextDelivery,
  resolveMssrContextDeliveryBudget,
  type MssrContextDeliveryMode,
  type MssrContextSourceClass,
} from "./context-delivery-policy.js";
import {
  buildMssrMarkdownDocumentSurface,
  findMssrDocumentSurfaceHeadingBySelector,
  materializeMssrDocumentSurfaceSection,
  type MssrDocumentSurface,
} from "./document-surface.js";

const selectorFields = {
  stages: z.array(z.enum(SKILL_STAGES)).max(6).default([]),
  domains: z.array(z.enum(SKILL_DOMAINS)).max(8).default([]),
  actions: z.array(z.enum(SKILL_ACTIONS)).max(12).default([]),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).max(12).default([]),
  needs: z.array(z.enum(SKILL_NEEDS)).max(12).default([]),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(12).default([]),
};

const headingSchema = z.string().min(1).max(160);

export const documentContextCoreSchema = z.object({
  sections: z.array(headingSchema).min(1).max(24),
  maxChars: z.number().int().min(200).max(80_000).optional(),
}).strict();

export const documentContextModuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  description: z.string().min(1).max(300),
  sections: z.array(headingSchema).min(1).max(24),
  tier: z.enum(MSSR_CONTEXT_DELIVERY_TIERS).default("relevant"),
  ...selectorFields,
  required: z.boolean().default(false),
  priority: z.number().int().min(-100).max(100).default(0),
  maxChars: z.number().int().min(200).max(80_000).optional(),
  exclusiveGroup: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.required && value.exclusiveGroup) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required document-context modules cannot belong to an exclusive group.", path: ["exclusiveGroup"] });
  }
  if (value.tier === "authority" && !value.required) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Authority-tier document modules must be explicitly required; unconditional authority belongs in core.", path: ["tier"] });
  }
});

export const documentContextManifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceClass: z.enum(MSSR_CONTEXT_SOURCE_CLASSES),
  core: documentContextCoreSchema,
  modules: z.array(documentContextModuleSchema).max(96).default([]),
}).strict();

export type DocumentContextManifest = z.infer<typeof documentContextManifestSchema>;
export type DocumentContextModule = z.infer<typeof documentContextModuleSchema>;

/** Portable adjacent-sidecar convention, e.g. AGENTS.md.context.json. */
export function documentContextManifestPath(documentPath: string): string {
  return `${documentPath}.context.json`;
}

export type DocumentContextAssembly = {
  sourceClass: MssrContextSourceClass;
  mode: MssrContextDeliveryMode;
  selectionMode: "core-only" | "semantic";
  intentRequired: boolean;
  content: string;
  fullChars: number;
  loadedChars: number;
  estimatedCharsSaved: number;
  coreCharsLoaded: number;
  selectedModules: string[];
  omittedModules: string[];
  decisions: Array<ContextModuleDecision & { tier: string; deliveryReason?: string }>;
  budgetExceeded: boolean;
  requiredBudgetExceeded: boolean;
  remainingChars: number;
};

function extractDocumentContextSectionsFromSurface(args: {
  markdown: string;
  surface: MssrDocumentSurface;
  headings: readonly string[];
}): string {
  return args.headings.map((heading) => {
    const section = findMssrDocumentSurfaceHeadingBySelector(args.surface, heading);
    if (!section) throw new Error(`Document context section not found: ${heading}`);
    return materializeMssrDocumentSurfaceSection({
      markdown: args.markdown,
      surface: args.surface,
      sectionId: section.id,
    }).text.trim();
  }).join("\n\n");
}

/** Extract exact Markdown heading blocks through the shared revision-bound Document Surface. */
export function extractDocumentContextSections(markdown: string, headings: readonly string[]): string {
  const surface = buildMssrMarkdownDocumentSurface({
    sourceRef: "document-context:inline",
    markdown,
  });
  return extractDocumentContextSectionsFromSurface({ markdown, surface, headings });
}

/**
 * Assemble one authoritative Markdown source through the portable context policy.
 * The manifest is explicit: callers must use full fallback when no valid manifest exists.
 */
export function assembleDocumentContext(args: {
  markdown: string;
  manifest: DocumentContextManifest;
  intent?: StructuredSkillIntent;
  stage: SkillStage;
  mode?: MssrContextDeliveryMode;
  maxChars?: number;
  maxModules?: number;
}): DocumentContextAssembly {
  const manifest = documentContextManifestSchema.parse(args.manifest);
  const budget = resolveMssrContextDeliveryBudget({
    mode: args.mode,
    requestedChars: args.maxChars,
    requestedItems: args.maxModules,
    compactChars: 6_000,
    compactItems: 6,
  });
  const fullChars = args.markdown.length;
  const surface = buildMssrMarkdownDocumentSurface({
    sourceRef: "document-context:assembly",
    markdown: args.markdown,
  });
  const core = extractDocumentContextSectionsFromSurface({ markdown: args.markdown, surface, headings: manifest.core.sections });
  const coreLimit = Math.min(manifest.core.maxChars ?? 80_000, 80_000);
  if (core.length > coreLimit) throw new Error(`Document context core exceeds ${coreLimit} characters.`);

  if (!args.intent) {
    return {
      sourceClass: manifest.sourceClass,
      mode: budget.mode,
      selectionMode: "core-only",
      intentRequired: manifest.modules.length > 0,
      content: core,
      fullChars,
      loadedChars: core.length,
      estimatedCharsSaved: Math.max(0, fullChars - core.length),
      coreCharsLoaded: core.length,
      selectedModules: [],
      omittedModules: [],
      decisions: manifest.modules.map((module) => ({
        id: module.id,
        selected: false,
        score: 0,
        chars: 0,
        reason: "intent-mismatch" as const,
        matched: [],
        tier: module.tier,
        deliveryReason: "intent-required",
      })),
      budgetExceeded: core.length > budget.maxChars,
      requiredBudgetExceeded: core.length > budget.maxChars,
      remainingChars: Math.max(0, budget.maxChars - core.length),
    };
  }

  const candidates = manifest.modules.map((module) => ({ ...module, chars: 0 }));
  const eligibility = selectContextModules({ modules: candidates, intent: args.intent, stage: args.stage, maxModuleChars: Number.MAX_SAFE_INTEGER });
  const eligibleIds = new Set(eligibility.selected.map((module) => module.id));
  const materialized = manifest.modules
    .filter((module) => eligibleIds.has(module.id))
    .map((module) => {
      const content = extractDocumentContextSectionsFromSurface({ markdown: args.markdown, surface, headings: module.sections });
      const maxChars = Math.min(module.maxChars ?? 80_000, 80_000);
      if (content.length > maxChars) throw new Error(`Document context module '${module.id}' exceeds ${maxChars} characters.`);
      return { ...module, content, chars: content.length + 2 };
    });

  const selection = selectContextModules({
    modules: materialized.map(({ content: _content, ...module }) => module),
    intent: args.intent,
    stage: args.stage,
    maxModuleChars: Number.MAX_SAFE_INTEGER,
  });
  const decisionById = new Map(selection.decisions.map((decision) => [decision.id, decision]));
  const ranked = [...materialized].sort((left, right) => {
    const a = decisionById.get(left.id)?.score ?? 0;
    const b = decisionById.get(right.id)?.score ?? 0;
    return Number(right.required) - Number(left.required) || b - a || right.priority - left.priority || left.id.localeCompare(right.id);
  });

  let remaining = Math.max(0, budget.maxChars - core.length);
  let remainingItems = budget.maxItems;
  const selected: typeof ranked = [];
  const omitted = new Set<string>();
  const deliveryReason = new Map<string, string>();
  for (const module of ranked) {
    const semanticMatch = (decisionById.get(module.id)?.matched.length ?? 0) > 0;
    const delivery = evaluateMssrContextDelivery({ tier: module.tier, mode: budget.mode, semanticMatch });
    if (module.required) {
      selected.push(module);
      deliveryReason.set(module.id, module.tier === "authority" ? "authority" : "required");
      remaining = Math.max(0, remaining - module.chars);
      remainingItems = Math.max(0, remainingItems - 1);
      continue;
    }
    if (!delivery.deliver) {
      omitted.add(module.id);
      deliveryReason.set(module.id, delivery.reason);
      continue;
    }
    if (remainingItems > 0 && module.chars <= remaining) {
      selected.push(module);
      deliveryReason.set(module.id, delivery.reason);
      remaining -= module.chars;
      remainingItems -= 1;
    } else {
      omitted.add(module.id);
      deliveryReason.set(module.id, "budget-exceeded");
    }
  }

  const content = [core, ...selected.map((module) => module.content)].filter(Boolean).join("\n\n").trim();
  const selectedIds = new Set(selected.map((module) => module.id));
  const decisions = manifest.modules.map((module) => {
    const base = decisionById.get(module.id) ?? eligibility.decisions.find((decision) => decision.id === module.id) ?? {
      id: module.id, selected: false, score: 0, chars: 0, reason: "intent-mismatch" as const, matched: [],
    };
    return {
      ...base,
      selected: selectedIds.has(module.id),
      reason: selectedIds.has(module.id) ? "selected" as const : omitted.has(module.id) ? "budget-exceeded" as const : base.reason,
      tier: module.tier,
      ...(deliveryReason.has(module.id) ? { deliveryReason: deliveryReason.get(module.id) } : {}),
    };
  });
  const requiredBudgetExceeded = core.length + selected.filter((module) => module.required).reduce((sum, module) => sum + module.chars, 0) > budget.maxChars;

  return {
    sourceClass: manifest.sourceClass,
    mode: budget.mode,
    selectionMode: "semantic",
    intentRequired: false,
    content,
    fullChars,
    loadedChars: content.length,
    estimatedCharsSaved: Math.max(0, fullChars - content.length),
    coreCharsLoaded: core.length,
    selectedModules: selected.map((module) => module.id),
    omittedModules: [...omitted],
    decisions,
    budgetExceeded: omitted.size > 0 || content.length > budget.maxChars,
    requiredBudgetExceeded,
    remainingChars: Math.max(0, budget.maxChars - content.length),
  };
}
