import { ERROR_CODES, type ErrorCode } from '@fieldmate/shared';

/** An expected error that is safe to return to the client. */
export class AppError extends Error {
  override name = 'AppError';
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.status = ERROR_CODES[code];
  }
}
