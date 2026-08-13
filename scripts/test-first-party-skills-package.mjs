import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSkillFrontmatter } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await fs.readFile(path.join(root, "config", "first-party-skills.json"), "utf8"));
const names = manifest.skills.map((skill) => skill.name).sort();
assert.equal(manifest.schemaVersion, 1);
assert.equal(new Set(names).size, names.length, "first-party manifest names must be unique");

const skillRoot = path.join(root, "skills");
const directories = (await fs.readdir(skillRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
assert.deepEqual(directories, names, "bundled skill directories must exactly match the first-party manifest");

async function filesUnder(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(location);
    return [location];
  }));
  return nested.flat();
}

const expectedPackageFiles = [];
for (const name of names) {
  const skillFile = path.join(skillRoot, name, "SKILL.md");
  const frontmatter = parseSkillFrontmatter(await fs.readFile(skillFile, "utf8"));
  assert.equal(frontmatter.name, name, `frontmatter name must match manifest name for ${name}`);
  expectedPackageFiles.push(...(await filesUnder(path.join(skillRoot, name))).map((file) => path.relative(root, file).replace(/\\/g, "/")));
}

const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "npm must expose npm_execpath while running the package conformance test");
const packed = await new Promise((resolve, reject) => execFile(process.execPath, [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root }, (error, stdout, stderr) => {
  if (error) reject(new Error(`${error.message}\n${stderr}`));
  else resolve(JSON.parse(stdout));
}));
const packedFiles = new Set(packed[0].files.map((file) => file.path));
for (const file of expectedPackageFiles) assert.equal(packedFiles.has(file), true, `npm pack must include ${file}`);
const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.scripts.postinstall, undefined, "first-party skill installation must remain opt-in");
const fixtureSchema = JSON.parse(await fs.readFile(path.join(root, "config", "skill-routing", "skill-routing-fixtures.schema.json"), "utf8"));
assert.equal(fixtureSchema.properties.cases.items.properties.sources.items.enum.includes("mssr-first-party"), true, "routing fixture schema must accept first-party provenance");

console.log("first-party skill package conformance tests passed");
