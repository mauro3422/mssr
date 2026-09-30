import assert from "node:assert/strict";
import "./test-routing-proportionality.mjs";
import fs from "node:fs";
import {
  CapabilityRegistry,
  FilesystemSkillProvider,
  auditSkillRouting,
  planSkillRoute,
  resolveSkillLoadSelection,
  routingFixturesPath,
} from "../dist/index.js";

const fixturePath = routingFixturesPath();
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.equal(fixture.schemaVersion, 1, `Invalid schemaVersion in ${fixturePath}`);
assert.ok(Array.isArray(fixture.cases) && fixture.cases.length > 0, `No cases in ${fixturePath}`);

const registry = new CapabilityRegistry([new FilesystemSkillProvider()]);
const snapshot = await registry.refresh();
const skills = snapshot.capabilities.flatMap((capability) =>
  capability.kind === "skill" && capability.skill ? [capability.skill] : []);
assert.ok(skills.length > 0, "Filesystem provider returned no skills");

const failures = [];
const expandedCases = fixture.cases.flatMap((testCase) =>
  [testCase.task, ...(testCase.taskVariants ?? [])].map((task, index) => ({
    ...testCase,
    task,
    name: index === 0 ? testCase.name : `${testCase.name}:${task}`,
  })));

const requireMembers = (caseName, label, actual, expected = []) => {
  for (const name of expected) {
    if (!actual.includes(name)) failures.push(`${caseName}: ${label} missing '${name}' (actual: ${actual.join(", ") || "none"})`);
  }
};
const rejectMembers = (caseName, label, actual, expected = []) => {
  for (const name of expected) {
    if (actual.includes(name)) failures.push(`${caseName}: ${label} unexpectedly contains '${name}'`);
  }
};

for (const testCase of expandedCases) {
  const route = await planSkillRoute({
    task: testCase.task,
    context: testCase.context,
    intent: testCase.intent,
    caller: testCase.caller,
    stage: testCase.stage,
    completedPhases: testCase.completedPhases ?? [],
    maxSkills: testCase.maxSkills ?? 16,
    skills,
  });
  const expected = testCase.expect ?? {};
  if (expected.classificationMode && route.classificationMode !== expected.classificationMode) {
    failures.push(`${testCase.name}: expected classificationMode=${expected.classificationMode}, got ${route.classificationMode}`);
  }
  if (typeof expected.contextUsed === "boolean" && route.contextUsed !== expected.contextUsed) {
    failures.push(`${testCase.name}: expected contextUsed=${expected.contextUsed}, got ${route.contextUsed}`);
  }
  requireMembers(testCase.name, "active", route.loadOrder, expected.activeIncludes);
  rejectMembers(testCase.name, "active", route.loadOrder, expected.activeExcludes);
  requireMembers(testCase.name, "deferred", route.deferredLoadOrder, expected.deferredIncludes);
  rejectMembers(testCase.name, "deferred", route.deferredLoadOrder, expected.deferredExcludes);
  const hostGated = resolveSkillLoadSelection(route, "host-gated", []);
  requireMembers(testCase.name, "host-gated eligible", hostGated.eligibleLoadOrder, expected.hostGatedEligibleIncludes);
  rejectMembers(testCase.name, "host-gated eligible", hostGated.eligibleLoadOrder, expected.hostGatedEligibleExcludes);
  for (const key of ["missingRequiredPhases", "agentFallbackPhases"]) {
    if (!Array.isArray(expected[key])) continue;
    const actual = [...(route.coverage?.[key] ?? [])].sort();
    const wanted = [...expected[key]].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      failures.push(`${testCase.name}: expected ${key}=${wanted.join(", ") || "none"}, got ${actual.join(", ") || "none"}`);
    }
  }
  requireMembers(testCase.name, "required phases", route.coverage?.requiredPhases ?? [], expected.requiredPhasesIncludes);
  rejectMembers(testCase.name, "required phases", route.coverage?.requiredPhases ?? [], expected.requiredPhasesExcludes);
  if (Number.isInteger(expected.rootSelectedAtMost)
      && route.selectionBudget.selectedRootSkills > expected.rootSelectedAtMost) {
    failures.push(`${testCase.name}: expected at most ${expected.rootSelectedAtMost} root skills, got ${route.selectionBudget.selectedRootSkills}`);
  }
}

