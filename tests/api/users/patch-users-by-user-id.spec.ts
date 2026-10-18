import { test, expect, registerThrowawayCustomer, loginThrowawayCustomer, expectFieldMessages } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { PatchUserRequest, User } from '@api/dto/user';
import type { UsersService } from '@api/services/UsersService';
import { TestConstants } from '@data/TestConstants';
import { UserFactory } from '@data/factories/UserFactory';
import { expectErrorText, expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/patch-users-by-user-id.yml

type PatchRequestInfo = { method: 'PATCH'; path: string; auth: string; body: unknown };

/** A new first or last name (at most 20 characters), different from UserFactory's "SimpRight" and "Runner". */
const NEW_NAME = 'Patched';

const REGISTER_A_STEP = 'Send POST /users/register with a unique email, a first name, a last name and a random strong password (customer A).';
const LOGIN_A_STEP = "Send POST /users/login with customer A's email and password, and take its access_token.";

/** Sends PATCH /users/{userId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendPatch(
  usersClient: UsersClient,
  userId: string,
  body: PatchUserRequest | Record<string, unknown>,
  auth: string
): Promise<{ request: PatchRequestInfo; response: ApiResponse }> {
  const request: PatchRequestInfo = { method: 'PATCH', path: `/users/${userId}`, auth, body };
  const response = await usersClient.partialUpdate(userId, body);
  await attachJson('Patch User Request', request);
  await attachJson('Patch User Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The read-back of a Verify step: GET /users/me with the client's token must return 200; returns the profile. */
async function readMe(usersClient: UsersClient, auth: string): Promise<{ request: unknown; user: User }> {
  const request = { method: 'GET', path: '/users/me', auth };
  const response = await usersClient.me();
  await attachJson('Current User Request', request);
  await attachJson('Current User Response', { status: response.status, body: response.body });
  expectStatus(request, response, 200);
  return { request, user: JSON.parse(response.body) as User };
}

/** The read-back of a Verify step: GET /users/{userId} with the admin's token (a setup-style read: fails on a non-2xx). */
async function readAsAdmin(adminUsersService: UsersService, userId: string): Promise<{ request: unknown; user: User }> {
  const request = { method: 'GET', path: `/users/${userId}`, auth: "admin's token" };
  await attachJson('Get User Request', request);
  const user = await adminUsersService.getById(userId);
  await attachJson('Get User Response', user);
  return { request, user };
}

test.describe('@users-api - Users API', () => {
  test("API-0425: Patch user with the customer's own id and a new first_name returns 200 and changes only that field", async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    const registered = UserFactory.registerCustomer();
    let request: PatchRequestInfo;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { body: registered });
    const token = await loginThrowawayCustomer(authService, customer);

    await test.step('Send PATCH /users/{userId} with that id and access_token and only first_name set to a new value.', async () => {
      ({ request, response } = await sendPatch(usersClientForToken(token), customer.id, { first_name: NEW_NAME }, "the customer's access_token"));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step('Verify GET /users/me with that access_token returns the new first_name and the registered last_name and email.', async () => {
      const { request: meRequest, user } = await readMe(usersClientForToken(token), 'that access_token');
      expect(user.first_name, assertMessage({ request: meRequest, expected: `first_name is the new "${NEW_NAME}"`, actual: user })).toBe(NEW_NAME);
      expect(user.last_name, assertMessage({ request: meRequest, expected: `last_name is the registered "${registered.last_name}"`, actual: user })).toBe(
        registered.last_name
      );
      expect(user.email === registered.email, assertMessage({ request: meRequest, expected: 'email is the registered email' })).toBe(true);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0426: Patch user as an admin changes another user's last_name", async ({ usersService, adminUsersService, usersClient, cleanup }) => {
      const registered = UserFactory.registerCustomer();
      let request: PatchRequestInfo;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { body: registered });

      await test.step(
        "Send PATCH /users/{userId} with the new user's id, the admin's token and only last_name set to a new value of at most 20 characters.",
        async () => {
          ({ request, response } = await sendPatch(usersClient, customer.id, { last_name: NEW_NAME }, "admin's token"));
        }
      );

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      await test.step(
        "Verify GET /users/{userId} with the new user's id and the admin's token returns the new last_name and the registered first_name.",
        async () => {
          const { request: getRequest, user } = await readAsAdmin(adminUsersService, customer.id);
          expect(user.last_name, assertMessage({ request: getRequest, expected: `last_name is the new "${NEW_NAME}"`, actual: user })).toBe(NEW_NAME);
          expect(user.first_name, assertMessage({ request: getRequest, expected: `first_name is the registered "${registered.first_name}"`, actual: user })).toBe(
            registered.first_name
          );
        }
      );
    });

    test('API-0427: Patch user as an admin with enabled false disables the account', async ({ usersService, adminUsersService, usersClient, cleanup }) => {
      let request: PatchRequestInfo;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

      await test.step("Send PATCH /users/{userId} with the new user's id, the admin's token and enabled false.", async () => {
        ({ request, response } = await sendPatch(usersClient, customer.id, { enabled: false }, "admin's token"));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      await test.step("Verify GET /users/{userId} with the new user's id and the admin's token returns enabled false.", async () => {
        const { request: getRequest, user } = await readAsAdmin(adminUsersService, customer.id);
        expect(user.enabled, assertMessage({ request: getRequest, expected: 'enabled is false', actual: user })).toBe(false);
      });
    });

    test('API-0428: Patch user as an admin with a role key drops the role silently', async ({ usersService, adminUsersService, usersClient, cleanup }) => {
      let request: PatchRequestInfo;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

      await test.step('Send PATCH /users/{userId} with the new user\'s id, the admin\'s token and role "admin".', async () => {
        ({ request, response } = await sendPatch(usersClient, customer.id, { role: 'admin' }, "admin's token"));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify GET /users/{userId} with the new user\'s id and the admin\'s token returns role "user".', async () => {
        const { request: getRequest, user } = await readAsAdmin(adminUsersService, customer.id);
        expect(user.role, assertMessage({ request: getRequest, expected: 'role is "user"', actual: user })).toBe('user');
      });
    });

    test("API-0433: Patch user with the customer's own failed_login_attempts leaves the value unchanged", async ({
      usersService,
      adminUsersService,
      authService,
      usersClientForToken,
      cleanup,
    }) => {
      let before: number | undefined;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
      const token = await loginThrowawayCustomer(authService, customer);
      test.fail(
        true,
        'Known issue BUG-033: A customer can change their own failed_login_attempts (and enabled and the totp_* fields) with PATCH; the value is saved instead of being rejected or ignored.'
      );

      await test.step("Send GET /users/{userId} with the new user's id and the admin's token, and take failed_login_attempts.", async () => {
        const { user } = await readAsAdmin(adminUsersService, customer.id);
        before = user.failed_login_attempts;
        expect(typeof before, assertMessage({ request: { method: 'GET', path: `/users/${customer.id}` }, expected: 'failed_login_attempts is a number', actual: user })).toBe(
          'number'
        );
      });

      // No step checks this call's status: it is sent and attached; the next step reads the result.
      await test.step("Send PATCH /users/{userId} with that id, the customer's access_token and failed_login_attempts 2.", async () => {
        await sendPatch(usersClientForToken(token), customer.id, { failed_login_attempts: 2 }, "the customer's access_token");
      });

      await test.step(
        "Verify GET /users/{userId} with the new user's id and the admin's token returns the same failed_login_attempts as before the patch.",
        async () => {
          const { request: getRequest, user } = await readAsAdmin(adminUsersService, customer.id);
          expect(user.failed_login_attempts, assertMessage({ request: getRequest, expected: `failed_login_attempts is still ${before}`, actual: user })).toBe(before);
        }
      );
    });

    test('API-0434: Patch user with an unknown id as an admin returns 404', async ({ usersClient }) => {
      test.fail(true, 'Known issue BUG-034: Returns 403 instead of 404 for an unknown user id.');
      let request: PatchRequestInfo;
      let response: ApiResponse;

      await test.step("Send PATCH /users/{userId} with a well-formed ULID that no user has, first_name set to a new value and the admin's token.", async () => {
        ({ request, response } = await sendPatch(usersClient, TestConstants.users.unknownId, { first_name: NEW_NAME }, "admin's token"));
      });

      await test.step('Verify the response status is 404.', async () => {
        expectStatus(request, response, 404);
      });
    });
  });

  test('API-0429: Patch user without a token returns 401', async ({ usersClientWithoutToken }) => {
    let request: PatchRequestInfo;
    let response: ApiResponse;

    await test.step('Send PATCH /users/{userId} with a well-formed ULID that no user has and first_name set to a new value, without an Authorization header.', async () => {
      ({ request, response } = await sendPatch(usersClientWithoutToken, TestConstants.users.unknownId, { first_name: NEW_NAME }, 'none'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test("API-0430: Patch user with another customer's id returns 403 and leaves that customer unchanged", async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    const registeredB = UserFactory.registerCustomer();
    let request: PatchRequestInfo;
    let response: ApiResponse;

    const customerA = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { title: REGISTER_A_STEP });
    const customerB = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, {
      title: "Send POST /users/register with a unique email, a first name, a last name and a random strong password (customer B), and take B's id.",
      body: registeredB,
    });
    const tokenA = await loginThrowawayCustomer(authService, customerA, LOGIN_A_STEP);

    await test.step("Send PATCH /users/{userId} with customer B's id, customer A's access_token and first_name set to a new value.", async () => {
      ({ request, response } = await sendPatch(usersClientForToken(tokenA), customerB.id, { first_name: NEW_NAME }, "customer A's access_token"));
    });

    await test.step('Verify the response status is 403.', async () => {
      expectStatus(request, response, 403);
    });

    await test.step("Verify the body's error is a non-empty string.", async () => {
      expectErrorText(request, response);
    });

    const tokenB = await loginThrowawayCustomer(authService, customerB, "Send POST /users/login with customer B's email and password, and take its access_token.");

    await test.step("Verify GET /users/me with B's access_token returns B's registered first_name.", async () => {
      const { request: meRequest, user } = await readMe(usersClientForToken(tokenB), "B's access_token");
      expect(user.first_name, assertMessage({ request: meRequest, expected: `first_name is B's registered "${registeredB.first_name}"`, actual: user })).toBe(
        registeredB.first_name
      );
    });
  });

  test('API-0431: Patch user with a phone containing letters returns 422 and leaves the profile unchanged', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    const registered = UserFactory.registerCustomer({ phone: UserFactory.phoneOfDigits() });
    let request: PatchRequestInfo;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, {
      title:
        "Send POST /users/register with a unique email, a first name, a last name, a random strong password and a phone of digits, and take the new user's id.",
      body: registered,
    });
    const token = await loginThrowawayCustomer(authService, customer);

    await test.step('Send PATCH /users/{userId} with that id, access_token and a phone containing letters.', async () => {
      ({ request, response } = await sendPatch(usersClientForToken(token), customer.id, { phone: UserFactory.phoneWithLetters() }, "the customer's access_token"));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a phone key with at least one message.', async () => {
      expectFieldMessages(response, 'phone', request);
    });

    await test.step('Verify GET /users/me with that access_token returns the registered phone.', async () => {
      const { request: meRequest, user } = await readMe(usersClientForToken(token), 'that access_token');
      expect(user.phone, assertMessage({ request: meRequest, expected: `phone is the registered "${registered.phone}"`, actual: user })).toBe(registered.phone);
    });
  });

  test('API-0432: Patch user with a dob under 18 years ago returns 422 and leaves the profile unchanged', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    const registered = UserFactory.registerCustomer({ dob: UserFactory.dobYearsAgo(30) });
    let request: PatchRequestInfo;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, {
      title: "Send POST /users/register with a unique email, a first name, a last name, a random strong password and an adult dob, and take the new user's id.",
      body: registered,
    });
    const token = await loginThrowawayCustomer(authService, customer);

    await test.step('Send PATCH /users/{userId} with that id, access_token and a dob 10 years ago in YYYY-MM-DD.', async () => {
      ({ request, response } = await sendPatch(usersClientForToken(token), customer.id, { dob: UserFactory.dobYearsAgo(10) }, "the customer's access_token"));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a dob key with at least one message.', async () => {
      expectFieldMessages(response, 'dob', request);
    });

    await test.step('Verify GET /users/me with that access_token returns the registered dob.', async () => {
      const { request: meRequest, user } = await readMe(usersClientForToken(token), 'that access_token');
      expect(user.dob, assertMessage({ request: meRequest, expected: `dob is the registered "${registered.dob}"`, actual: user })).toBe(registered.dob);
    });
  });

  test('API-0435: Patch user with an email another account uses returns 409 or 422', async ({
    usersService,
    adminUsersService,
    authService,
    usersClientForToken,
    cleanup,
  }) => {
    let request: PatchRequestInfo;
    let response: ApiResponse;

    const customerA = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { title: REGISTER_A_STEP });
    const customerB = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, {
      title: 'Send POST /users/register with a unique email, a first name, a last name and a random strong password (customer B).',
    });
    const tokenA = await loginThrowawayCustomer(authService, customerA, LOGIN_A_STEP);
    test.fail(true, 'Known issue BUG-035: Returns 403, with the SQL error in the body, instead of 409 or 422 when the email already belongs to another account.');

    await test.step("Send PATCH /users/{userId} with customer A's id, A's access_token and email set to customer B's email.", async () => {
      ({ request, response } = await sendPatch(usersClientForToken(tokenA), customerA.id, { email: customerB.email }, "A's access_token"));
    });

    await test.step('Verify the response status is 409 or 422.', async () => {
      expect([409, 422], assertMessage({ request, expected: 'Status 409 or 422', actual: { status: response.status, body: response.body.slice(0, 500) } })).toContain(
        response.status
      );
    });
  });
});
