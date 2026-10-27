/**
 * The checks API specs share for steps checked through a client: the core's HTTP checks (`httpChecks.ts`: the status,
 * the JSON body, the body's message, headers, lists), re-exported here, plus the Toolshop's own formats: Laravel's 422
 * `errors` keys and field maps, `{ error }` bodies, pages, `success`. `request` is the request record the spec
 * attached, used in the failure message. A check specific to one endpoint stays in its spec.
 */
import { expect } from '@playwright/test';
import type { ApiResponse } from '../api/clients/BaseClient';
import type { FieldValidationError, ValidationErrors } from '../api/dto/common';
import type { UserErrorBody } from '../api/dto/user';
import { assertMessage } from './assertHelpers';
import { parseJson } from './httpChecks';

export * from './httpChecks';

/** The keys of a Laravel page (the paginator's output without the link keys), as the list and search endpoints return it. */
export const PAGE_KEYS = ['current_page', 'data', 'from', 'last_page', 'per_page', 'to', 'total'] as const;

/** The checks of a "Verify the body's success is <true | false>." step. */
export function expectSuccess(request: unknown, response: ApiResponse, success: boolean): void {
  const body = parseJson<{ success?: unknown }>(request, response);
  expect(body.success, assertMessage({ request, expected: `success is ${success}`, actual: body })).toBe(success);
}

/** The checks of a "Verify the body's errors has the key(s) ..., each with at least one message." step; returns the parsed body. */
export function expectErrorKeys(request: unknown, response: ApiResponse, keys: string[]): FieldValidationError {
  const body = parseJson<FieldValidationError>(request, response);
  for (const key of keys) {
    const messages = body.errors?.[key];
    expect(
      Array.isArray(messages) && messages.length > 0,
      assertMessage({ request, expected: `errors has the key "${key}" with at least one message`, actual: body.errors })
    ).toBe(true);
  }
  return body;
}

/** The checks of a "Verify the body's errors has the keys ..." step that asks only for the keys, not for their messages. */
export function expectErrorKeysPresent(request: unknown, response: ApiResponse, keys: string[]): FieldValidationError {
  const body = parseJson<FieldValidationError>(request, response);
  for (const key of keys) {
    expect(
      body.errors !== null && typeof body.errors === 'object' && key in body.errors,
      assertMessage({ request, expected: `errors has the key "${key}"`, actual: body })
    ).toBe(true);
  }
  return body;
}

/** The checks of a "Verify the body's errors has no other keys." step. */
export function expectNoOtherKeys(request: unknown, body: FieldValidationError, keys: string[]): void {
  const actualKeys = Object.keys(body.errors ?? {}).sort();
  expect(actualKeys, assertMessage({ request, expected: `errors has only the keys ${keys.join(', ')}`, actual: body.errors })).toEqual([...keys].sort());
}

/**
 * The checks of a "Verify the body has a <field> key with at least one message." step, for endpoints whose 422 body is
 * the field map without a wrapper (form requests).
 */
export function expectFieldMessages(request: unknown, response: ApiResponse, field: string): void {
  const body = parseJson<ValidationErrors>(request, response);
  const messages = body[field];
  expect(
    Array.isArray(messages) && messages.length > 0,
    assertMessage({ request, expected: `Body has a "${field}" key with at least one message`, actual: body })
  ).toBe(true);
}

/** The checks of a "Verify the body's <field> messages include "<message>"." step (a field map without a wrapper). */
export function expectFieldMessageIncludes(request: unknown, response: ApiResponse, field: string, message: string): void {
  const body = parseJson<ValidationErrors>(request, response);
  const messages = body[field];
  expect(
    Array.isArray(messages) && messages.includes(message),
    assertMessage({ request, expected: `The "${field}" messages include "${message}"`, actual: body })
  ).toBe(true);
}

/** The checks of a "Verify the body is a non-empty array and every item's name contains "<term>" (case-insensitive)." step. */
export function expectItemNamesContain(request: unknown, body: unknown, term: string): void {
  expect(Array.isArray(body) && body.length > 0, assertMessage({ request, expected: 'The body is a non-empty array', actual: body })).toBe(true);
  for (const item of body as { name: string }[]) {
    expect(item.name.toLowerCase(), assertMessage({ request, expected: `The item's name contains "${term}" (case-insensitive)`, actual: item })).toContain(
      term.toLowerCase()
    );
  }
}

/** The checks of a "Verify the Accept-Query response header is application/json." step. */
export function expectAcceptQuery(request: unknown, response: ApiResponse): void {
  expect(response.headers['accept-query'], assertMessage({ request, expected: 'Accept-Query: application/json', actual: response.headers })).toBe('application/json');
}

/** The checks of a "Verify the body's error is a non-empty string." step (errors that a controller builds as `{ error }`). */
export function expectErrorText(request: unknown, response: ApiResponse): void {
  const body = parseJson<Partial<UserErrorBody>>(request, response);
  expect(
    typeof body.error === 'string' && body.error.length > 0,
    assertMessage({ request, expected: 'error is a non-empty string', actual: body })
  ).toBe(true);
}