const jevNearMatchIntent = {
  summary: "Evaluar un workload Jev masivo con paralelismo y presupuesto, omitiendo adrede la señal de tool-chain para probar diagnóstico",
  domains: ["coding", "agent-orchestration"],
  actions: ["design", "optimize", "analyze", "test"],
  artifacts: ["code", "project"],
  needs: ["performance", "integrity-verification"],
  signals: ["nominal"],
  risk: "read-only",
  ambiguity: "low",
};
const jevNearMatchRoute = await planSkillRoute({
  task: "Tengo 500 candidatos independientes ya recuperados y quiero que Jev los clasifique por responsabilidad y riesgo con cache, dedupe y paralelismo acotado.",
  intent: jevNearMatchIntent,
  caller: "chatgpt-web",
  stage: "start",
  maxSkills: 8,
  skills,
});
if (jevNearMatchRoute.loadOrder.includes("jev-decision-systems")) {
  failures.push("near-match regression: Jev must not auto-activate while its required signal gate is missing");
}
const jevNearMatch = jevNearMatchRoute.nearMatches.find((candidate) => candidate.name === "jev-decision-systems");
if (!jevNearMatch) {
  failures.push("near-match regression: expected jev-decision-systems to be surfaced as an advisory near match");
} else {
  const signalGate = jevNearMatch.missingGates.find((gate) => gate.dimension === "signal");
  if (!signalGate) failures.push("near-match regression: expected missing signal gate for jev-decision-systems");
  if (!signalGate?.missingValues.includes("tool-chain-needed")) {
    failures.push(`near-match regression: expected tool-chain-needed in missing signal values (actual: ${signalGate?.missingValues.join(", ") ?? "none"})`);
  }
  if (jevNearMatch.explicitNameMatched) failures.push("near-match regression: Jev diagnostic should not depend on the canonical skill name being present in task prose");
}
if (jevNearMatchRoute.routingDiagnostics.advisoryOnly !== true) {
  failures.push("near-match regression: routing diagnostics must remain advisory-only");
}
const jevRecoveredRoute = await planSkillRoute({
  task: "Tengo 500 candidatos independientes ya recuperados y quiero que Jev los clasifique por responsabilidad y riesgo con cache, dedupe y paralelismo acotado.",
  intent: { ...jevNearMatchIntent, signals: ["tool-chain-needed"] },
  caller: "chatgpt-web",
  stage: "start",
  maxSkills: 8,
  skills,
});
if (!jevRecoveredRoute.loadOrder.includes("jev-decision-systems")) {
  failures.push("near-match regression: Jev should route normally after the host truthfully supplies the missing signal");
}

const optionalDependencyRoute = await planSkillRoute({
  task: "Verify live host-gated optional skill selection after Bridge restart on the Atlas graph editor.",
  intent: {
    summary: "Verify live host-gated optional skill selection after Bridge restart on the Atlas graph editor.",
    domains: ["godot", "coding"],
    actions: ["review", "analyze", "verify", "edit"],
    artifacts: ["ui"],
    needs: ["visual-qa", "performance"],
    signals: ["reusable-pattern"],
    risk: "read-only",
    ambiguity: "low",
  },
  caller: "chatgpt-web",
  stage: "verify",
  completedPhases: ["discovery", "implementation"],
  maxSkills: 8,
  skills,
});
const graphRoot = optionalDependencyRoute.activeSkills.find((skill) => skill.name === "godot-graph-ux-audit");
const graphDependency = optionalDependencyRoute.activeSkills.find((skill) => skill.name === "godot-project-inspection");
if (!graphRoot || !graphDependency) {
  failures.push("host-gated dependency regression: expected godot graph root and project-inspection dependency in route metadata");
} else {
  if (!graphRoot.selectedAsRoot || graphRoot.required) failures.push("host-gated dependency regression: godot-graph-ux-audit must remain an optional root");
  if (graphDependency.selectedAsRoot || graphDependency.required) failures.push("host-gated dependency regression: dependency-only godot-project-inspection must not become a pre-acceptance obligation");
  const skipped = resolveSkillLoadSelection(optionalDependencyRoute, "host-gated", []);
  if (skipped.eligibleLoadOrder.includes(graphRoot.name) || skipped.eligibleLoadOrder.includes(graphDependency.name)) {
    failures.push(`host-gated dependency regression: skipped optional root leaked into load closure (${skipped.eligibleLoadOrder.join(", ")})`);
  }
  const accepted = resolveSkillLoadSelection(optionalDependencyRoute, "host-gated", [{ skillName: graphRoot.name, decision: "accepted" }]);
  if (!accepted.eligibleLoadOrder.includes(graphRoot.name) || !accepted.eligibleLoadOrder.includes(graphDependency.name)) {
    failures.push(`host-gated dependency regression: accepted optional root did not carry its dependency (${accepted.eligibleLoadOrder.join(", ")})`);
  }
}


const audit = await auditSkillRouting(skills);
if (!audit.ok) failures.push(...audit.errors.map((error) => `audit error: ${error}`));
if (audit.maintenanceRequired) failures.push(...audit.maintenanceReasons.map((reason) => `audit maintenance: ${reason}`));

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, fixturePath, cases: expandedCases.length, failures, audit }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  fixturePath,
  cases: expandedCases.length,
  capabilities: snapshot.capabilities.length,
  audit: {
    ok: audit.ok,
    maintenanceRequired: audit.maintenanceRequired,
    counts: audit.counts,
    paths: audit.paths,
  },
}, null, 2));
