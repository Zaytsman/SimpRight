import { test, expect, registerThrowawayCustomer } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { AuthClient } from '@api/clients/AuthClient';
import type { LoginErrorBody, LoginResponse } from '@api/dto/auth';
import type { User } from '@api/dto/user';
import { UserFactory } from '@data/factories/UserFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/post-users-login.yml

type LoginRequestInfo = { method: 'POST'; path: '/users/login'; body: unknown };

/** The 401 bodies the API returns for failed logins; either is accepted. */
const LOGIN_401_ERRORS = ['Unauthorized', 'Invalid login request'];

/** "Any totp value" for the TOTP step: the API rejects the token before it checks the code. */
const ANY_TOTP = '000000';

/** Sends POST /users/login with `body` and attaches the request and the response. */
async function sendLogin(authClient: AuthClient, body: Record<string, unknown>): Promise<{ request: LoginRequestInfo; response: ApiResponse }> {
  const request: LoginRequestInfo = { method: 'POST', path: '/users/login', body };
  const response = await authClient.login(body);
  await attachJson('Login Request', request);
  await attachJson('Login Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the response status is <status>." step. */
function expectStatus(request: LoginRequestInfo, response: ApiResponse, status: number): void {
  expect(response.status, assertMessage({ request, expected: `Status ${status}`, actual: { status: response.status, body: response.body } })).toBe(status);
}

/** The checks of a "Verify the body's error is ..." step: `error` is one of `allowed`. */
function expectLoginError(request: LoginRequestInfo, response: ApiResponse, allowed: string[]): void {
  const body = JSON.parse(response.body) as LoginErrorBody;
  expect(
    allowed.includes(body.error),
    assertMessage({ request, expected: `error is ${allowed.map((text) => `"${text}"`).join(' or ')}`, actual: body })
  ).toBe(true);
}

test.describe('@users-api - Users API', () => {
  test('API-0078: Login returns 200 with a bearer token', async ({ authClient, user, usersClientForToken }) => {
    let request: LoginRequestInfo;
    let response: ApiResponse;
    let body: LoginResponse;

    await test.step("Send POST /users/login with the default user's email and password.", async () => {
      ({ request, response } = await sendLogin(authClient, { email: user.username, password: user.password }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = JSON.parse(response.body) as LoginResponse;
    });

    await test.step("Verify the body's access_token is a non-empty string.", async () => {
      // The token is a secret: check it as a condition so a failure never prints it.
      expect(
        typeof body.access_token === 'string' && body.access_token.length > 0,
        assertMessage({ request, expected: 'access_token is a non-empty string', actual: typeof body.access_token })
      ).toBe(true);
    });

    await test.step('Verify the body\'s token_type is "bearer".', async () => {
      expect(body.token_type, assertMessage({ request, expected: 'token_type is "bearer"', actual: body.token_type })).toBe('bearer');
    });

    await test.step("Verify the body's expires_in is 300.", async () => {
      expect(body.expires_in, assertMessage({ request, expected: 'expires_in is 300', actual: body.expires_in })).toBe(300);
    });

    await test.step("Verify GET /users/me with the new access_token returns 200 with the default user's email.", async () => {
      const meRequest = { method: 'GET', path: '/users/me', auth: 'the new access_token' };
      const meResponse = await usersClientForToken(body.access_token).me();
      await attachJson('Current User Request', meRequest);
      await attachJson('Current User Response', { status: meResponse.status, body: meResponse.body });
      expect(meResponse.status, assertMessage({ request: meRequest, expected: 'Status 200', actual: meResponse.status })).toBe(200);
      const profile = JSON.parse(meResponse.body) as User;
      // The email is a secret: compare it as a condition so a failure diff doesn't print it.
      expect(
        profile.email === user.username,
        assertMessage({ request: meRequest, expected: "Email equals the default user's email", actual: profile.email })
      ).toBe(true);
    });
  });

  test('API-0079: Login with a wrong password returns 401', async ({ authClient, usersService, adminUsersService, cleanup }) => {
    let request: LoginRequestInfo;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

    await test.step('Send POST /users/login with that email and a different password.', async () => {
      // Only this throwaway customer ever gets a wrong password (one failed attempt; the lockout is at 3).
      const wrongPassword = UserFactory.registerCustomer().password;
      expect(wrongPassword !== customer.password, assertMessage({ expected: 'The wrong password differs from the real one' })).toBe(true);
      ({ request, response } = await sendLogin(authClient, { email: customer.email, password: wrongPassword }));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s error is "Unauthorized" or "Invalid login request".', async () => {
      expectLoginError(request, response, LOGIN_401_ERRORS);
    });
  });

  test('API-0080: Login with an email no account has returns 401', async ({ authClient }) => {
    let request: LoginRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/login with a unique email that no account has and a random strong password.', async () => {
      // A register payload only: nothing is registered, so no account has this email.
      const { email, password } = UserFactory.registerCustomer();
      ({ request, response } = await sendLogin(authClient, { email, password }));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s error is "Unauthorized" or "Invalid login request".', async () => {
      expectLoginError(request, response, LOGIN_401_ERRORS);
    });
  });

  test('API-0081: Login without credentials returns 401', async ({ authClient }) => {
    let request: LoginRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/login with an empty JSON object as the body.', async () => {
      ({ request, response } = await sendLogin(authClient, {}));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s error is "Unauthorized" or "Invalid login request".', async () => {
      expectLoginError(request, response, LOGIN_401_ERRORS);
    });
  });

  test('API-0082: TOTP login step with a full token returns 401', async ({ authClient, accessToken }) => {
    let request: LoginRequestInfo;
    let response: ApiResponse;

    await test.step("Send POST /users/login with access_token set to the default user's token and any totp value.", async () => {
      ({ request, response } = await sendLogin(authClient, { access_token: accessToken, totp: ANY_TOTP }));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });
  });

  test('API-0083: TOTP login step with an invalid access token returns 400', async ({ authClient }) => {
    const invalidToken = 'not-a-valid-token';
    let request: LoginRequestInfo;
    let response: ApiResponse;

    await test.step("Send POST /users/login with an access_token that isn't a valid token and any totp value.", async () => {
      ({ request, response } = await sendLogin(authClient, { access_token: invalidToken, totp: ANY_TOTP }));
    });

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step('Verify the body\'s error is "Invalid or expired token".', async () => {
      expectLoginError(request, response, ['Invalid or expired token']);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0084: Login to a disabled account returns 403', async ({ authClient, usersService, adminUsersService, cleanup }) => {
      let request: LoginRequestInfo;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

      await test.step("Send PATCH /users/{userId} with that id and enabled false, with the admin's token.", async () => {
        const patchRequest = { method: 'PATCH', path: `/users/${customer.id}`, auth: "admin's token", body: { enabled: false } };
        await attachJson('Patch User Request', patchRequest);
        const result = await adminUsersService.partialUpdate(customer.id, { enabled: false });
        await attachJson('Patch User Response', result);
        expect(result.success, assertMessage({ request: patchRequest, expected: 'success is true', actual: result })).toBe(true);
      });

      await test.step('Send POST /users/login with that email and password.', async () => {
        ({ request, response } = await sendLogin(authClient, { email: customer.email, password: customer.password }));
      });

      await test.step('Verify the response status is 403.', async () => {
        expectStatus(request, response, 403);
      });

      await test.step('Verify the body\'s error is "Account disabled".', async () => {
        expectLoginError(request, response, ['Account disabled']);
      });
    });
  });
});
