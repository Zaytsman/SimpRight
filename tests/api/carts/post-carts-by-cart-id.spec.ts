import {
  ADD_PRODUCT_STEP,
  THOR_HAMMER_MESSAGE,
  test,
  expect,
  takeProductRefs,
  createProductAndCart,
  createCartProduct,
  createCart,
  addItemSetup,
  findThorHammerId,
  firstListedProductId,
  getCartOk,
  expectSingleItem,
  expectNoItems,
  NON_RENTAL_PRODUCT_STEP,
  RENTAL_PRODUCT_STEP,
  ADD_NON_RENTAL_STEP,
  ADD_RENTAL_STEP,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CartsClient } from '@api/clients/CartsClient';
import type { AddCartItemRequest, Cart, CartItem, CartItemResult } from '@api/dto/cart';
import type { FieldValidationError } from '@api/dto/common';
import { TestConstants } from '@data/TestConstants';
import { expectErrorKeysPresent, expectMessage } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/carts/post-carts-by-cart-id.yml

const LOCATION_OFFER_PRODUCT_STEP =
  "Send POST /products with a unique product name, a positive price, those ids, is_location_offer true, is_rental false and stock 10, and take the new product's id.";
const SAME_BODY_AGAIN_STEP = 'Send POST /carts/{cartId} with the same cart id and body again.';

type AddItemRequest = { method: 'POST'; path: string; body: AddCartItemRequest | Record<string, unknown> };

/** Sends POST /carts/{cartId} with the given body, and attaches the request and the response. */
async function sendAddItemBody(
  cartsClient: CartsClient,
  cartId: string,
  body: AddCartItemRequest | Record<string, unknown>
): Promise<{ request: AddItemRequest; response: ApiResponse }> {
  const request: AddItemRequest = { method: 'POST', path: `/carts/${cartId}`, body };
  const response = await cartsClient.addItem(cartId, request.body);
  await attachJson('Add Item Request', request);
  await attachJson('Add Item Response', { status: response.status, body: response.body });
  return { request, response };
}

/** Sends POST /carts/{cartId} with the product and quantity, and attaches the request and the response. */
async function sendAddItem(cartsClient: CartsClient, cartId: string, productId: string, quantity: number): Promise<{ request: AddItemRequest; response: ApiResponse }> {
  return sendAddItemBody(cartsClient, cartId, { product_id: productId, quantity });
}

/** The checks of "its only item has discount_percentage <n>"; returns that item. */
function expectOnlyItemDiscount(cartId: string, cart: Cart, percentage: number): CartItem {
  const request = { method: 'GET', path: `/carts/${cartId}` };
  expect(cart.cart_items.length, assertMessage({ request, expected: 'cart_items has exactly one item', actual: cart.cart_items })).toBe(1);
  const item = cart.cart_items[0]!;
  expect(item.discount_percentage, assertMessage({ request, expected: `discount_percentage is ${percentage}`, actual: item })).toBe(percentage);
  return item;
}

/** The checks of "the item's discounted_price equals its product's price × <factor>, rounded to 2 decimals". */
function expectDiscountedPrice(cartId: string, item: CartItem, factor: number): void {
  const request = { method: 'GET', path: `/carts/${cartId}` };
  const expected = Math.round(Number(item.product.price) * factor * 100) / 100;
  expect(
    item.discounted_price,
    assertMessage({ request, expected: `discounted_price is ${item.product.price} × ${factor}, rounded to 2 decimals (${expected})`, actual: item })
  ).toBe(expected);
}

/** The checks of a "Verify the body's errors has a <field> key with at least one message." step (Laravel's default 422 body). */
function expectErrorsField(request: AddItemRequest, response: ApiResponse, field: string): void {
  const body = JSON.parse(response.body) as FieldValidationError;
  const messages = body.errors?.[field];
  expect(
    Array.isArray(messages) && messages.length > 0,
    assertMessage({ request, expected: `errors has a "${field}" key with at least one message`, actual: body })
  ).toBe(true);
}

