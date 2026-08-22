import { createHash } from "node:crypto";
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
const CURSOR_VERSION = 1;

export type SkillContextMode = "selective" | "full";
export type SkillReferenceMode = "auto" | "none";
export type SkillContextPlanningMode = "global-required-core-first";
export type SkillContextObligation = "required" | "accepted";
type ManifestStatus = "loaded" | "missing" | "invalid" | "disabled";
type AllocationTier = "required-core" | "required-module" | "required-skill-module" | "accepted-skill-core" | "accepted-skill-module";
type AmbiguousGroup = { group: string; candidates: string[]; score: number };
type ModuleDecision = { id: string; selected: boolean; score: number; chars: number; reason: string; matched?: string[]; allocationTier?: AllocationTier };

export type SkillContextAssemblyInfo = {
  mode: SkillContextMode; manifestStatus: ManifestStatus; fallbackFull: boolean;
  coreCharsLoaded: number; moduleCharsLoaded: number; totalCharsLoaded: number;
  fullSkillChars: number; estimatedCharsSaved: number; selectedModules: string[];
  moduleDecisions: Array<Record<string, unknown>>; ambiguousGroups: AmbiguousGroup[];
  budgetExceeded: boolean; requiredBudgetExceeded: boolean; optionalContextOmitted: boolean;
  contextDeferred: boolean;
  planningMode: SkillContextPlanningMode; allocationTiers: AllocationTier[];
  duplicateCharsAvoided: number; skipped?: boolean; skippedReason?: string;
  candidateChars?: number; warning?: string;
};
export type SkillContextAssembly = { skill: SkillEntry; obligation: SkillContextObligation; loaded: true; activationInstruction: string; content: string; contextAssembly: SkillContextAssemblyInfo };
export type SkippedSkillContextAssembly = { skill: SkillEntry; obligation: SkillContextObligation; loaded: false; warning: string; contextAssembly: SkillContextAssemblyInfo };
export type PlannedSkillContext = SkillContextAssembly | SkippedSkillContextAssembly;

type Module = { id: string; content: string; assembled: string; chars: number; score: number; priority: number; required: boolean; matched: string[] };
type Prepared = { skill: SkillEntry; obligation: SkillContextObligation; routeIndex: number; routeScore: number; mode: SkillContextMode; manifestStatus: ManifestStatus; fallbackFull: boolean; full: string; core: string; modules: Module[]; decisions: ModuleDecision[]; ambiguousGroups: AmbiguousGroup[]; deduplicatedModules: Map<string, AllocationTier>; duplicateCharsAvoided: number; warning?: string };
type UnitKind = "core" | "module";
type DeliveryUnit = { id: string; skill: string; kind: UnitKind; module?: string; obligation: SkillContextObligation; tier: AllocationTier; chars: number; content: string; state: Prepared };
type CursorEnvelope = { v: number; plan: string; next: number; page: number; integrity: string };

export type SkillContextUnitMetadata = Readonly<{ id: string; skill: string; kind: UnitKind; module?: string; obligation: SkillContextObligation; chars: number }>;
export type SkillContextPageNext = Readonly<{ page: number; cursor: string; maxContextChars: number; remainingRequiredUnits: number; remainingAcceptedUnits: number }>;
export type SkillContextPage = Readonly<{
  planningMode: SkillContextPlanningMode;
  status: "complete" | "partial";
  mustContinue: boolean;
  cursor?: string;
  nextPage?: SkillContextPageNext;
  planFingerprint: string;
  page: number;
  maxContextChars: number;
  deliveredChars: number;
  remaining: { required: SkillContextUnitMetadata[]; accepted: SkillContextUnitMetadata[] };
  units: SkillContextUnitMetadata[];
  blocked: SkillContextUnitMetadata[];
  requiredCoreReservedChars: number;
  requiredModuleReservedChars: number;
  optionalModuleCharsLoaded: number;
  optionalSkillCoreCharsLoaded: number;
  requiredOverflowChars: number;
  duplicateCharsAvoided: number;
  totalContextCharsLoaded: number;
  totalFullSkillChars: number;
  estimatedCharsSaved: number;
  remainingContextChars: number;
  budgetExceeded: boolean;
  requiredBudgetExceeded: boolean;
  optionalContextOmitted: boolean;
  globallySelectedModules: Array<{ skill: string; module: string; tier: AllocationTier; score: number; chars: number }>;
  skills: PlannedSkillContext[];
}>;
export type GlobalSkillContextPlan = SkillContextPage;
export type SkillContextPageInput = {
  skills: Array<{ skill: SkillEntry; obligation: SkillContextObligation; routeIndex: number; routeScore: number }>;
  intent: StructuredSkillIntent;
  stage: SkillStage;
  mode: SkillContextMode;
  references: SkillReferenceMode;
  maxContextChars: number;
  cursor?: string;
};

