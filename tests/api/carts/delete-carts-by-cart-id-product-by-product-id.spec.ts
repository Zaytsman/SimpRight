import {
  ADD_PRODUCT_STEP,
  test,
  expect,
  takeProductRefs,
  createProductAndCart,
  createCartProduct,
  createCart,
  addItemSetup,
  firstListedProductId,
  getCartOk,
  expectSingleItem,
  expectNoItems,
  NON_RENTAL_PRODUCT_STEP,
  RENTAL_PRODUCT_STEP,
  ADD_NON_RENTAL_STEP,
  ADD_RENTAL_STEP,
  type CartSetupFixtures,
  sendAndAttach,
} from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CartsClient } from '@api/clients/CartsClient';
import type { Cart } from '@api/dto/cart';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/carts/delete-carts-by-cart-id-product-by-product-id.yml


type RemoveProductRequest = { method: 'DELETE'; path: string };

/** Sends DELETE /carts/{cartId}/product/{productId} and attaches the request and the response. */
async function sendRemoveProduct(cartsClient: CartsClient, cartId: string, productId: string): Promise<{ request: RemoveProductRequest; response: ApiResponse }> {
  const request: RemoveProductRequest = { method: 'DELETE', path: `/carts/${cartId}/product/${productId}` };
  return sendAndAttach('Remove Product', request, () => cartsClient.removeProduct(cartId, productId));
}

/**
 * The setup steps of the scenarios with a non-rental and a rental product in one cart, titles verbatim: take the first
 * listed product's ids, create both products (as admin), an empty cart, and add each with quantity 1.
 */
async function createRentalAndNonRentalCart({
  productsService,
  adminProductsService,
  cartsService,
  cleanup,
}: CartSetupFixtures): Promise<{ nonRentalId: string; rentalId: string; cartId: string }> {
  const refs = await takeProductRefs(productsService);
  const nonRentalId = (await createCartProduct(adminProductsService, cleanup, refs, NON_RENTAL_PRODUCT_STEP)).id;
  const rentalId = (await createCartProduct(adminProductsService, cleanup, refs, RENTAL_PRODUCT_STEP, { is_rental: true })).id;
  const cartId = await createCart(cartsService, cleanup);
  await addItemSetup(cartsService, cartId, nonRentalId, 1, ADD_NON_RENTAL_STEP);
  await addItemSetup(cartsService, cartId, rentalId, 1, ADD_RENTAL_STEP);
  return { nonRentalId, rentalId, cartId };
}

/** The checks of "returns 200 with additional_discount_percentage <value>"; returns the cart. */
async function expectAdditionalDiscount(cartsClient: CartsClient, cartId: string, value: number | null): Promise<Cart> {
  const cart = await getCartOk(cartsClient, cartId);
  expect(
    cart.additional_discount_percentage,
    assertMessage({ request: { method: 'GET', path: `/carts/${cartId}` }, expected: `additional_discount_percentage is ${value}`, actual: cart })
  ).toBe(value);
  return cart;
}

/** The checks of "its cart_items has exactly <n> item(s), with <these ids> as product_id" (in any order). */
function expectProductIds(cartId: string, cart: Cart, productIds: string[], label: string): void {
  const actual = cart.cart_items.map((item) => item.product_id);
  expect([...actual].sort(), assertMessage({ request: { method: 'GET', path: `/carts/${cartId}` }, expected: `cart_items holds exactly ${label}`, actual })).toEqual(
    [...productIds].sort()
  );
}

