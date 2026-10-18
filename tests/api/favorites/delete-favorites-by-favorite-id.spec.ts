import { test, createCustomerWithFavorite, AUTH, createSecondCustomer, expectGetFavoriteStatus, sendDeleteFavorite, type FavoriteRequest } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/favorites/delete-favorites-by-favorite-id.yml

test.describe('@favorites-api - Favorites API', () => {
  test('API-0284: Delete favorite returns 204 and removes it', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    favoritesServiceForToken,
    favoritesClientForToken,
    cleanup,
  }) => {
    let request: FavoriteRequest;
    let response: ApiResponse;

    // The favourite's cleanup is registered anyway; DELETE answers 204 when it's already gone.
    const { token, favorite } = await createCustomerWithFavorite({ usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup });

    await test.step("Send DELETE /favorites/{favoriteId} with that id and the throwaway customer's access_token.", async () => {
      ({ request, response } = await sendDeleteFavorite(favoritesClientForToken(token), favorite.id, AUTH.throwaway));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /favorites/{favoriteId} with that id and the throwaway customer's access_token returns 404.", async () => {
      await expectGetFavoriteStatus(favoritesClientForToken(token), favorite.id, AUTH.throwaway, 404);
    });
  });

  test('API-0285: Delete favorite without a token returns 401', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    favoritesServiceForToken,
    favoritesClient,
    favoritesClientForToken,
    cleanup,
  }) => {
    let request: FavoriteRequest;
    let response: ApiResponse;

    const { token, favorite } = await createCustomerWithFavorite({ usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup });

    await test.step('Send DELETE /favorites/{favoriteId} with that id, without an Authorization header.', async () => {
      ({ request, response } = await sendDeleteFavorite(favoritesClient, favorite.id, 'none'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });

    await test.step("Verify GET /favorites/{favoriteId} with that id and the throwaway customer's access_token returns 200.", async () => {
      await expectGetFavoriteStatus(favoritesClientForToken(token), favorite.id, AUTH.throwaway, 200);
    });
  });

  test('API-0286: Delete favorite with a malformed token returns 401', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    favoritesServiceForToken,
    favoritesClientWithInvalidToken,
    favoritesClientForToken,
    cleanup,
  }) => {
    let request: FavoriteRequest;
    let response: ApiResponse;

    const { token, favorite } = await createCustomerWithFavorite({ usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup });

    await test.step('Send DELETE /favorites/{favoriteId} with that id, with a malformed token.', async () => {
      ({ request, response } = await sendDeleteFavorite(favoritesClientWithInvalidToken, favorite.id, AUTH.malformed));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });

    await test.step("Verify GET /favorites/{favoriteId} with that id and the throwaway customer's access_token returns 200.", async () => {
      await expectGetFavoriteStatus(favoritesClientForToken(token), favorite.id, AUTH.throwaway, 200);
    });
  });

  test('API-0287: Delete favorite with an unknown id returns 204', async ({ favoritesClientWithToken }) => {
    let request: FavoriteRequest;
    let response: ApiResponse;

    await test.step('Send DELETE /favorites/{favoriteId} with a well-formed ULID that no favorite has.', async () => {
      ({ request, response } = await sendDeleteFavorite(favoritesClientWithToken, TestConstants.favorites.unknownId, AUTH.defaultUser));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });
  });

  test("API-0288: Delete another user's favorite returns 204 and keeps it", async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    favoritesServiceForToken,
    favoritesClientForToken,
    cleanup,
  }) => {
    let request: FavoriteRequest;
    let response: ApiResponse;

    const { token, favorite } = await createCustomerWithFavorite({ usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup });
    const second = await createSecondCustomer(usersService, adminUsersService, authService, cleanup);

    await test.step("Send DELETE /favorites/{favoriteId} with that favorite's id, with the second customer's access_token.", async () => {
      ({ request, response } = await sendDeleteFavorite(favoritesClientForToken(second.token), favorite.id, AUTH.second));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /favorites/{favoriteId} with that id, with the throwaway customer's access_token, returns 200.", async () => {
      await expectGetFavoriteStatus(favoritesClientForToken(token), favorite.id, AUTH.throwaway, 200);
    });
  });
});
