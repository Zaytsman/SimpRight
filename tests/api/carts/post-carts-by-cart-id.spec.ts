import { test, expect, takeProductRefs, type TestFixtures } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CartsClient } from '@api/clients/CartsClient';
import type { AddCartItemRequest, Cart, CartItemResult } from '@api/dto/cart';
import type { FieldValidationError } from '@api/dto/common';
import { ProductFactory, type ProductRefs } from '@data/factories/ProductFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/carts/post-carts-by-cart-id.yml

const PRODUCT_IN_STOCK_CREATE_STEP =
  "Send POST /products with a unique product name, a positive price, those ids, is_location_offer false, is_rental false and stock 10, and take the new product's id.";
const CART_CREATE_STEP = "Send POST /carts with an empty body and take the returned id as the cart's id.";

type SetupFixtures = Pick<TestFixtures, 'productsService' | 'adminProductsService' | 'cartsService' | 'cleanup'>;
type AddItemRequest = { method: 'POST'; path: string; body: AddCartItemRequest };

/**
 * The three setup steps every scenario of this file starts with, titles verbatim: take the first listed product's ids,
 * create a product in stock with them (as admin) and an empty cart. Each removal is registered right after its create;
 * cleanup runs newest first, so the cart (whose item would block the product delete with 409) goes before the product.
 */
async function createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }: SetupFixtures): Promise<{ productId: string; cartId: string }> {
  let productId = '';
  let cartId = '';
  const refs = await takeProductRefs(productsService);

  await test.step(PRODUCT_IN_STOCK_CREATE_STEP, async () => {
    const body = ProductFactory.createProductInStock(refs as ProductRefs);
    await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: "admin's token", body });
    const product = await adminProductsService.create(body);
    cleanup.add(() => adminProductsService.delete(product.id));
    await attachJson('Create Product Response', product);
    expect(product.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: product })).toBeTruthy();
    productId = product.id;
  });

  await test.step(CART_CREATE_STEP, async () => {
    await attachJson('Create Cart Request', { method: 'POST', path: '/carts', body: {} });
    const cart = await cartsService.create({});
    cleanup.add(() => cartsService.delete(cart.id));
    await attachJson('Create Cart Response', cart);
    expect(cart.id, assertMessage({ request: { method: 'POST', path: '/carts', body: {} }, expected: 'The new cart has an id', actual: cart })).toBeTruthy();
    cartId = cart.id;
  });

  return { productId, cartId };
}

/** Sends POST /carts/{cartId} with the product and quantity, and attaches the request and the response. */
async function sendAddItem(cartsClient: CartsClient, cartId: string, productId: string, quantity: number): Promise<{ request: AddItemRequest; response: ApiResponse }> {
  const request: AddItemRequest = { method: 'POST', path: `/carts/${cartId}`, body: { product_id: productId, quantity } };
  const response = await cartsClient.addItem(cartId, request.body);
  await attachJson('Add Item Request', request);
  await attachJson('Add Item Response', { status: response.status, body: response.body });
  return { request, response };
}

/** Sends GET /carts/{cartId}, attaches the response and checks it returns 200; returns the parsed cart. */
async function getCartOk(cartsClient: CartsClient, cartId: string): Promise<Cart> {
  const request = { method: 'GET', path: `/carts/${cartId}` };
  const response = await cartsClient.getById(cartId);
  await attachJson('Get Cart Response', { status: response.status, body: response.body });
  expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
  return JSON.parse(response.body) as Cart;
}

/** The checks of "its cart_items has exactly one item, with the new product's id as product_id and quantity <n>". */
function expectSingleItem(cartId: string, cart: Cart, productId: string, quantity: number): void {
  const request = { method: 'GET', path: `/carts/${cartId}` };
  const items = cart.cart_items.map((item) => ({ product_id: item.product_id, quantity: item.quantity }));
  expect(cart.cart_items.length, assertMessage({ request, expected: 'cart_items has exactly one item', actual: items })).toBe(1);
  const item = cart.cart_items[0]!;
  expect(item.product_id, assertMessage({ request, expected: `product_id is the new product's id (${productId})`, actual: items })).toBe(productId);
  expect(item.quantity, assertMessage({ request, expected: `quantity is ${quantity}`, actual: items })).toBe(quantity);
}

/** The checks of "the cart_items is empty". */
function expectNoItems(cartId: string, cart: Cart): void {
  const request = { method: 'GET', path: `/carts/${cartId}` };
  expect(
    Array.isArray(cart.cart_items) && cart.cart_items.length === 0,
    assertMessage({ request, expected: 'cart_items is an empty array', actual: cart.cart_items })
  ).toBe(true);
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
    test.fail(true, 'Known issue BUG-008: Returns 422 for a quantity of 999,999,999 (the server allows at most 99) instead of adding it to the cart as the story\'s range 1 to 999,999,999 requires.');
    const quantity = 999999999;
    let productId: string;
    let cartId: string;
    let request: AddItemRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));

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
});
