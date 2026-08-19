import crypto from "node:crypto";
import {
  MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION,
  architectureSymbolAnalysisPlanSchema,
  architectureSymbolHostEvidenceSchema,
  type ArchitectureSymbolAnalysisPlan,
  type ArchitectureSymbolAnalysisResult,
  type ArchitectureSymbolHostEvidence,
} from "./architecture-symbol-analysis.js";

export const MSSR_TYPESCRIPT_SYMBOL_ANALYZER_ID_BASE = "mssr-typescript-reference-v1" as const;
export const MSSR_TYPESCRIPT_SYMBOL_FINGERPRINT_SCHEME_BASE = "mssr-ts-symbol-v1" as const;
export const MAX_ARCHITECTURE_TYPESCRIPT_SOURCE_CHARS = 2_000_000;

export type ArchitectureTypeScriptCompilerLoader = () => Promise<unknown>;

export interface AnalyzeArchitectureTypeScriptSourceInput {
  plan: ArchitectureSymbolAnalysisPlan;
  sourceText: string;
  sourceRevision: string;
  compilerLoader?: ArchitectureTypeScriptCompilerLoader;
}

type Ts = typeof import("typescript");
type TsNode = import("typescript").Node;
type TsSourceFile = import("typescript").SourceFile;
type TsDeclaration = import("typescript").Declaration;
type TsNamedDeclaration = import("typescript").NamedDeclaration;
type TsClassElement = import("typescript").ClassElement;

type SymbolCategory =
  | "function"
  | "method"
  | "getter"
  | "setter"
  | "class"
  | "interface"
  | "type-alias"
  | "enum"
  | "variable"
  | "property";

interface SymbolCandidate {
  name: string;
  category: SymbolCategory;
  node: TsDeclaration;
  body?: TsNode;
  initializer?: TsNode;
  owner?: TsNode;
}

interface TextRange {
  start: number;
  end: number;
  marker: string;
}

async function defaultTypeScriptCompilerLoader(): Promise<unknown> {
  return import("typescript");
}

function unwrapTypeScriptModule(value: unknown): Ts | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const candidate = raw.default && typeof raw.default === "object"
    ? raw.default as Record<string, unknown>
    : raw;
  if (
    typeof candidate.createSourceFile !== "function"
    || typeof candidate.createScanner !== "function"
    || typeof candidate.transpileModule !== "function"
    || typeof candidate.version !== "string"
    || typeof candidate.ScriptTarget !== "object"
    || typeof candidate.ScriptKind !== "object"
    || typeof candidate.SyntaxKind !== "object"
    || typeof candidate.NodeFlags !== "object"
    || typeof candidate.DiagnosticCategory !== "object"
    || typeof candidate.JsxEmit !== "object"
  ) {
    return null;
  }
  return candidate as unknown as Ts;
}

function compilerVersion(version: string): string {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(version.trim());
  if (!match) return "unknown";
  return match[3] ? `${match[1]}.${match[2]}.${match[3]}` : `${match[1]}.${match[2]}`;
}

function analyzerIdentity(ts: Ts): { analyzerId: string; fingerprintScheme: string } {
  const version = compilerVersion(ts.version);
  return {
    analyzerId: `${MSSR_TYPESCRIPT_SYMBOL_ANALYZER_ID_BASE}:ts${version}`,
    fingerprintScheme: `${MSSR_TYPESCRIPT_SYMBOL_FINGERPRINT_SCHEME_BASE}:ts${version}`,
  };
}

function planScriptKind(ts: Ts, plan: ArchitectureSymbolAnalysisPlan): import("typescript").ScriptKind {
  const lower = plan.ref.toLowerCase();
  if (plan.selectors[0].language === "javascript") {
    return lower.endsWith(".jsx") ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  }
  return lower.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function candidateName(ts: Ts, name: import("typescript").DeclarationName | undefined, sourceFile: TsSourceFile): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) {
    const expression = name.expression;
    if (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression)) return expression.text;
  }
  const text = name.getText(sourceFile).trim();
  return text && !/[\r\n]/.test(text) ? text : null;
}

