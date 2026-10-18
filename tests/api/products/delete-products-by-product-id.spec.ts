import { test, expect, createProductToUpdate, takeProductRefs, PRODUCT_CREATE_STEP, AUTH, sendAndAttach } from '@fixtures';
import { expectStatus, parseJson } from '@utils/apiChecks';
import type { ApiResponse } from '@api/clients/BaseClient';
import { TestConstants } from '@data/TestConstants';
import { ProductFactory, type ProductRefs } from '@data/factories/ProductFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/delete-products-by-product-id.yml

type Request = { method: string; path: string; auth: string };

test.describe('@products-api - Products API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0058: Admin deletes a product', async ({ productsService, adminProductsService, productsClient, productsClientWithToken, cleanup }) => {
      let productId: string;
      let request: Request;
      let response: ApiResponse;

      const refs = (await takeProductRefs(productsService)) as ProductRefs;

      // The DELETE under test removes the product; cleanup is a backstop if it fails, and a 404 then counts as done.
      await test.step(PRODUCT_CREATE_STEP, async () => {
        const body = ProductFactory.createProduct(refs);
        await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: AUTH.admin, body });
        const product = await adminProductsService.create(body);
        cleanup.add(() => adminProductsService.deleteIfExists(product.id));
        await attachJson('Create Product Response', product);
        expect(product.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: product })).toBeTruthy();
        productId = product.id;
      });

      await test.step("Send DELETE /products/{productId} with that id, with the admin's token.", async () => {
        ({ request, response } = await sendAndAttach('Delete Product', { method: 'DELETE', path: `/products/${productId}`, auth: AUTH.admin }, () => productsClientWithToken.deleteById(productId)));
      });

      await test.step('Verify the response status is 204.', async () => {
        expectStatus(request, response, 204);
      });

      // The product was never read before the DELETE, so no cached copy of it can exist.
      await test.step('Verify GET /products/{productId} with that id returns 404.', async () => {
        const { request: getRequest, response: getResponse } = await sendAndAttach('Get Product', { method: 'GET', path: `/products/${productId}` }, () => productsClient.getById(productId));
        expectStatus(getRequest, getResponse, 404);
      });
    });
  });

  test('API-0059: Delete product without a token returns 401', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    let request: Request;
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send DELETE /products/{productId} with that id, without an Authorization header.', async () => {
      ({ request, response } = await sendAndAttach('Delete Product', { method: 'DELETE', path: `/products/${productId}`, auth: AUTH.none }, () => productsClient.deleteById(productId)));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      const body = parseJson<{ message?: string }>(request, response);
      expect(body.message, assertMessage({ request, expected: 'message is "Unauthorized"', actual: body })).toBe('Unauthorized');
    });
  });

  test('API-0060: Delete product with an invalid token returns 401', async ({
    productsService,
    adminProductsService,
    productsClientWithInvalidToken,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send DELETE /products/{productId} with that id, with an invalid token.', async () => {
      ({ request, response } = await sendAndAttach('Delete Product', { method: 'DELETE', path: `/products/${productId}`, auth: 'invalid token' }, () => productsClientWithInvalidToken.deleteById(productId)));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      const body = parseJson<{ message?: string }>(request, response);
      expect(body.message, assertMessage({ request, expected: 'message is "Unauthorized"', actual: body })).toBe('Unauthorized');
    });
  });

  test('API-0061: Delete product as a non-admin user returns 403', async ({
    productsService,
    adminProductsService,
    productsClientWithToken,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step("Send DELETE /products/{productId} with that id, with the default user's token.", async () => {
      ({ request, response } = await sendAndAttach('Delete Product', { method: 'DELETE', path: `/products/${productId}`, auth: AUTH.defaultUser }, () => productsClientWithToken.deleteById(productId)));
    });

    await test.step('Verify the response status is 403.', async () => {
      expectStatus(request, response, 403);
    });

    await test.step('Verify the body\'s message is "Forbidden".', async () => {
      const body = parseJson<{ message?: string }>(request, response);
      expect(body.message, assertMessage({ request, expected: 'message is "Forbidden"', actual: body })).toBe('Forbidden');
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0062: Delete product with an unknown id returns 404', async ({ productsClientWithToken }) => {
      const unknownId = TestConstants.products.unknownId;
      let request: Request;
      let response: ApiResponse;

      await test.step("Send DELETE /products/{productId} with a well-formed ULID that no product has, with the admin's token.", async () => {
        ({ request, response } = await sendAndAttach('Delete Product', { method: 'DELETE', path: `/products/${unknownId}`, auth: AUTH.admin }, () => productsClientWithToken.deleteById(unknownId)));
      });

      await test.step('Verify the response status is 404.', async () => {
        expectStatus(request, response, 404);
      });

      await test.step('Verify the body\'s message is "Requested item not found".', async () => {
        const body = parseJson<{ message?: string }>(request, response);
        expect(body.message, assertMessage({ request, expected: 'message is "Requested item not found"', actual: body })).toBe(
          'Requested item not found'
        );
      });
    });
  });
});
