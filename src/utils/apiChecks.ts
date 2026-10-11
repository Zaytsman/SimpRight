import { expect } from '@playwright/test';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { FieldValidationError } from '@api/dto/common';
import { assertMessage } from './assertHelpers';

/**
 * Checks that API specs share for steps checked through a client: the status, Laravel's 422 `errors`
 * keys and a redirect's Location. `request` is the request record the spec attached, used in the
 * failure message. A check specific to one endpoint stays in its spec.
 */

/** How a request record shows the Accept header for a client's `accept` option. */
export function describeAccept(accept: string | null | undefined): string {
  if (accept === undefined) return 'application/json';
  // Playwright's request API sends its default Accept (any type) when none is set.
  return accept ?? 'left out (Playwright sends its default, any type)';
}

/** The checks of a "Verify the response status is <status>." step. */
export function expectStatus(request: unknown, response: ApiResponse, status: number): void {
  expect(response.status, assertMessage({ request, expected: `Status ${status}`, actual: { status: response.status, body: response.body.slice(0, 500) } })).toBe(
    status
  );
}

/** The checks of a "Verify the body's errors has the key(s) ..., each with at least one message." step; returns the parsed body. */
export function expectErrorKeys(request: unknown, response: ApiResponse, keys: string[]): FieldValidationError {
  const body = JSON.parse(response.body) as FieldValidationError;
  for (const key of keys) {
    const messages = body.errors?.[key];
    expect(
      Array.isArray(messages) && messages.length > 0,
      assertMessage({ request, expected: `errors has the key "${key}" with at least one message`, actual: body.errors })
    ).toBe(true);
  }
  return body;
}

/** The checks of a "Verify the body's errors has no other keys." step. */
export function expectNoOtherKeys(request: unknown, body: FieldValidationError, keys: string[]): void {
  const actualKeys = Object.keys(body.errors ?? {}).sort();
  expect(actualKeys, assertMessage({ request, expected: `errors has only the keys ${keys.join(', ')}`, actual: body.errors })).toEqual([...keys].sort());
}

/** The checks of a "Verify the Location header is "<location>"." step. */
export function expectLocation(request: unknown, response: ApiResponse, location: string): void {
  expect(response.headers['location'], assertMessage({ request, expected: `Location is "${location}"`, actual: response.headers })).toBe(location);
}
