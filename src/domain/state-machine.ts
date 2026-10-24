import type { WorkflowStatus } from "./types.ts";

const allowed: Record<WorkflowStatus, WorkflowStatus[]> = {
  IDLE: ["RECEIVING_SIGNAL"],
  RECEIVING_SIGNAL: ["PARSING", "CANCELLED", "FAILED"],
  PARSING: ["VALIDATING", "NEEDS_CLARIFICATION", "FAILED"],
  VALIDATING: ["RENDERING", "FAILED"],
  RENDERING: ["AWAITING_APPROVAL", "FAILED"],
  AWAITING_APPROVAL: ["PUBLISHING", "EDITING", "RENDERING", "CANCELLED"],
  EDITING: ["VALIDATING", "FAILED", "CANCELLED"],
  PUBLISHING: ["PUBLISHED", "FAILED"],
  PUBLISHED: [],
  CANCELLED: [],
  FAILED: ["RECEIVING_SIGNAL", "PARSING"],
  NEEDS_CLARIFICATION: ["RECEIVING_SIGNAL", "PARSING", "CANCELLED"]
};

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: WorkflowStatus,
    readonly to: WorkflowStatus
  ) {
    super(`Illegal workflow transition ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return allowed[from]?.includes(to) ?? false;
}

export function transition(from: WorkflowStatus, to: WorkflowStatus): WorkflowStatus {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
  return to;
}

export function isTerminal(status: WorkflowStatus): boolean {
  return status === "PUBLISHED" || status === "CANCELLED";
}

export function canPublish(status: WorkflowStatus): boolean {
  return status === "AWAITING_APPROVAL";
}
