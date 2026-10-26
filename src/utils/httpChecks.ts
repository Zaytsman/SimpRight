/**
 * Checks of an HTTP response that API specs share: the status, the JSON body, the body's message, headers and lists.
 * `request` is the request record the spec attached, used in the failure message. The project's own checks (its
 * error and page formats) are in `apiChecks.ts`, which re-exports these, so specs import every check from there.
 */
import { expect } from '@playwright/test';
import type { ApiResponse } from '../api/clients/BaseClient';
import { assertMessage } from './assertHelpers';

/** How a request record shows the Accept header for a client's `accept` option. */
export function describeAccept(accept: string | null | undefined): string {
  if (accept === undefined) return 'application/json';
  // Playwright's request API sends its default Accept (any type) when none is set.
  return accept ?? 'left out (Playwright sends its default, any type)';
}

/**
 * The response body parsed as JSON. When it isn't JSON (an HTML error page, Cloudflare's bot check), fails with the
 * request, the status and the start of the body instead of a bare "Unexpected token" SyntaxError.
 */
export function parseJson<T>(request: unknown, response: ApiResponse): T {
  try {
    return JSON.parse(response.body) as T;
  } catch {
    throw new Error(assertMessage({ request, expected: 'A JSON body', actual: { status: response.status, body: response.body.slice(0, 500) } }));
  }
}

/**
 * The checks of a "Verify the response status is <status>." step. The failure message shows the status and the start of
 * the body, or what `describeBody` returns: a page summary, or nothing for a body that may list other visitors.
 */
export function expectStatus(
  request: unknown,
  response: ApiResponse,
  status: number,
  describeBody: (response: ApiResponse) => unknown = (sent) => sent.body.slice(0, 500)
): void {
  expect(response.status, assertMessage({ request, expected: `Status ${status}`, actual: { status: response.status, body: describeBody(response) } })).toBe(status);
}

/**
 * Fails unless `items` has at least one element. The guard at the start of an "every item ..." step: on an empty list
 * the step's loop checks nothing and passes.
 */
export function expectSomeItems(request: unknown, items: unknown, what: string): void {
  expect(
    Array.isArray(items) && items.length > 0,
    assertMessage({ request, expected: `${what} has at least one item (an "every item" check needs one)`, actual: Array.isArray(items) ? `${items.length} items` : items })
  ).toBe(true);
}

/** `expectStatus`, then the parsed body, for a status step whose body the later steps check. */
export function expectStatusAndBody<T>(request: unknown, response: ApiResponse, status: number): T {
  expectStatus(request, response, status);
  return parseJson<T>(request, response);
}

/** The checks of a "Verify the body's message is "<message>"." step. */
export function expectMessage(request: unknown, response: ApiResponse, message: string): void {
  const body = parseJson<{ message?: unknown }>(request, response);
  expect(body.message, assertMessage({ request, expected: `message is "${message}"`, actual: body })).toBe(message);
}

/** The checks of a "Verify the Location header is "<location>"." step. */
export function expectLocation(request: unknown, response: ApiResponse, location: string): void {
  expect(response.headers['location'], assertMessage({ request, expected: `Location is "${location}"`, actual: response.headers })).toBe(location);
}

/** The checks of a "Verify the body is an empty array." step. */
export function expectEmptyArray(request: unknown, response: ApiResponse): void {
  const body = parseJson<unknown>(request, response);
  expect(Array.isArray(body) && body.length === 0, assertMessage({ request, expected: 'The body is an empty array', actual: body })).toBe(true);
}

/** The checks of a "Verify the Content-Type response header is <type>." step: the header equals the type exactly. */
export function expectContentType(request: unknown, response: ApiResponse, contentType: string): void {
  expect(response.headers['content-type'], assertMessage({ request, expected: `Content-Type is "${contentType}"`, actual: response.headers })).toBe(contentType);
}

/** The checks of a "Verify the Content-Type header starts with "<type>"." step. */
export function expectContentTypeStartsWith(request: unknown, response: ApiResponse, prefix: string): void {
  const contentType = response.headers['content-type'] ?? '';
  expect(contentType.startsWith(prefix), assertMessage({ request, expected: `Content-Type starts with "${prefix}"`, actual: contentType })).toBe(true);
}
