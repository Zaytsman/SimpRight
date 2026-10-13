import {
  test,
  expect,
  registerThrowawayCustomer,
  attachUserPageResponse,
  expectAllCustomers,
  expectCurrentPages,
  expectNoSharedIds,
  expectOnlyUser,
  expectStatusHidingBody,
  expectUserPageKeys,
  userPageSummary,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import { userSearchQuery, type UsersClient } from '@api/clients/UsersClient';
import type { UsersService } from '@api/services/UsersService';
import type { Paginated } from '@api/dto/common';
import type { User } from '@api/dto/user';
import { UserFactory } from '@data/factories/UserFactory';
import { uniqueName } from '@data/factories/testDataUtils';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/get-users-search.yml

type SearchUsersRequest = { method: 'GET'; path: '/users/search'; query?: string; auth: string };

/**
 * Sends GET /users/search and attaches the request and the response (a page as its summary: other visitors' details
 * stay out of the public reports). Returns the parsed page for a 2xx.
 */
async function sendSearch(
  usersClient: UsersClient,
  auth: string,
  params: { q?: string; page?: number } = {}
): Promise<{ request: SearchUsersRequest; response: ApiResponse; body?: Paginated<User> }> {
  const query = userSearchQuery(params.q, params.page);
  const request: SearchUsersRequest = { method: 'GET', path: '/users/search', ...(query === undefined ? {} : { query }), auth };
  const response = await usersClient.search(params.q, params.page);
  await attachJson('Search Users Request', request);
  const body = await attachUserPageResponse('Search Users Response', response);
  return { request, response, body };
}

const ADMIN = "admin's token";

/** Gets a page of GET /users/search (no q) as admin through the service (a happy path) and attaches the request and the page's summary. */
async function searchPage(adminUsersService: UsersService, page: number): Promise<Paginated<User>> {
  const body = await adminUsersService.search(undefined, page);
  await attachJson('Search Users Request', { method: 'GET', path: '/users/search', query: userSearchQuery(undefined, page), auth: ADMIN });
  await attachJson('Search Users Response', userPageSummary(body));
  return body;
}

// A trace records full response bodies, and these pages hold other visitors' names, emails and cities.
test.use({ trace: 'off' });

test.describe('@users-api - Users API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0406: Search users by first name returns 200 with the matching customer', async ({ usersService, adminUsersService, usersClient, cleanup }) => {
      const registered = UserFactory.registerCustomer({ first_name: UserFactory.uniqueFirstName() });
      let request: SearchUsersRequest;
      let response: ApiResponse;
      let page: Paginated<User>;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, {
        title:
          "Send POST /users/register with a unique email, a unique first name of at most 40 characters, a last name and a random strong password, and take the new user's id.",
        body: registered,
      });

      await test.step("Send GET /users/search with q set to that first name and the admin's token.", async () => {
        ({ request, response } = await sendSearch(usersClient, ADMIN, { q: registered.first_name }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
        page = JSON.parse(response.body) as Paginated<User>;
      });

      await test.step('Verify the body has the keys current_page, data, from, last_page, per_page, to and total.', async () => {
        expectUserPageKeys(request, page);
      });

      await test.step(
        "Verify the body's total is 1 and data has exactly one item, whose id is the new user's id and whose first_name and email equal the registered values.",
        async () => {
          const user = expectOnlyUser(request, page, customer.id);
          expect(user.first_name, assertMessage({ request, expected: `first_name is the registered "${registered.first_name}"`, actual: user.first_name })).toBe(
            registered.first_name
          );
          expect(user.email === registered.email, assertMessage({ request, expected: 'email is the registered email' })).toBe(true);
        }
      );
    });

    test('API-0407: Search users by email returns 200 with the matching customer', async ({ usersService, adminUsersService, usersClient, cleanup }) => {
      let request: SearchUsersRequest;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

      await test.step("Send GET /users/search with q set to the registered email and the admin's token.", async () => {
        ({ request, response } = await sendSearch(usersClient, ADMIN, { q: customer.email }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's total is 1 and data has exactly one item, whose id is the new user's id.", async () => {
        expectOnlyUser(request, JSON.parse(response.body) as Paginated<User>, customer.id);
      });
    });

    test('API-0408: Search users by last name returns 200 with the matching customer', async ({ usersService, adminUsersService, usersClient, cleanup }) => {
      const registered = UserFactory.registerCustomer({ last_name: UserFactory.uniqueLastName() });
      let request: SearchUsersRequest;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, {
        title:
          "Send POST /users/register with a unique email, a first name, a unique last name of at most 20 characters and a random strong password, and take the new user's id.",
        body: registered,
      });

      await test.step("Send GET /users/search with q set to that last name and the admin's token.", async () => {
        ({ request, response } = await sendSearch(usersClient, ADMIN, { q: registered.last_name }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's total is 1 and data has exactly one item, whose id is the new user's id.", async () => {
        expectOnlyUser(request, JSON.parse(response.body) as Paginated<User>, customer.id);
      });
    });

    test('API-0409: Search users by city returns 200 with the matching customer', async ({ usersService, adminUsersService, usersClient, cleanup }) => {
      const city = UserFactory.uniqueCity();
      let request: SearchUsersRequest;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, {
        title:
          "Send POST /users/register with a unique email, a first name, a last name, a random strong password and an address with only a unique city of at most 40 characters, and take the new user's id.",
        body: UserFactory.registerCustomer({ address: { city } }),
      });

      await test.step("Send GET /users/search with q set to that city and the admin's token.", async () => {
        ({ request, response } = await sendSearch(usersClient, ADMIN, { q: city }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's total is 1 and data has exactly one item, whose id is the new user's id.", async () => {
        expectOnlyUser(request, JSON.parse(response.body) as Paginated<User>, customer.id);
      });
    });

    test('API-0410: Search users with a term nobody matches returns 200 with an empty list', async ({ usersClient }) => {
      const term = uniqueName('NoSuchUser');
      let request: SearchUsersRequest;
      let response: ApiResponse;
      let page: Paginated<User>;

      await test.step("Send GET /users/search with q set to a unique string no customer has and the admin's token.", async () => {
        ({ request, response } = await sendSearch(usersClient, ADMIN, { q: term }));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
        page = JSON.parse(response.body) as Paginated<User>;
      });

      await test.step("Verify the body's total is 0.", async () => {
        expect(page.total, assertMessage({ request, expected: 'total is 0', actual: userPageSummary(page) })).toBe(0);
      });

      await test.step("Verify the body's data is an empty array.", async () => {
        expect(Array.isArray(page.data) && page.data.length === 0, assertMessage({ request, expected: 'data is an empty array', actual: userPageSummary(page) })).toBe(
          true
        );
      });
    });

    test('API-0411: Search users without q returns 200 with customers', async ({ usersClient }) => {
      let request: SearchUsersRequest;
      let response: ApiResponse;
      let page: Paginated<User>;

      await test.step("Send GET /users/search without q and with the admin's token.", async () => {
        ({ request, response } = await sendSearch(usersClient, ADMIN));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
        page = JSON.parse(response.body) as Paginated<User>;
      });

      await test.step("Verify the body's per_page is 15 and data is not empty.", async () => {
        expect(page.per_page, assertMessage({ request, expected: 'per_page is 15', actual: userPageSummary(page) })).toBe(15);
        expect(Array.isArray(page.data) && page.data.length > 0, assertMessage({ request, expected: 'data is not empty', actual: userPageSummary(page) })).toBe(true);
      });

      await test.step('Verify every item\'s role is "user".', async () => {
        expectAllCustomers(request, page);
      });
    });

    test('API-0412: Search users with page 2 returns the second page', async ({ adminUsersService }) => {
      let firstPage: Paginated<User>;
      let secondPage: Paginated<User>;

      await test.step("Send GET /users/search with page 1 and the admin's token.", async () => {
        firstPage = await searchPage(adminUsersService, 1);
      });

      await test.step("Send GET /users/search with page 2 and the admin's token.", async () => {
        secondPage = await searchPage(adminUsersService, 2);
      });

      const request = { method: 'GET', path: '/users/search', query: ['page=1', 'page=2'], auth: ADMIN };

      await test.step("Verify the first response's current_page is 1 and the second response's current_page is 2.", async () => {
        expectCurrentPages(request, firstPage, secondPage);
      });

      await test.step("Verify no id appears in both pages' data.", async () => {
        expectNoSharedIds(request, firstPage, secondPage);
      });
    });
  });

  test('API-0413: Search users without a token returns 401', async ({ usersClientWithoutToken }) => {
    let request: SearchUsersRequest;
    let response: ApiResponse;

    await test.step('Send GET /users/search with q set to a letter, without an Authorization header.', async () => {
      ({ request, response } = await sendSearch(usersClientWithoutToken, 'none', { q: 'a' }));
    });

    // A 200 here would list other customers: the failure message shows only the status.
    await test.step('Verify the response status is 401.', async () => {
      expectStatusHidingBody(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0414: Search users as a customer returns 403', async ({ usersClient }) => {
    test.fail(true, "Known issue BUG-032: Returns 200 with other customers' names, emails and cities instead of rejecting a customer (403, like GET /users).");
    let request: SearchUsersRequest;
    let response: ApiResponse;

    await test.step("Send GET /users/search with q set to a letter and the default user's token.", async () => {
      ({ request, response } = await sendSearch(usersClient, "default user's token", { q: 'a' }));
    });

    // The bug returns other customers' details: the failure message shows only the status.
    await test.step('Verify the response status is 403.', async () => {
      expectStatusHidingBody(request, response, 403);
    });
  });
});
