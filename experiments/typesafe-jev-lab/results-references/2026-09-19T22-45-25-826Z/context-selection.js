function overlap(left, right) {
    const wanted = new Set(right);
    return left.filter((value) => wanted.has(value));
}
function stageMatches(stages, stage) {
    return stages.length === 0 || stages.includes(stage);
}
export function selectContextModules(args) {
    const evaluated = args.modules.map((module) => {
        if (!stageMatches(module.stages, args.stage)) {
            return { module, score: -1, matched: [], eligible: false, reason: "stage-mismatch" };
        }
        const dimensions = [
            ["domain", module.domains, args.intent.domains],
            ["action", module.actions, args.intent.actions],
            ["artifact", module.artifacts, args.intent.artifacts],
            ["need", module.needs, args.intent.needs],
            ["signal", module.signals, args.intent.signals],
        ];
        const weights = { domain: 8, action: 10, artifact: 10, need: 12, signal: 14 };
        const matched = [];
        let score = module.priority;
        let hasSelector = false;
        let allSpecifiedMatch = true;
        for (const [label, expected, actual] of dimensions) {
            if (expected.length === 0)
                continue;
            hasSelector = true;
            const hits = overlap(actual, expected);
            if (hits.length === 0)
                allSpecifiedMatch = false;
            for (const hit of hits)
                matched.push(`${label}:${hit}`);
            score += hits.length * weights[label];
        }
        const eligible = module.required || (hasSelector && allSpecifiedMatch);
        return {
            module,
            score,
            matched,
            eligible,
            reason: eligible ? "selected" : "intent-mismatch",
        };
    });
    const exclusiveRejected = new Map();
    const ambiguousGroups = [];
    const rankedCandidates = evaluated.filter((item) => item.eligible && !item.module.exclusiveGroup);
    const exclusiveGroups = new Map();
    for (const item of evaluated.filter((candidate) => candidate.eligible && candidate.module.exclusiveGroup)) {
        const group = item.module.exclusiveGroup;
        const members = exclusiveGroups.get(group) ?? [];
        members.push(item);
        exclusiveGroups.set(group, members);
    }
    for (const [group, members] of exclusiveGroups) {
        const sorted = [...members].sort((a, b) => b.score - a.score
            || b.module.priority - a.module.priority
            || a.module.id.localeCompare(b.module.id));
        const topScore = sorted[0].score;
        const tied = sorted.filter((item) => item.score === topScore);
        if (tied.length > 1) {
            ambiguousGroups.push({ group, candidates: tied.map((item) => item.module.id), score: topScore });
            for (const item of tied)
                exclusiveRejected.set(item.module.id, "ambiguous-candidate");
            for (const item of sorted.slice(tied.length))
                exclusiveRejected.set(item.module.id, "exclusive-not-selected");
            continue;
        }
        rankedCandidates.push(sorted[0]);
        for (const item of sorted.slice(1))
            exclusiveRejected.set(item.module.id, "exclusive-not-selected");
    }
    const ranked = rankedCandidates.sort((a, b) => Number(b.module.required) - Number(a.module.required)
        || b.score - a.score
        || b.module.priority - a.module.priority
        || a.module.id.localeCompare(b.module.id));
    let remaining = Math.max(0, Math.floor(args.maxModuleChars));
    const selected = [];
    const selectedIds = new Set();
    const budgetRejected = new Set();
    for (const item of ranked) {
        if (item.module.chars <= remaining) {
            selected.push(item.module);
            selectedIds.add(item.module.id);
            remaining -= item.module.chars;
        }
        else {
            budgetRejected.add(item.module.id);
        }
    }
    const decisions = evaluated.map((item) => ({
        id: item.module.id,
        selected: selectedIds.has(item.module.id),
        score: item.score,
        chars: item.module.chars,
        reason: selectedIds.has(item.module.id)
            ? "selected"
            : budgetRejected.has(item.module.id)
                ? "budget-exceeded"
                : exclusiveRejected.get(item.module.id) ?? item.reason,
        matched: item.matched,
    }));
    return {
        selected,
        decisions,
        selectedChars: selected.reduce((sum, module) => sum + module.chars, 0),
        remainingChars: remaining,
        ambiguousGroups,
    };
}
