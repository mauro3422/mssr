import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { CapabilityRegistry, FilesystemSkillProvider } from "./registry.js";
import {
  planSkillRoute,
  structuredSkillIntentSchema,
  type SkillPhase,
  type SkillStage,
  type StructuredSkillIntent,
  type SkillCaller,
} from "./skill-routing.js";
import {
  mssrTraceLifecycleStateSchema,
  reduceMssrCheckpointLifecycle,
  reduceMssrRouteLifecycle,
  reduceMssrSkillLoadLifecycle,
  validateMssrCheckpointLifecycle,
  type MssrTraceLifecycleState,
} from "./trace-contract.js";
import {
  createMssrTelemetryEnvelope,
  hashMssrTelemetryTask,
  mssrHostCheckpointSchema,
  routeTelemetrySummary,
  type MssrHostCheckpoint,
  type MssrTelemetrySink,
} from "./telemetry.js";

export type CodexMssrRouteInput = {
  task: string;
  context?: string;
  intent: StructuredSkillIntent;
  stage?: SkillStage;
  completedPhases?: SkillPhase[];
  maxSkills?: number;
  traceId?: string;
  workflowKey?: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | "ultra" | "unknown";
};

export type HostMssrAdapterOptions = {
  caller?: SkillCaller;
  source?: string;
  tracePrefix?: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | "ultra" | "unknown";
  telemetrySink?: MssrTelemetrySink | null;
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
  private readonly options: Required<Omit<HostMssrAdapterOptions, "telemetrySink">> & { telemetrySink: MssrTelemetrySink | null };

  constructor(
    registry = new CapabilityRegistry([new FilesystemSkillProvider()]),
    options: HostMssrAdapterOptions = {},
  ) {
    this.registry = registry;
    this.options = {
      caller: options.caller ?? "codex-local",
      source: options.source ?? "codex-local",
      tracePrefix: options.tracePrefix ?? "mssr-codex",
      model: options.model ?? "unknown",
      reasoningEffort: options.reasoningEffort ?? "unknown",
      telemetrySink: options.telemetrySink ?? null,
    };
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
    return `${this.options.tracePrefix}-${randomUUID()}`;
  }

  private profile(input: CodexMssrRouteInput) {
    return {
      model: input.model ?? this.options.model,
      reasoningEffort: input.reasoningEffort ?? this.options.reasoningEffort,
    };
  }

  private async emit(event: Parameters<typeof createMssrTelemetryEnvelope>[0]) {
    if (!this.options.telemetrySink) return { configured: false, delivered: false };
    try {
      await this.options.telemetrySink.emit(createMssrTelemetryEnvelope(event));
      return { configured: true, delivered: true };
    } catch (error) {
      return {
        configured: true,
        delivered: false,
        warning: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
      };
    }
  }

  getTrace(traceId: string): MssrTraceLifecycleState | null {
    return this.traces.get(traceId) ?? null;
  }

  private async plan(input: CodexMssrRouteInput, action: "plan" | "bootstrap") {
    await this.initialize();
    const intent = structuredSkillIntentSchema.parse(input.intent);
    const traceId = input.traceId ?? this.newTraceId();
    const plan = await planSkillRoute({
      task: input.task,
      context: input.context,
      intent,
      caller: this.options.caller,
      stage: input.stage ?? "start",
      completedPhases: input.completedPhases ?? [],
      maxSkills: input.maxSkills,
      skills: this.discoveredSkills(),
    });
    const observedPlan = {
      ...plan,
      workflowKey: input.workflowKey,
      agentProfile: this.profile(input),
    };
    const lifecycle = reduceMssrRouteLifecycle(this.traces.get(traceId) ?? null, observedPlan);
    this.traces.set(traceId, lifecycle);
    const telemetry = await this.emit({
      source: this.options.source,
      traceId,
      caller: this.options.caller,
      event: {
        kind: "route",
        action,
        taskHash: hashMssrTelemetryTask(input.task),
        route: routeTelemetrySummary(observedPlan as unknown as Record<string, unknown>),
      },
    });
    return { ...observedPlan, traceId, lifecycle, telemetry, registry: this.registry.getSnapshot() };
  }

  async route(input: CodexMssrRouteInput) {
    return this.plan(input, "plan");
  }

  async bootstrap(input: CodexMssrRouteInput) {
    const route = await this.plan(input, "bootstrap");
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
        await this.emit({ source: this.options.source, traceId: route.traceId, caller: this.options.caller, event: {
          kind: "skill_load", skillName: name, loaded: false, via: "skill_bootstrap", stage: route.stage,
          warning: "Skill metadata was not found in the active registry.",
        } });
        continue;
      }
      if (!skill.path) {
        loaded.push({ skill, loaded: false, warning: "Skill has no local readable path." });
        await this.emit({ source: this.options.source, traceId: route.traceId, caller: this.options.caller, event: {
          kind: "skill_load", skillName: name, source: skill.source, loaded: false, via: "skill_bootstrap", stage: route.stage,
          warning: "Skill has no local readable path.",
        } });
        continue;
      }

      try {
        const content = await fs.readFile(skill.path, "utf8");
        loaded.push({ skill, loaded: true, content });
        lifecycle = reduceMssrSkillLoadLifecycle(lifecycle, name);
        await this.emit({ source: this.options.source, traceId: route.traceId, caller: this.options.caller, event: {
          kind: "skill_load", skillName: name, source: skill.source, loaded: true, via: "skill_bootstrap", stage: route.stage,
          required: route.activeSkills.some((item) => item.name === name && item.required),
        } });
      } catch (error) {
        loaded.push({
          skill,
          loaded: false,
          warning: error instanceof Error ? error.message : String(error),
        });
        await this.emit({ source: this.options.source, traceId: route.traceId, caller: this.options.caller, event: {
          kind: "skill_load", skillName: name, source: skill.source, loaded: false, via: "skill_bootstrap", stage: route.stage,
          required: route.activeSkills.some((item) => item.name === name && item.required),
          warning: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        } });
      }
    }

    this.traces.set(route.traceId, lifecycle);
    return { ...route, lifecycle, loaded };
  }

  async checkpoint(traceId: string, checkpoint: unknown) {
    const previous = this.traces.get(traceId);
    if (!previous) {
      return {
        accepted: false,
        traceId,
        violations: [{ code: "mssr-trace-missing", blocking: true }],
      };
    }

    const validatedState = mssrTraceLifecycleStateSchema.parse(previous);
    const parsedCheckpoint = mssrHostCheckpointSchema.parse(checkpoint);
    const violations = validateMssrCheckpointLifecycle(validatedState, parsedCheckpoint);
    if (violations.some((item) => item.blocking)) {
      return { accepted: false, traceId, state: validatedState, violations };
    }

    const state = reduceMssrCheckpointLifecycle(validatedState, parsedCheckpoint);
    this.traces.set(traceId, state);
    const telemetry = await this.emit({
      source: this.options.source,
      traceId,
      caller: this.options.caller,
      event: { kind: "checkpoint", checkpoint: parsedCheckpoint as MssrHostCheckpoint },
    });
    return { accepted: true, traceId, state, violations, telemetry };
  }
}
