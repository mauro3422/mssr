import fs from "node:fs/promises";
import path from "node:path";
import {
  selectSkillContextModules,
  skillContextManifestSchema,
  type SkillContextSource,
} from "./skill-context.js";
import type { SkillEntry, SkillStage, StructuredSkillIntent } from "./skill-routing.js";

const MANIFEST_NAME = "context-modules.json";
const MAX_SKILL_FILE_CHARS = 160_000;
const MAX_MODULE_FILE_CHARS = 80_000;

export type SkillContextMode = "selective" | "full";
export type SkillReferenceMode = "auto" | "none";
export type SkillContextPlanningMode = "global-required-core-first";
type ManifestStatus = "loaded" | "missing" | "invalid" | "disabled";
type AllocationTier = "required-core" | "required-module" | "required-skill-module" | "optional-skill-core" | "optional-skill-module";
type AmbiguousGroup = { group: string; candidates: string[]; score: number };
type ModuleDecision = { id: string; selected: boolean; score: number; chars: number; reason: string; matched?: string[]; allocationTier?: AllocationTier };

export type SkillContextAssemblyInfo = {
  mode: SkillContextMode; manifestStatus: ManifestStatus; fallbackFull: boolean;
  coreCharsLoaded: number; moduleCharsLoaded: number; totalCharsLoaded: number;
  fullSkillChars: number; estimatedCharsSaved: number; selectedModules: string[];
  moduleDecisions: Array<Record<string, unknown>>; ambiguousGroups: AmbiguousGroup[];
  budgetExceeded: boolean; requiredBudgetExceeded: boolean; optionalContextOmitted: boolean;
  planningMode: SkillContextPlanningMode; allocationTiers: AllocationTier[];
  duplicateCharsAvoided: number; skipped?: boolean; skippedReason?: string;
  candidateChars?: number; warning?: string;
};
export type SkillContextAssembly = { skill: SkillEntry; loaded: true; activationInstruction: string; content: string; contextAssembly: SkillContextAssemblyInfo };
export type SkippedSkillContextAssembly = { skill: SkillEntry; loaded: false; warning: string; contextAssembly: SkillContextAssemblyInfo };
export type PlannedSkillContext = SkillContextAssembly | SkippedSkillContextAssembly;
type Module = { id: string; content: string; assembled: string; chars: number; score: number; priority: number; required: boolean; matched: string[] };
type Prepared = { skill: SkillEntry; required: boolean; routeIndex: number; routeScore: number; mode: SkillContextMode; manifestStatus: ManifestStatus; fallbackFull: boolean; full: string; core: string; modules: Module[]; decisions: ModuleDecision[]; ambiguousGroups: AmbiguousGroup[]; warning?: string };
type State = { prepared: Prepared; loaded: boolean; modules: Module[]; moduleIds: Set<string>; covered: string; tiers: Set<AllocationTier>; duplicate: number; skippedReason?: string; warning?: string };

