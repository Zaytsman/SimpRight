import { test, loginForNewToken, logoutToken, sendAndAttach, checkStatusAndMessage } from '@fixtures';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';

// Scenarios: test-scenarios/api/users/get-users-logout.yml
// Every test that logs out logs the default user in again first (loginForNewToken), so the shared
// TokenService token other tests use is never invalidated.

type LogoutRequest = { method: 'GET'; path: '/users/logout'; auth: string };

/** Sends GET /users/logout with `client` and attaches the request and the response. */
async function sendLogout(client: UsersClient, auth: string): Promise<{ request: LogoutRequest; response: ApiResponse }> {
  const request: LogoutRequest = { method: 'GET', path: '/users/logout', auth };
  return sendAndAttach('Logout', request, () => client.logout());
}

test.describe('@users-api - Users API', () => {
  test('API-0105: Logout returns 200 and invalidates the token', async ({ authService, user, usersClientForToken }) => {
    let token = '';
    let request: LogoutRequest;
    let response: ApiResponse;

    token = await loginForNewToken(authService, user);

    await test.step('Send GET /users/logout with that token.', async () => {
      ({ request, response } = await sendLogout(usersClientForToken(token), 'the new access_token'));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s message is "Successfully logged out".', async () => {
      expectMessage(request, response, 'Successfully logged out');
    });

    await test.step('Verify GET /users/me with that token returns 401.', async () => {
      const { request: meRequest, response: meResponse } = await sendAndAttach('Current User', { method: 'GET', path: '/users/me', auth: 'the logged-out access_token' }, () => usersClientForToken(token).me());
      expectStatus(meRequest, meResponse, 401);
    });
  });

  test('API-0106: Logout without a token returns 401', async ({ usersClient }) => {
    await checkStatusAndMessage(
      'Send GET /users/logout without an Authorization header.',
      () => sendLogout(usersClient, 'none'),
      401,
      'Unauthorized'
    );
  });

  test('API-0107: Logout with an invalid token returns 401', async ({ usersClientWithInvalidToken }) => {
    await checkStatusAndMessage(
      'Send GET /users/logout with an invalid token.',
      () => sendLogout(usersClientWithInvalidToken, 'an invalid token'),
      401,
      'Unauthorized'
    );
  });

  test('API-0108: Logout with an already logged-out token returns 401', async ({ authService, user, usersClientForToken, usersServiceForToken }) => {
    const token = await loginForNewToken(authService, user);
    await logoutToken(usersServiceForToken, token);

    await checkStatusAndMessage(
      'Send GET /users/logout with the same token again.',
      () => sendLogout(usersClientForToken(token), 'the logged-out access_token'),
      401,
      'Unauthorized'
    );
  });
});
