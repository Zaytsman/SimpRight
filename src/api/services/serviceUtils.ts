import type { ApiResponse } from '../clients/BaseClient';

/** Throws with the status and the start of the body when `response` isn't 2xx. */
export function assertOk(response: ApiResponse, action: string): void {
  if (!response.isSuccess) {
    throw new Error(`Failed to ${action}: ${response.status} ${response.statusText}. Body: ${response.body.slice(0, 200)}`);
  }
}

/** Like `assertOk`, then returns the parsed JSON body. */
export function parseOk<T>(response: ApiResponse, action: string): T {
  assertOk(response, action);
  return JSON.parse(response.body) as T;
}
