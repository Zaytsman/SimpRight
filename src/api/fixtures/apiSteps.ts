/**
 * Building blocks the area step helpers (`<area>Steps.ts`) and specs share: how attached requests name their token, a
 * send that attaches its request and response, and the page summaries that keep other visitors' data out of reports.
 */
import type { ApiResponse } from '../clients/BaseClient';
import type { Paginated } from '../dto/common';
import { attachJson } from '../../utils/assertHelpers';
import { parseJson } from '../../utils/apiChecks';

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
