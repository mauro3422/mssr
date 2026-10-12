import { performance } from "node:perf_hooks";
import { RUNTIME_BOOT_ID } from "../../runtime-identity.js";
function roundedMs(value) {
    return Math.round(value * 100) / 100;
}
export function compactBridgeTimingEnvelope(envelope) {
    return {
        schemaVersion: envelope.schemaVersion,
        scope: envelope.scope,
        runtimeBootId: envelope.runtimeBootId,
        clock: envelope.clock,
        totalMs: envelope.totalMs,
        instrumentedMs: envelope.instrumentedMs,
        uninstrumentedMs: envelope.uninstrumentedMs,
        detail: "compact",
        phaseCount: envelope.phases.length,
        phases: [],
        phaseDurationsMs: Object.fromEntries(envelope.phases.map((phase) => [phase.name, phase.durationMs])),
    };
}
function coveredDurationMs(phases, totalMs) {
    const intervals = phases
        .map((phase) => [
        Math.max(0, phase.startedOffsetMs),
        Math.min(totalMs, phase.startedOffsetMs + phase.durationMs),
    ])
        .filter(([start, end]) => end > start)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (intervals.length === 0)
        return 0;
    let covered = 0;
    let currentStart = intervals[0][0];
    let currentEnd = intervals[0][1];
    for (const [start, end] of intervals.slice(1)) {
        if (start <= currentEnd) {
            currentEnd = Math.max(currentEnd, end);
            continue;
        }
        covered += currentEnd - currentStart;
        currentStart = start;
        currentEnd = end;
    }
    covered += currentEnd - currentStart;
    return roundedMs(Math.min(totalMs, covered));
}
export class BridgeTimingCollector {
    scope;
    startedAt = performance.now();
    phases = [];
    constructor(scope) {
        this.scope = scope;
    }
    async measure(name, operation) {
        const phaseStartedAt = performance.now();
        try {
            return await operation();
        }
        finally {
            const endedAt = performance.now();
            this.phases.push({
                name,
                durationMs: roundedMs(endedAt - phaseStartedAt),
                startedOffsetMs: roundedMs(phaseStartedAt - this.startedAt),
            });
        }
    }
    measureSync(name, operation) {
        const phaseStartedAt = performance.now();
        try {
            return operation();
        }
        finally {
            const endedAt = performance.now();
            this.phases.push({
                name,
                durationMs: roundedMs(endedAt - phaseStartedAt),
                startedOffsetMs: roundedMs(phaseStartedAt - this.startedAt),
            });
        }
    }
    finish() {
        const endedAt = performance.now();
        const totalMs = roundedMs(endedAt - this.startedAt);
        const phases = [...this.phases].sort((a, b) => a.startedOffsetMs - b.startedOffsetMs || a.name.localeCompare(b.name));
        const instrumentedMs = coveredDurationMs(phases, totalMs);
        return {
            schemaVersion: 1,
            scope: this.scope,
            runtimeBootId: RUNTIME_BOOT_ID,
            clock: "monotonic-process",
            totalMs,
            instrumentedMs,
            uninstrumentedMs: roundedMs(Math.max(0, totalMs - instrumentedMs)),
            phases,
        };
    }
}
