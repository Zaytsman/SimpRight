import { test, expect, attachUserPageResponse, expectAllCustomers, expectCurrentPages, expectNoSharedIds, expectStatusHidingBody, expectUserPageKeys, userPageSummary, AUTH } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { UsersService } from '@api/services/UsersService';
import type { Paginated } from '@api/dto/common';
import type { User } from '@api/dto/user';
import { expectMessage, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/get-users.yml

type ListUsersRequest = { method: 'GET'; path: '/users'; query?: string; auth: string };

/**
 * Sends GET /users and attaches the request and the response (a page as its summary: other visitors' details stay out
 * of the public reports). Returns the parsed page for a 2xx.
 */
async function sendListUsers(
  client: UsersClient,
  auth: string,
  page?: number
): Promise<{ request: ListUsersRequest; response: ApiResponse; body?: Paginated<User> }> {
  const request: ListUsersRequest = { method: 'GET', path: '/users', ...(page === undefined ? {} : { query: `page=${page}` }), auth };
  const response = await client.list(page);
  await attachJson('List Users Request', request);
  const body = await attachUserPageResponse('List Users Response', response);
  return { request, response, body };
}

/** Gets a page of GET /users as admin through the service (a happy path) and attaches the request and the page's summary. */
async function listPage(adminUsersService: UsersService, page: number): Promise<Paginated<User>> {
  const body = await adminUsersService.list(page);
  await attachJson('List Users Request', { method: 'GET', path: '/users', query: `page=${page}`, auth: AUTH.admin });
  await attachJson('List Users Response', userPageSummary(body));
  return body;
}

test.describe('@users-api - Users API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0402: List users as an admin returns 200 with a page of customers', { tag: '@smoke' }, async ({ usersClientWithToken }) => {
      let request: ListUsersRequest;
      let response: ApiResponse;
      let page: Paginated<User>;

      await test.step("Send GET /users with the admin's token.", async () => {
        ({ request, response } = await sendListUsers(usersClientWithToken, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
        page = parseJson<Paginated<User>>(request, response);
      });

      await test.step('Verify the body has the keys current_page, data, from, last_page, per_page, to and total, and its per_page is 15.', async () => {
        expectUserPageKeys(request, page);
        expect(page.per_page, assertMessage({ request, expected: 'per_page is 15', actual: userPageSummary(page) })).toBe(15);
      });

      await test.step('Verify data has 1 to 15 items and every item\'s role is "user".', async () => {
        expect(
          Array.isArray(page.data) && page.data.length >= 1 && page.data.length <= 15,
          assertMessage({ request, expected: 'data is an array of 1 to 15 items', actual: userPageSummary(page) })
        ).toBe(true);
        expectAllCustomers(request, page);
      });
    });

    test('API-0403: List users with page 2 returns the second page', async ({ adminUsersService }) => {
      let firstPage: Paginated<User>;
      let secondPage: Paginated<User>;

      await test.step("Send GET /users with page 1 and the admin's token.", async () => {
        firstPage = await listPage(adminUsersService, 1);
      });

      await test.step("Send GET /users with page 2 and the admin's token.", async () => {
        secondPage = await listPage(adminUsersService, 2);
      });

      const request = { method: 'GET', path: '/users', query: ['page=1', 'page=2'], auth: AUTH.admin };

      await test.step("Verify the first response's current_page is 1 and the second response's current_page is 2.", async () => {
        expectCurrentPages(request, firstPage, secondPage);
      });

      await test.step("Verify no id appears in both pages' data.", async () => {
        expectNoSharedIds(request, firstPage, secondPage);
      });
    });
  });

  test('API-0404: List users without a token returns 401', async ({ usersClient }) => {
    let request: ListUsersRequest;
    let response: ApiResponse;

    await test.step('Send GET /users without an Authorization header.', async () => {
      ({ request, response } = await sendListUsers(usersClient, 'none'));
    });

    // A 200 here would list other customers: the failure message shows only the status.
    await test.step('Verify the response status is 401.', async () => {
      expectStatusHidingBody(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0405: List users as a customer returns 403', async ({ usersClientWithToken }) => {
    let request: ListUsersRequest;
    let response: ApiResponse;

    await test.step("Send GET /users with the default user's token.", async () => {
      ({ request, response } = await sendListUsers(usersClientWithToken, AUTH.defaultUser));
    });

    await test.step('Verify the response status is 403.', async () => {
      expectStatusHidingBody(request, response, 403);
    });

    await test.step('Verify the body\'s message is "Forbidden".', async () => {
      expectMessage(request, response, 'Forbidden');
    });
  });
});
