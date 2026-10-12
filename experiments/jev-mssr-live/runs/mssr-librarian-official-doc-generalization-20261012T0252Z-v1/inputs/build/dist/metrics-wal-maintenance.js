import { Worker } from "node:worker_threads";
const checkpointDelayMs = Math.max(100, Number(process.env.BRIDGE_MCP_METRICS_WAL_CHECKPOINT_DELAY_MS || 2_000));
const checkpointBusyTimeoutMs = Math.max(0, Number(process.env.BRIDGE_MCP_METRICS_WAL_CHECKPOINT_BUSY_MS || 100));
let scheduledTimer = null;
let checkpointInFlight = false;
let dirtySinceCheckpoint = false;
let sqlitePath = null;
let checkpointCount = 0;
let failureCount = 0;
let lastStartedAt = null;
let lastCompletedAt = null;
let lastDurationMs = null;
let lastResult = null;
let lastError = null;
function scheduleIfNeeded(resetDelay = false) {
    if (!dirtySinceCheckpoint || checkpointInFlight || !sqlitePath)
        return;
    if (scheduledTimer) {
        if (!resetDelay)
            return;
        clearTimeout(scheduledTimer);
        scheduledTimer = null;
    }
    scheduledTimer = setTimeout(() => {
        scheduledTimer = null;
        runCheckpoint();
    }, checkpointDelayMs);
    scheduledTimer.unref();
}
function runCheckpoint() {
    if (!sqlitePath || checkpointInFlight || !dirtySinceCheckpoint)
        return;
    checkpointInFlight = true;
    dirtySinceCheckpoint = false;
    lastStartedAt = new Date().toISOString();
    const startedAt = performance.now();
    const worker = new Worker(new URL("./metrics-wal-checkpoint-worker.js", import.meta.url), {
        workerData: { sqlitePath, busyTimeoutMs: checkpointBusyTimeoutMs },
        execArgv: process.execArgv.filter((arg) => !arg.startsWith("--input-type")),
    });
    let settled = false;
    const finish = (ok, result, error) => {
        if (settled)
            return;
        settled = true;
        checkpointInFlight = false;
        lastCompletedAt = new Date().toISOString();
        lastDurationMs = Math.round((performance.now() - startedAt) * 100) / 100;
        if (ok) {
            checkpointCount += 1;
            lastResult = result ?? null;
            lastError = null;
        }
        else {
            failureCount += 1;
            lastError = error ?? "metrics WAL checkpoint worker failed";
        }
        void worker.terminate();
        scheduleIfNeeded();
    };
    worker.once("message", (message) => {
        const payload = message && typeof message === "object" ? message : {};
        if (payload.ok === true) {
            const result = payload.result && typeof payload.result === "object" && !Array.isArray(payload.result)
                ? payload.result
                : null;
            finish(true, result);
            return;
        }
        finish(false, null, typeof payload.error === "string" ? payload.error : "metrics WAL checkpoint worker failed");
    });
    worker.once("error", (error) => finish(false, null, error.message));
    worker.once("exit", (code) => {
        if (!settled && code !== 0)
            finish(false, null, `metrics WAL checkpoint worker exited with code ${code}`);
    });
}
export function scheduleMetricsWalCheckpoint(targetSqlitePath) {
    sqlitePath = targetSqlitePath;
    dirtySinceCheckpoint = true;
    scheduleIfNeeded(true);
}
export function getMetricsWalMaintenanceStatus() {
    return {
        mode: "passive-worker",
        autoCheckpointDisabledOnWriters: true,
        delayMs: checkpointDelayMs,
        busyTimeoutMs: checkpointBusyTimeoutMs,
        scheduled: scheduledTimer !== null,
        inFlight: checkpointInFlight,
        dirty: dirtySinceCheckpoint,
        checkpointCount,
        failureCount,
        lastStartedAt,
        lastCompletedAt,
        lastDurationMs,
        lastResult,
        lastError,
    };
}
export function closeMetricsWalMaintenanceForTests() {
    if (scheduledTimer) {
        clearTimeout(scheduledTimer);
        scheduledTimer = null;
    }
    dirtySinceCheckpoint = false;
    sqlitePath = null;
}
