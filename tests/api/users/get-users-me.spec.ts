import { test, expect, registerThrowawayCustomer } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { MessageErrorBody, User } from '@api/dto/user';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/get-users-me.yml

type MeRequest = { method: 'GET'; path: '/users/me'; auth: string };

/** Sends GET /users/me with `usersClient` and attaches the request and the response. */
async function sendMe(usersClient: UsersClient, auth: string): Promise<{ request: MeRequest; response: ApiResponse }> {
  const request: MeRequest = { method: 'GET', path: '/users/me', auth };
  const response = await usersClient.me();
  await attachJson('Current User Request', request);
  await attachJson('Current User Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the response status is <status>." step. */
function expectStatus(request: MeRequest, response: ApiResponse, status: number): void {
  expect(response.status, assertMessage({ request, expected: `Status ${status}`, actual: { status: response.status, body: response.body } })).toBe(status);
}

/** The checks of a "Verify the body's message is <message>." step. */
function expectMessage(request: MeRequest, response: ApiResponse, message: string): void {
  const body = JSON.parse(response.body) as MessageErrorBody;
  expect(body.message, assertMessage({ request, expected: `message is "${message}"`, actual: body })).toBe(message);
}

test.describe('@users-api - Users API', () => {
  test("API-0063: Current user endpoint returns the logged-in user's profile", async ({ usersClient, user }) => {
    const request = { method: 'GET', path: '/users/me' };
    let response: ApiResponse;

    await test.step("Send GET /users/me with the default user's token.", async () => {
      response = await usersClient.me();
      await attachJson('Current User Request', request);
      await attachJson('Current User Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step('Verify email equals the default user\'s email, and id, first_name and last_name are not empty.', async () => {
      const profile = JSON.parse(response.body) as User;
      // The email is a secret: compare it as a condition so a failure diff doesn't print it.
      expect(
        profile.email === user.username,
        assertMessage({ request, expected: "Email equals the default user's email", actual: profile.email })
      ).toBe(true);
      for (const field of ['id', 'first_name', 'last_name'] as const) {
        expect(profile[field], assertMessage({ request, expected: `"${field}" is not empty`, actual: profile })).toBeTruthy();
      }
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0100: Current user endpoint returns the admin-only fields to an admin', async ({ usersClient }) => {
      let request: MeRequest;
      let response: ApiResponse;
      let profile: User;

      await test.step("Send GET /users/me with the admin's token.", async () => {
        ({ request, response } = await sendMe(usersClient, "admin's token"));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
        profile = JSON.parse(response.body) as User;
      });

      await test.step('Verify the body\'s role is "admin".', async () => {
        expect(profile.role, assertMessage({ request, expected: 'role is "admin"', actual: profile.role })).toBe('admin');
      });

      await test.step("Verify the body's enabled is a boolean and failed_login_attempts is a number.", async () => {
        const actual = { enabled: profile.enabled, failed_login_attempts: profile.failed_login_attempts };
        expect(typeof profile.enabled, assertMessage({ request, expected: 'enabled is a boolean', actual })).toBe('boolean');
        expect(typeof profile.failed_login_attempts, assertMessage({ request, expected: 'failed_login_attempts is a number', actual })).toBe('number');
      });
    });
  });

  test('API-0101: Current user endpoint hides the admin-only fields from a customer', async ({ usersClient }) => {
    const expectedKeys = ['id', 'provider', 'first_name', 'last_name', 'phone', 'dob', 'email', 'totp_enabled', 'created_at', 'address'];
    const adminOnlyKeys = ['role', 'enabled', 'failed_login_attempts'];
    let request: MeRequest;
    let response: ApiResponse;
    let keys: string[];

    await test.step("Send GET /users/me with the default user's token.", async () => {
      ({ request, response } = await sendMe(usersClient, "default user's token"));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      keys = Object.keys(JSON.parse(response.body) as User);
    });

    await test.step('Verify the body has the keys id, provider, first_name, last_name, phone, dob, email, totp_enabled, created_at and address.', async () => {
      const missing = expectedKeys.filter((key) => !keys.includes(key));
      expect(missing, assertMessage({ request, expected: `The body has the keys ${expectedKeys.join(', ')}`, actual: { missing, keys } })).toEqual([]);
    });

    await test.step('Verify the body has no role, enabled or failed_login_attempts key.', async () => {
      const present = adminOnlyKeys.filter((key) => keys.includes(key));
      expect(present, assertMessage({ request, expected: `The body has none of the keys ${adminOnlyKeys.join(', ')}`, actual: { present, keys } })).toEqual([]);
    });
  });

  test('API-0102: Current user without a token returns 401', async ({ usersClientWithoutToken }) => {
    let request: MeRequest;
    let response: ApiResponse;

    await test.step('Send GET /users/me without an Authorization header.', async () => {
      ({ request, response } = await sendMe(usersClientWithoutToken, 'none'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0103: Current user with a malformed token returns 401', async ({ usersClientWithInvalidToken }) => {
    let request: MeRequest;
    let response: ApiResponse;

    await test.step('Send GET /users/me with a malformed token.', async () => {
      ({ request, response } = await sendMe(usersClientWithInvalidToken, 'a malformed token'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0104: Current user with a disabled account's token returns 403", async ({
      authService,
      usersService,
      adminUsersService,
      usersClientForToken,
      cleanup,
    }) => {
      let customerToken = '';
      let request: MeRequest;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

      await test.step('Send POST /users/login with that email and password, and take its access_token.', async () => {
        const loginRequest = { method: 'POST', path: '/users/login', body: { email: customer.email, password: customer.password } };
        await attachJson('Login Request', loginRequest);
        const login = await authService.login({ email: customer.email, password: customer.password });
        await attachJson('Login Response', login);
        expect(Boolean(login.access_token), assertMessage({ request: loginRequest, expected: 'The login returns an access_token' })).toBe(true);
        customerToken = login.access_token;
      });

      await test.step("Send PATCH /users/{userId} with that id and enabled false, with the admin's token.", async () => {
        // The throwaway's token isn't used before this call, so the API's cached user can't be a stale, enabled one.
        const patchRequest = { method: 'PATCH', path: `/users/${customer.id}`, auth: "admin's token", body: { enabled: false } };
        await attachJson('Patch User Request', patchRequest);
        const result = await adminUsersService.partialUpdate(customer.id, { enabled: false });
        await attachJson('Patch User Response', result);
        expect(result.success, assertMessage({ request: patchRequest, expected: 'success is true', actual: result })).toBe(true);
      });

      await test.step("Send GET /users/me with the throwaway customer's access_token.", async () => {
        ({ request, response } = await sendMe(usersClientForToken(customerToken), "the throwaway customer's access_token"));
      });

      await test.step('Verify the response status is 403.', async () => {
        expectStatus(request, response, 403);
      });

      await test.step('Verify the body\'s message is "Account disabled.".', async () => {
        expectMessage(request, response, 'Account disabled.');
      });
    });
  });
});
