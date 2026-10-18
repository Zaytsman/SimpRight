import { test, expect, registerThrowawayCustomer, loginThrowawayCustomer, type ThrowawayCustomer, disableCustomerSetup } from '@fixtures';
import type { Cleanup } from '@fixtures/base';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { AuthClient } from '@api/clients/AuthClient';
import type { LoginErrorBody, LoginResponse, TotpRequiredResponse } from '@api/dto/auth';
import type { MessageErrorBody, User } from '@api/dto/user';
import type { AuthService } from '@api/services/AuthService';
import type { UsersService } from '@api/services/UsersService';
import { UserFactory } from '@data/factories/UserFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';
import { totpCode, wrongTotpCode } from '@utils/totp';

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

/** The TOTP setup step of API-0308..0311 (same wording in all four). */
const TOTP_ENABLE_STEP =
  "Send PATCH /users/{userId} with that id, totp_enabled true and totp_secret set to a known base32 secret, with the customer's own access_token.";
/** The restricted-token step of API-0309..0311 (same wording in all three). */
const RESTRICTED_LOGIN_STEP = 'Send POST /users/login with that email and password, and take the restricted access_token from the response.';

type TotpCustomer = { customer: ThrowawayCustomer; secret: string };

/**
 * The three setup steps shared by the TOTP scenarios, with their titles verbatim: register a throwaway customer
 * (its removal as admin registered at once), log it in, then turn TOTP on with a secret the test knows, using the
 * customer's own token (the API lets a customer set its own totp_* fields). Returns the customer and the secret.
 */
async function registerTotpCustomer(
  usersService: UsersService,
  adminUsersService: UsersService,
  authService: AuthService,
  usersServiceForToken: (token: string) => UsersService,
  cleanup: Cleanup
): Promise<TotpCustomer> {
  const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
  const token = await loginThrowawayCustomer(authService, customer);
  const secret = UserFactory.totpSecret();

  await test.step(TOTP_ENABLE_STEP, async () => {
    const body = { totp_enabled: true, totp_secret: secret };
    const patchRequest = { method: 'PATCH', path: `/users/${customer.id}`, auth: "the customer's own access_token", body };
    await attachJson('Patch User Request', patchRequest);
    const result = await usersServiceForToken(token).partialUpdate(customer.id, body);
    await attachJson('Patch User Response', result);
    expect(result.success, assertMessage({ request: patchRequest, expected: 'success is true', actual: result })).toBe(true);
  });

  return { customer, secret };
}

/** The RESTRICTED_LOGIN_STEP step as setup: the first login step of a TOTP account; returns its restricted token. */
async function takeRestrictedToken(authService: AuthService, customer: ThrowawayCustomer): Promise<string> {
  let token = '';

  await test.step(RESTRICTED_LOGIN_STEP, async () => {
    const credentials = { email: customer.email, password: customer.password };
    const request = { method: 'POST', path: '/users/login', body: credentials };
    await attachJson('Login Request', request);
    const login = (await authService.login(credentials)) as unknown as TotpRequiredResponse;
    await attachJson('Login Response', login);
    expect(
      login.requires_totp === true && Boolean(login.access_token),
      assertMessage({ request, expected: 'The login asks for the TOTP code and returns a restricted access_token', actual: { ...login, access_token: typeof login.access_token } })
    ).toBe(true);
    token = login.access_token;
  });

  return token;
}

/** The checks of a "Verify the body has no <keys> key." step. */
function expectNoKeys(request: unknown, response: ApiResponse, keys: string[]): void {
  const body = JSON.parse(response.body) as Record<string, unknown>;
  const present = keys.filter((key) => key in body);
  expect(present, assertMessage({ request, expected: `The body has none of the keys ${keys.join(', ')}`, actual: Object.keys(body) })).toEqual([]);
}