function inside(dir: string, relative: string): string {
  const result = path.resolve(dir, relative);
  const rel = path.relative(dir, result);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Skill context path escapes its skill directory: ${relative}`);
  return result;
}
function headingLevel(line: string): number | null {
  const hit = /^(#{1,6})\s+\S/.exec(line.trim());
  return hit ? hit[1].length : null;
}
/** Extract exact Markdown heading blocks, including their headings. */
export function extractMarkdownSections(markdown: string, headings: string[]): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  return headings.map((heading) => {
    const matches = lines.map((line, index) => ({ line: line.trim(), index })).filter((item) => item.line === heading.trim());
    if (matches.length !== 1) throw new Error(`Expected one markdown heading '${heading}', found ${matches.length}.`);
    const start = matches[0].index;
    const level = headingLevel(lines[start]);
    if (!level) throw new Error(`Context section is not a markdown heading: ${heading}`);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      const next = headingLevel(lines[index]);
      if (next !== null && next <= level) { end = index; break; }
    }
    return lines.slice(start, end).join("\n").trim();
  }).join("\n\n");
}
async function readText(file: string, max: number): Promise<string> {
  const text = await fs.readFile(file, "utf8");
  if (text.length > max) throw new Error(`Skill context source exceeds ${max} characters: ${file}`);
  return text;
}
async function materialize(source: SkillContextSource, dir: string, full: string, max = MAX_MODULE_FILE_CHARS): Promise<string> {
  const text = source.path ? await readText(inside(dir, source.path), max) : extractMarkdownSections(full, source.sections ?? []);
  if (text.length > max) throw new Error(`Materialized skill context exceeds ${max} characters.`);
  return text.trim();
}
function compare(a: { state: State; module: Module }, b: { state: State; module: Module }): number {
  return b.module.score - a.module.score || b.module.priority - a.module.priority || b.state.prepared.routeScore - a.state.prepared.routeScore || a.state.prepared.routeIndex - b.state.prepared.routeIndex || a.state.prepared.skill.name.localeCompare(b.state.prepared.skill.name) || a.module.id.localeCompare(b.module.id);
}
function update(state: State, module: Module, patch: Partial<ModuleDecision>): void {
  const index = state.prepared.decisions.findIndex((item) => item.id === module.id);
  if (index >= 0) state.prepared.decisions[index] = { ...state.prepared.decisions[index], ...patch };
}
function add(state: State, module: Module, tier: AllocationTier): number {
  if (state.moduleIds.has(module.id)) return 0;
  if (module.content && state.covered.includes(module.content)) {
    state.duplicate += module.chars;
    update(state, module, { selected: false, chars: 0, reason: "already-covered-by-loaded-context", allocationTier: tier });
    return 0;
  }
  state.modules.push(module); state.moduleIds.add(module.id); state.covered += `\n\n${module.content}`; state.tiers.add(tier);
  update(state, module, { selected: true, reason: "selected", allocationTier: tier });
  return module.chars;
}
function omit(state: State, module: Module, reason: string, tier: AllocationTier): void { update(state, module, { selected: false, reason, allocationTier: tier }); }
async function prepare(args: { skill: SkillEntry; required: boolean; routeIndex: number; routeScore: number; intent: StructuredSkillIntent; stage: SkillStage; mode: SkillContextMode; references: SkillReferenceMode }): Promise<Prepared> {
  if (!args.skill.path) throw new Error(`Codex skill has no readable path: ${args.skill.name}`);
  const full = await readText(args.skill.path, MAX_SKILL_FILE_CHARS);
  const basic = (mode: SkillContextMode, status: ManifestStatus, fallback: boolean, warning?: string): Prepared => ({ skill: args.skill, required: args.required, routeIndex: args.routeIndex, routeScore: args.routeScore, mode, manifestStatus: status, fallbackFull: fallback, full, core: full, modules: [], decisions: [], ambiguousGroups: [], warning });
  if (args.mode === "full") return basic("full", "disabled", false);
  const dir = path.dirname(args.skill.path);
  let raw: string;
  try { raw = await fs.readFile(path.join(dir, MANIFEST_NAME), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return basic("full", "missing", true, "No context-modules.json manifest; loaded full SKILL.md for compatibility."); throw error; }
  let manifest;
  try { manifest = skillContextManifestSchema.parse(JSON.parse(raw)); }
  catch (error) { return basic("full", "invalid", true, `Invalid context-modules.json; loaded full SKILL.md: ${error instanceof Error ? error.message : String(error)}`); }
  const core = `# Active skill context: ${args.skill.name}\n\n${await materialize(manifest.core, dir, full, MAX_SKILL_FILE_CHARS)}`.trim();
  if (args.references === "none") return { ...basic("selective", "loaded", false), core, decisions: manifest.modules.map((module) => ({ id: module.id, selected: false, score: 0, chars: 0, reason: "references-disabled", matched: [] })) };
  const materialized = await Promise.all(manifest.modules.map(async (item) => {
    const content = await materialize(item.source, dir, full, item.maxChars);
    const assembled = `## Selected context module: ${item.id}\n\n${content}`;
    return { ...item, content, assembled, chars: assembled.length + 2 };
  }));
  const selection = selectSkillContextModules({ modules: materialized.map(({ content: _content, assembled: _assembled, ...item }) => item), intent: args.intent, stage: args.stage, maxModuleChars: Number.MAX_SAFE_INTEGER });
  const selected = new Map(selection.selected.map((item) => [item.id, item]));
  return { ...basic("selective", "loaded", false), core, modules: materialized.filter((item) => selected.has(item.id)).map((item) => {
    const decision = selection.decisions.find((candidate) => candidate.id === item.id)!;
    return { id: item.id, content: item.content, assembled: item.assembled, chars: item.chars, score: decision.score, priority: item.priority ?? 0, required: item.required === true, matched: decision.matched };
  }), decisions: selection.decisions.map((item) => ({ id: item.id, selected: item.selected, score: item.score, chars: item.chars, reason: item.reason, matched: item.matched })), ambiguousGroups: selection.ambiguousGroups };
}
function result(state: State, limit: number): PlannedSkillContext {
  const p = state.prepared;
  if (!state.loaded) {
    const candidateChars = p.core.length + p.modules.filter((module) => module.required).reduce((sum, module) => sum + module.chars, 0);
    const warning = state.warning ?? `Optional skill '${p.skill.name}' context was skipped because its minimum package of ${candidateChars} characters did not fit the global budget.`;
    return { skill: p.skill, loaded: false, warning, contextAssembly: { mode: p.mode, manifestStatus: p.manifestStatus, fallbackFull: p.fallbackFull, coreCharsLoaded: 0, moduleCharsLoaded: 0, totalCharsLoaded: 0, fullSkillChars: p.full.length, estimatedCharsSaved: p.full.length, selectedModules: [], moduleDecisions: p.decisions, ambiguousGroups: p.ambiguousGroups, budgetExceeded: false, requiredBudgetExceeded: false, optionalContextOmitted: true, planningMode: "global-required-core-first", allocationTiers: [], duplicateCharsAvoided: state.duplicate, skipped: true, skippedReason: state.skippedReason ?? "optional-context-exceeds-budget", candidateChars, warning } };
  }
  const content = p.mode === "full" ? p.core : [p.core, ...state.modules.map((module) => module.assembled)].filter(Boolean).join("\n\n").trim();
  const omitted = p.decisions.filter((item) => item.reason === "budget-exceeded");
  const requiredBudgetExceeded = content.length > limit || omitted.some((item) => p.modules.some((module) => module.id === item.id && module.required));
  return { skill: p.skill, loaded: true, activationInstruction: p.mode === "full" ? "Treat the returned SKILL.md as active procedural guidance for the current task. Apply it together with higher-priority safety and project instructions." : "Treat the assembled core and selected modules as active guidance for this task phase. Omitted modules are not active unless loaded explicitly.", content, contextAssembly: { mode: p.mode, manifestStatus: p.manifestStatus, fallbackFull: p.fallbackFull, coreCharsLoaded: p.core.length, moduleCharsLoaded: Math.max(0, content.length - p.core.length), totalCharsLoaded: content.length, fullSkillChars: p.full.length, estimatedCharsSaved: Math.max(0, p.full.length - content.length), selectedModules: state.modules.map((module) => module.id), moduleDecisions: p.decisions, ambiguousGroups: p.ambiguousGroups, budgetExceeded: requiredBudgetExceeded, requiredBudgetExceeded, optionalContextOmitted: omitted.some((item) => !p.modules.some((module) => module.id === item.id && module.required)), planningMode: "global-required-core-first", allocationTiers: [...state.tiers], duplicateCharsAvoided: state.duplicate, warning: p.warning } };
}

