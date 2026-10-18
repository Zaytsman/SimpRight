import { ADD_PRODUCT_STEP, test, expect, takeProductRefs, createCartProduct, createCart, addItemSetup, NON_RENTAL_PRODUCT_STEP, RENTAL_PRODUCT_STEP, ADD_NON_RENTAL_STEP, ADD_RENTAL_STEP, CART_PRODUCT_IN_STOCK_STEP, AUTH, sendAndAttach, withHeaders, checkStatusAndMessage, type AuthLabel } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CartsClient } from '@api/clients/CartsClient';
import type { Cart, CartItem } from '@api/dto/cart';
import { TestConstants } from '@data/TestConstants';
import { expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/carts/get-carts-by-cart-id.yml

type GetCartRequest = { method: 'GET'; path: string; auth: AuthLabel };

/** Sends GET /carts/{cartId} with the given client and attaches the request and the response. `auth` describes the client's token. */
async function sendGetCart(client: CartsClient, cartId: string, auth: AuthLabel = AUTH.none): Promise<{ request: GetCartRequest; response: ApiResponse }> {
  const request: GetCartRequest = { method: 'GET', path: `/carts/${cartId}`, auth };
  return sendAndAttach('Get Cart', request, () => client.getById(cartId), withHeaders);
}

/** The cart's only item, checked to be the only one. */
function onlyItem(request: GetCartRequest, cart: Cart): CartItem {
  expect(cart.cart_items.length, assertMessage({ request, expected: 'cart_items has exactly one item', actual: cart.cart_items })).toBe(1);
  return cart.cart_items[0]!;
}

test.describe('@carts-api - Carts API', () => {
  test('API-0247: Get cart returns 200 with its items and their products', async ({ productsService, adminProductsService, cartsService, cartsClient, cleanup }) => {
    let productId: string;
    let productName: string;
    let cartId: string;
    let request: GetCartRequest;
    let response: ApiResponse;
    let cart: Cart;
    let item: CartItem;

    const refs = await takeProductRefs(productsService);
    ({ id: productId, name: productName } = await createCartProduct(adminProductsService, cleanup, refs, CART_PRODUCT_IN_STOCK_STEP));
    cartId = await createCart(cartsService, cleanup);
    await addItemSetup(cartsService, cartId, productId, 2, "Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 2.");

    await test.step("Send GET /carts/{cartId} with the cart's id, without an Authorization header.", async () => {
      ({ request, response } = await sendGetCart(cartsClient, cartId));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      cart = parseJson<Cart>(request, response);
    });

    await test.step('Verify the Cache-Control header contains no-cache and private.', async () => {
      const cacheControl = response.headers['cache-control'] ?? '';
      expect(cacheControl.includes('no-cache'), assertMessage({ request, expected: 'Cache-Control contains no-cache', actual: cacheControl })).toBe(true);
      expect(cacheControl.includes('private'), assertMessage({ request, expected: 'Cache-Control contains private', actual: cacheControl })).toBe(true);
    });

    await test.step("Verify the body's id is the cart's id and it has the keys additional_discount_percentage, lat, lng and cart_items.", async () => {
      expect(cart.id, assertMessage({ request, expected: `id is the cart's id (${cartId})`, actual: cart.id })).toBe(cartId);
      for (const key of ['additional_discount_percentage', 'lat', 'lng', 'cart_items']) {
        expect(key in cart, assertMessage({ request, expected: `The body has the key ${key}`, actual: Object.keys(cart) })).toBe(true);
      }
    });

    await test.step("Verify cart_items has exactly one item with a non-empty id, quantity 2, the cart's id as cart_id and the new product's id as product_id.", async () => {
      item = onlyItem(request, cart);
      expect(typeof item.id === 'string' && item.id.length > 0, assertMessage({ request, expected: 'The item has a non-empty id', actual: item })).toBe(true);
      expect(item.quantity, assertMessage({ request, expected: 'quantity is 2', actual: item })).toBe(2);
      expect(item.cart_id, assertMessage({ request, expected: `cart_id is the cart's id (${cartId})`, actual: item })).toBe(cartId);
      expect(item.product_id, assertMessage({ request, expected: `product_id is the new product's id (${productId})`, actual: item })).toBe(productId);
    });

    await test.step("Verify the item's discount_percentage is null and it has no discounted_price.", async () => {
      expect(item.discount_percentage, assertMessage({ request, expected: 'discount_percentage is null', actual: item })).toBeNull();
      expect('discounted_price' in item, assertMessage({ request, expected: 'The item has no discounted_price key', actual: Object.keys(item) })).toBe(false);
    });

    await test.step(
      "Verify the item's product has the keys id, name, description, price, is_location_offer, is_rental, co2_rating, in_stock and is_eco_friendly, with the new product's name as name.",
      async () => {
        const keys = ['id', 'name', 'description', 'price', 'is_location_offer', 'is_rental', 'co2_rating', 'in_stock', 'is_eco_friendly'];
        for (const key of keys) {
          expect(key in item.product, assertMessage({ request, expected: `The product has the key ${key}`, actual: Object.keys(item.product) })).toBe(true);
        }
        expect(item.product.name, assertMessage({ request, expected: `name is the new product's name (${productName})`, actual: item.product })).toBe(productName);
      }
    );

    await test.step("Verify the item's product in_stock is a boolean.", async () => {
      expect(typeof item.product.in_stock, assertMessage({ request, expected: 'in_stock is a boolean', actual: item.product })).toBe('boolean');
    });

    await test.step("Verify the item's product has no product_image, category or brand key.", async () => {
      for (const key of ['product_image', 'category', 'brand']) {
        expect(key in item.product, assertMessage({ request, expected: `The product has no ${key} key`, actual: Object.keys(item.product) })).toBe(false);
      }
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test("API-0248: Get cart with an admin token returns each product's in_stock as the stock count", async ({
      productsService,
      adminProductsService,
      cartsService,
      cartsClientWithToken,
      cleanup,
    }) => {
      let productId: string;
      let cartId: string;
      let request: GetCartRequest;
      let response: ApiResponse;

      const refs = await takeProductRefs(productsService);
      productId = (await createCartProduct(adminProductsService, cleanup, refs, CART_PRODUCT_IN_STOCK_STEP)).id;
      cartId = await createCart(cartsService, cleanup);
      await addItemSetup(cartsService, cartId, productId, 1, ADD_PRODUCT_STEP);

      await test.step("Send GET /carts/{cartId} with the cart's id, with the admin's token.", async () => {
        ({ request, response } = await sendGetCart(cartsClientWithToken, cartId, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the only item's product in_stock is the number 10.", async () => {
        const item = onlyItem(request, parseJson<Cart>(request, response));
        expect(item.product.in_stock, assertMessage({ request, expected: 'in_stock is the number 10', actual: item.product })).toBe(10);
      });
    });
  });

  test('API-0249: Get cart with an unknown cart id returns 404', async ({ cartsClient }) => {
    await checkStatusAndMessage(
      "Send GET /carts/{cartId} with a well-formed cart id that doesn't exist.",
      () => sendGetCart(cartsClient, TestConstants.carts.unknownId),
      404,
      'Requested item not found'
    );
  });

  test('API-0250: Get cart with a malformed cart id returns 404', async ({ cartsClient }) => {
    const malformedId = 'abc';

    await checkStatusAndMessage(
      'Send GET /carts/{cartId} with abc as the cart id.',
      () => sendGetCart(cartsClient, malformedId),
      404,
      'Requested item not found'
    );
  });

  test('API-0327: Get cart returns product.is_rental true for a rental line and false for a non-rental line', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let nonRentalId: string;
    let rentalId: string;
    let cartId: string;
    let request: GetCartRequest;
    let response: ApiResponse;
    let cart: Cart;

    const refs = await takeProductRefs(productsService);
    nonRentalId = (await createCartProduct(adminProductsService, cleanup, refs, NON_RENTAL_PRODUCT_STEP)).id;
    rentalId = (await createCartProduct(adminProductsService, cleanup, refs, RENTAL_PRODUCT_STEP, { is_rental: true })).id;
    cartId = await createCart(cartsService, cleanup);
    await addItemSetup(cartsService, cartId, nonRentalId, 1, ADD_NON_RENTAL_STEP);
    await addItemSetup(cartsService, cartId, rentalId, 1, ADD_RENTAL_STEP);

    await test.step("Send GET /carts/{cartId} with the cart's id.", async () => {
      ({ request, response } = await sendGetCart(cartsClient, cartId));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      cart = parseJson<Cart>(request, response);
    });

    await test.step('Verify cart_items has exactly two items.', async () => {
      expect(cart.cart_items.length, assertMessage({ request, expected: 'cart_items has exactly two items', actual: cart.cart_items })).toBe(2);
    });

    await test.step("Verify the item whose product_id is the rental product's id has a product with is_rental true.", async () => {
      const item = cart.cart_items.find((line) => line.product_id === rentalId);
      expect(item?.product.is_rental, assertMessage({ request, expected: `The line of the rental product (${rentalId}) has is_rental true`, actual: cart.cart_items })).toBe(
        true
      );
    });

    await test.step("Verify the item whose product_id is the non-rental product's id has a product with is_rental false.", async () => {
      const item = cart.cart_items.find((line) => line.product_id === nonRentalId);
      expect(
        item?.product.is_rental,
        assertMessage({ request, expected: `The line of the non-rental product (${nonRentalId}) has is_rental false`, actual: cart.cart_items })
      ).toBe(false);
    });
  });
});
