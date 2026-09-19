export type MssrTraceOwnerIdentity = {
  /** Canonical project owner key observed by the host. */
  project?: string | null;
  /** Stable workflow owner key observed by the host. */
  workflowKey?: string | null;
};

export type MssrTraceOwnerField = "project" | "workflowKey";

export type MssrTraceOwnerCompatibility = {
  compatible: boolean;
  status:
    | "unbound"
    | "compatible"
    | "project-mismatch"
    | "workflow-mismatch"
    | "project-and-workflow-mismatch";
  existing: Required<MssrTraceOwnerIdentity>;
  requested: Required<MssrTraceOwnerIdentity>;
  bound: Required<MssrTraceOwnerIdentity>;
  newlyBoundFields: MssrTraceOwnerField[];
  mismatchFields: MssrTraceOwnerField[];
  ownerMutationAllowed: false;
};

function ownerValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Pure portable trace-owner contract.
 *
 * Hosts own canonical project/workflow observation. MSSR only decides whether
 * the supplied owner evidence may continue one logical trace. A missing value
 * may fill an unbound field, but once known that field never migrates.
 */
export function evaluateMssrTraceOwnerCompatibility(
  existingInput: MssrTraceOwnerIdentity | null | undefined,
  requestedInput: MssrTraceOwnerIdentity | null | undefined,
): MssrTraceOwnerCompatibility {
  const existing = {
    project: ownerValue(existingInput?.project),
    workflowKey: ownerValue(existingInput?.workflowKey),
  };
  const requested = {
    project: ownerValue(requestedInput?.project),
    workflowKey: ownerValue(requestedInput?.workflowKey),
  };

  const mismatchFields: MssrTraceOwnerField[] = [];
  if (existing.project && requested.project && existing.project !== requested.project) mismatchFields.push("project");
  if (existing.workflowKey && requested.workflowKey && existing.workflowKey !== requested.workflowKey) mismatchFields.push("workflowKey");

  const newlyBoundFields: MssrTraceOwnerField[] = [];
  if (!existing.project && requested.project) newlyBoundFields.push("project");
  if (!existing.workflowKey && requested.workflowKey) newlyBoundFields.push("workflowKey");

  const bound = {
    project: existing.project ?? requested.project,
    workflowKey: existing.workflowKey ?? requested.workflowKey,
  };

  let status: MssrTraceOwnerCompatibility["status"] = "compatible";
  if (mismatchFields.length === 2) status = "project-and-workflow-mismatch";
  else if (mismatchFields[0] === "project") status = "project-mismatch";
  else if (mismatchFields[0] === "workflowKey") status = "workflow-mismatch";
  else if (!existing.project && !existing.workflowKey) status = "unbound";

  return {
    compatible: mismatchFields.length === 0,
    status,
    existing,
    requested,
    bound,
    newlyBoundFields,
    mismatchFields,
    ownerMutationAllowed: false,
  };
}