function pushCandidate(map: Map<string, SymbolCandidate[]>, candidate: SymbolCandidate): void {
  const current = map.get(candidate.name) ?? [];
  current.push(candidate);
  map.set(candidate.name, current);
}

function collectMemberCandidates(
  ts: Ts,
  sourceFile: TsSourceFile,
  ownerName: string,
  members: readonly import("typescript").TypeElement[] | readonly TsClassElement[],
  map: Map<string, SymbolCandidate[]>,
): void {
  for (const member of members) {
    const memberName = candidateName(ts, (member as TsNamedDeclaration).name, sourceFile);
    if (!memberName) continue;
    const qualifiedName = `${ownerName}.${memberName}`;
    if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      pushCandidate(map, { name: qualifiedName, category: "method", node: member, body: ts.isMethodDeclaration(member) ? member.body : undefined, owner: member.parent });
    } else if (ts.isGetAccessorDeclaration(member)) {
      pushCandidate(map, { name: qualifiedName, category: "getter", node: member, body: member.body, owner: member.parent });
    } else if (ts.isSetAccessorDeclaration(member)) {
      pushCandidate(map, { name: qualifiedName, category: "setter", node: member, body: member.body, owner: member.parent });
    } else if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      pushCandidate(map, {
        name: qualifiedName,
        category: "property",
        node: member,
        initializer: ts.isPropertyDeclaration(member) ? member.initializer : undefined,
        owner: member.parent,
      });
    }
  }
}

function collectTopLevelCandidates(ts: Ts, sourceFile: TsSourceFile): Map<string, SymbolCandidate[]> {
  const map = new Map<string, SymbolCandidate[]>();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      pushCandidate(map, { name: statement.name.text, category: "function", node: statement, body: statement.body });
      continue;
    }
    if (ts.isClassDeclaration(statement) && statement.name) {
      pushCandidate(map, { name: statement.name.text, category: "class", node: statement });
      collectMemberCandidates(ts, sourceFile, statement.name.text, statement.members, map);
      continue;
    }
    if (ts.isInterfaceDeclaration(statement)) {
      pushCandidate(map, { name: statement.name.text, category: "interface", node: statement });
      collectMemberCandidates(ts, sourceFile, statement.name.text, statement.members, map);
      continue;
    }
    if (ts.isTypeAliasDeclaration(statement)) {
      pushCandidate(map, { name: statement.name.text, category: "type-alias", node: statement });
      continue;
    }
    if (ts.isEnumDeclaration(statement)) {
      pushCandidate(map, { name: statement.name.text, category: "enum", node: statement });
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        pushCandidate(map, {
          name: declaration.name.text,
          category: "variable",
          node: declaration,
          initializer: declaration.initializer,
          owner: statement,
        });
      }
    }
  }
  return map;
}

function nodeStart(node: TsNode, sourceFile: TsSourceFile): number {
  return node.getStart(sourceFile, false);
}

function nodeRange(node: TsNode, sourceFile: TsSourceFile, marker: string): TextRange {
  return { start: nodeStart(node, sourceFile), end: node.end, marker };
}

function headerRange(node: TsNode, body: TsNode | undefined, sourceFile: TsSourceFile, marker: string): TextRange {
  const start = nodeStart(node, sourceFile);
  const end = body ? nodeStart(body, sourceFile) : node.end;
  return { start, end, marker };
}

function rangeBeforeNode(node: TsNode, excluded: TsNode, sourceFile: TsSourceFile, marker: string): TextRange {
  return { start: nodeStart(node, sourceFile), end: nodeStart(excluded, sourceFile), marker };
}

