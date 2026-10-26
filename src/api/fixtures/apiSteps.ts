/**
 * Building blocks the area step helpers (`<area>Steps.ts`) and specs share: the core's send helpers (`sendSteps.ts`:
 * `sendAndAttach`, `checkStatusAndMessage`, `removeIfCreated`), re-exported here, plus the Toolshop's own: how attached
 * requests name their token, the QUERY sends, the validation templates, and the page summaries that keep other
 * visitors' data out of reports.
 */
import { test } from '@playwright/test';
import type { ApiResponse, QueryBodyOptions } from '../clients/BaseClient';
import type { Paginated } from '../dto/common';
import { expectFieldMessages, expectLocation, expectStatus, parseJson } from '../../utils/apiChecks';
import { sendAndAttach, withHeaders, type DescribeResponse } from './sendSteps';

export * from './sendSteps';

/** How attached requests and assertion messages name the token a request was sent with, in the scenarios' wording. */
export const AUTH = {
  none: 'none',
  malformed: 'a malformed token',
  admin: "the admin's token",
  defaultUser: "the default user's token",
  throwaway: "the throwaway customer's access_token",
  customer: "the customer's access_token",
  second: "the second customer's access_token",
  newUser: "the new user's access_token",
  customerA: "customer A's access_token",
  customerB: "customer B's access_token",
  // The login, logout and refresh scenarios name their token by its state.
  newLogin: 'the new access_token',
  loggedOut: 'the logged-out access_token',
  refreshed: 'the refreshed access_token',
  replacedByRefresh: 'the old (already refreshed) access_token',
  restricted: 'the restricted access_token',
} as const;

/** A token label: one of `AUTH`'s. Request records and send helpers take this type, so a label of a spec's own fails the typecheck. */
export type AuthLabel = (typeof AUTH)[keyof typeof AUTH];

/** The headers a QUERY scenario sends unless it says otherwise: a JSON body and `Accept: application/json`. */
export const JSON_QUERY_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' } as const;

/** The Content-Type and Accept of a QUERY request; without `Accept`, the request leaves the header out. */
export type QueryHeaders = { 'Content-Type': string; Accept?: string };

/** The record a QUERY step attaches and its assertion messages show. */
export type QueryRequestRecord<Body> = { method: 'QUERY'; path: string; auth?: AuthLabel; headers: QueryHeaders; body: Body | string };

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
  options: { auth?: AuthLabel; describe?: DescribeResponse } = {}
): Promise<{ request: QueryRequestRecord<Body>; response: ApiResponse }> {
  const request: QueryRequestRecord<Body> = { method: 'QUERY', path, ...(options.auth !== undefined ? { auth: options.auth } : {}), headers, body };
  return sendAndAttach(name, request, () => send(body, { contentType: headers['Content-Type'], accept: headers.Accept ?? null }), options.describe ?? withHeaders);
}

/**
 * The template of the validation scenarios that send one invalid body and check one field's error: the send (title
 * `sendStep`, through `send`, usually the spec's own send helper), then the 422 and `field`'s messages (the form-request
 * body without a wrapper). Setup the scenario has before the send (a record to update, the known-issue line) stays in
 * the test, before the call.
 */
export async function checkRejectedBody(
  sendStep: string,
  send: () => Promise<{ request: unknown; response: ApiResponse }>,
  field: string
): Promise<void> {
  let request: unknown;
  let response: ApiResponse;

  await test.step(sendStep, async () => {
    ({ request, response } = await send());
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(fieldMessagesStep(field), async () => {
    expectFieldMessages(request, response, field);
  });
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
