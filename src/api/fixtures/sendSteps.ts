/**
 * Send helpers the step helpers and specs share: a send that attaches its request and response, the template of the
 * one-request status-and-message scenarios, and the cleanup of a record a call under test created. The project's own
 * (its token labels, request shapes and templates) are in `apiSteps.ts`, which re-exports these.
 */
import { test } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { ApiResponse } from '../clients/BaseClient';
import { attachJson } from '../../utils/assertHelpers';
import { expectMessage, expectStatus } from '../../utils/httpChecks';

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
 * The template of the scenarios that send one request and check only the status and the body's message, such as the
 * access checks every protected endpoint has (without a token or with a malformed one 401 "Unauthorized", with a
 * customer's token 403 "Forbidden") and the QUERY 415s: the send (title `sendStep`, through `send`), then the two checks.
 */
export async function checkStatusAndMessage(
  sendStep: string,
  send: () => Promise<{ request: unknown; response: ApiResponse }>,
  status: number,
  message: string
): Promise<void> {
  let request: unknown;
  let response: ApiResponse;

  await test.step(sendStep, async () => {
    ({ request, response } = await send());
  });

  await test.step(`Verify the response status is ${status}.`, async () => {
    expectStatus(request, response, status);
  });

  await test.step(`Verify the body's message is "${message}".`, async () => {
    expectMessage(request, response, message);
  });
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