function topLevelHeaderRange(ts: Ts, candidate: SymbolCandidate, sourceFile: TsSourceFile, marker: string): TextRange | null {
  const node = candidate.node;
  if (candidate.category === "function" || candidate.category === "method" || candidate.category === "getter" || candidate.category === "setter") {
    return headerRange(node, candidate.body, sourceFile, marker);
  }
  if (candidate.category === "class") {
    const declaration = node as import("typescript").ClassDeclaration;
    const first = declaration.members[0];
    if (first) return { start: nodeStart(node, sourceFile), end: nodeStart(first, sourceFile), marker };
    return nodeRange(node, sourceFile, marker);
  }
  if (candidate.category === "interface") {
    const declaration = node as import("typescript").InterfaceDeclaration;
    const first = declaration.members[0];
    if (first) return { start: nodeStart(node, sourceFile), end: nodeStart(first, sourceFile), marker };
    return nodeRange(node, sourceFile, marker);
  }
  if (candidate.category === "enum") {
    const declaration = node as import("typescript").EnumDeclaration;
    const first = declaration.members[0];
    if (first) return { start: nodeStart(node, sourceFile), end: nodeStart(first, sourceFile), marker };
    return nodeRange(node, sourceFile, marker);
  }
  if (candidate.category === "type-alias") {
    const declaration = node as import("typescript").TypeAliasDeclaration;
    return rangeBeforeNode(node, declaration.type, sourceFile, marker);
  }
  if (candidate.category === "variable") {
    const declaration = node as import("typescript").VariableDeclaration;
    const statement = candidate.owner && ts.isVariableStatement(candidate.owner) ? candidate.owner : null;
    const flags = statement?.declarationList.flags ?? 0;
    const storage = (flags & ts.NodeFlags.Const) !== 0 ? "const" : (flags & ts.NodeFlags.Let) !== 0 ? "let" : "var";
    const modifiers = statement?.modifiers?.map((modifier) => ts.SyntaxKind[modifier.kind]).join(",") ?? "";
    const endNode = declaration.type ?? declaration.exclamationToken ?? declaration.name;
    return { start: nodeStart(node, sourceFile), end: endNode.end, marker: `${marker}:storage=${storage}:modifiers=${modifiers}` };
  }
  if (candidate.category === "property") {
    const declaration = node as import("typescript").PropertyDeclaration | import("typescript").PropertySignature;
    const endNode = declaration.type ?? ("questionToken" in declaration ? declaration.questionToken : undefined) ?? declaration.name;
    return { start: nodeStart(node, sourceFile), end: endNode.end, marker };
  }
  return null;
}

function classShapeRanges(
  ts: Ts,
  candidate: SymbolCandidate,
  sourceFile: TsSourceFile,
): TextRange[] {
  const declaration = candidate.node as import("typescript").ClassDeclaration;
  const ranges: TextRange[] = [];
  const first = declaration.members[0];
  ranges.push(first
    ? { start: nodeStart(declaration, sourceFile), end: nodeStart(first, sourceFile), marker: "class-header" }
    : nodeRange(declaration, sourceFile, "class-empty"));
  for (let index = 0; index < declaration.members.length; index += 1) {
    const member = declaration.members[index];
    if (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member) || ts.isConstructorDeclaration(member)) {
      ranges.push(headerRange(member, member.body, sourceFile, `member-${index}`));
      continue;
    }
    if (ts.isPropertyDeclaration(member)) {
      const endNode = member.type ?? member.questionToken ?? member.exclamationToken ?? member.name;
      ranges.push({ start: nodeStart(member, sourceFile), end: endNode.end, marker: `member-${index}` });
      continue;
    }
    ranges.push(nodeRange(member, sourceFile, `member-${index}`));
  }
  return ranges;
}

