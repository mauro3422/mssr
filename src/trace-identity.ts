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


/**
 * Explicit host-supplied identity for one human task and its trace lineage.
 * MSSR never derives these fields from free-form task text, workflow names, or
 * elapsed time. They are correlation evidence only and do not close/supersede
 * another trace by themselves.
 */
export type MssrTraceTaskIdentity = {
  taskKey?: string | null;
  parentTraceId?: string | null;
  supersedesTraceId?: string | null;
};

export type MssrTraceTaskField = "taskKey" | "parentTraceId" | "supersedesTraceId";

export type MssrTraceTaskCompatibility = {
  compatible: boolean;
  status: "unbound" | "compatible" | "task-identity-mismatch";
  existing: Required<MssrTraceTaskIdentity>;
  requested: Required<MssrTraceTaskIdentity>;
  bound: Required<MssrTraceTaskIdentity>;
  newlyBoundFields: MssrTraceTaskField[];
  mismatchFields: MssrTraceTaskField[];
  identityMutationAllowed: false;
};

function taskValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Additive immutable task correlation for one trace. Missing fields can be
 * filled later, but an already observed task/lineage field cannot migrate.
 * Cross-trace existence is intentionally not required because a host may be
 * resuming evidence from another process or persisted history.
 */
export function evaluateMssrTraceTaskCompatibility(
  existingInput: MssrTraceTaskIdentity | null | undefined,
  requestedInput: MssrTraceTaskIdentity | null | undefined,
): MssrTraceTaskCompatibility {
  const existing = {
    taskKey: taskValue(existingInput?.taskKey),
    parentTraceId: taskValue(existingInput?.parentTraceId),
    supersedesTraceId: taskValue(existingInput?.supersedesTraceId),
  };
  const requested = {
    taskKey: taskValue(requestedInput?.taskKey),
    parentTraceId: taskValue(requestedInput?.parentTraceId),
    supersedesTraceId: taskValue(requestedInput?.supersedesTraceId),
  };

  const fields: MssrTraceTaskField[] = ["taskKey", "parentTraceId", "supersedesTraceId"];
  const mismatchFields = fields.filter((field) => existing[field] && requested[field] && existing[field] !== requested[field]);
  const newlyBoundFields = fields.filter((field) => !existing[field] && requested[field]);
  const bound = {
    taskKey: existing.taskKey ?? requested.taskKey,
    parentTraceId: existing.parentTraceId ?? requested.parentTraceId,
    supersedesTraceId: existing.supersedesTraceId ?? requested.supersedesTraceId,
  };

  return {
    compatible: mismatchFields.length === 0,
    status: mismatchFields.length > 0
      ? "task-identity-mismatch"
      : fields.every((field) => !existing[field])
        ? "unbound"
        : "compatible",
    existing,
    requested,
    bound,
    newlyBoundFields,
    mismatchFields,
    identityMutationAllowed: false,
  };
}
