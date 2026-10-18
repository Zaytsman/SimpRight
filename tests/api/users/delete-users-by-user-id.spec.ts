import { test, expect, registerThrowawayCustomer, loginThrowawayCustomer, takeFirstProductId } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UsersClient } from '@api/clients/UsersClient';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/users/delete-users-by-user-id.yml

type DeleteUserRequest = { method: 'DELETE'; path: string; auth: string };

/** Sends DELETE /users/{userId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendDeleteUser(client: UsersClient, userId: string, auth: string): Promise<{ request: DeleteUserRequest; response: ApiResponse }> {
  const request: DeleteUserRequest = { method: 'DELETE', path: `/users/${userId}`, auth };
  const response = await client.deleteById(userId);
  await attachJson('Delete User Request', request);
  await attachJson('Delete User Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The checks of a "Verify GET /users/{userId} with that id and the admin's token returns <status>." step. */
async function expectGetUserStatus(adminUsersClient: UsersClient, userId: string, status: number): Promise<void> {
  const request = { method: 'GET', path: `/users/${userId}`, auth: "admin's token" };
  const response = await adminUsersClient.getById(userId);
  await attachJson('Get User Request', request);
  await attachJson('Get User Response', { status: response.status, body: response.body });
  expectStatus(request, response, status);
}

test.describe('@users-api - Users API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0436: Delete user as an admin returns 204 and the user is gone', async ({ usersService, adminUsersService, usersClientWithToken, cleanup }) => {
      let request: DeleteUserRequest;
      let response: ApiResponse;

      // The DELETE under test removes the user; cleanup is a backstop if it fails, and deletes only a user that still exists.
      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup, { ifExists: true });

      await test.step("Send DELETE /users/{userId} with the new user's id and the admin's token.", async () => {
        ({ request, response } = await sendDeleteUser(usersClientWithToken, customer.id, "admin's token"));
      });

      await test.step('Verify the response status is 204.', async () => {
        expectStatus(request, response, 204);
      });

      await test.step("Verify GET /users/{userId} with that id and the admin's token returns 404.", async () => {
        await expectGetUserStatus(usersClientWithToken, customer.id, 404);
      });
    });

    test('API-0438: Delete user as a customer returns 403 and the user stays', async ({
      usersService,
      adminUsersService,
      authService,
      usersClientWithToken,
      usersClientForToken,
      cleanup,
    }) => {
      let request: DeleteUserRequest;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
      const token = await loginThrowawayCustomer(authService, customer);

      await test.step("Send DELETE /users/{userId} with the new user's id and the customer's access_token.", async () => {
        ({ request, response } = await sendDeleteUser(usersClientForToken(token), customer.id, "the customer's access_token"));
      });

      await test.step('Verify the response status is 403.', async () => {
        expectStatus(request, response, 403);
      });

      await test.step('Verify the body\'s message is "Forbidden".', async () => {
        expectMessage(request, response, 'Forbidden');
      });

      await test.step("Verify GET /users/{userId} with that id and the admin's token returns 200.", async () => {
        await expectGetUserStatus(usersClientWithToken, customer.id, 200);
      });
    });

    test('API-0439: Delete a user that has a favorite returns 409 and the user stays', async ({
      usersService,
      adminUsersService,
      authService,
      productsService,
      favoritesServiceForToken,
      usersClientWithToken,
      cleanup,
    }) => {
      let request: DeleteUserRequest;
      let response: ApiResponse;

      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
      const token = await loginThrowawayCustomer(authService, customer);
      const productId = await takeFirstProductId(productsService, 'Send GET /products and take the id of a product.');

      await test.step("Send POST /favorites with that product id and the customer's access_token.", async () => {
        const favoriteRequest = { method: 'POST', path: '/favorites', auth: "the customer's access_token", body: { product_id: productId } };
        await attachJson('Add Favorite Request', favoriteRequest);
        const favorite = await favoritesServiceForToken(token).add(productId);
        // Cleanup runs newest first: the favourite goes before the user, whose delete it would block (409).
        cleanup.add(() => favoritesServiceForToken(token).delete(favorite.id));
        await attachJson('Add Favorite Response', favorite);
        expect(favorite.id, assertMessage({ request: favoriteRequest, expected: 'The new favorite has an id', actual: favorite })).toBeTruthy();
      });

      await test.step("Send DELETE /users/{userId} with the new user's id and the admin's token.", async () => {
        ({ request, response } = await sendDeleteUser(usersClientWithToken, customer.id, "admin's token"));
      });

      await test.step('Verify the response status is 409.', async () => {
        expectStatus(request, response, 409);
      });

      await test.step("Verify the body's success is false.", async () => {
        expectSuccess(request, response, false);
      });

      await test.step('Verify the body\'s message is "Seems like this customer is used elsewhere.".', async () => {
        expectMessage(request, response, 'Seems like this customer is used elsewhere.');
      });

      await test.step("Verify GET /users/{userId} with that id and the admin's token returns 200.", async () => {
        await expectGetUserStatus(usersClientWithToken, customer.id, 200);
      });
    });

    test('API-0440: Delete user with an unknown id as an admin returns 404', async ({ usersClientWithToken }) => {
      test.fail(true, 'Known issue BUG-036: Returns 500 instead of 404 for an unknown user id.');
      let request: DeleteUserRequest;
      let response: ApiResponse;

      await test.step("Send DELETE /users/{userId} with a well-formed ULID that no user has and the admin's token.", async () => {
        ({ request, response } = await sendDeleteUser(usersClientWithToken, TestConstants.users.unknownId, "admin's token"));
      });

      await test.step('Verify the response status is 404.', async () => {
        expectStatus(request, response, 404);
      });
    });
  });

  test('API-0437: Delete user without a token returns 401', async ({ usersClient }) => {
    let request: DeleteUserRequest;
    let response: ApiResponse;

    await test.step('Send DELETE /users/{userId} with a well-formed ULID that no user has, without an Authorization header.', async () => {
      ({ request, response } = await sendDeleteUser(usersClient, TestConstants.users.unknownId, 'none'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });
});
