import { createRequire } from "node:module";
import { parentPort, workerData } from "node:worker_threads";
const require = createRequire(import.meta.url);
const input = workerData;
try {
    const sqlite = require("node:sqlite");
    const database = new sqlite.DatabaseSync(input.sqlitePath);
    database.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.trunc(input.busyTimeoutMs))};`);
    const result = database.prepare("PRAGMA wal_checkpoint(PASSIVE)").get();
    database.close();
    parentPort?.postMessage({ ok: true, result: result ?? null });
}
catch (error) {
    parentPort?.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
    });
}
