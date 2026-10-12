import { buildMssrEvidenceAtom, buildMssrMarkdownDocumentSurface, catalogMssrLibrarianRecord, evidenceAtomFromLibrarianCatalogRecord, MSSR_LIBRARIAN_RETRIEVAL_LIMITS, } from "@mauroprime/mssr";
export const MSSR_PROJECT_CONTEXT_LIBRARIAN_METADATA_MODE = "project-context-single-section";
const selectorProjectionFields = [
    ["domains", "domain"],
    ["actions", "action"],
    ["artifacts", "artifact"],
    ["needs", "need"],
    ["signals", "signal"],
];
function sourceRefKey(value) {
    const normalized = value.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
function declaredHeadingLine(markdown, declared) {
    const target = declared.trim();
    if (!target)
        return null;
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const matches = [];
    for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].trim() === target)
            matches.push(index + 1);
    }
    if (matches.length !== 1 || !/^#{1,6}\s+\S/.test(lines[matches[0] - 1].trim()))
        return null;
    return matches[0];
}
function selectorValues(module) {
    const values = [];
    for (const [sourceField, projectionField] of selectorProjectionFields) {
        for (const value of module[sourceField])
            values.push({ field: projectionField, value });
    }
    const seen = new Set();
    return values.filter(({ field, value }) => {
        const key = `${field}\u0000${value}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function atomWithMetadataDedupeKey(args) {
    const base = evidenceAtomFromLibrarianCatalogRecord({
        record: args.record,
        sourceClass: "canonical",
        canonicalOwner: args.canonicalOwner,
        // The owner-declared selector is canonical metadata; its application to a
        // source range is still a derived classification, never truth authority.
        authorityClass: "inferred",
        privacyClass: "project-metadata",
        freshness: "fresh",
        freshnessEvidence: {
            canonicalOwner: args.canonicalOwner,
            ref: args.sourceRef,
            revision: args.revision,
            observedAt: args.observedAt,
        },
        headingPath: args.range.headingPath,
        range: {
            startLine: args.range.startLine,
            endLine: args.range.endLine,
            startOffset: args.range.startOffset,
            endOffset: args.range.endOffset,
        },
        reasonCodes: ["project-context-single-section-selector"],
        attributes: {
            [args.binding.selectorField]: args.binding.selectorValue,
            projectContextModuleId: args.binding.moduleId,
            projectContextKind: args.binding.moduleKind,
            ...(args.moduleTopic ? { projectContextTopic: args.moduleTopic } : {}),
            ...(args.moduleArea ? { projectContextArea: args.moduleArea } : {}),
            manifestRevision: args.binding.manifestRevision,
            selectorField: args.binding.selectorField,
            selectorValue: args.binding.selectorValue,
        },
    });
    // Different declared selector values share the exact text range and subject.
    // Keep their stable atom dedupe identities distinct by the catalog-record hash.
    return buildMssrEvidenceAtom({
        subject: base.subject,
        source: base.source,
        provenance: base.provenance,
        fingerprints: base.fingerprints,
        reasonCodes: base.reasonCodes,
        lineage: base.lineage,
        dedupeKey: `${base.dedupeKey}:${args.record.metadataFingerprint ?? args.record.recordFingerprint}`,
        authorityClass: base.authorityClass,
        privacyClass: base.privacyClass,
        usage: base.usage,
        attributes: base.attributes,
    });
}
/**
 * Attach only owner-declared selectors whose manifest module is exactly one
 * explicitly selected Markdown heading. Whole-file and multi-heading modules
 * are intentionally left lexical-only because their selectors do not define
 * per-heading semantic scope.
 */
export function bindProjectContextMetadataToLibrarianDocuments(args) {
    const documents = args.documents.map((document) => ({ ...document, records: [], evidenceAtoms: [] }));
    const bindingsByAtomId = new Map();
    const index = {
        mode: MSSR_PROJECT_CONTEXT_LIBRARIAN_METADATA_MODE,
        manifestRevision: args.manifestRevision,
        sourceCount: 0,
        moduleCount: 0,
        rangeCount: 0,
        atomCount: 0,
        skipped: {
            unselectedSource: 0,
            nonSingleSection: 0,
            unsupportedKind: 0,
            noSearchSelectors: 0,
            ambiguousOrMissingSection: 0,
            unbindableRange: 0,
        },
        advisoryOnly: true,
        truthAuthority: false,
        canonicalRewriteAllowed: false,
    };
    const documentByRef = new Map(documents.map((document, index) => [sourceRefKey(document.sourceRef), { document, outputIndex: index }]));
    const staged = [];
    for (const module of args.manifest.modules) {
        if (module.kind === "directive") {
            index.skipped.unsupportedKind += 1;
            continue;
        }
        const target = documentByRef.get(sourceRefKey(module.source.path));
        if (!target) {
            index.skipped.unselectedSource += 1;
            continue;
        }
        if (!module.source.sections || module.source.sections.length !== 1) {
            index.skipped.nonSingleSection += 1;
            continue;
        }
        const selectors = selectorValues(module);
        if (selectors.length === 0) {
            index.skipped.noSearchSelectors += 1;
            continue;
        }
        let surface;
        try {
            surface = buildMssrMarkdownDocumentSurface({ sourceRef: target.document.sourceRef, markdown: target.document.markdown });
        }
        catch {
            index.skipped.ambiguousOrMissingSection += 1;
            continue;
        }
        const headingLine = declaredHeadingLine(target.document.markdown, module.source.sections[0]);
        const matchingHeadings = headingLine === null ? [] : surface.headings.filter((heading) => heading.startLine === headingLine);
        if (matchingHeadings.length !== 1) {
            index.skipped.ambiguousOrMissingSection += 1;
            continue;
        }
        const heading = matchingHeadings[0];
        const identity = `${target.document.sourceRef}#${heading.id}`;
        if (identity.length > 400) {
            index.skipped.unbindableRange += 1;
            continue;
        }
        const moduleRecords = [];
        const moduleAtoms = [];
        const moduleBindings = [];
        for (const selector of selectors) {
            const binding = {
                moduleId: module.id,
                moduleKind: module.kind,
                selectorField: selector.field,
                selectorValue: selector.value,
                manifestRevision: args.manifestRevision,
                sourceRef: target.document.sourceRef,
                rangeId: heading.id,
            };
            const record = catalogMssrLibrarianRecord({
                namespace: "project-context",
                kind: "section",
                identity,
                sourceRef: target.document.sourceRef,
                revision: surface.revision,
                payloadFingerprint: heading.fingerprint,
                metadata: {
                    moduleId: module.id,
                    moduleKind: module.kind,
                    ...(module.topic ? { topic: module.topic } : {}),
                    ...(module.area ? { area: module.area } : {}),
                    selectorField: selector.field,
                    selectorValue: selector.value,
                    manifestRevision: args.manifestRevision,
                },
                provenance: { producer: "project-context-manifest" },
            });
            const atom = atomWithMetadataDedupeKey({
                record,
                canonicalOwner: target.document.owner,
                sourceRef: target.document.sourceRef,
                revision: surface.revision,
                observedAt: args.observedAt,
                range: {
                    id: heading.id,
                    startLine: heading.startLine,
                    endLine: heading.endLine,
                    startOffset: heading.startOffset,
                    endOffset: heading.endOffset,
                    headingPath: heading.headingPath,
                    fingerprint: heading.fingerprint,
                },
                binding,
                ...(module.topic ? { moduleTopic: module.topic } : {}),
                ...(module.area ? { moduleArea: module.area } : {}),
            });
            moduleRecords.push(record);
            moduleAtoms.push(atom);
            moduleBindings.push(binding);
        }
        staged.push({ outputIndex: target.outputIndex, records: moduleRecords, atoms: moduleAtoms, bindings: moduleBindings });
    }
    const recordCount = staged.reduce((count, item) => count + item.records.length, 0);
    const perDocumentCounts = new Map();
    for (const item of staged)
        perDocumentCounts.set(item.outputIndex, (perDocumentCounts.get(item.outputIndex) ?? 0) + item.atoms.length);
    const overLimit = recordCount > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalRecords
        || recordCount > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxTotalEvidenceAtoms
        || [...perDocumentCounts.values()].some((count) => count > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxRecordsPerDocument
            || count > MSSR_LIBRARIAN_RETRIEVAL_LIMITS.maxEvidenceAtomsPerDocument);
    if (overLimit) {
        return {
            documents,
            bindingsByAtomId,
            index,
            limitExceeded: true,
        };
    }
    const indexedSources = new Set();
    const indexedModules = new Set();
    const indexedRanges = new Set();
    for (const item of staged) {
        const output = documents[item.outputIndex];
        output.records.push(...item.records);
        output.evidenceAtoms.push(...item.atoms);
        for (const [indexInModule, atom] of item.atoms.entries()) {
            bindingsByAtomId.set(atom.id, item.bindings[indexInModule]);
            indexedSources.add(item.bindings[indexInModule].sourceRef);
            indexedModules.add(item.bindings[indexInModule].moduleId);
            indexedRanges.add(`${item.bindings[indexInModule].sourceRef}\u0000${item.bindings[indexInModule].rangeId}`);
        }
    }
    index.sourceCount = indexedSources.size;
    index.moduleCount = indexedModules.size;
    index.rangeCount = indexedRanges.size;
    index.atomCount = recordCount;
    return { documents, bindingsByAtomId, index, limitExceeded: false };
}
