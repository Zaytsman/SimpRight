import { test, expect, getCartOk, type TestFixtures, sendAndAttach, removeIfCreated } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Cart, CreateCartRequest, CreateCartResponse } from '@api/dto/cart';
import { expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/carts/post-carts.yml

type CreateCartRequestInfo = { method: 'POST'; path: '/carts'; body: CreateCartRequest };

/**
 * Sends POST /carts (the call under test) and attaches the request and the response. A cart exists only when the response
 * says so, so its removal is registered only for a 2xx response with an id.
 */
async function sendCreateCart(
  { cartsClient, cartsService, cleanup }: Pick<TestFixtures, 'cartsClient' | 'cartsService' | 'cleanup'>,
  body: CreateCartRequest
): Promise<{ request: CreateCartRequestInfo; response: ApiResponse }> {
  const request: CreateCartRequestInfo = { method: 'POST', path: '/carts', body };
  return sendAndAttach('Create Cart', request, async () => {
    const response = await cartsClient.create(body);
    removeIfCreated(response, cleanup, (id) => cartsService.deleteIfExists(id));
    return response;
  });
}

test.describe('@carts-api - Carts API', () => {
  test('API-0230: Create cart with an empty body returns 201 and an empty cart', async ({ cartsClient, cartsService, cleanup }) => {
    let request: CreateCartRequestInfo;
    let response: ApiResponse;
    let cartId: string;

    await test.step('Send POST /carts with an empty body.', async () => {
      ({ request, response } = await sendCreateCart({ cartsClient, cartsService, cleanup }, {}));
    });

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
    });

    await test.step("Verify the body's id is a non-empty string.", async () => {
      const body = parseJson<Partial<CreateCartResponse>>(request, response);
      expect(typeof body.id === 'string' && body.id.length > 0, assertMessage({ request, expected: 'id is a non-empty string', actual: body })).toBe(true);
      cartId = body.id!;
    });

    await test.step('Verify GET /carts/{cartId} with that id returns 200 with the same id and an empty cart_items.', async () => {
      const cart = await getCartOk(cartsClient, cartId);
      const getRequest = { method: 'GET', path: `/carts/${cartId}` };
      expect(cart.id, assertMessage({ request: getRequest, expected: `id is the created cart's id (${cartId})`, actual: cart })).toBe(cartId);
      expect(
        Array.isArray(cart.cart_items) && cart.cart_items.length === 0,
        assertMessage({ request: getRequest, expected: 'cart_items is an empty array', actual: cart.cart_items })
      ).toBe(true);
    });
  });

  test('API-0231: Create cart with coordinates stores them on the cart', async ({ cartsClient, cartsService, cleanup }) => {
    const body: CreateCartRequest = { lat: 52, lng: 5 };
    let request: CreateCartRequestInfo;
    let response: ApiResponse;
    let cartId: string;

    await test.step("Send POST /carts with lat 52 and lng 5 and take the returned id as the cart's id.", async () => {
      ({ request, response } = await sendCreateCart({ cartsClient, cartsService, cleanup }, body));
      // Parsed only after a successful status: a failed request may not return JSON.
      cartId = response.isSuccess ? ((parseJson<Partial<CreateCartResponse>>(request, response)).id ?? '') : '';
    });

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
    });

    await test.step('Verify GET /carts/{cartId} with the cart\'s id returns 200 with lat numerically equal to 52 and lng numerically equal to 5.', async () => {
      const cart: Cart = await getCartOk(cartsClient, cartId);
      const getRequest = { method: 'GET', path: `/carts/${cartId}` };
      expect(Number(cart.lat), assertMessage({ request: getRequest, expected: 'lat is numerically 52', actual: { lat: cart.lat, lng: cart.lng } })).toBe(52);
      expect(Number(cart.lng), assertMessage({ request: getRequest, expected: 'lng is numerically 5', actual: { lat: cart.lat, lng: cart.lng } })).toBe(5);
    });
  });
});
