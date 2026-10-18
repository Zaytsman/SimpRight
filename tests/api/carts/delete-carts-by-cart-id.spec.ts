import { test, createProductAndCart, addItemSetup, ADD_PRODUCT_STEP, sendAndAttach, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CartsClient } from '@api/clients/CartsClient';
import { TestConstants } from '@data/TestConstants';
import { expectStatus } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/carts/delete-carts-by-cart-id.yml

type DeleteCartRequest = { method: 'DELETE'; path: string };

/** Sends DELETE /carts/{cartId} and attaches the request and the response. */
async function sendDeleteCart(cartsClient: CartsClient, cartId: string): Promise<{ request: DeleteCartRequest; response: ApiResponse }> {
  const request: DeleteCartRequest = { method: 'DELETE', path: `/carts/${cartId}` };
  return sendAndAttach('Delete Cart', request, () => cartsClient.deleteById(cartId));
}

test.describe('@carts-api - Carts API', () => {
  test('API-0265: Delete cart returns 204 and the cart is gone', async ({ productsService, adminProductsService, cartsService, cartsClient, cleanup }) => {
    let productId: string;
    let cartId: string;
    let request: DeleteCartRequest;
    let response: ApiResponse;

    // The cart's cleanup counts a 404 as done, because this test deletes the cart itself.
    ({ productId, cartId } = await createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }));
    await addItemSetup(cartsService, cartId, productId, 1, ADD_PRODUCT_STEP);

    await test.step("Send DELETE /carts/{cartId} with the cart's id.", async () => {
      ({ request, response } = await sendDeleteCart(cartsClient, cartId));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /carts/{cartId} with the cart's id returns 404.", async () => {
      const { request: getRequest, response: getResponse } = await sendAndAttach('Get Cart', { method: 'GET', path: `/carts/${cartId}` }, () =>
        cartsClient.getById(cartId)
      );
      expectStatus(getRequest, getResponse, 404);
    });
  });

  test('API-0266: Delete cart with an unknown cart id returns 404', async ({ cartsClient }) => {
    await checkStatusAndMessage(
      "Send DELETE /carts/{cartId} with a well-formed cart id that doesn't exist.",
      () => sendDeleteCart(cartsClient, TestConstants.carts.unknownId),
      404,
      'Cart doesnt exists'
    );
  });
});
