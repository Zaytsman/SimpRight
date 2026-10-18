import { test, expect, registerThrowawayCustomer, expectLoginSucceeds } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { MessageErrorBody } from '@api/dto/user';
import { UserFactory } from '@data/factories/UserFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';
import { expectErrorKeys, expectStatus, expectSuccess } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/users/post-users-forgot-password.yml

type ForgotPasswordRequestInfo = { method: 'POST'; path: '/users/forgot-password'; body: unknown };

/** The password the API sets on a reset (Users contract, section 3). Public, and only ever used for a throwaway customer. */
const RESET_PASSWORD = 'welcome02';

/** Sends POST /users/forgot-password (no token) and attaches the request and the response. */
async function sendForgotPassword(client: UsersClient, body: Record<string, unknown>): Promise<{ request: ForgotPasswordRequestInfo; response: ApiResponse }> {
  const request: ForgotPasswordRequestInfo = { method: 'POST', path: '/users/forgot-password', body };
  const response = await client.forgotPassword(body);
  await attachJson('Forgot Password Request', request);
  await attachJson('Forgot Password Response', { status: response.status, body: response.body });
  return { request, response };
}

test.describe('@users-api - Users API', () => {
  test('API-0399: Forgot password for an existing email returns 200 and resets the password to welcome02', async ({
    usersService,
    adminUsersService,
    usersClient,
    authClient,
    cleanup,
  }) => {
    let request: ForgotPasswordRequestInfo;
    let response: ApiResponse;

    // Never a shared account: the reset works without a token, so only this test's own customer is reset.
    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);

    await test.step('Send POST /users/forgot-password with that email.', async () => {
      ({ request, response } = await sendForgotPassword(usersClient, { email: customer.email }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step('Verify POST /users/login with that email and the password "welcome02" returns 200 with a non-empty access_token.', async () => {
      await expectLoginSucceeds(authClient, customer.email, RESET_PASSWORD, `"${RESET_PASSWORD}"`);
    });
  });

  test('API-0400: Forgot password without email returns 404', async ({ usersClient }) => {
    let request: ForgotPasswordRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/forgot-password with an empty JSON object as the body.', async () => {
      ({ request, response } = await sendForgotPassword(usersClient, {}));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      const body = JSON.parse(response.body) as MessageErrorBody;
      expect(body.message, assertMessage({ request, expected: 'message is "Requested item not found"', actual: body })).toBe('Requested item not found');
    });
  });

  test('API-0401: Forgot password for an unknown email returns 422', async ({ usersClient }) => {
    let request: ForgotPasswordRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /users/forgot-password with a unique email that no account has.', async () => {
      // A register payload only: nothing is registered, so no account has this email.
      const { email } = UserFactory.registerCustomer();
      ({ request, response } = await sendForgotPassword(usersClient, { email }));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step("Verify the body's errors.email is a non-empty list.", async () => {
      expectErrorKeys(request, response, ['email']);
    });
  });
});