test.describe('@users-api - Users API', () => {
  test('API-0078: Login returns 200 with a bearer token', { tag: '@smoke' }, async ({ authClient, user, usersClientForToken }) => {
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

      await disableCustomerSetup(adminUsersService, customer.id, "Send PATCH /users/{userId} with that id and enabled false, with the admin's token.", "admin's token");

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

  test('API-0308: Login of a TOTP account returns "TOTP required" with a restricted token', async ({
    authClient,
    authService,
    usersService,
    adminUsersService,
    usersServiceForToken,
    cleanup,
  }) => {
    let request: LoginRequestInfo;
    let response: ApiResponse;
    let body: TotpRequiredResponse;

    const { customer } = await registerTotpCustomer(usersService, adminUsersService, authService, usersServiceForToken, cleanup);

    await test.step('Send POST /users/login with that email and password.', async () => {
      ({ request, response } = await sendLogin(authClient, { email: customer.email, password: customer.password }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = JSON.parse(response.body) as TotpRequiredResponse;
    });

    await test.step('Verify the body\'s message is "TOTP required" and requires_totp is true.', async () => {
      const actual = { message: body.message, requires_totp: body.requires_totp };
      expect(body.message, assertMessage({ request, expected: 'message is "TOTP required"', actual })).toBe('TOTP required');
      expect(body.requires_totp, assertMessage({ request, expected: 'requires_totp is true', actual })).toBe(true);
    });

    await test.step("Verify the body's access_token is a non-empty string.", async () => {
      // The token is a secret: check it as a condition so a failure never prints it.
      expect(
        typeof body.access_token === 'string' && body.access_token.length > 0,
        assertMessage({ request, expected: 'access_token is a non-empty string', actual: typeof body.access_token })
      ).toBe(true);
    });

    await test.step('Verify the body has no token_type or expires_in key.', async () => {
      expectNoKeys(request, response, ['token_type', 'expires_in']);
    });
  });

  test('API-0309: TOTP login step with the right code returns a full token', async ({
    authClient,
    authService,
    usersService,
    adminUsersService,
    usersServiceForToken,
    usersClientForToken,
    cleanup,
  }) => {
    let request: LoginRequestInfo;
    let response: ApiResponse;
    let body: LoginResponse;

    const { customer, secret } = await registerTotpCustomer(usersService, adminUsersService, authService, usersServiceForToken, cleanup);
    const restrictedToken = await takeRestrictedToken(authService, customer);

    await test.step('Send POST /users/login with access_token set to the restricted access_token and totp set to the current 6-digit code for that secret.', async () => {
      ({ request, response } = await sendLogin(authClient, { access_token: restrictedToken, totp: totpCode(secret) }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = JSON.parse(response.body) as LoginResponse;
    });

    await test.step("Verify the body's access_token is a non-empty string.", async () => {
      expect(
        typeof body.access_token === 'string' && body.access_token.length > 0,
        assertMessage({ request, expected: 'access_token is a non-empty string', actual: typeof body.access_token })
      ).toBe(true);
    });

    await test.step('Verify the body\'s token_type is "bearer".', async () => {
      expect(body.token_type, assertMessage({ request, expected: 'token_type is "bearer"', actual: body.token_type })).toBe('bearer');
    });

    await test.step("Verify GET /users/me with the new access_token returns 200 with the throwaway customer's email.", async () => {
      const meRequest = { method: 'GET', path: '/users/me', auth: 'the new access_token' };
      const meResponse = await usersClientForToken(body.access_token).me();
      await attachJson('Current User Request', meRequest);
      await attachJson('Current User Response', { status: meResponse.status, body: meResponse.body });
      expect(meResponse.status, assertMessage({ request: meRequest, expected: 'Status 200', actual: meResponse.status })).toBe(200);
      const profile = JSON.parse(meResponse.body) as User;
      expect(
        profile.email === customer.email,
        assertMessage({ request: meRequest, expected: "Email equals the throwaway customer's email", actual: profile.email })
      ).toBe(true);
    });
  });

  test('API-0310: Restricted token of the TOTP first step is rejected as a session', async ({
    authService,
    usersService,
    adminUsersService,
    usersServiceForToken,
    usersClientForToken,
    cleanup,
  }) => {
    const request = { method: 'GET', path: '/users/me', auth: 'the restricted access_token' };
    let response: ApiResponse;

    const { customer } = await registerTotpCustomer(usersService, adminUsersService, authService, usersServiceForToken, cleanup);
    const restrictedToken = await takeRestrictedToken(authService, customer);

    await test.step('Send GET /users/me with the restricted access_token.', async () => {
      response = await usersClientForToken(restrictedToken).me();
      await attachJson('Current User Request', request);
      await attachJson('Current User Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 401.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 401', actual: { status: response.status, body: response.body } })).toBe(401);
    });

    await test.step('Verify the body\'s message is "Unauthorized token usage".', async () => {
      const body = JSON.parse(response.body) as MessageErrorBody;
      expect(body.message, assertMessage({ request, expected: 'message is "Unauthorized token usage"', actual: body })).toBe('Unauthorized token usage');
    });
  });

  test('API-0311: TOTP login step with a wrong code returns 401', async ({
    authClient,
    authService,
    usersService,
    adminUsersService,
    usersServiceForToken,
    cleanup,
  }) => {
    let request: LoginRequestInfo;
    let response: ApiResponse;

    const { customer, secret } = await registerTotpCustomer(usersService, adminUsersService, authService, usersServiceForToken, cleanup);
    const restrictedToken = await takeRestrictedToken(authService, customer);

    await test.step(
      'Send POST /users/login with access_token set to the restricted access_token and totp set to a 6-digit code that differs from the secret\'s codes for the current and the neighbouring 30-second periods.',
      async () => {
        // A wrong TOTP code doesn't count as a failed login (only a wrong password does), so no lockout risk.
        ({ request, response } = await sendLogin(authClient, { access_token: restrictedToken, totp: wrongTotpCode(secret) }));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s error is "Invalid TOTP".', async () => {
      expectLoginError(request, response, ['Invalid TOTP']);
    });

    await test.step('Verify the body has no access_token key.', async () => {
      expectNoKeys(request, response, ['access_token']);
    });
  });
});
