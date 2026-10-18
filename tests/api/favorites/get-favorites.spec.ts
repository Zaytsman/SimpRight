import { test, expect, AUTH, createCustomerWithFavorite, createSecondCustomer, registerThrowawayCustomer, loginThrowawayCustomer, disableCustomerSetup, sendAndAttach, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { FavoritesClient } from '@api/clients/FavoritesClient';
import type { Favorite } from '@api/dto/favorite';
import { expectEmptyArray, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/favorites/get-favorites.yml

type ListFavoritesRequest = { method: 'GET'; path: '/favorites'; auth: string };

/** Sends GET /favorites with `favoritesClient` and attaches the request and the response. */
async function sendList(favoritesClient: FavoritesClient, auth: string): Promise<{ request: ListFavoritesRequest; response: ApiResponse }> {
  const request: ListFavoritesRequest = { method: 'GET', path: '/favorites', auth };
  return sendAndAttach('List Favorites', request, () => favoritesClient.list());
}

test.describe('@favorites-api - Favorites API', () => {
  test("API-0267: List favorites returns 200 with the user's favorites and their products", async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    favoritesServiceForToken,
    favoritesClientForToken,
    cleanup,
  }) => {
    let request: ListFavoritesRequest;
    let response: ApiResponse;
    let item: Favorite | undefined;

    const { token, productId, favorite } = await createCustomerWithFavorite(
      { usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup },
      "Send POST /favorites with that product id and the throwaway customer's access_token, and take the new favorite's id and its user_id."
    );

    await test.step("Send GET /favorites with the throwaway customer's access_token.", async () => {
      ({ request, response } = await sendList(favoritesClientForToken(token), AUTH.throwaway));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body is an array that includes an item with the new favorite's id.", async () => {
      const body = parseJson<Favorite[]>(request, response);
      expect(Array.isArray(body), assertMessage({ request, expected: 'The body is an array', actual: body })).toBe(true);
      item = body.find((entry) => entry.id === favorite.id);
      expect(item, assertMessage({ request, expected: `An item with the new favorite's id ${favorite.id}`, actual: body })).toBeDefined();
    });

    await test.step("Verify that item's product_id equals the product id sent and its user_id equals the user_id returned by POST /favorites.", async () => {
      expect(item!.product_id, assertMessage({ request, expected: `product_id is the product id sent, ${productId}`, actual: item })).toBe(productId);
      expect(item!.user_id, assertMessage({ request, expected: `user_id is the one POST /favorites returned, ${favorite.user_id}`, actual: item })).toBe(
        favorite.user_id
      );
    });

    await test.step("Verify that item's product has an id equal to its product_id, a name, a price and a product_image.", async () => {
      const product = item!.product;
      expect(product?.id, assertMessage({ request, expected: `product.id equals product_id ${item!.product_id}`, actual: product })).toBe(item!.product_id);
      expect(
        typeof product?.name === 'string' && product.name.length > 0,
        assertMessage({ request, expected: 'product has a name', actual: product })
      ).toBe(true);
      expect(typeof product?.price, assertMessage({ request, expected: 'product has a price (a number)', actual: product })).toBe('number');
      expect(
        product?.product_image !== null && typeof product?.product_image === 'object',
        assertMessage({ request, expected: 'product has a product_image object', actual: product })
      ).toBe(true);
    });

    await test.step("Verify that item's product has no category key and no brand key.", async () => {
      const keys = Object.keys(item!.product ?? {});
      expect(keys.includes('category'), assertMessage({ request, expected: 'product has no category key', actual: keys })).toBe(false);
      expect(keys.includes('brand'), assertMessage({ request, expected: 'product has no brand key', actual: keys })).toBe(false);
    });
  });

  test('API-0268: List favorites of a new customer returns an empty list', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    favoritesServiceForToken,
    favoritesClientForToken,
    cleanup,
  }) => {
    let request: ListFavoritesRequest;
    let response: ApiResponse;

    await createCustomerWithFavorite(
      { usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup },
      "Send POST /favorites with that product id and the throwaway customer's access_token."
    );
    const second = await createSecondCustomer(usersService, adminUsersService, authService, cleanup);

    await test.step("Send GET /favorites with the second customer's access_token.", async () => {
      ({ request, response } = await sendList(favoritesClientForToken(second.token), AUTH.second));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is an empty array.', async () => {
      expectEmptyArray(request, response);
    });
  });

  test('API-0269: List favorites without a token returns 401', async ({ favoritesClient }) => {
    await checkStatusAndMessage(
      'Send GET /favorites without an Authorization header.',
      () => sendList(favoritesClient, 'none'),
      401,
      'Unauthorized'
    );
  });

  test('API-0270: List favorites with a malformed token returns 401', async ({ favoritesClientWithInvalidToken }) => {
    await checkStatusAndMessage(
      'Send GET /favorites with a malformed token.',
      () => sendList(favoritesClientWithInvalidToken, AUTH.malformed),
      401,
      'Unauthorized'
    );
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0271: List favorites with a disabled account's token returns 403", async ({
      usersService,
      adminUsersService,
      authService,
      favoritesClientForToken,
      cleanup,
    }) => {
      const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
      const customerToken = await loginThrowawayCustomer(authService, customer);

      // The throwaway's token isn't used before this call, so the API's cached user can't be a stale, enabled one.
      await disableCustomerSetup(adminUsersService, customer.id, "Send PATCH /users/{userId} with that id and enabled false, with the admin's token.", AUTH.admin);

      await checkStatusAndMessage(
        "Send GET /favorites with the throwaway customer's access_token.",
        () => sendList(favoritesClientForToken(customerToken), AUTH.throwaway),
        403,
        'Account disabled.'
      );
    });
  });
});
