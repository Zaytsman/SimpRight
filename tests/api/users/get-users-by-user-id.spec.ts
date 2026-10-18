import { test, expect, registerThrowawayCustomer, loginThrowawayCustomer, AUTH, sendAndAttach, checkStatusAndMessage, type AuthLabel } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { User } from '@api/dto/user';
import { TestConstants } from '@data/TestConstants';
import { UserFactory } from '@data/factories/UserFactory';
import { expectErrorText, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/get-users-by-user-id.yml

type GetUserRequest = { method: 'GET'; path: string; auth: AuthLabel };

/** Sends GET /users/{userId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendGetUser(client: UsersClient, userId: string, auth: AuthLabel): Promise<{ request: GetUserRequest; response: ApiResponse }> {
  const request: GetUserRequest = { method: 'GET', path: `/users/${userId}`, auth };
  return sendAndAttach('Get User', request, () => client.getById(userId));
}

const REGISTER_A_STEP = 'Send POST /users/register with a unique email, a first name, a last name and a random strong password (customer A).';
const REGISTER_B_STEP = "Send POST /users/register with a unique email, a first name, a last name and a random strong password (customer B), and take B's id.";

test.describe('@users-api - Users API', () => {
  test('API-0420: Get user with the customer\'s own id returns 200 without the admin-only fields', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    const registered = UserFactory.registerCustomer();
    let request: GetUserRequest;
    let response: ApiResponse;
    let user: User;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { body: registered });
    const token = await loginThrowawayCustomer(authService, customer);

    await test.step('Send GET /users/{userId} with that id and access_token.', async () => {
      ({ request, response } = await sendGetUser(usersClientForToken(token), customer.id, AUTH.customer));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      user = parseJson<User>(request, response);
    });

    await test.step("Verify the body's id equals the new user's id, and its email, first_name and last_name equal the registered values.", async () => {
      expect(user.id, assertMessage({ request, expected: `id is the new user's id ${customer.id}`, actual: user.id })).toBe(customer.id);
      expect(user.email === registered.email, assertMessage({ request, expected: 'email is the registered email' })).toBe(true);
      expect(user.first_name, assertMessage({ request, expected: `first_name is the registered "${registered.first_name}"`, actual: user })).toBe(registered.first_name);
      expect(user.last_name, assertMessage({ request, expected: `last_name is the registered "${registered.last_name}"`, actual: user })).toBe(registered.last_name);
    });

    await test.step('Verify the body has no role, enabled or failed_login_attempts key.', async () => {
      for (const key of ['role', 'enabled', 'failed_login_attempts']) {
        expect(key in user, assertMessage({ request, expected: `The body has no "${key}" key`, actual: Object.keys(user) })).toBe(false);
      }
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0421: Get user as an admin returns 200 with the admin-only fields', async ({ usersService, adminUsersService, usersClientWithToken, cleanup }) => {
      let request: GetUserRequest;
      let response: ApiResponse;
      let user: User;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

      await test.step("Send GET /users/{userId} with that id and the admin's token.", async () => {
        ({ request, response } = await sendGetUser(usersClientWithToken, customer.id, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
        user = parseJson<User>(request, response);
      });

      await test.step('Verify the body\'s id equals the new user\'s id and its role is "user".', async () => {
        expect(user.id, assertMessage({ request, expected: `id is the new user's id ${customer.id}`, actual: user.id })).toBe(customer.id);
        expect(user.role, assertMessage({ request, expected: 'role is "user"', actual: user })).toBe('user');
      });

      await test.step("Verify the body's enabled is a boolean and failed_login_attempts is a number.", async () => {
        expect(typeof user.enabled, assertMessage({ request, expected: 'enabled is a boolean', actual: user })).toBe('boolean');
        expect(typeof user.failed_login_attempts, assertMessage({ request, expected: 'failed_login_attempts is a number', actual: user })).toBe('number');
      });
    });

    test('API-0423: Get user with an unknown id returns 404', async ({ usersClientWithToken }) => {
      let request: GetUserRequest;
      let response: ApiResponse;

      await test.step("Send GET /users/{userId} with a well-formed ULID that no user has and the admin's token.", async () => {
        ({ request, response } = await sendGetUser(usersClientWithToken, TestConstants.users.unknownId, AUTH.admin));
      });

      await test.step('Verify the response status is 404.', async () => {
        expectStatus(request, response, 404);
      });

      await test.step("Verify the body's error is a non-empty string.", async () => {
        expectErrorText(request, response);
      });
    });
  });

  test('API-0422: Get user without a token returns 401', async ({ usersClient }) => {
    await checkStatusAndMessage(
      'Send GET /users/{userId} with a well-formed ULID that no user has, without an Authorization header.',
      () => sendGetUser(usersClient, TestConstants.users.unknownId, AUTH.none),
      401,
      'Unauthorized'
    );
  });

  test('API-0424: Get user with another customer\'s id returns 404', async ({ usersService, adminUsersService, authService, usersClientForToken, cleanup }) => {
    let request: GetUserRequest;
    let response: ApiResponse;

    const customerA = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { title: REGISTER_A_STEP });
    const customerB = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { title: REGISTER_B_STEP });
    const tokenA = await loginThrowawayCustomer(authService, customerA, "Send POST /users/login with customer A's email and password, and take its access_token.");

    await test.step("Send GET /users/{userId} with customer B's id and customer A's access_token.", async () => {
      ({ request, response } = await sendGetUser(usersClientForToken(tokenA), customerB.id, AUTH.customerA));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step("Verify the body's error is a non-empty string.", async () => {
      expectErrorText(request, response);
    });
  });
});