function inside(dir: string, relative: string): string {
  const result = path.resolve(dir, relative);
  const rel = path.relative(dir, result);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Skill context path escapes its skill directory: ${relative}`);
  return result;
}
function headingLevel(line: string): number | null { const hit = /^(#{1,6})\s+\S/.exec(line.trim()); return hit ? hit[1].length : null; }
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
    for (let index = start + 1; index < lines.length; index += 1) { const next = headingLevel(lines[index]); if (next !== null && next <= level) { end = index; break; } }
    return lines.slice(start, end).join("\n").trim();
  }).join("\n\n");
}
async function readText(file: string, max: number): Promise<string> { const text = await fs.readFile(file, "utf8"); if (text.length > max) throw new Error(`Skill context source exceeds ${max} characters: ${file}`); return text; }
async function materialize(source: SkillContextSource, dir: string, full: string, max = MAX_MODULE_FILE_CHARS): Promise<string> {
  const text = source.path ? await readText(inside(dir, source.path), max) : extractMarkdownSections(full, source.sections ?? []);
  if (text.length > max) throw new Error(`Materialized skill context exceeds ${max} characters.`);
  return text.trim();
}
function compare(a: { state: Prepared; module: Module }, b: { state: Prepared; module: Module }): number { return b.module.score - a.module.score || b.module.priority - a.module.priority || b.state.routeScore - a.state.routeScore || a.state.routeIndex - b.state.routeIndex || a.state.skill.name.localeCompare(b.state.skill.name) || a.module.id.localeCompare(b.module.id); }
function sha256(value: string): string { return createHash("sha256").update(value).digest("base64url"); }
function cursorIntegrity(plan: string, next: number, page: number): string { return sha256(`${CURSOR_VERSION}|${plan}|${next}|${page}`); }
function makeCursor(plan: string, next: number, page: number): string { return Buffer.from(JSON.stringify({ v: CURSOR_VERSION, plan, next, page, integrity: cursorIntegrity(plan, next, page) } satisfies CursorEnvelope), "utf8").toString("base64url"); }
function parseCursor(cursor: string, plan: string, unitCount: number): CursorEnvelope {
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")); } catch { throw new Error("Invalid skill context cursor."); }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid skill context cursor.");
  const value = parsed as Partial<CursorEnvelope>;
  if (value.v !== CURSOR_VERSION || typeof value.plan !== "string" || !Number.isInteger(value.next) || !Number.isInteger(value.page) || typeof value.integrity !== "string") throw new Error("Invalid skill context cursor.");
  const envelope = value as CursorEnvelope;
  if (envelope.integrity !== cursorIntegrity(envelope.plan, envelope.next, envelope.page)) throw new Error("Skill context cursor integrity check failed.");
  if (envelope.plan !== plan) throw new Error("Stale skill context cursor: selected skill context changed.");
  if (envelope.next < 0 || envelope.next >= unitCount || envelope.page < 1) throw new Error("Invalid skill context cursor position.");
  return envelope;
}
function unitMetadata(unit: DeliveryUnit): SkillContextUnitMetadata { return { id: unit.id, skill: unit.skill, kind: unit.kind, ...(unit.module ? { module: unit.module } : {}), obligation: unit.obligation, chars: unit.chars }; }
async function prepare(args: { skill: SkillEntry; obligation: SkillContextObligation; routeIndex: number; routeScore: number; intent: StructuredSkillIntent; stage: SkillStage; mode: SkillContextMode; references: SkillReferenceMode }): Promise<Prepared> {
  if (!args.skill.path) throw new Error(`Codex skill has no readable path: ${args.skill.name}`);
  const full = await readText(args.skill.path, MAX_SKILL_FILE_CHARS);
  const basic = (mode: SkillContextMode, status: ManifestStatus, fallback: boolean, warning?: string): Prepared => ({ skill: args.skill, obligation: args.obligation, routeIndex: args.routeIndex, routeScore: args.routeScore, mode, manifestStatus: status, fallbackFull: fallback, full, core: full, modules: [], decisions: [], ambiguousGroups: [], deduplicatedModules: new Map(), duplicateCharsAvoided: 0, warning });
  if (args.mode === "full") return basic("full", "disabled", false);
  const dir = path.dirname(args.skill.path);
  let raw: string;
  try { raw = await fs.readFile(path.join(dir, MANIFEST_NAME), "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return basic("full", "missing", true, "No context-modules.json manifest; loaded full SKILL.md for compatibility."); throw error; }
  let manifest;
  try { manifest = skillContextManifestSchema.parse(JSON.parse(raw)); } catch (error) { return basic("full", "invalid", true, `Invalid context-modules.json; loaded full SKILL.md: ${error instanceof Error ? error.message : String(error)}`); }
  const core = `# Active skill context: ${args.skill.name}\n\n${await materialize(manifest.core, dir, full, MAX_SKILL_FILE_CHARS)}`.trim();
  if (args.references === "none") return { ...basic("selective", "loaded", false), core, decisions: manifest.modules.map((module) => ({ id: module.id, selected: false, score: 0, chars: 0, reason: "references-disabled", matched: [] })) };
  const materialized = await Promise.all(manifest.modules.map(async (item) => { const content = await materialize(item.source, dir, full, item.maxChars); const assembled = `## Selected context module: ${item.id}\n\n${content}`; return { ...item, content, assembled, chars: assembled.length + 2 }; }));
  const selection = selectSkillContextModules({ modules: materialized.map(({ content: _content, assembled: _assembled, ...item }) => item), intent: args.intent, stage: args.stage, maxModuleChars: Number.MAX_SAFE_INTEGER });
  const selected = new Map(selection.selected.map((item) => [item.id, item]));
  return { ...basic("selective", "loaded", false), core, modules: materialized.filter((item) => selected.has(item.id)).map((item) => { const decision = selection.decisions.find((candidate) => candidate.id === item.id)!; return { id: item.id, content: item.content, assembled: item.assembled, chars: item.chars, score: decision.score, priority: item.priority ?? 0, required: item.required === true, matched: decision.matched }; }), decisions: selection.decisions.map((item) => ({ id: item.id, selected: item.selected, score: item.score, chars: item.chars, reason: item.reason, matched: item.matched })), ambiguousGroups: selection.ambiguousGroups };
}
function buildUnits(states: Prepared[]): DeliveryUnit[] {
  const required = states.filter((state) => state.obligation === "required").sort((a, b) => a.routeIndex - b.routeIndex);
  const accepted = states.filter((state) => state.obligation === "accepted").sort((a, b) => b.routeScore - a.routeScore || a.routeIndex - b.routeIndex || a.skill.name.localeCompare(b.skill.name));
  const core = (state: Prepared, tier: AllocationTier): DeliveryUnit => ({ id: `${state.skill.name}:core`, skill: state.skill.name, kind: "core", obligation: state.obligation, tier, chars: state.core.length, content: state.core, state });
  const covered = new Map(states.map((state) => [state, state.core]));
  const module = (state: Prepared, item: Module, tier: AllocationTier): DeliveryUnit | null => {
    const prior = covered.get(state) ?? "";
    if (item.content && prior.includes(item.content)) {
      state.deduplicatedModules.set(item.id, tier);
      state.duplicateCharsAvoided += item.chars;
      return null;
    }
    covered.set(state, `${prior}\n\n${item.content}`);
    return { id: `${state.skill.name}:module:${item.id}`, skill: state.skill.name, kind: "module", module: item.id, obligation: state.obligation, tier, chars: item.chars, content: item.assembled, state };
  };
  const ordered = (items: Prepared[], requiredOnly: boolean, tier: AllocationTier) => items.flatMap((state) => state.modules.filter((item) => item.required === requiredOnly).map((item) => ({ state, module: item }))).sort(compare).flatMap(({ state, module: item }) => {
    const unit = module(state, item, tier);
    return unit ? [unit] : [];
  });
  const acceptedRequired = accepted.flatMap((state) => [core(state, "accepted-skill-core"), ...state.modules.filter((item) => item.required).sort((a, b) => b.score - a.score || b.priority - a.priority || a.id.localeCompare(b.id)).flatMap((item) => {
    const unit = module(state, item, "required-module");
    return unit ? [unit] : [];
  })]);
  return [...required.map((state) => core(state, "required-core")), ...ordered(required, true, "required-module"), ...ordered(required, false, "required-skill-module"), ...acceptedRequired, ...ordered(accepted, false, "accepted-skill-module")];
}
function planFingerprint(args: SkillContextPageInput, units: DeliveryUnit[]): string {
  // Cursor payload deliberately contains no task prompt or skill text. This
  // fingerprint binds it to reconstructed bytes, order, obligation and budget.
  return sha256(JSON.stringify({ v: CURSOR_VERSION, stage: args.stage, mode: args.mode, references: args.references, maxContextChars: args.maxContextChars, skills: args.skills.map((item) => ({ name: item.skill.name, obligation: item.obligation, routeIndex: item.routeIndex, routeScore: item.routeScore })), units: units.map((item) => ({ id: item.id, obligation: item.obligation, chars: item.chars, contentFingerprint: sha256(item.content) })) }));
}
function skillResult(state: Prepared, delivered: DeliveryUnit[], all: DeliveryUnit[], deferred: Set<string>, blocked: Set<string>, limit: number): PlannedSkillContext {
  const own = delivered.filter((unit) => unit.state === state);
  const ownAll = all.filter((unit) => unit.state === state);
  const ownDeferred = ownAll.filter((unit) => deferred.has(unit.id));
  const ownBlocked = ownAll.filter((unit) => blocked.has(unit.id));
  const coreLoaded = own.some((unit) => unit.kind === "core");
  const modules = own.filter((unit) => unit.kind === "module");
  const content = state.mode === "full" && own.length === 1 && own[0]?.kind === "core"
    ? own[0].content
    : own.map((unit) => unit.content).join("\n\n").trim();
  const moduleDecisions = state.decisions.map((decision) => {
    const dedupeTier = state.deduplicatedModules.get(decision.id);
    if (dedupeTier) return { ...decision, selected: false, chars: 0, reason: "already-covered-by-loaded-context", allocationTier: dedupeTier };
    const id = `${state.skill.name}:module:${decision.id}`;
    const unit = ownAll.find((candidate) => candidate.id === id);
    if (!unit) return decision;
    if (own.some((candidate) => candidate.id === id)) return { ...decision, selected: true, reason: "selected", allocationTier: unit.tier };
    if (blocked.has(id)) return { ...decision, selected: false, reason: "indivisible-unit-exceeds-budget", allocationTier: unit.tier };
    return { ...decision, selected: false, reason: "deferred-to-next-page", allocationTier: unit.tier };
  });
  const info: SkillContextAssemblyInfo = { mode: state.mode, manifestStatus: state.manifestStatus, fallbackFull: state.fallbackFull, coreCharsLoaded: coreLoaded ? state.core.length : 0, moduleCharsLoaded: modules.reduce((sum, unit) => sum + unit.chars, 0), totalCharsLoaded: content.length, fullSkillChars: state.full.length, estimatedCharsSaved: Math.max(0, state.full.length - content.length), selectedModules: modules.map((unit) => unit.module!).filter(Boolean), moduleDecisions, ambiguousGroups: state.ambiguousGroups, budgetExceeded: ownBlocked.length > 0, requiredBudgetExceeded: ownBlocked.some((unit) => unit.obligation === "required"), optionalContextOmitted: false, contextDeferred: ownDeferred.length > 0, planningMode: "global-required-core-first", allocationTiers: [...new Set(own.map((unit) => unit.tier))], duplicateCharsAvoided: state.duplicateCharsAvoided, ...(state.warning ? { warning: state.warning } : {}) };
  if (own.length) return { skill: state.skill, obligation: state.obligation, loaded: true, activationInstruction: coreLoaded ? "Treat this page's core and modules as active guidance for the current task phase. Continue with the returned cursor before relying on deferred selected context." : "Continuation page: apply these selected modules together with the compatible core delivered on a prior page.", content, contextAssembly: info };
  const reason = ownBlocked.length ? `Selected ${state.obligation} context cannot fit the ${limit}-character page budget as an indivisible unit.` : ownDeferred.length ? `Selected ${state.obligation} context is deferred to the next compatible page.` : "No selected context was materialized for this skill.";
  return { skill: state.skill, obligation: state.obligation, loaded: false, warning: reason, contextAssembly: { ...info, skipped: true, skippedReason: ownBlocked.length ? "indivisible-unit-exceeds-budget" : ownDeferred.length ? "deferred-to-next-page" : "not-selected", candidateChars: state.core.length + state.modules.reduce((sum, item) => sum + item.chars, 0) } };
}