function rangesForAspect(
  ts: Ts,
  candidates: SymbolCandidate[],
  aspect: "signature" | "body" | "shape",
  sourceFile: TsSourceFile,
): { ranges: TextRange[]; locationNodes: TsNode[] } | { unavailable: string } {
  const categories = new Set(candidates.map((candidate) => candidate.category));
  if (categories.size !== 1) return { unavailable: "ambiguous-symbol" };
  const category = candidates[0].category;
  const callable = category === "function" || category === "method" || category === "getter" || category === "setter";

  if (!callable && candidates.length !== 1) return { unavailable: "ambiguous-symbol" };

  if (aspect === "signature") {
    const ranges = candidates
      .map((candidate, index) => topLevelHeaderRange(ts, candidate, sourceFile, `signature-${index}`))
      .filter((range): range is TextRange => range !== null);
    return ranges.length > 0
      ? { ranges, locationNodes: candidates.map((candidate) => candidate.node) }
      : { unavailable: "unsupported-symbol-kind" };
  }

  if (aspect === "body") {
    if (callable) {
      const withBody = candidates.filter((candidate) => candidate.body);
      if (withBody.length !== 1) return { unavailable: withBody.length === 0 ? "symbol-body-unavailable" : "ambiguous-symbol-body" };
      return { ranges: [nodeRange(withBody[0].body!, sourceFile, "body")], locationNodes: [withBody[0].body!] };
    }
    if (category === "variable" || category === "property") {
      const candidate = candidates[0];
      if (!candidate.initializer) return { unavailable: "symbol-body-unavailable" };
      return { ranges: [nodeRange(candidate.initializer, sourceFile, "initializer")], locationNodes: [candidate.initializer] };
    }
    return { unavailable: "unsupported-aspect" };
  }

  if (category === "class") {
    return { ranges: classShapeRanges(ts, candidates[0], sourceFile), locationNodes: [candidates[0].node] };
  }
  if (category === "interface" || category === "type-alias" || category === "enum") {
    return { ranges: [nodeRange(candidates[0].node, sourceFile, `shape-${category}`)], locationNodes: [candidates[0].node] };
  }
  return { unavailable: "unsupported-aspect" };
}

function canonicalTokenStream(
  ts: Ts,
  text: string,
  scriptKind: import("typescript").ScriptKind,
): string {
  const languageVariant = scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX
    ? ts.LanguageVariant.JSX
    : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, languageVariant, text);
  const parts: string[] = [];
  while (true) {
    const token = scanner.scan();
    if (token === ts.SyntaxKind.EndOfFileToken) break;
    const tokenText = scanner.getTokenText();
    parts.push(`${tokenText.length}:${tokenText}`);
  }
  return parts.join("|");
}

