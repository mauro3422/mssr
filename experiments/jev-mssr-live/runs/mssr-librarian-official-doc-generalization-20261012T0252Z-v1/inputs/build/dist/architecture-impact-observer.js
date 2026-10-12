import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadArchitectureImpactManifest, observeArchitectureImpactManifest, resolveArchitectureImpactProjectPath, } from "@mauroprime/mssr";
const defaultFsDependencies = {
    readFile: (filePath) => fs.readFile(filePath),
    stat: (filePath) => fs.stat(filePath),
    realpath: (filePath) => fs.realpath(filePath),
};
function normalizeForCompare(value) {
    const resolved = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
function isWithin(root, target) {
    const relative = path.relative(normalizeForCompare(root), normalizeForCompare(target));
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
function errnoCode(error) {
    if (!error || typeof error !== "object" || !("code" in error))
        return null;
    const raw = String(error.code ?? "").trim().toLowerCase();
    if (!raw)
        return null;
    const safe = raw.replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
    return safe || null;
}
function unavailableReason(error) {
    const code = errnoCode(error);
    return code ? `fs-${code}`.slice(0, 80) : "inspect-failed";
}
async function canonicalizePotentialPath(target, dependencies) {
    let current = path.resolve(target);
    const suffix = [];
    while (true) {
        try {
            const realBase = await dependencies.realpath(current);
            return path.resolve(realBase, ...suffix);
        }
        catch (error) {
            if (errnoCode(error) !== "enoent")
                throw error;
            const parent = path.dirname(current);
            if (parent === current)
                return path.resolve(target);
            suffix.unshift(path.basename(current));
            current = parent;
        }
    }
}
async function observeFile(projectRoot, canonicalProjectRoot, ref, dependencies) {
    const candidate = resolveArchitectureImpactProjectPath(projectRoot, ref);
    let canonical;
    try {
        canonical = await canonicalizePotentialPath(candidate, dependencies);
    }
    catch (error) {
        if (errnoCode(error) === "enoent")
            return { ref, availability: "missing" };
        return { ref, availability: "unavailable", reasonCode: unavailableReason(error) };
    }
    if (!isWithin(canonicalProjectRoot, canonical)) {
        return { ref, availability: "unavailable", reasonCode: "path-outside-project" };
    }
    try {
        const stat = await dependencies.stat(canonical);
        if (!stat.isFile())
            return { ref, availability: "unavailable", reasonCode: "not-a-file" };
        const bytes = await dependencies.readFile(canonical);
        return {
            ref,
            availability: "available",
            revision: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
        };
    }
    catch (error) {
        const code = errnoCode(error);
        if (code === "enoent" || code === "enotdir")
            return { ref, availability: "missing" };
        return { ref, availability: "unavailable", reasonCode: unavailableReason(error) };
    }
}
export function createBridgeArchitectureImpactFilesystemObserver(projectRootInput, dependencyOverrides = {}) {
    const projectRoot = path.resolve(projectRootInput);
    const dependencies = { ...defaultFsDependencies, ...dependencyOverrides };
    const canonicalProjectRootPromise = dependencies.realpath(projectRoot);
    return async (plan) => {
        const canonicalProjectRoot = await canonicalProjectRootPromise;
        const authority = await observeFile(projectRoot, canonicalProjectRoot, plan.authorityRef, dependencies);
        const impacts = [];
        for (const ref of plan.impactRefs) {
            impacts.push(await observeFile(projectRoot, canonicalProjectRoot, ref, dependencies));
        }
        return {
            schemaVersion: 1,
            architectureId: plan.architectureId,
            authority,
            impacts,
        };
    };
}
/**
 * Bridge host boundary for MSSR C2f-B. It loads the reviewed declaration,
 * observes current exact-file SHA-256/availability metadata, and delegates all
 * manifest/evidence normalization back to portable MSSR. It does not compare a
 * baseline, classify possible impact, emit notices, schedule work, or persist
 * observation history; those remain later C2f gates/host concerns.
 */
export async function observeBridgeArchitectureImpactProject(options) {
    const projectRoot = path.resolve(options.projectRoot);
    const loaded = await loadArchitectureImpactManifest(projectRoot, options.manifestPath);
    if (!loaded.found) {
        return { found: false, manifestPath: loaded.path, evidence: [] };
    }
    const evidence = await observeArchitectureImpactManifest(loaded.manifest, createBridgeArchitectureImpactFilesystemObserver(projectRoot, options.dependencies));
    return {
        found: true,
        manifestPath: loaded.path,
        projectContextPath: loaded.projectContextPath,
        evidence,
    };
}