/** Materialize one deterministic bounded page; selected units are delivered, deferred with a cursor, or explicitly blocked. */
export async function planSkillContextPage(args: SkillContextPageInput): Promise<SkillContextPage> {
  const maxContextChars = Math.max(0, Math.floor(args.maxContextChars));
  const states = await Promise.all(args.skills.map((item) => prepare({ ...item, intent: args.intent, stage: args.stage, mode: args.mode, references: args.references })));
  const units = buildUnits(states);
  const fingerprint = planFingerprint({ ...args, maxContextChars }, units);
  const position = args.cursor ? parseCursor(args.cursor, fingerprint, units.length) : { next: 0, page: 1 };
  const delivered: DeliveryUnit[] = [];
  const blocked: DeliveryUnit[] = [];
  let index = position.next;
  let used = 0;
  while (index < units.length) {
    const unit = units[index];
    if (unit.chars > maxContextChars) { blocked.push(unit); break; }
    if (used + unit.chars > maxContextChars) break;
    delivered.push(unit); used += unit.chars; index += 1;
  }
  const remainingUnits = units.slice(index);
  const blockedIds = new Set(blocked.map((unit) => unit.id));
  const deferred = new Set(remainingUnits.filter((unit) => !blockedIds.has(unit.id)).map((unit) => unit.id));
  const remaining = { required: remainingUnits.filter((unit) => unit.obligation === "required").map(unitMetadata), accepted: remainingUnits.filter((unit) => unit.obligation === "accepted").map(unitMetadata) };
  const requiredCoreReservedChars = units.filter((unit) => unit.tier === "required-core").reduce((sum, unit) => sum + unit.chars, 0);
  const requiredModuleReservedChars = units.filter((unit) => unit.tier === "required-module").reduce((sum, unit) => sum + unit.chars, 0);
  const optionalModuleCharsLoaded = delivered.filter((unit) => unit.tier === "required-skill-module" || unit.tier === "accepted-skill-module").reduce((sum, unit) => sum + unit.chars, 0);
  const optionalSkillCoreCharsLoaded = delivered.filter((unit) => unit.tier === "accepted-skill-core").reduce((sum, unit) => sum + unit.chars, 0);
  const status = remainingUnits.length || blocked.length ? "partial" as const : "complete" as const;
  const cursor = !blocked.length && remainingUnits.length ? makeCursor(fingerprint, index, position.page + 1) : undefined;
  const skills = states.sort((a, b) => a.routeIndex - b.routeIndex).map((state) => skillResult(state, delivered, units, deferred, blockedIds, maxContextChars));
  return { planningMode: "global-required-core-first", status, mustContinue: status === "partial", ...(cursor ? { cursor } : {}), ...(cursor ? { nextPage: { page: position.page + 1, cursor, maxContextChars, remainingRequiredUnits: remaining.required.length, remainingAcceptedUnits: remaining.accepted.length } } : {}), planFingerprint: fingerprint, page: position.page, maxContextChars, deliveredChars: used, remaining, units: delivered.map(unitMetadata), blocked: blocked.map(unitMetadata), requiredCoreReservedChars, requiredModuleReservedChars, optionalModuleCharsLoaded, optionalSkillCoreCharsLoaded, requiredOverflowChars: blocked.filter((unit) => unit.obligation === "required").reduce((sum, unit) => sum + unit.chars - maxContextChars, 0), duplicateCharsAvoided: states.reduce((sum, state) => sum + state.duplicateCharsAvoided, 0), totalContextCharsLoaded: used, totalFullSkillChars: states.reduce((sum, state) => sum + state.full.length, 0), estimatedCharsSaved: skills.reduce((sum, item) => sum + item.contextAssembly.estimatedCharsSaved, 0), remainingContextChars: Math.max(0, maxContextChars - used), budgetExceeded: blocked.length > 0, requiredBudgetExceeded: blocked.some((unit) => unit.obligation === "required"), optionalContextOmitted: false, globallySelectedModules: delivered.filter((unit) => unit.kind === "module").map((unit) => ({ skill: unit.skill, module: unit.module!, tier: unit.tier, score: unit.state.modules.find((item) => item.id === unit.module)?.score ?? 0, chars: unit.chars })), skills };
}
/** Continue exactly the selection bound to a compatible opaque cursor. */
export async function continueSkillContextPage(args: Omit<SkillContextPageInput, "cursor"> & { cursor: string }): Promise<SkillContextPage> { return planSkillContextPage(args); }
/** Legacy name retained for hosts that still use the original one-page API. */
export async function planCodexSkillContexts(args: { skills: Array<{ skill: SkillEntry; required?: boolean; obligation?: SkillContextObligation; routeIndex: number; routeScore: number }>; intent: StructuredSkillIntent; stage: SkillStage; mode: SkillContextMode; references: SkillReferenceMode; maxContextChars: number; cursor?: string }): Promise<GlobalSkillContextPlan> { return planSkillContextPage({ ...args, skills: args.skills.map((item) => ({ ...item, obligation: item.obligation ?? (item.required === false ? "accepted" : "required") })) }); }
export async function assembleCodexSkillContext(args: { skill: SkillEntry; intent: StructuredSkillIntent; stage: SkillStage; mode: SkillContextMode; references: SkillReferenceMode; remainingChars: number }): Promise<SkillContextAssembly> {
  const plan = await planSkillContextPage({ skills: [{ skill: args.skill, obligation: "required", routeIndex: 0, routeScore: 0 }], intent: args.intent, stage: args.stage, mode: args.mode, references: args.references, maxContextChars: Math.max(0, Math.floor(args.remainingChars)) });
  const item = plan.skills[0];
  if (!item || !item.loaded || plan.mustContinue) throw new Error(`Required skill context cannot be delivered in one page: ${args.skill.name}`);
  return item;
}
export const planSkillContexts = planCodexSkillContexts;
export const assembleSkillContext = assembleCodexSkillContext;