test.describe('@carts-api - Carts API', () => {
  test('API-0114: Add a product with quantity 1 to a cart returns 200 and the cart holds it', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    const quantity = 1;
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;
    let cart: Cart;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, quantity));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step('Verify the body\'s result is "item added or updated".', async () => {
      const body = JSON.parse(response.body) as CartItemResult;
      expect(body.result, assertMessage({ request, expected: 'result is "item added or updated"', actual: body })).toBe('item added or updated');
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200.", async () => {
      cart = await getCartOk(cartsClient, cartId);
    });

    await test.step("Verify its cart_items has exactly one item, with the new product's id as product_id and quantity 1.", async () => {
      expectSingleItem(cartId, cart, productId, quantity);
    });
  });

  test('API-0115: Add a product with quantity 2 to a new cart puts it in the cart with quantity 2', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    const quantity = 2;
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;
    let cart: Cart;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 2.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, quantity));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200.", async () => {
      cart = await getCartOk(cartsClient, cartId);
    });

    await test.step("Verify its cart_items has exactly one item, with the new product's id as product_id and quantity 2.", async () => {
      expectSingleItem(cartId, cart, productId, quantity);
    });
  });

  test('API-0116: Add a product with quantity 0 to a cart returns 422 and adds nothing', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    const quantity = 0;
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 0.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, quantity));
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step("Verify the body's errors has a quantity key with at least one message.", async () => {
      expectErrorsField(request, response, 'quantity');
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items is empty.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectNoItems(cartId, cart);
    });
  });

  test('API-0117: Add a product with quantity 1,000,000,000 to a cart returns 422 and adds nothing', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    const quantity = 1000000000;
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1000000000.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, quantity));
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step("Verify the body's errors has a quantity key with at least one message.", async () => {
      expectErrorsField(request, response, 'quantity');
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items is empty.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectNoItems(cartId, cart);
    });
  });

  test('API-0118: Add a product with quantity 999,999,999 to a cart returns 200 and the cart holds it', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    const quantity = 999999999;
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));
    test.fail(true, 'Known issue BUG-008: Returns 422 for a quantity of 999,999,999 (the server allows at most 99) instead of adding it to the cart as the story\'s range 1 to 999,999,999 requires.');

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 999999999.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, quantity));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items has exactly one item, with the new product's id as product_id and quantity 999999999.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectSingleItem(cartId, cart, productId, quantity);
    });
  });

  test('API-0232: Add a product that is already in the cart increases its quantity', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

    await addItemSetup(cartsService, cartId, productId, 1, ADD_PRODUCT_STEP);

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 2.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, 2));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items has exactly one item, with the new product's id as product_id and quantity 3.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectSingleItem(cartId, cart, productId, 3);
    });
  });

  test('API-0233: Add a product with quantity 99 to a cart returns 200 and the cart holds it', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    const quantity = 99;
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 99.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, quantity));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items has exactly one item, with the new product's id as product_id and quantity 99.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectSingleItem(cartId, cart, productId, quantity);
    });
  });

  test('API-0234: Add a product with quantity 99 twice gives a cart line with quantity 198', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

    await addItemSetup(cartsService, cartId, productId, 99, "Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 99.");

    await test.step(SAME_BODY_AGAIN_STEP, async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, 99));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items has exactly one item, with the new product's id as product_id and quantity 198.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectSingleItem(cartId, cart, productId, 198);
    });
  });

  test('API-0235: Add an out-of-stock product to a cart returns 200 and the cart holds it', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    const refs = await takeProductRefs(productsService);
    productId = (await createCartProduct(
      adminProductsService,
      cleanup,
      refs,
      "Send POST /products with a unique product name, a positive price, those ids, is_location_offer false, is_rental false and stock 0, and take the new product's id.",
      { stock: 0 }
    )).id;
    cartId = await createCart(cartsService, cleanup);

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, 1));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items has exactly one item, with the new product's id as product_id and quantity 1.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectSingleItem(cartId, cart, productId, 1);
    });
  });

  test('API-0236: Add a rental and a non-rental product to a cart sets the additional discount to 15', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let nonRentalId: string;
    let rentalId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    const refs = await takeProductRefs(productsService);
    nonRentalId = (await createCartProduct(adminProductsService, cleanup, refs, NON_RENTAL_PRODUCT_STEP)).id;
    rentalId = (await createCartProduct(adminProductsService, cleanup, refs, RENTAL_PRODUCT_STEP, { is_rental: true })).id;
    cartId = await createCart(cartsService, cleanup);
    await addItemSetup(cartsService, cartId, nonRentalId, 1, ADD_NON_RENTAL_STEP);

    await test.step(ADD_RENTAL_STEP, async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, rentalId, 1));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 with additional_discount_percentage 15.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expect(
        cart.additional_discount_percentage,
        assertMessage({ request: { method: 'GET', path: `/carts/${cartId}` }, expected: 'additional_discount_percentage is 15', actual: cart })
      ).toBe(15);
    });
  });

  test('API-0237: Add a location offer to a cart near Amsterdam gives it a 20% discount', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;
    let item: CartItem;

    const refs = await takeProductRefs(productsService);
    productId = (await createCartProduct(adminProductsService, cleanup, refs, LOCATION_OFFER_PRODUCT_STEP, { is_location_offer: true })).id;
    cartId = await createCart(cartsService, cleanup, "Send POST /carts with lat 52 and lng 5 and take the returned id as the cart's id.", { lat: 52, lng: 5 });

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, 1));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its only item has discount_percentage 20.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      item = expectOnlyItemDiscount(cartId, cart, 20);
    });

    await test.step("Verify the item's discounted_price equals its product's price × 0.8, rounded to 2 decimals.", async () => {
      expectDiscountedPrice(cartId, item, 0.8);
    });
  });

  test('API-0238: Add a location offer to a cart at real New York coordinates gives it a 5% discount', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;
    let item: CartItem;

    const refs = await takeProductRefs(productsService);
    productId = (await createCartProduct(adminProductsService, cleanup, refs, LOCATION_OFFER_PRODUCT_STEP, { is_location_offer: true })).id;
    cartId = await createCart(cartsService, cleanup, "Send POST /carts with lat 41 and lng -74 and take the returned id as the cart's id.", { lat: 41, lng: -74 });
    test.fail(true, 'Known issue BUG-025: Gives a location offer no discount at real New York coordinates (41, -74) instead of New York\'s 5% discount.');

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, 1));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its only item has discount_percentage 5.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      item = expectOnlyItemDiscount(cartId, cart, 5);
    });

    await test.step("Verify the item's discounted_price equals its product's price × 0.95, rounded to 2 decimals.", async () => {
      expectDiscountedPrice(cartId, item, 0.95);
    });
  });

  test('API-0239: Add to cart without the required fields returns 422 for each of them', async ({ cartsService, cartsClient, cleanup }) => {
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    cartId = await createCart(cartsService, cleanup);

    await test.step("Send POST /carts/{cartId} with the cart's id and an empty JSON object as the body.", async () => {
      ({ request, response } = await sendAddItemBody(cartsClient, cartId, {}));
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step("Verify the body's errors has the keys product_id and quantity, each with at least one message.", async () => {
      expectErrorsField(request, response, 'product_id');
      expectErrorsField(request, response, 'quantity');
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items is empty.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectNoItems(cartId, cart);
    });
  });

  test('API-0240: Add to cart with an unknown product id returns 422 and adds nothing', async ({ cartsService, cartsClient, cleanup }) => {
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    cartId = await createCart(cartsService, cleanup);

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with a well-formed product id that doesn't exist as product_id and quantity 1.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, TestConstants.products.unknownId, 1));
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step("Verify the body's errors has a product_id key with at least one message.", async () => {
      expectErrorsField(request, response, 'product_id');
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items is empty.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectNoItems(cartId, cart);
    });
  });

  test('API-0241: Add to cart with a non-integer quantity returns 422 and adds nothing', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1.5.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, 1.5));
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step("Verify the body's errors has a quantity key with at least one message.", async () => {
      expectErrorsField(request, response, 'quantity');
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items is empty.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectNoItems(cartId, cart);
    });
  });

  test('API-0242: Add to cart with an unknown cart id returns 404', async ({ productsService, cartsClient }) => {
    let request: AddItemRequest;
    let response: ApiResponse;

    await test.step(
      "Send POST /carts/{cartId} with a well-formed cart id that doesn't exist and a body with an existing product's id (taken from GET /products) as product_id and quantity 1.",
      async () => {
        const productId = await firstListedProductId(productsService);
        ({ request, response } = await sendAddItem(cartsClient, TestConstants.carts.unknownId, productId, 1));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 404', actual: response.status })).toBe(404);
    });

    await test.step('Verify the body\'s message is "Cart not found".', async () => {
      expectMessage(request, response, 'Cart not found');
    });
  });

  test('API-0243: Add to cart with an empty body and an unknown cart id returns 422, not 404', async ({ cartsClient }) => {
    let request: AddItemRequest;
    let response: ApiResponse;

    await test.step("Send POST /carts/{cartId} with a well-formed cart id that doesn't exist and an empty JSON object as the body.", async () => {
      ({ request, response } = await sendAddItemBody(cartsClient, TestConstants.carts.unknownId, {}));
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step("Verify the body's errors has the keys product_id and quantity.", async () => {
      expectErrorKeysPresent(request, response, ['product_id', 'quantity']);
    });
  });

  test('API-0244: Add Thor Hammer with quantity 2 to a cart returns 400 and adds nothing', async ({ productsService, cartsService, cartsClient, cleanup }) => {
    let thorHammerId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    thorHammerId = await findThorHammerId(productsService);
    cartId = await createCart(cartsService, cleanup);

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with Thor Hammer's id as product_id and quantity 2.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, thorHammerId, 2));
    });

    await test.step('Verify the response status is 400.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 400', actual: response.status })).toBe(400);
    });

    await test.step('Verify the body\'s message is "You can only have one Thor Hammer in the cart.".', async () => {
      expectMessage(request, response, THOR_HAMMER_MESSAGE);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items is empty.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectNoItems(cartId, cart);
    });
  });

  test('API-0245: Add Thor Hammer to a cart that already holds it returns 400', async ({ productsService, cartsService, cartsClient, cleanup }) => {
    let thorHammerId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    thorHammerId = await findThorHammerId(productsService);
    cartId = await createCart(cartsService, cleanup);
    await addItemSetup(cartsService, cartId, thorHammerId, 1, "Send POST /carts/{cartId} with the cart's id and a body with Thor Hammer's id as product_id and quantity 1.");

    await test.step(SAME_BODY_AGAIN_STEP, async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, thorHammerId, 1));
    });

    await test.step('Verify the response status is 400.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 400', actual: response.status })).toBe(400);
    });

    await test.step('Verify the body\'s message is "You can only have one Thor Hammer in the cart.".', async () => {
      expectMessage(request, response, THOR_HAMMER_MESSAGE);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items has exactly one item, with Thor Hammer's id as product_id and quantity 1.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectSingleItem(cartId, cart, thorHammerId, 1, "Thor Hammer's id");
    });
  });

  test("API-0246: Add a product that isn't a location offer to a cart near Amsterdam gives it no discount", async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;
    let item: CartItem;

    const refs = await takeProductRefs(productsService);
    productId = (await createCartProduct(adminProductsService, cleanup, refs)).id;
    cartId = await createCart(cartsService, cleanup, "Send POST /carts with lat 52 and lng 5 and take the returned id as the cart's id.", { lat: 52, lng: 5 });
    test.fail(true, 'Known issue BUG-024: Applies the location discount to a product that isn\'t a location offer instead of leaving it undiscounted.');

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, 1));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its only item has discount_percentage null or 0.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      const getRequest = { method: 'GET', path: `/carts/${cartId}` };
      expect(cart.cart_items.length, assertMessage({ request: getRequest, expected: 'cart_items has exactly one item', actual: cart.cart_items })).toBe(1);
      item = cart.cart_items[0]!;
      expect(
        item.discount_percentage === null || item.discount_percentage === 0,
        assertMessage({ request: getRequest, expected: 'discount_percentage is null or 0', actual: item })
      ).toBe(true);
    });

    await test.step('Verify the item has no discounted_price.', async () => {
      expect('discounted_price' in item, assertMessage({ request: { method: 'GET', path: `/carts/${cartId}` }, expected: 'The item has no discounted_price key', actual: item })).toBe(
        false
      );
    });
  });

  test("API-0289: Add a location offer to a cart at London's coordinates (lat 51, lng 0) gives it a 25% discount", async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;
    let item: CartItem;

    const refs = await takeProductRefs(productsService);
    productId = (await createCartProduct(adminProductsService, cleanup, refs, LOCATION_OFFER_PRODUCT_STEP, { is_location_offer: true })).id;
    cartId = await createCart(cartsService, cleanup, "Send POST /carts with lat 51 and lng 0 and take the returned id as the cart's id.", { lat: 51, lng: 0 });
    test.fail(true, 'Known issue BUG-026: Gives a location offer no discount in a cart at longitude 0 (London, 51, 0) instead of London\'s 25% discount.');

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, 1));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its only item has discount_percentage 25.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      item = expectOnlyItemDiscount(cartId, cart, 25);
    });

    await test.step("Verify the item's discounted_price equals its product's price × 0.75, rounded to 2 decimals.", async () => {
      expectDiscountedPrice(cartId, item, 0.75);
    });
  });

  test('API-0326: Add a rental that is a location offer to a cart near Amsterdam gives it a 20% discount', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;
    let item: CartItem;

    const refs = await takeProductRefs(productsService);
    productId = (await createCartProduct(
      adminProductsService,
      cleanup,
      refs,
      "Send POST /products with a unique product name, a positive price, those ids, is_location_offer true, is_rental true and stock 10, and take the new product's id.",
      { is_location_offer: true, is_rental: true }
    )).id;
    cartId = await createCart(cartsService, cleanup, "Send POST /carts with lat 52 and lng 5 and take the returned id as the cart's id.", { lat: 52, lng: 5 });

    await test.step("Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1.", async () => {
      ({ request, response } = await sendAddItem(cartsClient, cartId, productId, 1));
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its only item has discount_percentage 20.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      item = expectOnlyItemDiscount(cartId, cart, 20);
    });

    await test.step("Verify the item's discounted_price equals its product's price × 0.8, rounded to 2 decimals.", async () => {
      expectDiscountedPrice(cartId, item, 0.8);
    });
  });
});
