import { z } from "zod";
import {
  SKILL_PHASES,
  SKILL_STAGES,
  resolveSkillLoadSelection,
  structuredSkillIntentSchema,
  type SkillLoadSelection,
  type SkillStage,
} from "./skill-routing.js";
import { mssrSkillDecisionSchema, type MssrSkillDecisionRecord } from "./trace-contract.js";
import { mssrContextMessageBatchSchema } from "./context-messages.js";
import {
  MAX_HOST_CONTEXT_MESSAGE_CHARS,
  MAX_HOST_PROJECT_CONTEXT_CHARS,
  MAX_HOST_PROJECT_CONTEXT_MODULES,
} from "./context-plane-host.js";

export const MSSR_SELECTION_MODES = ["auto", "host-gated"] as const;
export const MSSR_SKILL_CONTEXT_MODES = ["selective", "full"] as const;
export const MSSR_REFERENCE_MODES = ["auto", "none"] as const;
export const MSSR_REASONING_EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra", "unknown"] as const;

/**
 * Shared route/bootstrap contract for every stateful MSSR host adapter.
 * Hosts may add transport-only fields outside this schema, but must not fork
 * portable routing, gating, context-selection or trace semantics.
 */
export const mssrHostRouteInputSchema = z.object({
  task: z.string().min(1),
  context: z.string().max(4000).optional(),
  intent: structuredSkillIntentSchema,
  stage: z.enum(SKILL_STAGES).optional(),
  completedPhases: z.array(z.enum(SKILL_PHASES)).optional(),
  maxSkills: z.number().int().min(1).max(16).optional(),
  selectionMode: z.enum(MSSR_SELECTION_MODES).optional(),
  skillDecisions: z.array(mssrSkillDecisionSchema).max(32).optional(),
  contentMode: z.enum(MSSR_SKILL_CONTEXT_MODES).optional(),
  includeReferences: z.enum(MSSR_REFERENCE_MODES).optional(),
  maxContextChars: z.number().int().min(4000).max(100000).optional(),
  /** Opaque portable cursor returned by a partial skill-context page. */
  contextCursor: z.string().min(16).max(2048).optional(),
  traceId: z.string().min(6).max(128).optional(),
  workflowKey: z.string().min(1).max(160).optional(),
  model: z.string().min(1).max(80).optional(),
  reasoningEffort: z.enum(MSSR_REASONING_EFFORTS).optional(),
  contextMessages: mssrContextMessageBatchSchema.optional(),
  maxContextMessages: z.number().int().min(0).max(32).optional(),
  maxContextMessageChars: z.number().int().min(0).max(20_000).optional(),
  projectRoot: z.string().min(1).max(4096).optional(),
  contextNow: z.string().datetime({ offset: true }).optional(),
  contextMaxChars: z.number().int().min(0).max(MAX_HOST_PROJECT_CONTEXT_CHARS).optional(),
  contextMaxModules: z.number().int().min(0).max(MAX_HOST_PROJECT_CONTEXT_MODULES).optional(),
  /** Set false on a phase replan only when this host already delivered the project core. */
  contextIncludeCore: z.boolean().optional(),
  contextMessageMaxChars: z.number().int().min(0).max(MAX_HOST_CONTEXT_MESSAGE_CHARS).optional(),
  contextMessageMaxMessages: z.number().int().min(0).max(32).optional(),
}).strict();

export type MssrRouteInput = z.infer<typeof mssrHostRouteInputSchema>;

export type MssrHostSkillSelection = Readonly<{
  mode: "auto" | "host-gated";
  decisions: MssrSkillDecisionRecord[];
  loadSelection: SkillLoadSelection;
  skippedCandidates: Array<{ skill: string } & MssrSkillDecisionRecord>;
  pendingCandidates: Array<{ skill: string; decisionState: "absent" }>;
  policy: string;
}>;

/**
 * Portable host-gating contract. Every host must preserve the distinction
 * between an explicit skip and a decision that has not happened yet.
 */
export function resolveMssrHostSkillSelection(
  route: Readonly<{
    stage: SkillStage;
    loadOrder: readonly string[];
    activeSkills: ReadonlyArray<{
      name: string;
      required: boolean;
      requires: string[];
      selectedAsRoot: boolean;
    }>;
  }>,
  mode: "auto" | "host-gated",
  supplied: readonly MssrSkillDecisionRecord[] = [],
): MssrHostSkillSelection {
  const optionalRoots = new Set(route.activeSkills.filter((item) => item.selectedAsRoot && !item.required).map((item) => item.name));
  const requiredRoots = new Set(route.activeSkills.filter((item) => item.selectedAsRoot && item.required).map((item) => item.name));
  const decisionBySkill = new Map<string, MssrSkillDecisionRecord>();

  for (const raw of supplied) {
    const decision = mssrSkillDecisionSchema.parse({ ...raw, stage: route.stage });
    if (decisionBySkill.has(decision.skillName)) throw new Error(`Duplicate MSSR skill decision for '${decision.skillName}'.`);
    if (requiredRoots.has(decision.skillName)) throw new Error(`Required MSSR skill '${decision.skillName}' is a workflow obligation and must not be host-gated.`);
    if (!optionalRoots.has(decision.skillName)) throw new Error(`MSSR skill decision references a non-root optional candidate: ${decision.skillName}`);
    decisionBySkill.set(decision.skillName, decision);
  }

  const decisions = [...decisionBySkill.values()];
  const loadSelection = resolveSkillLoadSelection(route, mode, decisions);
  const skippedCandidates = route.activeSkills
    .filter((item) => item.selectedAsRoot && !item.required && decisionBySkill.get(item.name)?.decision === "skipped")
    .map((item) => ({ skill: item.name, ...decisionBySkill.get(item.name)! }));
  const pendingCandidates = mode === "host-gated"
    ? route.activeSkills
      .filter((item) => item.selectedAsRoot && !item.required && !decisionBySkill.has(item.name))
      .map((item) => ({ skill: item.name, decisionState: "absent" as const }))
    : [];

  return {
    mode,
    decisions,
    loadSelection,
    skippedCandidates,
    pendingCandidates,
    policy: mode === "host-gated"
      ? "Required roots are obligations; optional roots require an explicit host decision. Missing decisions remain pending and are not materialized."
      : "Auto mode materializes routed roots subject to the shared context budget.",
  };
}