function fingerprintRanges(
  ts: Ts,
  sourceText: string,
  ranges: TextRange[],
  scriptKind: import("typescript").ScriptKind,
  fingerprintScheme: string,
  category: SymbolCategory,
  aspect: string,
): string {
  const canonical = [
    fingerprintScheme,
    category,
    aspect,
    ...ranges.map((range) => `${range.marker.length}:${range.marker}=${canonicalTokenStream(ts, sourceText.slice(range.start, range.end), scriptKind)}`),
  ].map((part) => `${part.length}:${part}`).join("|");
  return `sha256:${crypto.createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

function sourceLocation(sourceFile: TsSourceFile, nodes: TsNode[]): { startLine: number; endLine: number } {
  const start = Math.min(...nodes.map((node) => nodeStart(node, sourceFile)));
  const end = Math.max(...nodes.map((node) => node.end));
  return {
    startLine: sourceFile.getLineAndCharacterOfPosition(start).line + 1,
    endLine: sourceFile.getLineAndCharacterOfPosition(Math.max(start, end - 1)).line + 1,
  };
}

function unavailableResults(plan: ArchitectureSymbolAnalysisPlan, reasonCode: string): ArchitectureSymbolAnalysisResult[] {
  return plan.selectors.map((selector) => ({ selector, availability: "unavailable" as const, reasonCode }));
}

function hostEvidence(
  plan: ArchitectureSymbolAnalysisPlan,
  sourceRevision: string,
  analyzerId: string,
  fingerprintScheme: string,
  results: ArchitectureSymbolAnalysisResult[],
): ArchitectureSymbolHostEvidence {
  return architectureSymbolHostEvidenceSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION,
    architectureId: plan.architectureId,
    ref: plan.ref,
    sourceRevision,
    analyzerId,
    fingerprintScheme,
    results,
  });
}

/**
 * Reference TypeScript/JavaScript analyzer for the C2f-C.5-C1 callback boundary.
 * The host still owns source reads and sourceRevision. TypeScript is loaded only
 * when this function runs; importing MSSR core does not require the compiler.
 */
export async function analyzeArchitectureTypeScriptSource(
  input: AnalyzeArchitectureTypeScriptSourceInput,
): Promise<ArchitectureSymbolHostEvidence> {
  const plan = architectureSymbolAnalysisPlanSchema.parse(input.plan);
  if (typeof input.sourceText !== "string") throw new Error("Architecture TypeScript analyzer sourceText must be a string.");

  let loaded: unknown;
  try {
    loaded = await (input.compilerLoader ?? defaultTypeScriptCompilerLoader)();
  } catch {
    return hostEvidence(
      plan,
      input.sourceRevision,
      `${MSSR_TYPESCRIPT_SYMBOL_ANALYZER_ID_BASE}:unavailable`,
      `${MSSR_TYPESCRIPT_SYMBOL_FINGERPRINT_SCHEME_BASE}:unavailable`,
      unavailableResults(plan, "typescript-parser-unavailable"),
    );
  }

  const ts = unwrapTypeScriptModule(loaded);
  if (!ts) {
    return hostEvidence(
      plan,
      input.sourceRevision,
      `${MSSR_TYPESCRIPT_SYMBOL_ANALYZER_ID_BASE}:invalid`,
      `${MSSR_TYPESCRIPT_SYMBOL_FINGERPRINT_SCHEME_BASE}:unavailable`,
      unavailableResults(plan, "typescript-parser-invalid"),
    );
  }

  const identity = analyzerIdentity(ts);
  if (input.sourceText.length > MAX_ARCHITECTURE_TYPESCRIPT_SOURCE_CHARS) {
    return hostEvidence(plan, input.sourceRevision, identity.analyzerId, identity.fingerprintScheme, unavailableResults(plan, "source-too-large"));
  }

  const scriptKind = planScriptKind(ts, plan);
  let sourceFile: TsSourceFile;
  try {
    const syntaxCheck = ts.transpileModule(input.sourceText, {
      compilerOptions: {
        target: ts.ScriptTarget.Latest,
        jsx: ts.JsxEmit.Preserve,
        allowJs: true,
      },
      fileName: plan.ref,
      reportDiagnostics: true,
    });
    if ((syntaxCheck.diagnostics ?? []).some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)) {
      return hostEvidence(plan, input.sourceRevision, identity.analyzerId, identity.fingerprintScheme, unavailableResults(plan, "typescript-parse-error"));
    }
    sourceFile = ts.createSourceFile(plan.ref, input.sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  } catch {
    return hostEvidence(plan, input.sourceRevision, identity.analyzerId, identity.fingerprintScheme, unavailableResults(plan, "typescript-parser-failed"));
  }

  const candidates = collectTopLevelCandidates(ts, sourceFile);
  const results: ArchitectureSymbolAnalysisResult[] = plan.selectors.map((selector) => {
    const matches = candidates.get(selector.name) ?? [];
    if (matches.length === 0) return { selector, availability: "missing" as const };
    const selected = rangesForAspect(ts, matches, selector.aspect, sourceFile);
    if ("unavailable" in selected) {
      return { selector, availability: "unavailable" as const, reasonCode: selected.unavailable };
    }
    const category = matches[0].category;
    return {
      selector,
      availability: "observed" as const,
      structuralFingerprint: fingerprintRanges(
        ts,
        input.sourceText,
        selected.ranges,
        scriptKind,
        identity.fingerprintScheme,
        category,
        selector.aspect,
      ),
      location: sourceLocation(sourceFile, selected.locationNodes),
    };
  });

  return hostEvidence(plan, input.sourceRevision, identity.analyzerId, identity.fingerprintScheme, results);
}
