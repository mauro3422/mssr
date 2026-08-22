import { randomUUID } from "node:crypto";
import { CapabilityRegistry, FilesystemSkillProvider, MssrFirstPartySkillProvider } from "./registry.js";
import {
  planSkillRoute,
  structuredSkillIntentSchema,
  type SkillPhase,
  type SkillStage,
  type StructuredSkillIntent,
  type SkillCaller,
} from "./skill-routing.js";
import {
  getMssrTraceClosureState,
  mssrTraceLifecycleStateSchema,
  mssrTraceWorkingMemorySchema,
  reduceMssrCheckpointLifecycle,
  reduceMssrRouteLifecycle,
  reduceMssrSkillLoadLifecycle,
  validateMssrCheckpointLifecycle,
  type MssrTraceLifecycleState,
  type MssrTraceWorkingMemory,
} from "./trace-contract.js";
import {
  createMssrTelemetryEnvelope,
  hashMssrTelemetryTask,
  mssrHostCheckpointSchema,
  routeTelemetrySummary,
  type MssrHostCheckpoint,
  type MssrTelemetrySink,
} from "./telemetry.js";
import {
  mssrContextMessageBatchSchema,
  selectMssrContextMessages,
  type MssrContextMessage,
} from "./context-messages.js";
import {
  acknowledgeProjectContextInbox,
  loadProjectContextHost,
  type ProjectContextHostResult,
} from "./context-plane-host.js";
import {
  planSkillContexts,
  type GlobalSkillContextPlan,
  type SkillContextMode,
  type SkillReferenceMode,
} from "./skill-context-loader.js";
import { initializeMssrProject, initializeMssrWorkspace, type InitializeMssrProjectOptions } from "./project-initialization.js";
import { auditMssrProjectContextHealth } from "./project-context-health.js";
import { planMssrProjectKnowledgeCapture, type MssrProjectKnowledgeCaptureInput } from "./project-context-capture.js";
import { planMssrProjectContextModularization } from "./project-context-modularization.js";
import type { MssrProjectControlAdapter } from "./project-control-contract.js";
import { deliverMssrNoticeV1, type MssrNoticeHostBoundary } from "./mssr-notice-delivery.js";

export type { MssrRouteInput } from "./host-adapter-contract.js";
import { resolveMssrHostSkillSelection, type MssrRouteInput } from "./host-adapter-contract.js";

export type MssrAdapterOptions = {
  caller?: SkillCaller;
  source?: string;
  tracePrefix?: string;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | "ultra" | "unknown";
  telemetrySink?: MssrTelemetrySink | null;
  noticeDelivery?: MssrNoticeHostBoundary<unknown> | null;
  defaultSelectionMode?: "auto" | "host-gated";
};

