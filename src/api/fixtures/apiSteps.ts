/**
 * Building blocks the area step helpers (`<area>Steps.ts`) and specs share: how attached requests name their token, a
 * send that attaches its request and response, and the page summaries that keep other visitors' data out of reports.
 */
import { test } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { ApiResponse, QueryBodyOptions } from '../clients/BaseClient';
import type { Paginated } from '../dto/common';
import { attachJson } from '../../utils/assertHelpers';
import { expectLocation, expectStatus, parseJson } from '../../utils/apiChecks';

/** How attached requests and assertion messages name the token a request was sent with, in the scenarios' wording. */
export const AUTH = {
  none: 'none',
  malformed: 'a malformed token',
  admin: "the admin's token",
  defaultUser: "the default user's token",
  throwaway: "the throwaway customer's access_token",
  second: "the second customer's access_token",
  newUser: "the new user's access_token",
  customerA: "customer A's access_token",
  customerB: "customer B's access_token",
} as const;

/** What a send attaches for its response; the default is the status and the body as they came. */
export type DescribeResponse = (response: ApiResponse) => unknown;

const statusAndBody: DescribeResponse = (response) => ({ status: response.status, body: response.body });

/** The status, headers and body of a response, for steps that check a header. */
export const withHeaders: DescribeResponse = (response) => ({ status: response.status, headers: response.headers, body: response.body });

/**
 * Sends a request through `call` and attaches `request` (the record that the step's assertion messages show) as
 * "<name> Request" and the response as "<name> Response" (`describe`, default its status and body). For steps that
 * check the status themselves.
 */
export async function sendAndAttach<Request>(
  name: string,
  request: Request,
  call: () => Promise<ApiResponse>,
  describe: DescribeResponse = statusAndBody
): Promise<{ request: Request; response: ApiResponse }> {
  await attachJson(`${name} Request`, request);
  const response = await call();
  await attachJson(`${name} Response`, describe(response));
  return { request, response };
}

/** The headers a QUERY scenario sends unless it says otherwise: a JSON body and `Accept: application/json`. */
export const JSON_QUERY_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' } as const;

/** The Content-Type and Accept of a QUERY request; without `Accept`, the request leaves the header out. */
export type QueryHeaders = { 'Content-Type': string; Accept?: string };

/** The record a QUERY step attaches and its assertion messages show. */
export type QueryRequestRecord<Body> = { method: 'QUERY'; path: string; auth?: string; headers: QueryHeaders; body: Body | string };

/**
 * Sends a QUERY through `send` (a client's query method) with `headers` (a string body goes as-is with their
 * Content-Type), and attaches the request record and the response with its headers (or `options.describe`'s view,
 * such as a page summary). `options.auth` names the token in the record.
 */
export async function sendQueryAndAttach<Body>(
  name: string,
  path: string,
  body: Body | string,
  headers: QueryHeaders,
  send: (body: Body | string, options: QueryBodyOptions) => Promise<ApiResponse>,
  options: { auth?: string; describe?: DescribeResponse } = {}
): Promise<{ request: QueryRequestRecord<Body>; response: ApiResponse }> {
  const request: QueryRequestRecord<Body> = { method: 'QUERY', path, ...(options.auth !== undefined ? { auth: options.auth } : {}), headers, body };
  return sendAndAttach(name, request, () => send(body, { contentType: headers['Content-Type'], accept: headers.Accept ?? null }), options.describe ?? withHeaders);
}

/**
 * The scenarios' wording of the Location step of the validation redirects, which names the TEST environment's API
 * base URL. The check itself compares with the configured `apiBaseUrl`, so it holds in any environment.
 */
const REDIRECT_LOCATION_STEP = 'Verify the Location header is "https://api.practicesoftwaretesting.com".';

/**
 * The template of the "... without Accept: application/json returns a 302 redirect" scenarios: a failed validation
 * that doesn't ask for JSON is redirected to the API's base URL. Sends with `send` (title `sendStep`; it must not follow
 * redirects), then checks the 302 and that Location is `apiBaseUrl`.
 */
export async function checkValidationRedirect(
  sendStep: string,
  send: () => Promise<{ request: unknown; response: ApiResponse }>,
  apiBaseUrl: string
): Promise<void> {
  let request: unknown;
  let response: ApiResponse;

  await test.step(sendStep, async () => {
    ({ request, response } = await send());
  });

  await test.step('Verify the response status is 302.', async () => {
    expectStatus(request, response, 302);
  });

  await test.step(REDIRECT_LOCATION_STEP, async () => {
    expectLocation(request, response, apiBaseUrl);
  });
}

/**
 * The title of a "Verify the body has a <field> key with at least one message." step, as the validation scenarios
 * word it ("an" before a vowel: "an is_rental key"). For the templates that run a family of such scenarios.
 */
export function fieldMessagesStep(field: string): string {
  return `Verify the body has ${/^[aeiou]/i.test(field) ? 'an' : 'a'} ${field} key with at least one message.`;
}

/**
 * For a create call under test: a record exists only when the response says so, so `remove(id)` is registered in
 * cleanup only for a 2xx response with an id. Covers the known issues that create a record anyway (a POST without a
 * token) and any validation case that unexpectedly creates one.
 */
export function removeIfCreated(response: ApiResponse, cleanup: Cleanup, remove: (id: string) => Promise<unknown>): void {
  if (!response.isSuccess) return;
  let id: unknown;
  try {
    id = (JSON.parse(response.body) as { id?: unknown }).id;
  } catch {
    return;
  }
  if (typeof id === 'string' && id) cleanup.add(() => remove(id));
}

/**
 * A page's pagination fields with each item reduced by `item`. List and search specs attach (and show as `actual`) this
 * instead of the page: an admin's page holds other visitors' names, emails and addresses, and the reports are public.
 */
export function pageSummary<Item>(page: Partial<Paginated<Item>>, item: (value: Item) => unknown): Record<string, unknown> {
  return {
    current_page: page.current_page,
    from: page.from,
    last_page: page.last_page,
    per_page: page.per_page,
    to: page.to,
    total: page.total,
    data: Array.isArray(page.data) ? page.data.map(item) : page.data,
  };
}

/**
 * Describes a page response for `sendAndAttach`: a 2xx page as its `pageSummary`, any other response with its body as
 * it came (error bodies hold no visitor data). `headers` adds the response headers.
 */
export function describePage<Item>(item: (value: Item) => unknown, options: { headers?: boolean } = {}): DescribeResponse {
  return (response) => ({
    status: response.status,
    ...(options.headers ? { headers: response.headers } : {}),
    body: response.isSuccess ? pageSummary(parseJson<Paginated<Item>>(undefined, response), item) : response.body,
  });
}
