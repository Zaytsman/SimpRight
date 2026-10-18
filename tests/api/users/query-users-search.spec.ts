import { test, expect, registerThrowawayCustomer, expectOnlyUser, expectStatusHidingBody, userPageSummary, AUTH, JSON_QUERY_HEADERS, sendQueryAndAttach, type QueryHeaders, type QueryRequestRecord, describeUserPage, type AuthLabel } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { Paginated } from '@api/dto/common';
import type { User, UserSearchQueryBody } from '@api/dto/user';
import { UserFactory } from '@data/factories/UserFactory';
import { expectAcceptQuery, expectMessage, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/query-users-search.yml

type QuerySearchRequest = QueryRequestRecord<UserSearchQueryBody>;

/**
 * Sends QUERY /users/search and attaches the request and the response (a page as its summary: other visitors' details
 * stay out of the public reports). A string body is sent as-is with the given Content-Type.
 */
async function sendQuerySearch(
  client: UsersClient,
  auth: AuthLabel,
  body: UserSearchQueryBody | string,
  headers: QueryHeaders = JSON_QUERY_HEADERS
): Promise<{ request: QuerySearchRequest; response: ApiResponse }> {
  return sendQueryAndAttach('Query Search', '/users/search', body, headers, (sent, options) => client.querySearch(sent, options), { auth, describe: describeUserPage });
}

test.describe('@users-api - Users API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0415: QUERY search by first name returns 200 with the matching customer', async ({ usersService, adminUsersService, usersClientWithToken, cleanup }) => {
      const registered = UserFactory.registerCustomer({ first_name: UserFactory.uniqueFirstName() });
      let request: QuerySearchRequest;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, {
        title:
          "Send POST /users/register with a unique email, a unique first name of at most 40 characters, a last name and a random strong password, and take the new user's id.",
        body: registered,
      });

      await test.step(
        'Send QUERY /users/search with the admin\'s token, Content-Type: application/json, Accept: application/json and the body { "q": <that first name> }.',
        async () => {
          ({ request, response } = await sendQuerySearch(usersClientWithToken, AUTH.admin, { q: registered.first_name }));
        }
      );

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify the Accept-Query response header is application/json.', async () => {
        expectAcceptQuery(request, response);
      });

      await test.step("Verify the body's total is 1 and data has exactly one item, whose id is the new user's id.", async () => {
        expectOnlyUser(request, parseJson<Paginated<User>>(request, response), customer.id);
      });
    });

    test('API-0416: QUERY search with an empty body object returns 200 with customers', async ({ usersClientWithToken }) => {
      let request: QuerySearchRequest;
      let response: ApiResponse;
      let page: Paginated<User>;

      await test.step(
        "Send QUERY /users/search with the admin's token, Content-Type: application/json, Accept: application/json and an empty JSON object as the body.",
        async () => {
          ({ request, response } = await sendQuerySearch(usersClientWithToken, AUTH.admin, {}));
        }
      );

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
        page = parseJson<Paginated<User>>(request, response);
      });

      await test.step("Verify the body's per_page is 15 and data is not empty.", async () => {
        expect(page.per_page, assertMessage({ request, expected: 'per_page is 15', actual: userPageSummary(page) })).toBe(15);
        expect(Array.isArray(page.data) && page.data.length > 0, assertMessage({ request, expected: 'data is not empty', actual: userPageSummary(page) })).toBe(true);
      });
    });
  });

  test('API-0417: QUERY search without a token returns 401', async ({ usersClient }) => {
    let request: QuerySearchRequest;
    let response: ApiResponse;

    await test.step(
      'Send QUERY /users/search without an Authorization header, with Content-Type: application/json, Accept: application/json and an empty JSON object as the body.',
      async () => {
        ({ request, response } = await sendQuerySearch(usersClient, AUTH.none, {}));
      }
    );

    // A 200 here would list other customers: the failure message shows only the status.
    await test.step('Verify the response status is 401.', async () => {
      expectStatusHidingBody(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0418: QUERY search without a JSON Content-Type returns 415', async ({ usersClientWithToken }) => {
    let request: QuerySearchRequest;
    let response: ApiResponse;

    await test.step("Send QUERY /users/search with the default user's token, Content-Type: text/plain, Accept: application/json and a plain-text body.", async () => {
      ({ request, response } = await sendQuerySearch(usersClientWithToken, AUTH.defaultUser, 'q=a', { 'Content-Type': 'text/plain', Accept: 'application/json' }));
    });

    await test.step('Verify the response status is 415.', async () => {
      expectStatusHidingBody(request, response, 415);
    });
  });

  test('API-0419: QUERY search as a customer returns 403', async ({ usersClientWithToken }) => {
    test.fail(true, "Known issue BUG-032: Returns 200 with other customers' names, emails and cities instead of rejecting a customer (403, like GET /users).");
    let request: QuerySearchRequest;
    let response: ApiResponse;

    await test.step(
      'Send QUERY /users/search with the default user\'s token, Content-Type: application/json, Accept: application/json and the body { "q": "a" }.',
      async () => {
        ({ request, response } = await sendQuerySearch(usersClientWithToken, AUTH.defaultUser, { q: 'a' }));
      }
    );

    // The bug returns other customers' details: the failure message shows only the status.
    await test.step('Verify the response status is 403.', async () => {
      expectStatusHidingBody(request, response, 403);
    });
  });
});
