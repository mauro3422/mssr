import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  HttpMssrTelemetrySink,
  MSSR_HOST_CALL_PROTOCOL_VERSION,
  mssrHostCallEnvelopeSchema,
  type MssrExternalTelemetrySink,
  type MssrHostCallEnvelope,
} from "./telemetry.js";

type JsonRecord = Record<string, unknown>;
type HostProfile = {
  agent: string;
  model: string;
  reasoningEffort: MssrHostCallEnvelope["host"]["reasoningEffort"];
  variant?: string;
  messageKey?: string;
};

export type OpenCodePluginInput = {
  project?: { id?: string; worktree?: string };
  directory?: string;
  worktree?: string;
  client?: { app?: { log?: (input: unknown) => Promise<unknown> } };
};

export type OpenCodePluginOptions = {
  sink?: MssrExternalTelemetrySink | null;
  salt?: string;
  now?: () => Date;
};

const efforts = new Set(["low", "medium", "high", "xhigh", "max", "ultra"]);
const asRecord = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const bounded = (value: unknown, fallback: string, max: number) => typeof value === "string" && value.trim()
  ? value.trim().slice(0, max)
  : fallback;
const hash = (salt: string, kind: string, value: string) => createHash("sha256").update(`${salt}\0${kind}\0${value}`).digest("hex");

async function readOpenCodeTelemetryConfig(): Promise<{ endpoint: string; tokenFile: string } | null> {
  const directEndpoint = process.env.MSSR_TELEMETRY_ENDPOINT?.trim();
  const directToken = process.env.MSSR_TELEMETRY_TOKEN_FILE?.trim();
  if (directEndpoint && directToken) return { endpoint: directEndpoint, tokenFile: directToken };
  const configured = process.env.OPENCODE_CONFIG?.trim();
  const candidates = [
    configured,
    path.join(os.homedir(), ".config", "opencode", "opencode.json"),
    process.env.APPDATA ? path.join(process.env.APPDATA, "opencode", "opencode.json") : undefined,
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    try {
      const config = JSON.parse(await fs.readFile(candidate, "utf8")) as JsonRecord;
      const mcp = asRecord(asRecord(config.mcp).mssr);
      const env = asRecord(mcp.environment);
      const endpoint = bounded(env.MSSR_TELEMETRY_ENDPOINT, "", 500);
      const tokenFile = bounded(env.MSSR_TELEMETRY_TOKEN_FILE, "", 500);
      if (endpoint && tokenFile) return { endpoint, tokenFile };
    } catch {
      // A missing or malformed optional config must never break OpenCode.
    }
  }
  return null;
}

async function defaultSink(): Promise<MssrExternalTelemetrySink | null> {
  const config = await readOpenCodeTelemetryConfig();
  return config ? new HttpMssrTelemetrySink(config.endpoint, config.tokenFile) : null;
}

