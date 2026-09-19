export const MSSR_LIFECYCLE_OPERATION_EFFECTS = [
  "control-plane",
  "read",
  "inspect",
  "verify",
  "execute",
  "mutate",
  "persist",
  "publish",
  "external-side-effect",
  "unknown",
] as const;

export type MssrLifecycleOperationEffect = typeof MSSR_LIFECYCLE_OPERATION_EFFECTS[number];
export type MssrLifecycleOperationScale = "trivial" | "substantial" | "unknown";
export type MssrLifecycleTraceState = "none" | "compatible" | "ambiguous" | "mismatch" | "unknown";
export type MssrLifecycleRouteState = "none" | "present";
export type MssrLifecycleActivationMode = "lightweight" | "managed" | "review";
export type MssrLifecycleActivationAction =
  | "none"
  | "inherit-active-trace"
  | "ensure-trace-and-route"
  | "ensure-route"
  | "continue-managed-route"
  | "replan-managed-route"
  | "inspect-traces";

export type MssrLifecycleActivationObservation = Readonly<{
  /** Semantic operation effect supplied by the host registry/adapter, never inferred from tool-name text by MSSR. */
  effect: MssrLifecycleOperationEffect;
  /** Host-observed scale. `substantial` may elevate otherwise read-only work; unknown is not silently treated as substantial. */
  scale: MssrLifecycleOperationScale;
  /** Current trace relationship after applying the immutable owner contract. */
  trace: MssrLifecycleTraceState;
  /** Whether the compatible trace already has an active route. */
  route: MssrLifecycleRouteState;
  /** Whether the operation belongs to a repository/project whose Project Context should accompany managed activation. */
  projectScoped?: boolean;
  /** Explicit lifecycle boundary observed by the host, for example verify/persist/close orchestration. */
  phaseBoundary?: boolean;
}>;

export type MssrLifecycleActivationDecision = Readonly<{
  mode: MssrLifecycleActivationMode;
  lifecycleRequired: boolean;
  projectContextRequired: boolean;
  action: MssrLifecycleActivationAction;
  reasonCodes: readonly string[];
  fingerprint: string;
  /** Portable policy only recommends lifecycle control; the host owns trace creation, routing calls and I/O. */
  advisoryOnly: true;
  /** This contract can never authorize project/file/tool mutation. */
  automaticMutationAllowed: false;
}>;

const INTRINSICALLY_MANAGED_EFFECTS = new Set<MssrLifecycleOperationEffect>([
  "mutate",
  "persist",
  "publish",
  "external-side-effect",
]);

function fingerprint(parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join("|");
}

/**
 * Portable pre-operation lifecycle activation policy.
 *
 * Hosts classify observable operation semantics and current trace/route state.
 * MSSR decides only whether the operation can remain lightweight or needs an
 * existing/new managed lifecycle. This deliberately does not carry a tool-name
 * catalog and does not infer semantic intent from raw arguments or commands.
 *
 * C2b routing-compliance remains the after-the-fact recovery/observability
 * layer if a host fails to apply this decision.
 */
export function evaluateMssrLifecycleActivation(
  observation: MssrLifecycleActivationObservation,
): MssrLifecycleActivationDecision {
  const reasons = new Set<string>();
  const phaseBoundary = observation.phaseBoundary === true;

  if (observation.effect === "control-plane") {
    return {
      mode: "lightweight",
      lifecycleRequired: false,
      projectContextRequired: false,
      action: "none",
      reasonCodes: ["control-plane-exempt"],
      fingerprint: fingerprint([
        `effect:${observation.effect}`,
        `scale:${observation.scale}`,
        `trace:${observation.trace}`,
        `route:${observation.route}`,
        "managed:false",
        "action:none",
      ]),
      advisoryOnly: true,
      automaticMutationAllowed: false,
    };
  }

  const inconsistentHostEvidence = observation.route === "present"
    && observation.trace !== "compatible";
  if (inconsistentHostEvidence) reasons.add("route-without-compatible-trace");

  const intrinsicManaged = INTRINSICALLY_MANAGED_EFFECTS.has(observation.effect);
  const substantial = observation.scale === "substantial";
  const lifecycleRequired = intrinsicManaged || substantial || phaseBoundary;

  if (intrinsicManaged) reasons.add("side-effectful-operation");
  if (substantial) reasons.add("substantial-operation");
  if (phaseBoundary) reasons.add("phase-boundary");

  const insufficientOperationEvidence = observation.effect === "unknown"
    && observation.scale !== "substantial"
    && !phaseBoundary;
  if (insufficientOperationEvidence) reasons.add("operation-semantics-unknown");

  let action: MssrLifecycleActivationAction = "none";
  let mode: MssrLifecycleActivationMode = "lightweight";

  if (inconsistentHostEvidence) {
    mode = "review";
    action = "inspect-traces";
  } else if (!lifecycleRequired) {
    if (insufficientOperationEvidence) {
      mode = "review";
      action = observation.trace === "compatible" ? "inherit-active-trace" : "none";
    } else {
      mode = "lightweight";
      action = observation.trace === "compatible" ? "inherit-active-trace" : "none";
      reasons.add("lightweight-operation");
    }
  } else if (observation.trace === "mismatch") {
    mode = "review";
    action = "inspect-traces";
    reasons.add("trace-owner-mismatch");
  } else if (observation.trace === "ambiguous") {
    mode = "review";
    action = "inspect-traces";
    reasons.add("trace-ambiguous");
  } else if (observation.trace === "unknown") {
    mode = "review";
    action = "inspect-traces";
    reasons.add("trace-state-unknown");
  } else if (observation.trace === "none") {
    mode = "managed";
    action = "ensure-trace-and-route";
    reasons.add("managed-trace-missing");
  } else if (observation.route === "none") {
    mode = "managed";
    action = "ensure-route";
    reasons.add("managed-route-missing");
  } else if (phaseBoundary) {
    mode = "managed";
    action = "replan-managed-route";
    reasons.add("managed-route-replan");
  } else {
    mode = "managed";
    action = "continue-managed-route";
    reasons.add("managed-route-present");
  }

  const reasonCodes = [...reasons].sort();
  const projectContextRequired = lifecycleRequired
    && observation.projectScoped === true
    && mode === "managed";

  return {
    mode,
    lifecycleRequired,
    projectContextRequired,
    action,
    reasonCodes,
    fingerprint: fingerprint([
      `effect:${observation.effect}`,
      `scale:${observation.scale}`,
      `trace:${observation.trace}`,
      `route:${observation.route}`,
      `project-scoped:${observation.projectScoped === true}`,
      `phase-boundary:${phaseBoundary}`,
      `mode:${mode}`,
      `managed:${lifecycleRequired}`,
      `project-context:${projectContextRequired}`,
      `action:${action}`,
      `reasons:${reasonCodes.join(",")}`,
    ]),
    advisoryOnly: true,
    automaticMutationAllowed: false,
  };
}
