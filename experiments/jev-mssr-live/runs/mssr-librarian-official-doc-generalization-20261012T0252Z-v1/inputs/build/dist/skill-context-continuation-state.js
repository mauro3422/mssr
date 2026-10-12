const CONTINUATION_TTL_MS = 30 * 60 * 1000;
const MAX_CONTINUATIONS = 64;
const continuations = new Map();
function prune(now = Date.now()) {
    for (const [traceId, state] of continuations) {
        if (now - state.updatedAt > CONTINUATION_TTL_MS)
            continuations.delete(traceId);
    }
    while (continuations.size > MAX_CONTINUATIONS) {
        const oldest = continuations.keys().next().value;
        if (typeof oldest !== "string")
            break;
        continuations.delete(oldest);
    }
}
export function rememberSkillContextContinuation(input) {
    const now = Date.now();
    prune(now);
    const previous = continuations.get(input.traceId);
    const state = {
        ...input,
        entries: input.entries.map((entry) => ({ ...entry })),
        retainedContextObligations: input.retainedContextObligations.map((receipt) => ({ ...receipt })),
        postContextAction: input.postContextAction ? { ...input.postContextAction } : null,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
    };
    continuations.delete(input.traceId);
    continuations.set(input.traceId, state);
    prune(now);
    return state;
}
export function readSkillContextContinuation(traceId) {
    const now = Date.now();
    prune(now);
    return continuations.get(traceId) ?? null;
}
export function clearSkillContextContinuation(traceId) {
    return continuations.delete(traceId);
}
export function skillContextContinuationStateCount() {
    prune();
    return continuations.size;
}
