export const MSSR_CONTEXT_DELIVERY_TIERS = ["authority", "relevant", "deep"] as const;
export type MssrContextDeliveryTier = typeof MSSR_CONTEXT_DELIVERY_TIERS[number];

export const MSSR_CONTEXT_SOURCE_CLASSES = [
  "instruction",
  "project-context",
  "memory",
  "state",
  "directive",
  "skill",
  "guide",
  "handoff",
  "documentation",
  "observability",
] as const;
export type MssrContextSourceClass = typeof MSSR_CONTEXT_SOURCE_CLASSES[number];

export const MSSR_CONTEXT_DELIVERY_MODES = ["compact", "debug"] as const;
export type MssrContextDeliveryMode = typeof MSSR_CONTEXT_DELIVERY_MODES[number];

export type MssrContextDeliveryBudget = {
  mode: MssrContextDeliveryMode;
  maxChars: number;
  maxItems: number;
  deepOnDemand: boolean;
};

export type MssrContextDeliveryDecision = {
  deliver: boolean;
  reason: "authority" | "relevant" | "deep-matched" | "deep-debug" | "deep-on-demand";
};

/**
 * Portable context-economy policy shared by hosts and source-specific loaders.
 *
 * The policy deliberately separates container authority from payload depth:
 * a required/authoritative container requires its authority capsule, not every
 * optional child document or procedure it owns. Deep material is selected only
 * when semantic selectors match or when the caller explicitly requests debug.
 */
export function resolveMssrContextDeliveryBudget(args: {
  mode?: MssrContextDeliveryMode;
  requestedChars?: number;
  requestedItems?: number;
  compactChars?: number;
  compactItems?: number;
  hardMaxChars?: number;
  hardMaxItems?: number;
}): MssrContextDeliveryBudget {
  const mode = args.mode === "debug" ? "debug" : "compact";
  const hardMaxChars = Math.max(0, Math.floor(args.hardMaxChars ?? 80_000));
  const hardMaxItems = Math.max(0, Math.floor(args.hardMaxItems ?? 32));
  const requestedChars = Math.min(hardMaxChars, Math.max(0, Math.floor(args.requestedChars ?? 12_000)));
  const requestedItems = Math.min(hardMaxItems, Math.max(0, Math.floor(args.requestedItems ?? 8)));
  const compactChars = Math.min(hardMaxChars, Math.max(0, Math.floor(args.compactChars ?? 6_000)));
  const compactItems = Math.min(hardMaxItems, Math.max(0, Math.floor(args.compactItems ?? 4)));
  return {
    mode,
    maxChars: mode === "debug" ? requestedChars : Math.min(requestedChars, compactChars),
    maxItems: mode === "debug" ? requestedItems : Math.min(requestedItems, compactItems),
    deepOnDemand: mode !== "debug",
  };
}

export function evaluateMssrContextDelivery(args: {
  tier?: MssrContextDeliveryTier;
  mode?: MssrContextDeliveryMode;
  semanticMatch?: boolean;
}): MssrContextDeliveryDecision {
  const tier = args.tier ?? "relevant";
  const mode = args.mode === "debug" ? "debug" : "compact";
  if (tier === "authority") return { deliver: true, reason: "authority" };
  if (tier === "relevant") return { deliver: true, reason: "relevant" };
  if (mode === "debug") return { deliver: true, reason: "deep-debug" };
  if (args.semanticMatch) return { deliver: true, reason: "deep-matched" };
  return { deliver: false, reason: "deep-on-demand" };
}

/**
 * Child payload does not inherit a parent's required obligation automatically.
 * A required child remains required only inside a required parent. Optional
 * children are accepted context even when their parent capability is required.
 */
export function resolveMssrChildContextObligation(args: {
  parentRequired: boolean;
  childRequired?: boolean;
}): "required" | "accepted" {
  return args.parentRequired && args.childRequired === true ? "required" : "accepted";
}
