import { randomUUID } from "node:crypto";
export const RUNTIME_BOOT_ID = randomUUID();
export const RUNTIME_STARTED_AT = new Date().toISOString();
export function normalizeModelIdentifier(value, fallback = "unknown") {
    if (typeof value !== "string")
        return fallback;
    const normalized = value
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return normalized || fallback;
}
const WORKFLOW_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{1,79}$/;
export function normalizeWorkflowKey(value) {
    if (typeof value !== "string")
        return undefined;
    const normalized = value
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/[-_.]{2,}/g, "-")
        .replace(/^[-_.]+|[-_.]+$/g, "")
        .slice(0, 80);
    return WORKFLOW_KEY_PATTERN.test(normalized) ? normalized : undefined;
}
export function requireWorkflowKey(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    const normalized = normalizeWorkflowKey(value);
    if (!normalized) {
        throw new Error("workflowKey must normalize to 2-80 lowercase letters, numbers, dots, underscores, or hyphens.");
    }
    return normalized;
}
export function resolveMetricWorkflowKey(args) {
    if (!args.startsNewRoute && args.traceId) {
        return normalizeWorkflowKey(args.traceWorkflowKey) ?? "unscoped";
    }
    if (args.startsNewRoute)
        return normalizeWorkflowKey(args.explicitWorkflowKey);
    return normalizeWorkflowKey(args.explicitWorkflowKey)
        ?? normalizeWorkflowKey(args.sessionWorkflowKey)
        ?? normalizeWorkflowKey(args.localWorkflowKey);
}
const TASK_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,159}$/;
export function normalizeTaskKey(value) {
    if (typeof value !== "string")
        return undefined;
    const normalized = value.trim();
    return TASK_KEY_PATTERN.test(normalized) ? normalized : undefined;
}
export function resolveMetricTaskKey(args) {
    if (!args.startsNewRoute && args.traceId) {
        return normalizeTaskKey(args.traceTaskKey);
    }
    if (args.startsNewRoute)
        return normalizeTaskKey(args.explicitTaskKey);
    return normalizeTaskKey(args.explicitTaskKey)
        ?? normalizeTaskKey(args.sessionTaskKey)
        ?? normalizeTaskKey(args.localTaskKey);
}
