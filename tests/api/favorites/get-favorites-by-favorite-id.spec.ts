import { test, expect, AUTH, createCustomerWithFavorite, createSecondCustomer, sendGetFavorite, type FavoriteRequest } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Favorite } from '@api/dto/favorite';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/favorites/get-favorites-by-favorite-id.yml

test.describe('@favorites-api - Favorites API', () => {
  test('API-0279: Get favorite returns 200 with the favorite', async ({
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
    let body: Favorite;

    const { token, favorite } = await createCustomerWithFavorite(
      { usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup },
      "Send POST /favorites with that product id and the throwaway customer's access_token, and take the new favorite's id, user_id and product_id."
    );

    await test.step("Send GET /favorites/{favoriteId} with that id and the throwaway customer's access_token.", async () => {
      ({ request, response } = await sendGetFavorite(favoritesClientForToken(token), favorite.id, AUTH.throwaway));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = JSON.parse(response.body) as Favorite;
    });

    await test.step("Verify the body's id, user_id and product_id equal the values POST /favorites returned.", async () => {
      const sent = { id: favorite.id, user_id: favorite.user_id, product_id: favorite.product_id };
      expect(
        { id: body.id, user_id: body.user_id, product_id: body.product_id },
        assertMessage({ request, expected: `The values POST /favorites returned: ${JSON.stringify(sent)}`, actual: body })
      ).toEqual(sent);
    });

    await test.step('Verify the body has no product key.', async () => {
      expect('product' in body, assertMessage({ request, expected: 'The body has no product key', actual: Object.keys(body) })).toBe(false);
    });
  });

  test('API-0280: Get favorite without a token returns 401', async ({ favoritesClient }) => {
    let request: FavoriteRequest;
    let response: ApiResponse;

    await test.step('Send GET /favorites/{favoriteId} with a well-formed ULID that no favorite has, without an Authorization header.', async () => {
      ({ request, response } = await sendGetFavorite(favoritesClient, TestConstants.favorites.unknownId, 'none'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0281: Get favorite with a malformed token returns 401', async ({ favoritesClientWithInvalidToken }) => {
    let request: FavoriteRequest;
    let response: ApiResponse;

    await test.step('Send GET /favorites/{favoriteId} with a well-formed ULID that no favorite has, with a malformed token.', async () => {
      ({ request, response } = await sendGetFavorite(favoritesClientWithInvalidToken, TestConstants.favorites.unknownId, 'a malformed token'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0282: Get favorite with an unknown id returns 404', async ({ favoritesClientWithToken }) => {
    let request: FavoriteRequest;
    let response: ApiResponse;

    await test.step('Send GET /favorites/{favoriteId} with a well-formed ULID that no favorite has.', async () => {
      ({ request, response } = await sendGetFavorite(favoritesClientWithToken, TestConstants.favorites.unknownId, "default user's token"));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test("API-0283: Get another user's favorite is refused", async ({
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

    const { favorite } = await createCustomerWithFavorite({ usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup });
    const second = await createSecondCustomer(usersService, adminUsersService, authService, cleanup);
    test.fail(true, "Known issue BUG-021: Returns 200 with another user's favorite instead of 404 or 403.");

    await test.step("Send GET /favorites/{favoriteId} with that favorite's id, with the second customer's access_token.", async () => {
      ({ request, response } = await sendGetFavorite(favoritesClientForToken(second.token), favorite.id, AUTH.second));
    });

    await test.step('Verify the response status is 404 or 403.', async () => {
      expect(
        [404, 403].includes(response.status),
        assertMessage({ request, expected: 'Status 404 or 403', actual: { status: response.status, body: response.body.slice(0, 500) } })
      ).toBe(true);
    });
  });
});
