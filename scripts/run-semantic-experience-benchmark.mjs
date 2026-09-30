import fs from "node:fs/promises";
import path from "node:path";

import {
  benchmarkMssrSemanticExperience,
  defaultMssrSemanticExperienceStorePath,
  readMssrSemanticExperienceStore,
} from "../dist/index.js";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
const storeIndex = args.indexOf("--store");
const storePath = storeIndex >= 0 ? args[storeIndex + 1] : defaultMssrSemanticExperienceStorePath();
if ((outputIndex >= 0 && !outputPath) || (storeIndex >= 0 && !storePath)) {
  throw new Error("Usage: node scripts/run-semantic-experience-benchmark.mjs [--store <path>] [--output <path>]");
}

const store = await readMssrSemanticExperienceStore(storePath ? { storePath } : {});
const report = benchmarkMssrSemanticExperience({ observations: store.observations });
const text = `${JSON.stringify({ storePath, ...report }, null, 2)}\n`;
if (outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, text, "utf8");
}
process.stdout.write(text);
process.exitCode = report.promotion.eligible ? 0 : 2;
