import fs from "node:fs";
import path from "node:path";
import { readPersistentCache, writePersistentCache } from "./persistent-cache.js";
import { resolveToolPath } from "./path.js";
import { collectProjectTextFiles } from "./project-scan.js";
import { analyzeTypeScriptSource, findTypeScriptIdentifierReferences } from "./typescript-intelligence.js";
const importGraphStore = new Map();
const IMPORT_GRAPH_STORE_MAX = 8;
function fileStamp(filePath) {
    try {
        const stat = fs.statSync(filePath);
        return `${path.resolve(filePath)}:${stat.size}:${Math.trunc(stat.mtimeMs)}`;
    }
    catch {
        return `${path.resolve(filePath)}:missing`;
    }
}
function rememberImportGraph(key, graph) {
    if (!importGraphStore.has(key) && importGraphStore.size >= IMPORT_GRAPH_STORE_MAX) {
        const oldest = importGraphStore.keys().next().value;
        if (oldest)
            importGraphStore.delete(oldest);
    }
    importGraphStore.set(key, graph);
}
function importGraphStoreKey(root, scan, options) {
    const tsconfigStamp = fileStamp(path.join(root, "tsconfig.json"));
    const stamps = scan.files.map((file) => fileStamp(file.path));
    return [root, tsconfigStamp, options.filePattern ?? "*.ts", String(options.includeTests === true), String(options.includeExternal === true), String(options.maxFiles ?? 500), String(options.maxCycles ?? 20), options.resolutionEngine ?? "auto", ...stamps].join("|");
}
function normalizeRel(filePath) {
    return filePath.replace(/\\/g, "/");
}
function normalizeAbs(filePath) {
    return path.resolve(filePath).toLowerCase();
}
function isInsideRoot(root, filePath) {
    const rel = path.relative(root, filePath);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}
