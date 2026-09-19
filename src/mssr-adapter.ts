import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
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
import { evaluateMssrTraceOwnerCompatibility, type MssrTraceOwnerIdentity } from "./trace-identity.js";
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
import { maintainMssrProjectContext, type MssrProjectContextMaintenanceInput } from "./project-context-maintenance.js";
import type { MssrProjectControlAdapter } from "./project-control-contract.js";
import { deliverMssrNoticeV1, MssrNoticeDeliveryTracker, type MssrNoticeHostBoundary, type MssrNoticeTrackerSnapshot } from "./mssr-notice-delivery.js";
import { evaluateMssrServerBuildOperationalAttention } from "./operational-projections.js";
import {
  isSameMssrServerBuild,
  readMssrServerBuildId,
  resolveMssrServerDistDir,
  type MssrServerBuildId,
} from "./server-build.js";
import {
  projectContextPageForEnvelope,
  routeEnvelopeDiagnostics,
  summarizeRegistrySnapshot,
} from "./route-envelope.js";

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
  /**
   * Stable per-process identity for stale-build notices (defaults to
   * `<tracePrefix>:pid=<pid>`). Override only in tests.
   */
  instanceId?: string;
  /**
   * Build-identity seams. `loaded` pins the identity captured at startup
   * (defaults to a read at construction); `distDir` overrides where the
   * available build is read from (defaults to the running `dist/`).
   */
  build?: { loaded?: MssrServerBuildId; distDir?: string };
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
  private readonly traceOwners = new Map<string, Required<MssrTraceOwnerIdentity>>();
  private readonly workingMemory = new Map<string, MssrTraceWorkingMemory>();
  private readonly instanceId: string;
  private readonly buildDistDir: string;
  private readonly loadedBuild: MssrServerBuildId;
  private readonly noticeTracker: MssrNoticeDeliveryTracker;
  private readonly options: Required<Omit<MssrAdapterOptions, "telemetrySink" | "noticeDelivery" | "instanceId" | "build">> & {
    telemetrySink: MssrTelemetrySink | null;
    noticeDelivery: MssrNoticeHostBoundary<unknown> | null;
    instanceId?: string;
    build?: { loaded?: MssrServerBuildId; distDir?: string };
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
    this.instanceId = options.instanceId ?? `${this.options.tracePrefix}:pid=${process.pid}`;
    this.buildDistDir = options.build?.distDir ?? resolveMssrServerDistDir();
    // Identity captured once at startup: later source edits never change it,
    // only a finished compiler run producing new dist bytes does.
    this.loadedBuild = options.build?.loaded ?? readMssrServerBuildId(this.buildDistDir);
    this.noticeTracker = new MssrNoticeDeliveryTracker(this.options.noticeDelivery);
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

  private async canonicalProjectOwner(projectRoot: string | undefined): Promise<string | null> {
    if (!projectRoot) return null;
    const absolute = path.resolve(projectRoot);
    let resolved = absolute;
    try {
      resolved = await fs.realpath(absolute);
    } catch {
      // A missing/unavailable root is still a stable host-observed owner candidate.
      // Project loading will report the filesystem problem separately.
    }
    return process.platform === "win32" ? resolved.toLocaleLowerCase() : resolved;
  }

  private async bindTraceOwner(traceId: string, input: MssrRouteInput) {
    const requested = {
      project: await this.canonicalProjectOwner(input.projectRoot),
      workflowKey: input.workflowKey?.trim() || null,
    };
    const compatibility = evaluateMssrTraceOwnerCompatibility(this.traceOwners.get(traceId), requested);
    if (!compatibility.compatible) {
      const fields = compatibility.mismatchFields.join(",");
      throw new Error(`mssr-trace-owner-mismatch: trace ${traceId} is already bound to another ${fields} owner; create or delegate to a separately owned trace instead of migrating this trace.`);
    }
    this.traceOwners.set(traceId, compatibility.bound);
    return compatibility;
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

  maintainProjectContext(input: MssrProjectContextMaintenanceInput) {
    return maintainMssrProjectContext(input);
  }
  getTraceStatus(traceId: string) {
    const state = this.getTrace(traceId);
    return {
      state,
      owner: this.traceOwners.get(traceId) ?? null,
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

  /**
   * Self-observation for stale persistent processes. Compares the build
   * identity captured at startup against the currently available compiled
   * build and tracks one deduped operational notice per instance/build pair.
   * Detection only: MSSR never restarts or reconnects its own process.
   * Observability failures here never fail the route call.
   */
  describeServerBuild() {
    const available = readMssrServerBuildId(this.buildDistDir);
    const loadedId = this.loadedBuild.status === "known" ? this.loadedBuild.id : null;
    const availableId = available.status === "known" ? available.id : null;
    const projection = evaluateMssrServerBuildOperationalAttention({
      loadedBuildId: loadedId,
      availableBuildId: availableId,
      availableKnown: available.status === "known",
    });
    return {
      instanceId: this.instanceId,
      loaded: this.loadedBuild,
      available,
      status: projection.level === "ok" ? "current" as const : projection.level === "watch" ? "unknown" as const : "stale" as const,
      projection,
      pendingDedupeKeys: this.noticeTracker.pendingDedupeKeys(),
    };
  }

  /**
   * Export notice-delivery memory so a reconnecting host may carry it over
   * and observe a `resolved` transition instead of starting blind. No
   * persistence inside MSSR; the host owns the snapshot bytes.
   */
  snapshotNoticeMemory(): MssrNoticeTrackerSnapshot {
    return this.noticeTracker.snapshot();
  }

  /** Restore memory previously exported by `snapshotNoticeMemory()`. */
  restoreNoticeMemory(snapshot: unknown): void {
    this.noticeTracker.restore(snapshot);
  }

  private async trackServerBuildNotice() {
    try {
      const described = this.describeServerBuild();
      const loadedLabel = described.loaded.status === "known" ? described.loaded.id : "unknown build";
      const availableLabel = described.available.status === "known" ? described.available.id : "unknown build";
      const track = await this.noticeTracker.observe({
        subject: described.instanceId,
        source: this.options.source,
        code: "mssr-server-build-stale",
        resolutionCode: "mssr-server-build-current",
        currentLevel: described.projection.level,
        currentFingerprint: described.projection.fingerprint,
        message: described.status === "stale"
          ? `Server ${described.instanceId} loaded ${loadedLabel} but ${availableLabel} is available. Responses may follow older behavior until the host reconnects or respawns this server.`
          : `Server ${described.instanceId} build state is ${described.status}: loaded ${loadedLabel}, available ${availableLabel}.`,
        resolutionMessage: `Server ${described.instanceId} now serves ${availableLabel}; the stale-build condition cleared.`,
        recommendation: "Reconnect or respawn this MCP server through its host so calls run the available build. MSSR never restarts its own process.",
      });
      return { described, track };
    } catch {
      return { described: null, track: null };
    }
  }

  private async plan(input: MssrRouteInput, action: "plan" | "bootstrap") {
    await this.initialize();
    const intent = structuredSkillIntentSchema.parse(input.intent);
    const stage = input.stage ?? "start";
    const traceId = input.traceId ?? this.newTraceId();
    await this.bindTraceOwner(traceId, input);
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
    return {
      ...observedPlan,
      traceId,
      lifecycle,
      telemetry,
      // Normal responses carry a bounded registry summary, never the full
      // capability snapshot: the catalog stays internal to routing and remains
      // inspectable on demand through mssr_registry_status /
      // mssr_capability_search / mssr_capability_inspect. The small routing
      // summary produced by planSkillRoute keeps the `registry` key.
      registrySummary: summarizeRegistrySnapshot(this.registry.getSnapshot()),
      diagnostics: routeEnvelopeDiagnostics(),
      ...(await this.serverBuildEnvelope()),
    };
  }

  /**
   * Compact build-identity envelope plus at most one deduped stale-build
   * notice. Quiet (empty `notices`) on current builds and stable repeats.
   */
  private async serverBuildEnvelope() {
    const { described, track } = await this.trackServerBuildNotice();
    if (!described) return {};
    const serverBuild = {
      loaded: described.loaded.status === "known" ? described.loaded.id : null,
      available: described.available.status === "known" ? described.available.id : null,
      status: described.status,
    };
    if (!track?.notice) return { serverBuild, notices: [] as const };
    return { serverBuild, notices: [track.notice] };
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
      ...(input.retainedContextObligations ? { retainedContextObligations: input.retainedContextObligations } : {}),
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
      // `loaded` is the canonical carrier of selected skill content. The page
      // keeps budgets, cursors and remaining/blocked units but omits the
      // repeated per-skill content strings.
      contextAssembly: projectContextPageForEnvelope(contextPlan),
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