export type GlobalSkillContextPlan = { planningMode: SkillContextPlanningMode; maxContextChars: number; requiredCoreReservedChars: number; requiredModuleReservedChars: number; optionalModuleCharsLoaded: number; optionalSkillCoreCharsLoaded: number; requiredOverflowChars: number; duplicateCharsAvoided: number; totalContextCharsLoaded: number; totalFullSkillChars: number; estimatedCharsSaved: number; remainingContextChars: number; budgetExceeded: boolean; requiredBudgetExceeded: boolean; optionalContextOmitted: boolean; globallySelectedModules: Array<{ skill: string; module: string; tier: AllocationTier; score: number; chars: number }>; skills: PlannedSkillContext[] };
export async function planCodexSkillContexts(args: { skills: Array<{ skill: SkillEntry; required: boolean; routeIndex: number; routeScore: number }>; intent: StructuredSkillIntent; stage: SkillStage; mode: SkillContextMode; references: SkillReferenceMode; maxContextChars: number }): Promise<GlobalSkillContextPlan> {
  const states = (await Promise.all(args.skills.map((item) => prepare({ ...item, intent: args.intent, stage: args.stage, mode: args.mode, references: args.references })))).map<State>((prepared) => ({ prepared, loaded: false, modules: [], moduleIds: new Set(), covered: "", tiers: new Set(), duplicate: 0 }));
  const required = states.filter((state) => state.prepared.required);
  const optional = states.filter((state) => !state.prepared.required).sort((a, b) => b.prepared.routeScore - a.prepared.routeScore || a.prepared.routeIndex - b.prepared.routeIndex);
  let used = 0; let requiredCoreReservedChars = 0; let requiredModuleReservedChars = 0; let optionalModuleCharsLoaded = 0; let optionalSkillCoreCharsLoaded = 0;
  const globallySelectedModules: GlobalSkillContextPlan["globallySelectedModules"] = [];
  for (const state of required) { state.loaded = true; state.covered = state.prepared.core; state.tiers.add("required-core"); used += state.prepared.core.length; requiredCoreReservedChars += state.prepared.core.length; }
  const selected = required.flatMap((state) => state.prepared.modules.filter((module) => module.required).map((module) => ({ state, module }))).sort(compare);
  for (const item of selected) { const chars = add(item.state, item.module, "required-module"); used += chars; requiredModuleReservedChars += chars; if (chars) globallySelectedModules.push({ skill: item.state.prepared.skill.name, module: item.module.id, tier: "required-module", score: item.module.score, chars }); }
  let remaining = Math.max(0, args.maxContextChars - used);
  const candidates = required.flatMap((state) => state.prepared.modules.filter((module) => !module.required).map((module) => ({ state, module }))).sort(compare);
  for (const item of candidates) { if (item.module.chars <= remaining) { const chars = add(item.state, item.module, "required-skill-module"); used += chars; remaining -= chars; optionalModuleCharsLoaded += chars; if (chars) globallySelectedModules.push({ skill: item.state.prepared.skill.name, module: item.module.id, tier: "required-skill-module", score: item.module.score, chars }); } else omit(item.state, item.module, "budget-exceeded", "required-skill-module"); }
  for (const state of optional) { const requiredModules = state.prepared.modules.filter((module) => module.required); const minimum = state.prepared.core.length + requiredModules.reduce((sum, module) => sum + module.chars, 0); if (minimum > remaining) { state.skippedReason = "optional-context-exceeds-budget"; for (const module of state.prepared.modules) omit(state, module, "optional-skill-not-loaded", module.required ? "required-module" : "optional-skill-module"); continue; } state.loaded = true; state.covered = state.prepared.core; state.tiers.add("optional-skill-core"); used += state.prepared.core.length; remaining -= state.prepared.core.length; optionalSkillCoreCharsLoaded += state.prepared.core.length; for (const module of requiredModules) { const chars = add(state, module, "required-module"); used += chars; remaining -= chars; requiredModuleReservedChars += chars; } }
  for (const item of optional.filter((state) => state.loaded).flatMap((state) => state.prepared.modules.filter((module) => !module.required).map((module) => ({ state, module }))).sort(compare)) { if (item.module.chars <= remaining) { const chars = add(item.state, item.module, "optional-skill-module"); used += chars; remaining -= chars; optionalModuleCharsLoaded += chars; if (chars) globallySelectedModules.push({ skill: item.state.prepared.skill.name, module: item.module.id, tier: "optional-skill-module", score: item.module.score, chars }); } else omit(item.state, item.module, "budget-exceeded", "optional-skill-module"); }
  const skills = states.sort((a, b) => a.prepared.routeIndex - b.prepared.routeIndex).map((state) => result(state, args.maxContextChars));
  const totalContextCharsLoaded = skills.reduce((sum, item) => sum + item.contextAssembly.totalCharsLoaded, 0);
  const requiredOverflowChars = Math.max(0, requiredCoreReservedChars + requiredModuleReservedChars - args.maxContextChars);
  return { planningMode: "global-required-core-first", maxContextChars: args.maxContextChars, requiredCoreReservedChars, requiredModuleReservedChars, optionalModuleCharsLoaded, optionalSkillCoreCharsLoaded, requiredOverflowChars, duplicateCharsAvoided: skills.reduce((sum, item) => sum + item.contextAssembly.duplicateCharsAvoided, 0), totalContextCharsLoaded, totalFullSkillChars: skills.reduce((sum, item) => sum + item.contextAssembly.fullSkillChars, 0), estimatedCharsSaved: skills.reduce((sum, item) => sum + item.contextAssembly.estimatedCharsSaved, 0), remainingContextChars: Math.max(0, args.maxContextChars - totalContextCharsLoaded), budgetExceeded: requiredOverflowChars > 0, requiredBudgetExceeded: requiredOverflowChars > 0, optionalContextOmitted: skills.some((item) => item.contextAssembly.optionalContextOmitted), globallySelectedModules, skills };
}
export async function assembleCodexSkillContext(args: { skill: SkillEntry; intent: StructuredSkillIntent; stage: SkillStage; mode: SkillContextMode; references: SkillReferenceMode; remainingChars: number }): Promise<SkillContextAssembly> {
  const plan = await planCodexSkillContexts({ skills: [{ skill: args.skill, required: true, routeIndex: 0, routeScore: 0 }], intent: args.intent, stage: args.stage, mode: args.mode, references: args.references, maxContextChars: Math.max(0, Math.floor(args.remainingChars)) });
  const item = plan.skills[0];
  if (!item || !item.loaded) throw new Error(`Required skill context was unexpectedly skipped: ${args.skill.name}`);
  return item;
}