function stripKnownExt(specifier) {
    return specifier.replace(/\.(js|jsx|mjs|cjs|ts|tsx)$/i, "");
}
function candidateRelativePaths(fromFile, moduleSpecifier) {
    const baseDir = path.dirname(fromFile);
    const raw = normalizeRel(path.normalize(path.join(baseDir, stripKnownExt(moduleSpecifier))));
    return [raw, `${raw}.ts`, `${raw}.tsx`, `${raw}.js`, `${raw}.jsx`, `${raw}/index.ts`, `${raw}/index.tsx`, `${raw}/index.js`, `${raw}/index.jsx`];
}
function resolveInternalImport(fromFile, moduleSpecifier, knownFiles) {
    if (!moduleSpecifier.startsWith("."))
        return null;
    for (const candidate of candidateRelativePaths(fromFile, moduleSpecifier)) {
        if (knownFiles.has(candidate))
            return candidate;
    }
    return null;
}
async function loadTypeScript() {
    try {
        return await import("typescript");
    }
    catch {
        return null;
    }
}
async function createTypeScriptResolver(root, enabled) {
    if (!enabled)
        return { available: false, root, reason: "typescript resolver disabled" };
    const ts = await loadTypeScript();
    if (!ts)
        return { available: false, root, reason: "typescript package is not available at runtime" };
    const tsconfigPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
    let compilerOptions = {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        allowJs: true,
    };
    if (tsconfigPath) {
        const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
        if (!configFile.error) {
            const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(tsconfigPath));
            compilerOptions = parsed.options;
        }
    }
    return {
        available: true,
        root,
        ts,
        compilerOptions,
        host: ts.sys,
        cache: ts.createModuleResolutionCache(root, (fileName) => fileName.toLowerCase(), compilerOptions),
        tsconfigPath,
    };
}
function resolveWithTypeScript(resolver, fromAbs, moduleSpecifier, knownFilesByAbs) {
    if (!resolver.available || !resolver.ts || !resolver.compilerOptions || !resolver.host)
        return null;
    const resolved = resolver.ts.resolveModuleName(moduleSpecifier, fromAbs, resolver.compilerOptions, resolver.host, resolver.cache).resolvedModule;
    if (!resolved)
        return null;
    const resolvedAbs = path.resolve(resolved.resolvedFileName);
    const knownRel = knownFilesByAbs.get(normalizeAbs(resolvedAbs));
    const inRoot = isInsideRoot(resolver.root, resolvedAbs);
    const external = resolved.isExternalLibraryImport === true || !inRoot || resolvedAbs.toLowerCase().includes(`${path.sep}node_modules${path.sep}`);
    if (knownRel) {
        return { to: knownRel, external: false, resolved: true, resolvedFile: normalizeRel(path.relative(resolver.root, resolvedAbs)) };
    }
    if (inRoot && !external && !resolvedAbs.endsWith(".d.ts")) {
        return { to: normalizeRel(path.relative(resolver.root, resolvedAbs)), external: false, resolved: true, resolvedFile: normalizeRel(path.relative(resolver.root, resolvedAbs)) };
    }
    return { to: moduleSpecifier, external: true, resolved: true, resolvedFile: normalizeRel(resolved.resolvedFileName) };
}
function findCycles(nodes, edges, maxCycles) {
    if (maxCycles <= 0)
        return [];
    const graph = new Map();
    for (const node of nodes)
        graph.set(node, []);
    for (const edge of edges)
        if (!edge.external && edge.resolved)
            graph.get(edge.from)?.push(edge.to);
    const cycles = [];
    const seen = new Set();
    const completed = new Set();
    const stack = [];
    const visiting = new Set();
    function canonical(cycle) {
        const body = cycle.slice(0, -1);
        const rotations = body.map((_, index) => [...body.slice(index), ...body.slice(0, index)].join(" -> "));
        return rotations.sort()[0] ?? cycle.join(" -> ");
    }
    function dfs(node) {
        if (cycles.length >= maxCycles)
            return;
        if (completed.has(node) || visiting.has(node))
            return;
        visiting.add(node);
        stack.push(node);
        for (const next of graph.get(node) ?? []) {
            if (cycles.length >= maxCycles)
                break;
            if (next === node)
                continue;
            if (!visiting.has(next))
                dfs(next);
            else {
                const start = stack.indexOf(next);
                if (start >= 0) {
                    const cycle = [...stack.slice(start), next];
                    const key = canonical(cycle);
                    if (!seen.has(key)) {
                        seen.add(key);
                        cycles.push(cycle);
                    }
                }
            }
        }
        completed.add(node);
        stack.pop();
        visiting.delete(node);
    }
    for (const node of nodes) {
        if (cycles.length >= maxCycles)
            break;
        if (!completed.has(node))
            dfs(node);
    }
    return cycles;
}
async function analyzeFile(file) {
    const analysis = await analyzeTypeScriptSource(file.path, file.text);
    if (!analysis.available)
        return { imports: [], symbols: [] };
    return { imports: analysis.imports, symbols: analysis.symbols };
}
export async function buildImportGraph(options) {
    const root = resolveToolPath(options.root, { access: "read" });
    const resolutionEngine = options.resolutionEngine ?? "auto";
    const scan = await collectProjectTextFiles({ root, filePattern: options.filePattern ?? "*.ts", includeTests: options.includeTests === true, maxFiles: options.maxFiles ?? 500 });
    const storeKey = importGraphStoreKey(root, scan, options);
    const stored = importGraphStore.get(storeKey);
    if (stored)
        return { ...stored, memo: { hit: true, key: storeKey } };
    const persisted = readPersistentCache("import-graph", storeKey);
    if (persisted.value) {
        const result = { ...persisted.value, memo: { hit: true, key: storeKey, persistent: persisted.meta } };
        rememberImportGraph(storeKey, result);
        return result;
    }
    const knownFiles = new Set(scan.files.map((file) => normalizeRel(file.relativePath)));
    const knownFilesByAbs = new Map(scan.files.map((file) => [normalizeAbs(file.path), normalizeRel(file.relativePath)]));
    const tsResolver = await createTypeScriptResolver(root, resolutionEngine !== "relative");
    const nodeStats = new Map();
    const edges = [];
    for (const file of scan.files) {
        const rel = normalizeRel(file.relativePath);
        const analyzed = await analyzeFile(file);
        nodeStats.set(rel, { imports: 0, importedBy: 0, symbols: analyzed.symbols.length, exportedSymbols: analyzed.symbols.filter((symbol) => symbol.exported).length });
        for (const imported of analyzed.imports) {
            const tsResolved = resolutionEngine !== "relative" ? resolveWithTypeScript(tsResolver, file.path, imported.module, knownFilesByAbs) : null;
            const relativeTarget = tsResolved ? null : resolveInternalImport(rel, imported.module, knownFiles);
            const external = tsResolved ? tsResolved.external : !imported.module.startsWith(".");
            if (external && options.includeExternal !== true)
                continue;
            const edge = {
                from: rel,
                to: tsResolved?.to ?? relativeTarget ?? imported.module,
                module: imported.module,
                line: imported.line,
                typeOnly: imported.typeOnly,
                external,
                resolved: tsResolved?.resolved ?? (relativeTarget !== null || external),
                resolutionEngine: tsResolved ? "typescript" : relativeTarget ? "relative" : "unresolved",
                resolvedFile: tsResolved?.resolvedFile,
            };
            edges.push(edge);
            const current = nodeStats.get(rel);
            if (current)
                current.imports += 1;
            if (!edge.external && edge.resolved) {
                const targetStats = nodeStats.get(edge.to) ?? { imports: 0, importedBy: 0, symbols: 0, exportedSymbols: 0 };
                targetStats.importedBy += 1;
                nodeStats.set(edge.to, targetStats);
            }
        }
    }
    const nodes = Array.from(nodeStats.entries()).map(([file, stats]) => ({ file, ...stats })).sort((a, b) => a.file.localeCompare(b.file));
    const internalEdges = edges.filter((edge) => !edge.external && edge.resolved);
    const unresolved = edges.filter((edge) => !edge.external && !edge.resolved);
    const externalImports = edges.filter((edge) => edge.external);
    const result = {
        root: scan.root,
        resolutionEngine,
        resolver: { available: tsResolver.available, reason: tsResolver.reason, tsconfigPath: tsResolver.tsconfigPath },
        scannedFiles: scan.files.length,
        truncated: scan.truncated,
        skipped: scan.skipped,
        nodes,
        edges,
        unresolved,
        externalImports,
        internalEdges,
        cycles: findCycles(nodes.map((node) => node.file), internalEdges, options.maxCycles ?? 20),
        mostImported: nodes.filter((node) => node.importedBy > 0).sort((a, b) => b.importedBy - a.importedBy).slice(0, 20).map(({ file, importedBy }) => ({ file, importedBy })),
        mostImporting: nodes.filter((node) => node.imports > 0).sort((a, b) => b.imports - a.imports).slice(0, 20).map(({ file, imports }) => ({ file, imports })),
        orphanFiles: nodes.filter((node) => node.importedBy === 0 && node.imports === 0).map((node) => node.file).slice(0, 100),
        memo: { hit: false, key: storeKey },
    };
    result.memo = { hit: false, key: storeKey };
    const persistedWrite = writePersistentCache("import-graph", storeKey, result);
    result.memo = { hit: false, key: storeKey, persistent: persistedWrite };
    rememberImportGraph(storeKey, result);
    return result;
}
export async function findDeadCodeCandidates(options) {
    const scan = await collectProjectTextFiles({ root: options.root, filePattern: options.filePattern ?? "*.ts", includeTests: options.includeTests === true, maxFiles: options.maxFiles ?? 500 });
    const candidates = [];
    const maxCandidates = Math.max(1, Math.min(500, Math.trunc(options.maxCandidates ?? 100)));
    for (const file of scan.files) {
        if (candidates.length >= maxCandidates)
            break;
        const analyzed = await analyzeFile(file);
        for (const symbol of analyzed.symbols) {
            if (candidates.length >= maxCandidates)
                break;
            if (symbol.kind === "method")
                continue;
            if (symbol.exported && options.includeExported !== true)
                continue;
            const refs = await findTypeScriptIdentifierReferences(file.path, file.text, symbol.name);
            const nonDefinitionRefs = refs.references.filter((ref) => ref.kind !== "definition" && ref.kind !== "export");
            if (nonDefinitionRefs.length === 0) {
                candidates.push({ file: normalizeRel(file.relativePath), name: symbol.name, kind: symbol.kind, line: symbol.line, exported: symbol.exported, references: nonDefinitionRefs.length, confidence: symbol.exported ? "low" : "medium", reason: symbol.exported ? "Exported symbol has no references inside its defining file; external usage is unknown." : "Local symbol has no AST references outside its definition in the same file.", text: symbol.text });
            }
        }
    }
    return { root: scan.root, scannedFiles: scan.files.length, candidates, skipped: scan.skipped, truncated: scan.truncated };
}
