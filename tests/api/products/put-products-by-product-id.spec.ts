import { test, expect, createProductToUpdate, createProductWithOtherRefs, takeProductRefs, PRODUCT_LIST_STEP, AUTH, sendAndAttach, checkInvalidProductChange, type AuthLabel } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductDetails } from '@api/dto/product';
import { TestConstants } from '@data/TestConstants';
import { ProductFactory, type ProductRefs } from '@data/factories/ProductFactory';
import { expectStatus, expectSuccess, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/put-products-by-product-id.yml

test.describe('@products-api - Products API', () => {
  test('API-0043: Update product returns success', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    let newName: string;
    let request: { method: string; path: string; auth: AuthLabel; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step('Send PUT /products/{productId} with that id and a body with a new unique product name.', async () => {
      const body = ProductFactory.updateName();
      newName = body.name!;
      ({ request, response } = await sendAndAttach('Update Product', { method: 'PUT', path: `/products/${productId}`, auth: AUTH.none, body }, () => productsClient.update(productId, body)));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
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

  test('API-0044: Update product with a name longer than 120 characters returns 422', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidProductChange(
      { productsService, adminProductsService, productsClient, cleanup },
      'PUT',
      'Send PUT /products/{productId} with that id and a body with a 121-character name that starts with a unique product name.',
      ProductFactory.nameTooLong(),
      'name',
    );
  });

  test('API-0045: Update product with a description longer than 1250 characters returns 422', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidProductChange(
      { productsService, adminProductsService, productsClient, cleanup },
      'PUT',
      'Send PUT /products/{productId} with that id and a body with a 1251-character description.',
      ProductFactory.descriptionTooLong(),
      'description',
    );
  });

  test("API-0046: Update product with a name that isn't a string returns 422", async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidProductChange(
      { productsService, adminProductsService, productsClient, cleanup },
      'PUT',
      'Send PUT /products/{productId} with that id and a body with name set to a number.',
      ProductFactory.nameNotString(),
      'name',
    );
  });

  test("API-0047: Update product with a description that isn't a string returns 422", async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidProductChange(
      { productsService, adminProductsService, productsClient, cleanup },
      'PUT',
      'Send PUT /products/{productId} with that id and a body with description set to a number.',
      ProductFactory.descriptionNotString(),
      'description',
    );
  });

  test('API-0048: Update product with a non-boolean is_location_offer returns 422', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidProductChange(
      { productsService, adminProductsService, productsClient, cleanup },
      'PUT',
      'Send PUT /products/{productId} with that id and a body with is_location_offer set to the string "not-a-boolean".',
      ProductFactory.isLocationOfferNotBoolean(),
      'is_location_offer',
    );
  });

  test('API-0049: Update product with a non-boolean is_rental returns 422', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidProductChange(
      { productsService, adminProductsService, productsClient, cleanup },
      'PUT',
      'Send PUT /products/{productId} with that id and a body with is_rental set to the string "not-a-boolean".',
      ProductFactory.isRentalNotBoolean(),
      'is_rental',
    );
  });

  test('API-0050: Update product with an unknown id returns 404', async ({ productsClient }) => {
    const unknownId = TestConstants.products.unknownId;
    let request: { method: string; path: string; auth: AuthLabel; body: unknown };
    let response: ApiResponse;

    await test.step('Send PUT /products/{productId} with a well-formed ULID that no product has and a body with a unique product name.', async () => {
      const body = ProductFactory.updateName();
      ({ request, response } = await sendAndAttach('Update Product', { method: 'PUT', path: `/products/${unknownId}`, auth: AUTH.none, body }, () => productsClient.update(unknownId, body)));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      const body = parseJson<{ message?: string }>(request, response);
      expect(body.message, assertMessage({ request, expected: 'message is "Requested item not found"', actual: body })).toBe('Requested item not found');
    });
  });

  test('API-0051: Update product without a token returns 401', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    let request: { method: string; path: string; auth: AuthLabel; body: unknown };
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);
    test.fail(true, 'Known issue BUG-001: Accepts PUT without a token instead of returning 401.');

    await test.step('Send PUT /products/{productId} with that id and a body with a new unique product name, without an Authorization header.', async () => {
      const body = ProductFactory.updateName();
      ({ request, response } = await sendAndAttach('Update Product', { method: 'PUT', path: `/products/${productId}`, auth: AUTH.none, body }, () => productsClient.update(productId, body)));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });
  });

  test('API-0074: Update product price, category, brand and image saves the new values', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    /** Differs from the factory's create price (9.99). */
    const newPrice = 19.99;
    let request: { method: string; path: string; auth: AuthLabel; body: unknown };
    let response: ApiResponse;
    let product: ProductDetails;

    const { productId, otherRefs } = await createProductWithOtherRefs(productsService, adminProductsService, cleanup);
    const getRequest = { method: 'GET', path: `/products/${productId}` };

    await test.step(
      'Send PUT /products/{productId} with that id and a body with a different positive price and the other category id, brand id and product image id.',
      async () => {
        const body = ProductFactory.updateRefs(otherRefs, { price: newPrice });
        ({ request, response } = await sendAndAttach('Update Product', { method: 'PUT', path: `/products/${productId}`, auth: AUTH.none, body }, () => productsClient.update(productId, body)));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step('Send GET /products/{productId} with that id.', async () => {
      product = await productsService.getById(productId);
      await attachJson('Get Product Response', product);
    });

    await test.step('Verify its price equals the new price.', async () => {
      expect(product.price, assertMessage({ request: getRequest, expected: `price is ${newPrice}`, actual: product.price })).toBe(newPrice);
    });

    await test.step('Verify its category id, brand id and product_image id equal the other ids.', async () => {
      expect(product.category?.id, assertMessage({ request: getRequest, expected: `category.id is ${otherRefs.categoryId}`, actual: product.category })).toBe(
        otherRefs.categoryId
      );
      expect(product.brand?.id, assertMessage({ request: getRequest, expected: `brand.id is ${otherRefs.brandId}`, actual: product.brand })).toBe(otherRefs.brandId);
      expect(
        product.product_image?.id,
        assertMessage({ request: getRequest, expected: `product_image.id is ${otherRefs.productImageId}`, actual: product.product_image })
      ).toBe(otherRefs.productImageId);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0075: Update product CO2 rating and stock saves the new values', async ({
      productsService,
      adminProductsService,
      productsClientWithToken,
      cleanup,
    }) => {
      let productId = '';
      let request: { method: string; path: string; auth: AuthLabel; body: unknown };
      let response: ApiResponse;
      let product: ProductDetails;

      const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

      await test.step(
        'Send POST /products with a unique product name, a positive price, those ids, is_location_offer false, is_rental false, co2_rating "D" and stock 5, and take the new product\'s id.',
        async () => {
          const body = ProductFactory.createProduct(refs, { co2_rating: 'D', stock: 5 });
          await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: AUTH.admin, body });
          const created = await adminProductsService.create(body);
          cleanup.add(() => adminProductsService.delete(created.id));
          await attachJson('Create Product Response', created);
          expect(created.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: created })).toBeTruthy();
          productId = created.id;
        }
      );

      const getRequest = { method: 'GET', path: `/products/${productId}`, auth: AUTH.admin };

      await test.step('Send PUT /products/{productId} with that id and a body with co2_rating "B" and stock 7.', async () => {
        const body = ProductFactory.updateCo2AndStock('B', 7);
        ({ request, response } = await sendAndAttach('Update Product', { method: 'PUT', path: `/products/${productId}`, auth: AUTH.admin, body }, () => productsClientWithToken.update(productId, body)));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      await test.step('Send GET /products/{productId} with that id and the admin token.', async () => {
        await attachJson('Get Product Request', getRequest);
        product = await adminProductsService.getById(productId);
        await attachJson('Get Product Response', product);
      });

      await test.step('Verify its co2_rating is "B" and its is_eco_friendly is true.', async () => {
        expect(product.co2_rating, assertMessage({ request: getRequest, expected: 'co2_rating is "B"', actual: product.co2_rating })).toBe('B');
        expect(product.is_eco_friendly, assertMessage({ request: getRequest, expected: 'is_eco_friendly is true', actual: product.is_eco_friendly })).toBe(true);
      });

      await test.step('Verify its in_stock is 7.', async () => {
        expect(product.in_stock, assertMessage({ request: getRequest, expected: 'in_stock is 7 (the stock count)', actual: product.in_stock })).toBe(7);
      });
    });
  });
});
