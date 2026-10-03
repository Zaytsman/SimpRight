import { test, expect, loginForNewToken, logoutToken } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import type { RefreshResponse } from '@api/dto/auth';
import type { User } from '@api/dto/user';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/get-users-refresh.yml
// Every test that refreshes logs the default user in again first (loginForNewToken): a refresh invalidates
// the token it is sent with, so the shared TokenService token other tests use is never sent here.

type RefreshRequest = { method: 'GET'; path: '/users/refresh'; auth: string };

/** Sends GET /users/refresh with `usersClient` and attaches the request and the response. */
async function sendRefresh(usersClient: UsersClient, auth: string): Promise<{ request: RefreshRequest; response: ApiResponse }> {
  const request: RefreshRequest = { method: 'GET', path: '/users/refresh', auth };
  const response = await usersClient.refresh();
  await attachJson('Refresh Request', request);
  await attachJson('Refresh Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the response status is <status>." step. */
function expectStatus(request: RefreshRequest, response: ApiResponse, status: number): void {
  expect(response.status, assertMessage({ request, expected: `Status ${status}`, actual: { status: response.status, body: response.body } })).toBe(status);
}

/** The checks of a "Verify the body contains the text <text>." step. */
function expectBodyContains(request: RefreshRequest, response: ApiResponse, text: string): void {
  expect(response.body.includes(text), assertMessage({ request, expected: `The body contains "${text}"`, actual: response.body })).toBe(true);
}

test.describe('@users-api - Users API', () => {
  test('API-0109: Refresh returns a new bearer token', async ({ authService, user, usersClientForToken }) => {
    let request: RefreshRequest;
    let response: ApiResponse;
    let body: RefreshResponse;

    const token = await loginForNewToken(authService, user);

    await test.step('Send GET /users/refresh with that token.', async () => {
      ({ request, response } = await sendRefresh(usersClientForToken(token), 'the new access_token'));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = JSON.parse(response.body) as RefreshResponse;
    });

    await test.step("Verify the body's access_token is a non-empty string that differs from the token sent.", async () => {
      // Tokens are secrets: check them as conditions so a failure never prints them.
      expect(
        typeof body.access_token === 'string' && body.access_token.length > 0,
        assertMessage({ request, expected: 'access_token is a non-empty string', actual: typeof body.access_token })
      ).toBe(true);
      expect(body.access_token !== token, assertMessage({ request, expected: 'access_token differs from the token sent' })).toBe(true);
    });

    await test.step('Verify the body\'s token_type is "bearer".', async () => {
      expect(body.token_type, assertMessage({ request, expected: 'token_type is "bearer"', actual: body.token_type })).toBe('bearer');
    });

    await test.step("Verify the body's expires_in is a number.", async () => {
      expect(typeof body.expires_in, assertMessage({ request, expected: 'expires_in is a number', actual: body.expires_in })).toBe('number');
    });

    await test.step("Verify GET /users/me with the new access_token returns 200 with the default user's email.", async () => {
      const meRequest = { method: 'GET', path: '/users/me', auth: 'the refreshed access_token' };
      const meResponse = await usersClientForToken(body.access_token).me();
      await attachJson('Current User Request', meRequest);
      await attachJson('Current User Response', { status: meResponse.status, body: meResponse.body });
      expect(meResponse.status, assertMessage({ request: meRequest, expected: 'Status 200', actual: { status: meResponse.status, body: meResponse.body } })).toBe(200);
      const profile = JSON.parse(meResponse.body) as User;
      // The email is a secret: compare it as a condition so a failure diff doesn't print it.
      expect(profile.email === user.username, assertMessage({ request: meRequest, expected: "Email equals the default user's email", actual: profile.email })).toBe(
        true
      );
    });
  });

  test('API-0110: Refresh with a logged-out token returns 401', async ({ authService, user, usersClientForToken, usersServiceForToken }) => {
    let request: RefreshRequest;
    let response: ApiResponse;

    const token = await loginForNewToken(authService, user);
    await logoutToken(usersServiceForToken, token);

    await test.step('Send GET /users/refresh with the same token.', async () => {
      ({ request, response } = await sendRefresh(usersClientForToken(token), 'the logged-out access_token'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body contains the text "Token is not valid".', async () => {
      expectBodyContains(request, response, 'Token is not valid');
    });
  });

  test('API-0111: Refresh with an already refreshed token returns 401', async ({ authService, user, usersClientForToken, usersServiceForToken }) => {
    let request: RefreshRequest;
    let response: ApiResponse;

    const token = await loginForNewToken(authService, user);

    await test.step('Send GET /users/refresh with that token.', async () => {
      const setupRequest = { method: 'GET', path: '/users/refresh', auth: 'the new access_token' };
      await attachJson('Refresh Request', setupRequest);
      const refreshed = await usersServiceForToken(token).refresh();
      await attachJson('Refresh Response', refreshed);
      expect(Boolean(refreshed.access_token), assertMessage({ request: setupRequest, expected: 'The refresh returns an access_token' })).toBe(true);
    });

    await test.step('Send GET /users/refresh with the same (old) token again.', async () => {
      ({ request, response } = await sendRefresh(usersClientForToken(token), 'the old (already refreshed) access_token'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body contains the text "Token is not valid".', async () => {
      expectBodyContains(request, response, 'Token is not valid');
    });
  });

  test('API-0112: Refresh without a token returns 401', async ({ usersClientWithoutToken }) => {
    test.fail(true, 'Known issue: Returns 500 instead of 401 when the request has no token.');
    let request: RefreshRequest;
    let response: ApiResponse;

    await test.step('Send GET /users/refresh without an Authorization header.', async () => {
      ({ request, response } = await sendRefresh(usersClientWithoutToken, 'none'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });
  });

  test('API-0113: Refresh with a malformed token returns 401', async ({ usersClientWithInvalidToken }) => {
    test.fail(true, 'Known issue: Returns 500 instead of 401 for a malformed token.');
    let request: RefreshRequest;
    let response: ApiResponse;

    await test.step('Send GET /users/refresh with a malformed token.', async () => {
      ({ request, response } = await sendRefresh(usersClientWithInvalidToken, 'a malformed token'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });
  });
});
