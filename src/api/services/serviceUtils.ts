import type { ApiResponse } from '../clients/BaseClient';

/** A non-2xx response where a happy path was expected; `status` lets callers tell a server error from a client one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Throws an `ApiError` with the status and the start of the body when `response` isn't 2xx. */
export function assertOk(response: ApiResponse, action: string): void {
  if (!response.isSuccess) {
    throw new ApiError(`Failed to ${action}: ${response.status} ${response.statusText}. Body: ${response.body.slice(0, 200)}`, response.status);
  }
}

/** Like `assertOk`, then returns the parsed JSON body. */
export function parseOk<T>(response: ApiResponse, action: string): T {
  assertOk(response, action);
  return JSON.parse(response.body) as T;
}
