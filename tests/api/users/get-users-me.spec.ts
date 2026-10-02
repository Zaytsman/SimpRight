import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { User } from '@api/dto/user';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/get-users-me.yml
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
});
