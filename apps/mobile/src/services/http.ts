import type { ApiErrorBody, ErrorCode } from '@fieldmate/shared';
import { env } from '../lib/env';

/** Every failure the app can see, normalised to one shape. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }
}

export const NETWORK_ERROR_MESSAGE = "Couldn't connect. Check your connection and try again.";
const UNKNOWN_ERROR_MESSAGE = 'Something went wrong. Please try again.';

type TokenReader = () => string | null;
type UnauthorizedHandler = () => void;

let readToken: TokenReader = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

/** Wired up by AuthProvider so requests carry the session and 401s sign the user out. */
export function configureHttp(options: {
  getToken: TokenReader;
  onUnauthorized: UnauthorizedHandler;
}): void {
  readToken = options.getToken;
  onUnauthorized = options.onUnauthorized;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skips the automatic sign-out on 401 (used by the session bootstrap). */
  ignoreUnauthorized?: boolean;
  signal?: AbortSignal;
};

function parseError(status: number, payload: unknown): ApiError {
  const body = payload as ApiErrorBody | null;
  const code = body?.error?.code;
  const message = body?.error?.message;
  if (code && message) return new ApiError(code, message, status);
  return new ApiError('INTERNAL_ERROR', UNKNOWN_ERROR_MESSAGE, status);
}

/**
 * Single entry point for API calls: base URL, bearer token, JSON handling and
 * the standard error shape (docs/05 §5).
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, ignoreUnauthorized = false, signal } = options;
  const token = readToken();

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
  }

  if (response.status === 401 && !ignoreUnauthorized) onUnauthorized();

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // A body that is missing or not JSON is handled by the error mapping below.
    payload = null;
  }

  if (!response.ok) throw parseError(response.status, payload);
  return payload as T;
}
