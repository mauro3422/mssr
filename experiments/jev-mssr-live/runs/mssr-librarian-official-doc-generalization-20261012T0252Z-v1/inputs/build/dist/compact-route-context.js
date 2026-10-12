const boundedStrings = (value, limit) => Array.isArray(value)
    ? value.filter((item) => typeof item === 'string').slice(0, limit)
    : [];
/** Keep routing repair evidence bounded without turning it into activation authority. */
export function compactRouteNearMatches(value) {
    if (!Array.isArray(value))
        return [];
    return value.slice(0, 5).flatMap((raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return [];
        const candidate = raw;
        const missingGates = Array.isArray(candidate.missingGates)
            ? candidate.missingGates.slice(0, 3).flatMap((rawGate) => {
                if (!rawGate || typeof rawGate !== 'object' || Array.isArray(rawGate))
                    return [];
                const gate = rawGate;
                return [{
                        dimension: gate.dimension,
                        reason: gate.reason,
                        acceptedValues: boundedStrings(gate.acceptedValues, 8),
                        missingValues: boundedStrings(gate.missingValues, 8),
                    }];
            })
            : [];
        return [{
                name: candidate.name,
                source: candidate.source,
                candidateScore: candidate.candidateScore,
                explicitNameMatched: candidate.explicitNameMatched === true,
                matchedDimensions: boundedStrings(candidate.matchedDimensions, 5),
                missingGates,
                advisoryOnly: true,
            }];
    });
}
/** Compact diagnostics only; selected evidence and its provenance remain intact. */
export function compactRouteContextPlane(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return value;
    const plane = value;
    const project = plane.projectContext;
    const repository = plane.repository;
    const { decisions, ...projectEvidence } = project ?? {};
    return {
        ...plane,
        projectContext: project ? { ...projectEvidence, decisionCount: Array.isArray(decisions) ? decisions.length : 0 } : project,
        // The merged selected messages are delivered once at response.contextMessages.
        contextMessages: { selectionRef: 'contextMessages' },
        repository: repository ? {
            observationCount: Array.isArray(repository.observations) ? repository.observations.length : 0,
            messageCount: Array.isArray(repository.messages) ? repository.messages.length : 0,
            diagnostics: repository.diagnostics,
            overflow: repository.overflow,
            detailMode: 'debug',
        } : repository,
    };
}
