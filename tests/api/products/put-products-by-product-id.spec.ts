import { test, expect, createProductToUpdate, expectFieldMessages } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { UpdateProductResponse } from '@api/dto/product';
import { TestConstants } from '@data/TestConstants';
import { ProductFactory } from '@data/factories/ProductFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/put-products-by-product-id.yml

test.describe('@products-api - Products API', () => {
  test('API-0043: Update product returns success', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    let newName: string;
    let request: { method: string; path: string; auth: string; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send PUT /products/{productId} with that id and a body with a new unique product name.', async () => {
      const body = ProductFactory.updateName();
      newName = body.name!;
      request = { method: 'PUT', path: `/products/${productId}`, auth: 'none', body };
      response = await productsClient.update(productId, body);
      await attachJson('Update Product Request', request);
      await attachJson('Update Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 200.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
    });

    await test.step("Verify the body's success is true.", async () => {
      const body = JSON.parse(response.body) as UpdateProductResponse;
      expect(body.success, assertMessage({ request, expected: 'success is true', actual: body })).toBe(true);
    });

    await test.step('Verify GET /products/{productId} with that id returns the new name.', async () => {
      const product = await productsService.getById(productId);
      await attachJson('Get Product Response', product);
      expect(
        product.name,
        assertMessage({ request: { method: 'GET', path: `/products/${productId}` }, expected: `name is "${newName}"`, actual: product.name })
      ).toBe(newName);
    });
  });

  test('API-0044: Update product with a name longer than 120 characters returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: { method: string; path: string; auth: string; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send PUT /products/{productId} with that id and a body with a 121-character name that starts with a unique product name.', async () => {
      const body = ProductFactory.nameTooLong();
      request = { method: 'PUT', path: `/products/${productId}`, auth: 'none', body };
      response = await productsClient.update(productId, body);
      await attachJson('Update Product Request', request);
      await attachJson('Update Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has a name key with at least one message.', async () => {
      expectFieldMessages(response, 'name', request);
    });
  });

  test('API-0045: Update product with a description longer than 1250 characters returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: { method: string; path: string; auth: string; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send PUT /products/{productId} with that id and a body with a 1251-character description.', async () => {
      const body = ProductFactory.descriptionTooLong();
      request = { method: 'PUT', path: `/products/${productId}`, auth: 'none', body };
      response = await productsClient.update(productId, body);
      await attachJson('Update Product Request', request);
      await attachJson('Update Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has a description key with at least one message.', async () => {
      expectFieldMessages(response, 'description', request);
    });
  });

  test("API-0046: Update product with a name that isn't a string returns 422", async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: { method: string; path: string; auth: string; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send PUT /products/{productId} with that id and a body with name set to a number.', async () => {
      const body = ProductFactory.nameNotString();
      request = { method: 'PUT', path: `/products/${productId}`, auth: 'none', body };
      response = await productsClient.update(productId, body);
      await attachJson('Update Product Request', request);
      await attachJson('Update Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has a name key with at least one message.', async () => {
      expectFieldMessages(response, 'name', request);
    });
  });

  test("API-0047: Update product with a description that isn't a string returns 422", async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: { method: string; path: string; auth: string; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send PUT /products/{productId} with that id and a body with description set to a number.', async () => {
      const body = ProductFactory.descriptionNotString();
      request = { method: 'PUT', path: `/products/${productId}`, auth: 'none', body };
      response = await productsClient.update(productId, body);
      await attachJson('Update Product Request', request);
      await attachJson('Update Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has a description key with at least one message.', async () => {
      expectFieldMessages(response, 'description', request);
    });
  });

  test('API-0048: Update product with a non-boolean is_location_offer returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: { method: string; path: string; auth: string; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send PUT /products/{productId} with that id and a body with is_location_offer set to the string "not-a-boolean".', async () => {
      const body = ProductFactory.isLocationOfferNotBoolean();
      request = { method: 'PUT', path: `/products/${productId}`, auth: 'none', body };
      response = await productsClient.update(productId, body);
      await attachJson('Update Product Request', request);
      await attachJson('Update Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has an is_location_offer key with at least one message.', async () => {
      expectFieldMessages(response, 'is_location_offer', request);
    });
  });

  test('API-0049: Update product with a non-boolean is_rental returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: { method: string; path: string; auth: string; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send PUT /products/{productId} with that id and a body with is_rental set to the string "not-a-boolean".', async () => {
      const body = ProductFactory.isRentalNotBoolean();
      request = { method: 'PUT', path: `/products/${productId}`, auth: 'none', body };
      response = await productsClient.update(productId, body);
      await attachJson('Update Product Request', request);
      await attachJson('Update Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has an is_rental key with at least one message.', async () => {
      expectFieldMessages(response, 'is_rental', request);
    });
  });

  test('API-0050: Update product with an unknown id returns 404', async ({ productsClient }) => {
    const unknownId = TestConstants.products.unknownId;
    let request: { method: string; path: string; auth: string; body: unknown };
    let response: ApiResponse;

    await test.step('Send PUT /products/{productId} with a well-formed ULID that no product has and a body with a unique product name.', async () => {
      const body = ProductFactory.updateName();
      request = { method: 'PUT', path: `/products/${unknownId}`, auth: 'none', body };
      response = await productsClient.update(unknownId, body);
      await attachJson('Update Product Request', request);
      await attachJson('Update Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 404.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 404', actual: response.status })).toBe(404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      const body = JSON.parse(response.body) as { message?: string };
      expect(body.message, assertMessage({ request, expected: 'message is "Requested item not found"', actual: body })).toBe('Requested item not found');
    });
  });

  test('API-0051: Update product without a token returns 401', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    test.fail(true, 'Known issue: Accepts PUT without a token instead of returning 401.');
    let request: { method: string; path: string; auth: string; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send PUT /products/{productId} with that id and a body with a new unique product name, without an Authorization header.', async () => {
      const body = ProductFactory.updateName();
      request = { method: 'PUT', path: `/products/${productId}`, auth: 'none', body };
      response = await productsClient.update(productId, body);
      await attachJson('Update Product Request', request);
      await attachJson('Update Product Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 401.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 401', actual: response.status })).toBe(401);
    });
  });
});
