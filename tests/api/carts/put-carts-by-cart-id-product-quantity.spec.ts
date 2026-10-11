import {
  ADD_PRODUCT_STEP,
  THOR_HAMMER_MESSAGE,
  test,
  expect,
  createProductAndCart,
  createCart,
  addItemSetup,
  findThorHammerId,
  firstListedProductId,
  getCartOk,
  expectSingleItem,
  expectNoItems,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CartsClient } from '@api/clients/CartsClient';
import type { Cart, CartItemResult, UpdateCartItemQuantityRequest } from '@api/dto/cart';
import { TestConstants } from '@data/TestConstants';
import { expectErrorKeys, expectErrorKeysPresent, expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/carts/put-carts-by-cart-id-product-quantity.yml


type UpdateQuantityRequest = { method: 'PUT'; path: string; body: UpdateCartItemQuantityRequest | Record<string, unknown> };

/** Sends PUT /carts/{cartId}/product/quantity with the given body, and attaches the request and the response. */
async function sendUpdateQuantity(
  cartsClient: CartsClient,
  cartId: string,
  body: UpdateCartItemQuantityRequest | Record<string, unknown>
): Promise<{ request: UpdateQuantityRequest; response: ApiResponse }> {
  const request: UpdateQuantityRequest = { method: 'PUT', path: `/carts/${cartId}/product/quantity`, body };
  const response = await cartsClient.updateQuantity(cartId, body);
  await attachJson('Update Quantity Request', request);
  await attachJson('Update Quantity Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the body's result is "item added or updated"." step. */
function expectResult(request: UpdateQuantityRequest, response: ApiResponse): void {
  const body = JSON.parse(response.body) as CartItemResult;
  expect(body.result, assertMessage({ request, expected: 'result is "item added or updated"', actual: body })).toBe('item added or updated');
}

/** The checks of a "Verify the body's errors quantity messages include "<message>"." step. */
function expectQuantityMessage(request: UpdateQuantityRequest, response: ApiResponse, message: string): void {
  const body = JSON.parse(response.body) as { errors?: Record<string, string[]> };
  const messages = body.errors?.['quantity'];
  expect(
    Array.isArray(messages) && messages.includes(message),
    assertMessage({ request, expected: `errors.quantity includes "${message}"`, actual: body })
  ).toBe(true);
}

/** The checks of "its only item has quantity <n>". */
function expectOnlyItemQuantity(cartId: string, cart: Cart, quantity: number): void {
  const request = { method: 'GET', path: `/carts/${cartId}` };
  expect(cart.cart_items.length, assertMessage({ request, expected: 'cart_items has exactly one item', actual: cart.cart_items })).toBe(1);
  expect(cart.cart_items[0]!.quantity, assertMessage({ request, expected: `quantity is ${quantity}`, actual: cart.cart_items })).toBe(quantity);
}

test.describe('@carts-api - Carts API', () => {
  test('API-0251: Update item quantity replaces the quantity of a product in the cart', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: UpdateQuantityRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));
    await addItemSetup(cartsService, cartId, productId, 2, "Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 2.");

    await test.step("Send PUT /carts/{cartId}/product/quantity with the cart's id and a body with the new product's id as product_id and quantity 5.", async () => {
      ({ request, response } = await sendUpdateQuantity(cartsClient, cartId, { product_id: productId, quantity: 5 }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s result is "item added or updated".', async () => {
      expectResult(request, response);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items has exactly one item, with the new product's id as product_id and quantity 5.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectSingleItem(cartId, cart, productId, 5);
    });
  });

  test("API-0252: Update item quantity for a product that isn't in the cart returns 200 and changes nothing", async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: UpdateQuantityRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

    await test.step("Send PUT /carts/{cartId}/product/quantity with the cart's id and a body with the new product's id as product_id and quantity 5.", async () => {
      ({ request, response } = await sendUpdateQuantity(cartsClient, cartId, { product_id: productId, quantity: 5 }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body\'s result is "item added or updated".', async () => {
      expectResult(request, response);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items is empty.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectNoItems(cartId, cart);
    });
  });

  test('API-0253: Update item quantity without the required fields returns 422 for each of them', async ({ cartsService, cartsClient, cleanup }) => {
    let cartId: string;
    let request: UpdateQuantityRequest;
    let response: ApiResponse;

    cartId = await createCart(cartsService, cleanup);

    await test.step("Send PUT /carts/{cartId}/product/quantity with the cart's id and an empty JSON object as the body.", async () => {
      ({ request, response } = await sendUpdateQuantity(cartsClient, cartId, {}));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step("Verify the body's errors has the keys product_id and quantity, each with at least one message.", async () => {
      expectErrorKeys(request, response, ['product_id', 'quantity']);
    });

    await test.step('Verify the body\'s errors quantity messages include "The quantity field is required.".', async () => {
      expectQuantityMessage(request, response, 'The quantity field is required.');
    });
  });

  test('API-0254: Update item quantity with a non-integer quantity returns 422 and keeps the quantity', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: UpdateQuantityRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));
    await addItemSetup(cartsService, cartId, productId, 1, ADD_PRODUCT_STEP);

    await test.step("Send PUT /carts/{cartId}/product/quantity with the cart's id and a body with the new product's id as product_id and quantity 1.5.", async () => {
      ({ request, response } = await sendUpdateQuantity(cartsClient, cartId, { product_id: productId, quantity: 1.5 }));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body\'s errors quantity messages include "The quantity field must be an integer.".', async () => {
      expectQuantityMessage(request, response, 'The quantity field must be an integer.');
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its only item has quantity 1.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectOnlyItemQuantity(cartId, cart, 1);
    });
  });

  test('API-0255: Update item quantity with quantity 0 returns 422 and keeps the quantity', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: UpdateQuantityRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));
    await addItemSetup(cartsService, cartId, productId, 1, ADD_PRODUCT_STEP);

    await test.step("Send PUT /carts/{cartId}/product/quantity with the cart's id and a body with the new product's id as product_id and quantity 0.", async () => {
      ({ request, response } = await sendUpdateQuantity(cartsClient, cartId, { product_id: productId, quantity: 0 }));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step("Verify the body's errors has a quantity key with at least one message.", async () => {
      expectErrorKeys(request, response, ['quantity']);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its only item has quantity 1.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectOnlyItemQuantity(cartId, cart, 1);
    });
  });

  test('API-0256: Update item quantity with an unknown product id returns 422', async ({ cartsService, cartsClient, cleanup }) => {
    let cartId: string;
    let request: UpdateQuantityRequest;
    let response: ApiResponse;

    cartId = await createCart(cartsService, cleanup);

    await test.step(
      "Send PUT /carts/{cartId}/product/quantity with the cart's id and a body with a well-formed product id that doesn't exist as product_id and quantity 1.",
      async () => {
        ({ request, response } = await sendUpdateQuantity(cartsClient, cartId, { product_id: TestConstants.products.unknownId, quantity: 1 }));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step("Verify the body's errors has a product_id key with at least one message.", async () => {
      expectErrorKeys(request, response, ['product_id']);
    });
  });

  test('API-0257: Update item quantity with an unknown cart id returns 404', async ({ productsService, cartsClient }) => {
    let request: UpdateQuantityRequest;
    let response: ApiResponse;

    await test.step(
      "Send PUT /carts/{cartId}/product/quantity with a well-formed cart id that doesn't exist and a body with an existing product's id (taken from GET /products) as product_id and quantity 1.",
      async () => {
        const productId = await firstListedProductId(productsService);
        ({ request, response } = await sendUpdateQuantity(cartsClient, TestConstants.carts.unknownId, { product_id: productId, quantity: 1 }));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Cart doesn\'t exist".', async () => {
      expectMessage(request, response, "Cart doesn't exist");
    });
  });

  test('API-0258: Update item quantity with an empty body and an unknown cart id returns 422, not 404', async ({ cartsClient }) => {
    let request: UpdateQuantityRequest;
    let response: ApiResponse;

    await test.step("Send PUT /carts/{cartId}/product/quantity with a well-formed cart id that doesn't exist and an empty JSON object as the body.", async () => {
      ({ request, response } = await sendUpdateQuantity(cartsClient, TestConstants.carts.unknownId, {}));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step("Verify the body's errors has the keys product_id and quantity.", async () => {
      expectErrorKeysPresent(request, response, ['product_id', 'quantity']);
    });
  });

  test("API-0259: Update Thor Hammer's quantity to 2 returns 400 and keeps quantity 1", async ({ productsService, cartsService, cartsClient, cleanup }) => {
    let thorHammerId: string;
    let cartId: string;
    let request: UpdateQuantityRequest;
    let response: ApiResponse;

    thorHammerId = await findThorHammerId(productsService);
    cartId = await createCart(cartsService, cleanup);
    await addItemSetup(cartsService, cartId, thorHammerId, 1, "Send POST /carts/{cartId} with the cart's id and a body with Thor Hammer's id as product_id and quantity 1.");

    await test.step("Send PUT /carts/{cartId}/product/quantity with the cart's id and a body with Thor Hammer's id as product_id and quantity 2.", async () => {
      ({ request, response } = await sendUpdateQuantity(cartsClient, cartId, { product_id: thorHammerId, quantity: 2 }));
    });

    await test.step('Verify the response status is 400.', async () => {
      expectStatus(request, response, 400);
    });

    await test.step('Verify the body\'s message is "You can only have one Thor Hammer in the cart.".', async () => {
      expectMessage(request, response, THOR_HAMMER_MESSAGE);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its only item has quantity 1.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectOnlyItemQuantity(cartId, cart, 1);
    });
  });
});
