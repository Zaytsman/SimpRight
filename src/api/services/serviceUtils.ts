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

/** Like `assertOk`, but a 404 counts as done: for the cleanup of a record the test itself may already have deleted. */
export function assertOkOrNotFound(response: ApiResponse, action: string): void {
  if (response.status !== 404) assertOk(response, action);
}

/** Like `assertOk`, then returns the parsed JSON body; a 2xx body that isn't JSON fails with the action and its start. */
export function parseOk<T>(response: ApiResponse, action: string): T {
  assertOk(response, action);
  try {
    return JSON.parse(response.body) as T;
  } catch {
    throw new Error(`Failed to ${action}: ${response.status} with a body that isn't JSON: ${response.body.slice(0, 200)}`);
  }
}
