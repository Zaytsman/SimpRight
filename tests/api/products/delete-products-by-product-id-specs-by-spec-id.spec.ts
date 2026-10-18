import { test, createProductAndTakeOtherId, AUTH, createProductWithSpec, createSpec, sendGetSpec, takeFirstProductId } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductSpecsClient } from '@api/clients/ProductSpecsClient';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/delete-products-by-product-id-specs-by-spec-id.yml

type DeleteSpecRequest = { method: 'DELETE'; path: string; auth: string };

/** Sends DELETE /products/{productId}/specs/{specId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendDeleteSpec(
  productSpecsClient: ProductSpecsClient,
  productId: string,
  specId: string,
  auth: string
): Promise<{ request: DeleteSpecRequest; response: ApiResponse }> {
  const request: DeleteSpecRequest = { method: 'DELETE', path: `/products/${productId}/specs/${specId}`, auth };
  const response = await productSpecsClient.deleteById(productId, specId);
  await attachJson('Delete Spec Request', request);
  await attachJson('Delete Spec Response', { status: response.status, body: response.body });
  return { request, response };
}

test.describe('@products-api - Products API', () => {
  test('API-0569: Delete a spec returns 204 and the spec is gone', async ({
    productsService,
    adminProductsService,
    productSpecsClient,
    productSpecsClientWithToken,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: DeleteSpecRequest;
    let response: ApiResponse;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step("Send DELETE /products/{productId}/specs/{specId} with the new product's id, the new spec's id and the default user's token.", async () => {
      ({ request, response } = await sendDeleteSpec(productSpecsClientWithToken, productId, spec.id, AUTH.defaultUser));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /products/{productId}/specs/{specId} with the new product's id and the new spec's id returns 404.", async () => {
      const fetched = await sendGetSpec(productSpecsClient, productId, spec.id, 'none');
      expectStatus(fetched.request, fetched.response, 404);
    });
  });

  test('API-0570: Delete a spec without a token returns 401', async ({ productsService, adminProductsService, productSpecsClient, productSpecsServiceWithToken, cleanup }) => {
    let request: DeleteSpecRequest;
    let response: ApiResponse;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step("Send DELETE /products/{productId}/specs/{specId} with the new product's id and the new spec's id, without an Authorization header.", async () => {
      ({ request, response } = await sendDeleteSpec(productSpecsClient, productId, spec.id, 'none'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0571: Delete a spec with an invalid token returns 401', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithInvalidToken,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: DeleteSpecRequest;
    let response: ApiResponse;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step("Send DELETE /products/{productId}/specs/{specId} with the new product's id and the new spec's id, with an invalid token.", async () => {
      ({ request, response } = await sendDeleteSpec(productSpecsClientWithInvalidToken, productId, spec.id, 'invalid token'));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test("API-0572: Delete a spec under another product's id returns 204 and deletes nothing", async ({
    productsService,
    adminProductsService,
    productSpecsClient,
    productSpecsClientWithToken,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: DeleteSpecRequest;
    let response: ApiResponse;

    const { productId, otherProductId } = await createProductAndTakeOtherId(productsService, adminProductsService, cleanup);
    const spec = await createSpec(productSpecsServiceWithToken, productId, cleanup);

    await test.step("Send DELETE /products/{productId}/specs/{specId} with the other item's id, the new spec's id and the default user's token.", async () => {
      ({ request, response } = await sendDeleteSpec(productSpecsClientWithToken, otherProductId, spec.id, AUTH.defaultUser));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });

    await test.step("Verify GET /products/{productId}/specs/{specId} with the new product's id and the new spec's id returns 200.", async () => {
      const fetched = await sendGetSpec(productSpecsClient, productId, spec.id, 'none');
      expectStatus(fetched.request, fetched.response, 200);
    });
  });

  test('API-0573: Delete a spec with an unknown spec id returns 204', async ({ productsService, productSpecsClientWithToken }) => {
    let request: DeleteSpecRequest;
    let response: ApiResponse;

    const productId = await takeFirstProductId(productsService);

    await test.step("Send DELETE /products/{productId}/specs/{specId} with that id, a well-formed ULID that no spec has and the default user's token.", async () => {
      ({ request, response } = await sendDeleteSpec(productSpecsClientWithToken, productId, TestConstants.productSpecs.unknownId, AUTH.defaultUser));
    });

    await test.step('Verify the response status is 204.', async () => {
      expectStatus(request, response, 204);
    });
  });
});
