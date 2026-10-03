import { test, expect, createProductToUpdate, takeProductRefs, PRODUCT_CREATE_STEP } from '@fixtures';
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
        await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: "admin's token", body });
        const product = await adminProductsService.create(body);
        cleanup.add(() => adminProductsService.deleteIfExists(product.id));
        await attachJson('Create Product Response', product);
        expect(product.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: product })).toBeTruthy();
        productId = product.id;
      });

      await test.step("Send DELETE /products/{productId} with that id, with the admin's token.", async () => {
        request = { method: 'DELETE', path: `/products/${productId}`, auth: "admin's token" };
        response = await productsClientWithToken.deleteById(productId);
        await attachJson('Delete Product Request', request);
        await attachJson('Delete Product Response', { status: response.status, body: response.body });
      });

      await test.step('Verify the response status is 204.', async () => {
        expect(response.status, assertMessage({ request, expected: 'Status 204', actual: response.status })).toBe(204);
      });

      // The product was never read before the DELETE, so no cached copy of it can exist.
      await test.step('Verify GET /products/{productId} with that id returns 404.', async () => {
        const getRequest = { method: 'GET', path: `/products/${productId}` };
        const getResponse = await productsClient.getById(productId);
        await attachJson('Get Product Response', { status: getResponse.status, body: getResponse.body });
        expect(getResponse.status, assertMessage({ request: getRequest, expected: 'Status 404', actual: getResponse.status })).toBe(404);
      });
    });
  });

  test('API-0059: Delete product without a token returns 401', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    let request: Request;
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send DELETE /products/{productId} with that id, without an Authorization header.', async () => {
      request = { method: 'DELETE', path: `/products/${productId}`, auth: 'none' };
      response = await productsClient.deleteById(productId);
      await attachJson('Delete Product Request', request);
      await attachJson('Delete Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 401.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 401', actual: response.status })).toBe(401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      const body = JSON.parse(response.body) as { message?: string };
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
      request = { method: 'DELETE', path: `/products/${productId}`, auth: 'invalid token' };
      response = await productsClientWithInvalidToken.deleteById(productId);
      await attachJson('Delete Product Request', request);
      await attachJson('Delete Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 401.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 401', actual: response.status })).toBe(401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      const body = JSON.parse(response.body) as { message?: string };
      expect(body.message, assertMessage({ request, expected: 'message is "Unauthorized"', actual: body })).toBe('Unauthorized');
    });
  });

  // Skipped for now (2026-10-03): the shared default test user is locked (423) on the demo site, so the
  // login fails before the test starts. Re-enable (test.fixme -> test) when it unlocks or with an own account.
  test.fixme('API-0061: Delete product as a non-admin user returns 403', async ({
    productsService,
    adminProductsService,
    productsClientWithToken,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step("Send DELETE /products/{productId} with that id, with the default user's token.", async () => {
      request = { method: 'DELETE', path: `/products/${productId}`, auth: "default user's token" };
      response = await productsClientWithToken.deleteById(productId);
      await attachJson('Delete Product Request', request);
      await attachJson('Delete Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 403.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 403', actual: response.status })).toBe(403);
    });

    await test.step('Verify the body\'s message is "Forbidden".', async () => {
      const body = JSON.parse(response.body) as { message?: string };
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
        request = { method: 'DELETE', path: `/products/${unknownId}`, auth: "admin's token" };
        response = await productsClientWithToken.deleteById(unknownId);
        await attachJson('Delete Product Request', request);
        await attachJson('Delete Product Response', { status: response.status, body: response.body });
      });

      await test.step('Verify the response status is 404.', async () => {
        expect(response.status, assertMessage({ request, expected: 'Status 404', actual: response.status })).toBe(404);
      });

      await test.step('Verify the body\'s message is "Requested item not found".', async () => {
        const body = JSON.parse(response.body) as { message?: string };
        expect(body.message, assertMessage({ request, expected: 'message is "Requested item not found"', actual: body })).toBe(
          'Requested item not found'
        );
      });
    });
  });
});
