import {
  test,
  expect,
  createCustomerWithFavorite,
  expectGetFavoriteStatus,
  loginThrowawayCustomer,
  registerSecondCustomer,
  registerThrowawayCustomer,
  takeFirstProductId,
  THROWAWAY_TOKEN,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { FavoritesClient } from '@api/clients/FavoritesClient';
import type { CreateFavoriteRequest, Favorite } from '@api/dto/favorite';
import type { FavoritesService } from '@api/services/FavoritesService';
import type { Cleanup } from '@fixtures/base';
import { FavoriteFactory } from '@data/factories/FavoriteFactory';
import { expectFieldMessageIncludes, expectFieldMessages, expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/favorites/post-favorites.yml

type AddFavoriteRequest = { method: 'POST'; path: '/favorites'; auth: string; body: CreateFavoriteRequest | Record<string, unknown> };

/**
 * Sends POST /favorites with `favoritesClient` and attaches the request and the response. The call is the one under
 * test, so the favourite's removal is registered only when the response shows it was created (201), with `owner`, the
 * service of the same token. Calls without a token pass no owner: no user could own the record.
 */
async function sendAdd(
  favoritesClient: FavoritesClient,
  body: CreateFavoriteRequest | Record<string, unknown>,
  auth: string,
  cleanup: Cleanup,
  owner?: FavoritesService
): Promise<{ request: AddFavoriteRequest; response: ApiResponse }> {
  const request: AddFavoriteRequest = { method: 'POST', path: '/favorites', auth, body };
  const response = await favoritesClient.create(body);
  if (response.status === 201 && owner) {
    const created = JSON.parse(response.body) as Favorite;
    cleanup.add(() => owner.delete(created.id));
  }
  await attachJson('Add Favorite Request', request);
  await attachJson('Add Favorite Response', { status: response.status, body: response.body });
  return { request, response };
}

test.describe('@favorites-api - Favorites API', () => {
  test('API-0272: Add favorite returns 201 with the new favorite', { tag: '@smoke' }, async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    favoritesClientForToken,
    favoritesServiceForToken,
    cleanup,
  }) => {
    let request: AddFavoriteRequest;
    let response: ApiResponse;
    let body: Favorite;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
    const token = await loginThrowawayCustomer(authService, customer);
    const productId = await takeFirstProductId(productsService);

    await test.step("Send POST /favorites with that product id and the throwaway customer's access_token, and take the new favorite's id.", async () => {
      ({ request, response } = await sendAdd(favoritesClientForToken(token), FavoriteFactory.addFavorite(productId), THROWAWAY_TOKEN, cleanup, favoritesServiceForToken(token)));
    });

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
      body = JSON.parse(response.body) as Favorite;
    });

    await test.step("Verify the body's product_id equals the product id sent.", async () => {
      expect(body.product_id, assertMessage({ request, expected: `product_id is ${productId}`, actual: body })).toBe(productId);
    });

    await test.step('Verify the body has a non-empty id.', async () => {
      expect(typeof body.id === 'string' && body.id.length > 0, assertMessage({ request, expected: 'id is a non-empty string', actual: body })).toBe(true);
    });

    await test.step("Verify the body's user_id equals the new user's id.", async () => {
      expect(body.user_id, assertMessage({ request, expected: `user_id is the new user's id ${customer.id}`, actual: body })).toBe(customer.id);
    });

    await test.step(
      "Verify GET /favorites/{favoriteId} with the new id and the throwaway customer's access_token returns 200 with the same product_id and user_id.",
      async () => {
        const read = await expectGetFavoriteStatus(favoritesClientForToken(token), body.id, THROWAWAY_TOKEN, 200);
        const favorite = JSON.parse(read.body) as Favorite;
        const readRequest = { method: 'GET', path: `/favorites/${body.id}`, auth: THROWAWAY_TOKEN };
        expect(
          { product_id: favorite.product_id, user_id: favorite.user_id },
          assertMessage({ request: readRequest, expected: `product_id ${body.product_id} and user_id ${body.user_id}, as POST returned`, actual: favorite })
        ).toEqual({ product_id: body.product_id, user_id: body.user_id });
      }
    );
  });

  test('API-0273: Add favorite takes the user from the token, not from the body', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    favoritesClientForToken,
    favoritesServiceForToken,
    cleanup,
  }) => {
    let request: AddFavoriteRequest;
    let response: ApiResponse;

    const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
    const token = await loginThrowawayCustomer(authService, customer);
    const second = await registerSecondCustomer(usersService, adminUsersService, cleanup);
    // Not a scenario step: if the API filed the favourite under the second user, only that user's token can remove it,
    // and its own delete would get 409. Registered after its delete, so it runs first (cleanup runs newest first).
    cleanup.add(async () => {
      const login = await authService.login({ email: second.email, password: second.password });
      await favoritesServiceForToken(login.access_token).deleteAll();
    });
    const productId = await takeFirstProductId(productsService);

    await test.step(
      "Send POST /favorites with that product id and user_id set to the second user's id, with the throwaway customer's access_token, and take the new favorite's id.",
      async () => {
        ({ request, response } = await sendAdd(
          favoritesClientForToken(token),
          FavoriteFactory.addFavoriteForUser(productId, second.id),
          THROWAWAY_TOKEN,
          cleanup,
          favoritesServiceForToken(token)
        ));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
    });

    await test.step("Verify the body's user_id equals the new user's id.", async () => {
      const body = JSON.parse(response.body) as Favorite;
      expect(
        body.user_id,
        assertMessage({ request, expected: `user_id is the new user's id ${customer.id}, not the second user's id ${second.id}`, actual: body })
      ).toBe(customer.id);
    });
  });

  test('API-0274: Add favorite without a token returns 401', async ({ productsService, favoritesClient, cleanup }) => {
    let request: AddFavoriteRequest;
    let response: ApiResponse;

    const productId = await takeFirstProductId(productsService, "Send GET /products and take the first product's id.");

    await test.step('Send POST /favorites with that product id, without an Authorization header.', async () => {
      ({ request, response } = await sendAdd(favoritesClient, FavoriteFactory.addFavorite(productId), 'none', cleanup));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0275: Add favorite with a malformed token returns 401', async ({ productsService, favoritesClientWithInvalidToken, cleanup }) => {
    let request: AddFavoriteRequest;
    let response: ApiResponse;

    const productId = await takeFirstProductId(productsService, "Send GET /products and take the first product's id.");

    await test.step('Send POST /favorites with that product id, with a malformed token.', async () => {
      ({ request, response } = await sendAdd(favoritesClientWithInvalidToken, FavoriteFactory.addFavorite(productId), 'a malformed token', cleanup));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0276: Add favorite without product_id returns 422', async ({ favoritesClientWithToken, favoritesServiceWithToken, cleanup }) => {
    let request: AddFavoriteRequest;
    let response: ApiResponse;

    await test.step('Send POST /favorites with an empty JSON object as the body.', async () => {
      ({ request, response } = await sendAdd(favoritesClientWithToken, FavoriteFactory.withoutProductId(), "default user's token", cleanup, favoritesServiceWithToken));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a product_id key with at least one message.', async () => {
      expectFieldMessages(response, 'product_id', request);
    });

    await test.step('Verify the body\'s product_id messages include "The product id field is required.".', async () => {
      expectFieldMessageIncludes(request, response, 'product_id', 'The product id field is required.');
    });
  });

  test('API-0277: Add favorite with an unknown product id returns 422', async ({ favoritesClientWithToken, favoritesServiceWithToken, cleanup }) => {
    let request: AddFavoriteRequest;
    let response: ApiResponse;

    await test.step('Send POST /favorites with product_id set to a well-formed ULID that no product has.', async () => {
      ({ request, response } = await sendAdd(favoritesClientWithToken, FavoriteFactory.unknownProduct(), "default user's token", cleanup, favoritesServiceWithToken));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body\'s product_id messages include "The selected product id is invalid.".', async () => {
      expectFieldMessageIncludes(request, response, 'product_id', 'The selected product id is invalid.');
    });
  });

  test('API-0278: Add favorite with a product already in the favorites returns 409', async ({
    usersService,
    adminUsersService,
    authService,
    productsService,
    favoritesServiceForToken,
    favoritesClientForToken,
    cleanup,
  }) => {
    let request: AddFavoriteRequest;
    let response: ApiResponse;

    const { token, productId } = await createCustomerWithFavorite({ usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup });

    await test.step('Send POST /favorites with the same product id again, with the same token.', async () => {
      ({ request, response } = await sendAdd(favoritesClientForToken(token), FavoriteFactory.addFavorite(productId), THROWAWAY_TOKEN, cleanup, favoritesServiceForToken(token)));
    });

    await test.step('Verify the response status is 409.', async () => {
      expectStatus(request, response, 409);
    });

    await test.step('Verify the body\'s message is "Duplicate Entry".', async () => {
      expectMessage(request, response, 'Duplicate Entry');
    });

    await test.step("Verify GET /favorites with the throwaway customer's access_token includes exactly one favorite with that product id.", async () => {
      const listRequest = { method: 'GET', path: '/favorites', auth: THROWAWAY_TOKEN };
      await attachJson('List Favorites Request', listRequest);
      const favorites = await favoritesServiceForToken(token).list();
      await attachJson('List Favorites Response', favorites);
      const matching = favorites.filter((favorite) => favorite.product_id === productId);
      expect(
        matching.length,
        assertMessage({ request: listRequest, expected: `Exactly one favorite with product_id ${productId}`, actual: favorites.map(({ id, product_id }) => ({ id, product_id })) })
      ).toBe(1);
    });
  });
});
