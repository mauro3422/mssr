import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createRegistryFromProviderConfig,
  loadMssrProviderConfig,
  mssrProviderConfigSchema,
} from "../dist/index.js";

const fixture = {
  schemaVersion: 1,
  providers: [{
    id: "fixture-mcp",
    transport: "stdio",
    command: process.execPath,
    args: ["fixture-server.mjs"],
    cwd: "C:\\fixture",
    source: "mcp:fixture",
    location: "local-fixture",
  }],
};

assert.deepEqual(mssrProviderConfigSchema.parse(fixture), fixture);
assert.throws(() => mssrProviderConfigSchema.parse({ ...fixture, extra: true }));
assert.throws(() => mssrProviderConfigSchema.parse({
  schemaVersion: 1,
  providers: [{ ...fixture.providers[0], id: "invalid id" }],
}));

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-provider-config-"));
const configPath = path.join(directory, "providers.json");
try {
  await fs.writeFile(configPath, JSON.stringify(fixture), "utf8");
  assert.deepEqual(await loadMssrProviderConfig(configPath), fixture);
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}

const registry = createRegistryFromProviderConfig(fixture);
assert.deepEqual(
  registry.getSnapshot().providers.map((provider) => provider.id),
  ["filesystem-skills", "fixture-mcp", "mssr-first-party-skills"],
);
await registry.close();
console.log("operator provider config tests passed");