type LoadedMssrSkill = {
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
 * Stateful host adapter shared by Codex, OpenCode, Bridge-compatible hosts and
 * future MSSR clients. The portable router and trace reducers remain stateless;
 * this class owns only host-local trace state, filesystem skill context
 * assembly, and telemetry delivery. It never proxies execution permissions.
 */
export class MssrAdapter implements MssrProjectControlAdapter {
  readonly registry: CapabilityRegistry;
  private initialized = false;
  private readonly traces = new Map<string, MssrTraceLifecycleState>();
  private readonly workingMemory = new Map<string, MssrTraceWorkingMemory>();
  private readonly options: Required<Omit<MssrAdapterOptions, "telemetrySink" | "noticeDelivery">> & {
    telemetrySink: MssrTelemetrySink | null;
    noticeDelivery: MssrNoticeHostBoundary<unknown> | null;
  };

  constructor(
    registry = new CapabilityRegistry([new MssrFirstPartySkillProvider(), new FilesystemSkillProvider()]),
    options: MssrAdapterOptions = {},
  ) {
    this.registry = registry;
    this.options = {
      caller: options.caller ?? "other",
      source: options.source ?? "mssr-host",
      tracePrefix: options.tracePrefix ?? "mssr-host",
      model: options.model ?? "unknown",
      reasoningEffort: options.reasoningEffort ?? "unknown",
      telemetrySink: options.telemetrySink ?? null,
      noticeDelivery: options.noticeDelivery ?? null,
      defaultSelectionMode: options.defaultSelectionMode ?? "host-gated",
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

  private profile(input: MssrRouteInput) {
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

  /** Portable project-control operations inherited by host-specific adapters. */
  projectHealth(projectRoot: string) {
    return auditMssrProjectContextHealth(projectRoot);
  }

  initializeProject(projectRoot: string, options: InitializeMssrProjectOptions = {}) {
    return initializeMssrProject(projectRoot, options);
  }

  initializeWorkspace(workspaceRoot: string, options: InitializeMssrProjectOptions & { maxDepth?: number } = {}) {
    return initializeMssrWorkspace(workspaceRoot, options);
  }

  planProjectKnowledgeCapture(input: MssrProjectKnowledgeCaptureInput) {
    return planMssrProjectKnowledgeCapture(input);
  }

  planProjectContextModularization(projectRoot: string) {
    return planMssrProjectContextModularization(projectRoot);
  }
  getTraceStatus(traceId: string) {
    const state = this.getTrace(traceId);
    return {
      state,
      closure: state ? getMssrTraceClosureState(state) : null,
      workingMemory: this.workingMemory.get(traceId) ?? null,
    };
  }

  updateWorkingMemory(traceId: string, input: unknown) {
    const state = this.traces.get(traceId);
    if (!state || state.closed) return { accepted: false, traceId, reason: state ? "trace-closed" : "trace-missing" };
    const workingMemory = mssrTraceWorkingMemorySchema.parse(input);
    this.workingMemory.set(traceId, workingMemory);
    return { accepted: true, traceId, workingMemory };
  }

  private async plan(input: MssrRouteInput, action: "plan" | "bootstrap") {
    await this.initialize();
    const intent = structuredSkillIntentSchema.parse(input.intent);
    const stage = input.stage ?? "start";
    const traceId = input.traceId ?? this.newTraceId();
    const plan = await planSkillRoute({
      task: input.task,
      context: input.context,
      intent,
      caller: this.options.caller,
      stage,
      completedPhases: input.completedPhases ?? [],
      maxSkills: input.maxSkills,
      skills: this.discoveredSkills(),
    });

    let host: ProjectContextHostResult | undefined;
    if (input.projectRoot) {
      const maxContextMessages = input.contextMessageMaxMessages ?? input.maxContextMessages;
      const maxContextMessageChars = input.contextMessageMaxChars ?? input.maxContextMessageChars;
      host = await loadProjectContextHost({
        projectRoot: input.projectRoot,
        intent,
        stage: plan.stage,
        ...(input.contextNow ? { now: input.contextNow } : {}),
        ...(input.contextMaxChars !== undefined ? { maxProjectContextChars: input.contextMaxChars } : {}),
        ...(input.contextMaxModules !== undefined ? { maxProjectContextModules: input.contextMaxModules } : {}),
        ...(input.contextIncludeCore !== undefined ? { includeCore: input.contextIncludeCore } : {}),
        ...(maxContextMessageChars !== undefined ? { maxContextMessageChars } : {}),
        ...(maxContextMessages !== undefined ? { maxContextMessages } : {}),
        ...(input.contextMessages ? { contextMessages: mssrContextMessageBatchSchema.parse(input.contextMessages) } : {}),
      });
    }

    const observedPlan = {
      ...plan,
      workflowKey: input.workflowKey,
      agentProfile: this.profile(input),
      ...(host
        ? {
          contextMessages: host.contextMessages,
          projectContext: host.projectContext,
          inbox: host.inbox,
          repository: host.repository,
        }
        : input.contextMessages ? {
          contextMessages: selectMssrContextMessages({
            messages: mssrContextMessageBatchSchema.parse(input.contextMessages),
            intent,
            stage: plan.stage,
            maxMessages: input.maxContextMessages,
            maxChars: input.maxContextMessageChars,
          }),
        } : {}),
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

  async route(input: MssrRouteInput) {
    return this.plan(input, "plan");
  }

  async bootstrap(input: MssrRouteInput) {
    const route = await this.plan(input, "bootstrap");
    const loaded: LoadedMssrSkill[] = [];
    let lifecycle = route.lifecycle;
    const snapshot = this.registry.getSnapshot();
    const selectionMode = input.selectionMode ?? this.options.defaultSelectionMode;
    const hostSelection = resolveMssrHostSkillSelection(route, selectionMode, input.skillDecisions ?? []);
    const { decisions, loadSelection, skippedCandidates, pendingCandidates } = hostSelection;
    for (const decision of decisions) {
      await this.emit({ source: this.options.source, traceId: route.traceId, caller: this.options.caller, event: {
        kind: "skill_decision", decision,
      } });
    }
    const loadOrder = [...loadSelection.eligibleLoadOrder];

    const routedByName = new Map(route.activeSkills.map((item) => [item.name, item]));
    const localPlanInput = loadOrder.flatMap((name, routeIndex) => {
      const capability = snapshot.capabilities.find((item) => item.kind === "skill" && item.name === name && item.skill);
      const skill = capability?.skill;
      const routed = routedByName.get(name);
      return skill?.path && routed ? [{
        skill,
        // Host acceptance makes an optional root eligible, not a new workflow
        // obligation. The portable page contract preserves that distinction.
        obligation: routed.required === true ? "required" as const : "accepted" as const,
        routeIndex,
        routeScore: Number(routed.score ?? 0),
      }] : [];
    });
    const contextPlan: GlobalSkillContextPlan = await planSkillContexts({
      skills: localPlanInput,
      intent: structuredSkillIntentSchema.parse(route.intent),
      stage: route.stage,
      mode: input.contentMode ?? "selective",
      references: input.includeReferences ?? "auto",
      maxContextChars: Math.min(100_000, Math.max(4_000, Math.floor(input.maxContextChars ?? 24_000))),
      ...(input.contextCursor ? { cursor: input.contextCursor } : {}),
    });
    const contextByName = new Map(contextPlan.skills.map((item) => [item.skill.name, item]));

    for (const name of loadOrder) {
      const capability = snapshot.capabilities.find((item) => item.kind === "skill" && item.name === name && item.skill);
      const skill = capability?.skill;
      const routed = routedByName.get(name);
      if (!skill) {
        const warning = "Skill metadata was not found in the active registry.";
        loaded.push({ skill: { name, description: "", source: "unknown" }, loaded: false, warning });
        await this.emit({ source: this.options.source, traceId: route.traceId, caller: this.options.caller, event: {
          kind: "skill_load", skillName: name, loaded: false, via: "skill_bootstrap", stage: route.stage, warning,
        } });
        continue;
      }
      if (!skill.path) {
        const warning = "Skill has no local readable path.";
        loaded.push({ skill, loaded: false, warning });
        await this.emit({ source: this.options.source, traceId: route.traceId, caller: this.options.caller, event: {
          kind: "skill_load", skillName: name, source: skill.source, loaded: false, via: "skill_bootstrap", stage: route.stage, warning,
        } });
        continue;
      }

      const planned = contextByName.get(name);
      if (!planned) throw new Error(`Shared MSSR context planner did not return routed skill: ${name}`);
      loaded.push(planned as unknown as LoadedMssrSkill);
      if (planned.loaded) lifecycle = reduceMssrSkillLoadLifecycle(lifecycle, name);
      await this.emit({ source: this.options.source, traceId: route.traceId, caller: this.options.caller, event: {
        kind: "skill_load",
        skillName: name,
        source: skill.source,
        loaded: planned.loaded,
        via: "skill_bootstrap",
        stage: route.stage,
        required: routed?.required === true,
        warning: planned.loaded ? planned.contextAssembly.warning : planned.warning,
      } });
    }

    this.traces.set(route.traceId, lifecycle);
    return {
      ...route,
      lifecycle,
      loaded,
      contextAssembly: contextPlan,
      selection: {
        ...loadSelection,
        decisions,
        skippedCandidates,
        pendingCandidates,
        loadedOrder: loadOrder,
        policy: hostSelection.policy,
      },
    };
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
    const workingMemoryPurged = parsedCheckpoint.eventType === "outcome" && this.workingMemory.delete(traceId);
    const telemetry = await this.emit({
      source: this.options.source,
      traceId,
      caller: this.options.caller,
      event: { kind: "checkpoint", checkpoint: parsedCheckpoint as MssrHostCheckpoint },
    });
    return {
      accepted: true,
      traceId,
      state,
      closure: getMssrTraceClosureState(state),
      workingMemoryPurged,
      violations,
      telemetry,
    };
  }

  /**
   * Immediately hands one validated portable notice to this host's explicit
   * delivery boundary. No boundary means no delivery; MSSR never silently
   * invents a queue, retry path, CLI stream, UI, or executable action.
   */
  async deliverNotice(notice: unknown) {
    if (!this.options.noticeDelivery) {
      throw new Error("MSSR host notice delivery boundary is not configured");
    }
    return deliverMssrNoticeV1(notice, this.options.noticeDelivery);
  }

  /**
   * Acknowledges delivered context messages for the nominated project's durable
   * inbox.  Delegates to the shared host helper which atomically persists the
   * updated state; selection alone never acknowledges.
   */
  async acknowledgeContextMessages(projectRoot: string, messageIds: string[], now?: string) {
    return acknowledgeProjectContextInbox({
      projectRoot,
      messageIds,
      ...(now ? { now } : {}),
    });
  }
}