export async function createMssrOpenCodePlugin(input: OpenCodePluginInput, options: OpenCodePluginOptions = {}) {
  const sink = options.sink === undefined ? await defaultSink() : options.sink;
  const now = options.now ?? (() => new Date());
  const salt = options.salt ?? process.env.MSSR_OPENCODE_HASH_SALT ?? "mssr-opencode-host-metadata-v1";
  const sessionProfiles = new Map<string, HostProfile>();
  const sessionTraces = new Map<string, string>();
  const emittedCalls = new Set<string>();
  const projectPath = input.worktree || input.directory || input.project?.worktree || "unknown";
  const project = projectPath === "unknown" ? "unknown" : path.basename(path.resolve(projectPath)).slice(0, 120);
  const projectKey = hash(salt, "project", projectPath);

  const warn = async (message: string) => {
    try {
      await input.client?.app?.log?.({ service: "mssr-opencode-plugin", level: "warn", message });
    } catch {
      // Telemetry is best-effort and must not affect the intercepted operation.
    }
  };

  const updateProfile = (sessionID: string, values: Partial<HostProfile>) => {
    const previous = sessionProfiles.get(sessionID) ?? { agent: "unknown", model: "unknown", reasoningEffort: "unknown" as const };
    sessionProfiles.set(sessionID, { ...previous, ...values });
  };

  const rememberTrace = (sessionID: string, toolName: string, rawOutput: unknown) => {
    if (!/(^|_)mssr_(route_plan|skill_bootstrap)$/.test(toolName)) return;
    const text = typeof rawOutput === "string" ? rawOutput.slice(0, 200_000) : "";
    const match = text.match(/"traceId"\s*:\s*"([A-Za-z0-9._:-]{6,128})"/);
    if (match?.[1]) sessionTraces.set(sessionID, match[1]);
  };

  const emitTerminalCall = async (part: JsonRecord) => {
    const sessionID = bounded(part.sessionID, "", 300);
    const callID = bounded(part.callID, "", 300);
    const toolName = bounded(part.tool, "unknown", 160);
    if (!sessionID || !callID) return;
    const callKey = hash(salt, "call", callID);
    if (emittedCalls.has(callKey)) return;
    const state = asRecord(part.state);
    const status = state.status;
    if (status !== "completed" && status !== "error") return;
    rememberTrace(sessionID, toolName, state.output);
    const timing = asRecord(state.time);
    const endedMs = typeof timing.end === "number" ? timing.end : now().getTime();
    const startedMs = typeof timing.start === "number" ? timing.start : endedMs;
    const profile = sessionProfiles.get(sessionID) ?? { agent: "unknown", model: "unknown", reasoningEffort: "unknown" as const };
    const envelope = mssrHostCallEnvelopeSchema.parse({
      protocolVersion: MSSR_HOST_CALL_PROTOCOL_VERSION,
      eventId: `mssr-host-${callKey}`,
      emittedAt: now().toISOString(),
      source: "opencode-plugin",
      caller: "opencode-local",
      traceId: sessionTraces.get(sessionID),
      host: {
        sessionKey: hash(salt, "session", sessionID),
        messageKey: typeof part.messageID === "string" ? hash(salt, "message", part.messageID) : profile.messageKey,
        callKey,
        agent: profile.agent,
        model: profile.model,
        reasoningEffort: profile.reasoningEffort,
        variant: profile.variant,
        project,
        projectKey,
      },
      tool: {
        name: toolName,
        startedAt: new Date(startedMs).toISOString(),
        endedAt: new Date(endedMs).toISOString(),
        durationMs: Math.max(0, Math.min(24 * 60 * 60_000, Math.round(endedMs - startedMs))),
        status: status === "completed" ? "success" : "error",
      },
    });
    emittedCalls.add(callKey);
    if (!sink) return;
    try {
      await sink.emit(envelope);
    } catch (error) {
      emittedCalls.delete(callKey);
      await warn(`Host metadata delivery failed: ${error instanceof Error ? error.message.slice(0, 160) : "unknown error"}`);
    }
  };

  return {
    "chat.message": async (hookInput: JsonRecord) => {
      const sessionID = bounded(hookInput.sessionID, "", 300);
      if (!sessionID) return;
      const model = asRecord(hookInput.model);
      updateProfile(sessionID, {
        agent: bounded(hookInput.agent, "unknown", 160),
        model: model.providerID || model.modelID
          ? `${bounded(model.providerID, "unknown", 80)}/${bounded(model.modelID, "unknown", 80)}`
          : "unknown",
        variant: typeof hookInput.variant === "string" ? bounded(hookInput.variant, "unknown", 80) : undefined,
        messageKey: typeof hookInput.messageID === "string" ? hash(salt, "message", hookInput.messageID) : undefined,
      });
    },
    "chat.params": async (hookInput: JsonRecord, output: JsonRecord) => {
      const sessionID = bounded(hookInput.sessionID, "", 300);
      if (!sessionID) return;
      const model = asRecord(hookInput.model);
      const provider = asRecord(hookInput.provider);
      const providerInfo = asRecord(provider.info);
      const rawEffort = asRecord(output.options).reasoningEffort;
      updateProfile(sessionID, {
        agent: bounded(hookInput.agent, "unknown", 160),
        model: `${bounded(model.providerID ?? providerInfo.id, "unknown", 80)}/${bounded(model.id, "unknown", 80)}`,
        reasoningEffort: typeof rawEffort === "string" && efforts.has(rawEffort) ? rawEffort as HostProfile["reasoningEffort"] : "unknown",
      });
    },
    "tool.execute.after": async (hookInput: JsonRecord, output: JsonRecord) => {
      try {
        const sessionID = bounded(hookInput.sessionID, "", 300);
        const toolName = bounded(hookInput.tool, "", 160);
        if (sessionID && toolName) rememberTrace(sessionID, toolName, output.output);
      } catch (error) {
        await warn(`Host trace correlation ignored: ${error instanceof Error ? error.message.slice(0, 160) : "unknown error"}`);
      }
    },
    event: async ({ event }: { event: unknown }) => {
      try {
        const record = asRecord(event);
        if (record.type !== "message.part.updated") return;
        const properties = asRecord(record.properties);
        const part = asRecord(properties.part);
        if (part.type === "tool") await emitTerminalCall(part);
      } catch (error) {
        await warn(`Host metadata event ignored: ${error instanceof Error ? error.message.slice(0, 160) : "unknown error"}`);
      }
    },
  };
}

export default createMssrOpenCodePlugin;
