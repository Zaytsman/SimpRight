import { test, createProductAndCart, addItemSetup, ADD_PRODUCT_STEP, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CartsClient } from '@api/clients/CartsClient';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { attachJson } from '@utils/assertHelpers';

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
      const getRequest = { method: 'GET', path: `/carts/${cartId}` };
      const getResponse = await cartsClient.getById(cartId);
      await attachJson('Get Cart Response', { status: getResponse.status, body: getResponse.body });
      expectStatus(getRequest, getResponse, 404);
    });
  });

  test('API-0266: Delete cart with an unknown cart id returns 404', async ({ cartsClient }) => {
    let request: DeleteCartRequest;
    let response: ApiResponse;

    await test.step("Send DELETE /carts/{cartId} with a well-formed cart id that doesn't exist.", async () => {
      ({ request, response } = await sendDeleteCart(cartsClient, TestConstants.carts.unknownId));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Cart doesnt exists".', async () => {
      expectMessage(request, response, 'Cart doesnt exists');
    });
  });
});