test.describe('@carts-api - Carts API', () => {
  test('API-0260: Remove a product from a cart returns 204 and the cart no longer holds it', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: RemoveProductRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));
    await addItemSetup(cartsService, cartId, productId, 1, ADD_PRODUCT_STEP);

    await test.step("Send DELETE /carts/{cartId}/product/{productId} with the cart's id and the new product's id.", async () => {
      ({ request, response } = await sendRemoveProduct(cartsClient, cartId, productId));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items is empty.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectNoItems(cartId, cart);
    });
  });

  test('API-0261: Remove the rental product from a rental and non-rental cart clears the additional discount', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let nonRentalId: string;
    let rentalId: string;
    let cartId: string;
    let request: RemoveProductRequest;
    let response: ApiResponse;
    let cart: Cart;

    ({ nonRentalId, rentalId, cartId } = await createRentalAndNonRentalCart({ productsService, adminProductsService, cartsService, cleanup }));

    await test.step("Send DELETE /carts/{cartId}/product/{productId} with the cart's id and the rental product's id.", async () => {
      ({ request, response } = await sendRemoveProduct(cartsClient, cartId, rentalId));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 with additional_discount_percentage null.", async () => {
      cart = await expectAdditionalDiscount(cartsClient, cartId, null);
    });

    await test.step("Verify its cart_items has exactly one item, with the non-rental product's id as product_id.", async () => {
      expectProductIds(cartId, cart, [nonRentalId], `one item, the non-rental product (${nonRentalId})`);
    });
  });

  test('API-0262: Remove an unknown product from a cart returns 204 and keeps the cart\'s items', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: RemoveProductRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));
    await addItemSetup(cartsService, cartId, productId, 1, ADD_PRODUCT_STEP);

    await test.step("Send DELETE /carts/{cartId}/product/{productId} with the cart's id and a well-formed product id that doesn't exist.", async () => {
      ({ request, response } = await sendRemoveProduct(cartsClient, cartId, TestConstants.products.unknownId));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items has exactly one item, with the new product's id as product_id and quantity 1.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectSingleItem(cartId, cart, productId, 1);
    });
  });

  test('API-0263: Remove a product from an unknown cart returns 404', async ({ productsService, cartsClient }) => {
    let request: RemoveProductRequest;
    let response: ApiResponse;

    await test.step(
      "Send DELETE /carts/{cartId}/product/{productId} with a well-formed cart id that doesn't exist and an existing product's id (taken from GET /products).",
      async () => {
        const productId = await firstListedProductId(productsService);
        ({ request, response } = await sendRemoveProduct(cartsClient, TestConstants.carts.unknownId, productId));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Cart doesnt exists".', async () => {
      expectMessage(request, response, 'Cart doesnt exists');
    });
  });

  test('API-0264: DELETE /carts/{cartId}/product/quantity returns 204 and removes nothing', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let productId: string;
    let cartId: string;
    let request: RemoveProductRequest;
    let response: ApiResponse;

    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));
    await addItemSetup(cartsService, cartId, productId, 1, ADD_PRODUCT_STEP);

    await test.step("Send DELETE /carts/{cartId}/product/quantity with the cart's id.", async () => {
      ({ request, response } = await sendRemoveProduct(cartsClient, cartId, 'quantity'));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 and its cart_items has exactly one item, with the new product's id as product_id.", async () => {
      const cart = await getCartOk(cartsClient, cartId);
      expectProductIds(cartId, cart, [productId], `one item, the new product (${productId})`);
    });
  });

  test('API-0306: Remove the non-rental product from a rental and non-rental cart clears the additional discount and keeps the rental line', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let nonRentalId: string;
    let rentalId: string;
    let cartId: string;
    let request: RemoveProductRequest;
    let response: ApiResponse;
    let cart: Cart;

    ({ nonRentalId, rentalId, cartId } = await createRentalAndNonRentalCart({ productsService, adminProductsService, cartsService, cleanup }));

    await test.step("Send DELETE /carts/{cartId}/product/{productId} with the cart's id and the non-rental product's id.", async () => {
      ({ request, response } = await sendRemoveProduct(cartsClient, cartId, nonRentalId));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 with additional_discount_percentage null.", async () => {
      cart = await expectAdditionalDiscount(cartsClient, cartId, null);
    });

    await test.step("Verify its cart_items has exactly one item, with the rental product's id as product_id.", async () => {
      expectProductIds(cartId, cart, [rentalId], `one item, the rental product (${rentalId})`);
    });
  });

  test('API-0307: Remove one of two rental products from a cart with a non-rental product keeps the additional discount', async ({
    productsService,
    adminProductsService,
    cartsService,
    cartsClient,
    cleanup,
  }) => {
    let nonRentalId: string;
    let firstRentalId: string;
    let secondRentalId: string;
    let cartId: string;
    let request: RemoveProductRequest;
    let response: ApiResponse;
    let cart: Cart;

    const refs = await takeProductRefs(productsService);
    nonRentalId = (await createCartProduct(adminProductsService, cleanup, refs, NON_RENTAL_PRODUCT_STEP)).id;
    firstRentalId = (
      await createCartProduct(
        adminProductsService,
        cleanup,
        refs,
        "Send POST /products with a unique product name, a positive price, the same brand, category and product image ids, is_location_offer false, is_rental true and stock 10, and take the new product's id as the first rental product's id.",
        { is_rental: true }
      )
    ).id;
    secondRentalId = (
      await createCartProduct(
        adminProductsService,
        cleanup,
        refs,
        "Send POST /products with another unique product name, a positive price, the same brand, category and product image ids, is_location_offer false, is_rental true and stock 10, and take the new product's id as the second rental product's id.",
        { is_rental: true }
      )
    ).id;
    cartId = await createCart(cartsService, cleanup);
    await addItemSetup(cartsService, cartId, nonRentalId, 1, ADD_NON_RENTAL_STEP);
    await addItemSetup(cartsService, cartId, firstRentalId, 1, "Send POST /carts/{cartId} with the cart's id and a body with the first rental product's id as product_id and quantity 1.");
    await addItemSetup(cartsService, cartId, secondRentalId, 1, "Send POST /carts/{cartId} with the cart's id and a body with the second rental product's id as product_id and quantity 1.");

    await test.step("Send DELETE /carts/{cartId}/product/{productId} with the cart's id and the first rental product's id.", async () => {
      ({ request, response } = await sendRemoveProduct(cartsClient, cartId, firstRentalId));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 200 with additional_discount_percentage 15.", async () => {
      cart = await expectAdditionalDiscount(cartsClient, cartId, 15);
    });

    await test.step("Verify its cart_items has exactly two items, with the non-rental product's id and the second rental product's id as product_id.", async () => {
      expectProductIds(cartId, cart, [nonRentalId, secondRentalId], `two items, the non-rental product (${nonRentalId}) and the second rental product (${secondRentalId})`);
    });
  });
});
