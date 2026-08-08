import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { CapabilityRegistry, FilesystemSkillProvider } from "./registry.js";
import {
  planSkillRoute,
  structuredSkillIntentSchema,
  type SkillPhase,
  type SkillStage,
  type StructuredSkillIntent,
} from "./skill-routing.js";
import {
  mssrTraceLifecycleStateSchema,
  reduceMssrCheckpointLifecycle,
  reduceMssrRouteLifecycle,
  reduceMssrSkillLoadLifecycle,
  validateMssrCheckpointLifecycle,
  type MssrTraceLifecycleState,
} from "./trace-contract.js";

export type CodexMssrRouteInput = {
  task: string;
  context?: string;
  intent: StructuredSkillIntent;
  stage?: SkillStage;
  completedPhases?: SkillPhase[];
  maxSkills?: number;
  traceId?: string;
};

type LoadedCodexSkill = {
  skill: {
    name: string;
    description: string;
    source: string;
    path?: string;
  };
  loaded: boolean;
  content?: string;
  warning?: string;
};

/**
 * Stateful Codex-local host adapter.
 *
 * The portable MSSR core and trace reducers remain stateless. This class owns
 * only the local trace map and reads locally-discovered SKILL.md files after a
 * route has recommended them. It never proxies an execution tool.
 */
export class CodexMssrAdapter {
  readonly registry: CapabilityRegistry;
  private initialized = false;
  private readonly traces = new Map<string, MssrTraceLifecycleState>();

  constructor(registry = new CapabilityRegistry([new FilesystemSkillProvider()])) {
    this.registry = registry;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.registry.refresh();
    this.initialized = true;
  }

  private discoveredSkills() {
    return this.registry.getSnapshot().capabilities.flatMap((capability) =>
      capability.kind === "skill" && capability.skill ? [capability.skill] : [],
    );
  }

  private newTraceId(): string {
    return `mssr-codex-${randomUUID()}`;
  }

  getTrace(traceId: string): MssrTraceLifecycleState | null {
    return this.traces.get(traceId) ?? null;
  }

  async route(input: CodexMssrRouteInput) {
    await this.initialize();
    const intent = structuredSkillIntentSchema.parse(input.intent);
    const traceId = input.traceId ?? this.newTraceId();
    const plan = await planSkillRoute({
      task: input.task,
      context: input.context,
      intent,
      caller: "codex-local",
      stage: input.stage ?? "start",
      completedPhases: input.completedPhases ?? [],
      maxSkills: input.maxSkills,
      skills: this.discoveredSkills(),
    });
    const lifecycle = reduceMssrRouteLifecycle(this.traces.get(traceId) ?? null, plan);
    this.traces.set(traceId, lifecycle);
    return { ...plan, traceId, lifecycle, registry: this.registry.getSnapshot() };
  }

  async bootstrap(input: CodexMssrRouteInput) {
    const route = await this.route(input);
    const loaded: LoadedCodexSkill[] = [];
    let lifecycle = route.lifecycle;
    const snapshot = this.registry.getSnapshot();

    for (const name of route.loadOrder) {
      const capability = snapshot.capabilities.find((item) =>
        item.kind === "skill" && item.name === name && item.skill,
      );
      const skill = capability?.skill;
      if (!skill) {
        loaded.push({
          skill: { name, description: "", source: "unknown" },
          loaded: false,
          warning: "Skill metadata was not found in the active registry.",
        });
        continue;
      }
      if (!skill.path) {
        loaded.push({ skill, loaded: false, warning: "Skill has no local readable path." });
        continue;
      }

      try {
        const content = await fs.readFile(skill.path, "utf8");
        loaded.push({ skill, loaded: true, content });
        lifecycle = reduceMssrSkillLoadLifecycle(lifecycle, name);
      } catch (error) {
        loaded.push({
          skill,
          loaded: false,
          warning: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.traces.set(route.traceId, lifecycle);
    return { ...route, lifecycle, loaded };
  }

  checkpoint(traceId: string, checkpoint: unknown) {
    const previous = this.traces.get(traceId);
    if (!previous) {
      return {
        accepted: false,
        traceId,
        violations: [{ code: "mssr-trace-missing", blocking: true }],
      };
    }

    const validatedState = mssrTraceLifecycleStateSchema.parse(previous);
    const violations = validateMssrCheckpointLifecycle(validatedState, checkpoint);
    if (violations.some((item) => item.blocking)) {
      return { accepted: false, traceId, state: validatedState, violations };
    }

    const state = reduceMssrCheckpointLifecycle(validatedState, checkpoint);
    this.traces.set(traceId, state);
    return { accepted: true, traceId, state, violations };
  }
}
