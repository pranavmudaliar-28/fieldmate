export const ERROR_CODES = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  TASK_NOT_FOUND: 404,
  EVIDENCE_NOT_FOUND: 404,
  NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  INVALID_STATUS_TRANSITION: 409,
  EVIDENCE_REQUIRED: 409,
  SAME_WORKER: 409,
  /** An admin tried to change their own role or access (docs/07 §2). */
  SELF_ACTION: 409,
  /** The change would leave the system with no active admin. */
  LAST_ADMIN: 409,
  /** The user has tasks, photos or notes, so deactivate instead of deleting. */
  USER_HAS_HISTORY: 409,
  EMAIL_TAKEN: 409,
  VALIDATION_ERROR: 422,
  INVALID_WORKER: 422,
  INVALID_FILE: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
  };
};
