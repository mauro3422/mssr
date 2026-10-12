import { parentPort, workerData } from "node:worker_threads";
import { refreshMssrSkillMaintenanceIndex } from "./mssr-observatory.js";
const input = workerData;
try {
    const result = refreshMssrSkillMaintenanceIndex({
        workspaceRoot: input.workspaceRoot,
        scope: input.scope,
        days: input.days,
    });
    parentPort?.postMessage({ ok: true, result });
}
catch (error) {
    parentPort?.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
    });
}
