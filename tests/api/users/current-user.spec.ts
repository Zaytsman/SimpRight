import { test, expect } from '@fixtures';
import type { User } from '@api/dto/user';

// Scenarios: test-scenarios/api/users/get-me.yml
test.describe('Users API', () => {
  test('API-USER-001: current user endpoint returns the logged-in user\'s profile', async ({ usersClient, user }) => {
    const response = await usersClient.me();

    expect(response.status).toBe(200);
    const profile = JSON.parse(response.body) as User;
    expect(profile.email).toBe(user.username);
    expect(profile.id).toBeTruthy();
    expect(profile.first_name).toBeTruthy();
    expect(profile.last_name).toBeTruthy();
  });
});
