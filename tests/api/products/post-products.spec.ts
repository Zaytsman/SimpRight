import { test, expect, takeProductRefs, expectFieldMessages, PRODUCT_LIST_STEP } from '@fixtures';
import type { Cleanup } from '@fixtures/base';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductsClient } from '@api/clients/ProductsClient';
import type { CreateProductRequest, Product, ProductDetails } from '@api/dto/product';
import type { ProductsService } from '@api/services/ProductsService';
import { TestConstants } from '@data/TestConstants';
import { ProductFactory, type ProductRefs } from '@data/factories/ProductFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/post-products.yml

type Request = { method: string; path: string; auth: string; body: unknown };

/**
 * POST /products is the call under test, so a product exists only when the response says so: register its
 * removal (as admin, DELETE is admin-only) only for a 2xx response with an id. Covers the known issue (POST
 * without a token creates the product) and any validation case that unexpectedly creates one.
 */
function removeIfCreated(response: ApiResponse, adminProductsService: ProductsService, cleanup: Cleanup): void {
  if (!response.isSuccess) return;
  let id: string | undefined;
  try {
    id = (JSON.parse(response.body) as Partial<Product>).id;
  } catch {
    return;
  }
  if (id) cleanup.add(() => adminProductsService.delete(id));
}

/** Sends the POST without a token (the public client) and attaches what was sent and what came back. */
async function sendCreate(
  productsClient: ProductsClient,
  body: CreateProductRequest | Record<string, unknown>,
  adminProductsService: ProductsService,
  cleanup: Cleanup
): Promise<{ request: Request; response: ApiResponse }> {
  const request: Request = { method: 'POST', path: '/products', auth: 'none', body };
  const response = await productsClient.create(body);
  removeIfCreated(response, adminProductsService, cleanup);
  await attachJson('Create Product Request', request);
  await attachJson('Create Product Response', { status: response.status, body: response.body });
  return { request, response };
}

test.describe('@products-api - Products API', () => {
  test('API-0033: Create product returns 201 with the new product', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let sent: CreateProductRequest;
    let request: Request;
    let response: ApiResponse;
    let created: Product;

    const refs = (await takeProductRefs(productsService)) as ProductRefs;

    await test.step(
      'Send POST /products with a unique product name, a positive price, that category id, brand id and product image id, is_location_offer false and is_rental false.',
      async () => {
        sent = ProductFactory.createProduct(refs);
        ({ request, response } = await sendCreate(productsClient, sent, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 201', actual: response.status })).toBe(201);
    });

    await test.step('Verify the body has a non-empty id.', async () => {
      created = JSON.parse(response.body) as Product;
      expect(
        typeof created.id === 'string' && created.id.length > 0,
        assertMessage({ request, expected: 'A non-empty id', actual: created.id })
      ).toBe(true);
    });

    await test.step("Verify the body's name and price equal the values sent, and its is_location_offer and is_rental are false.", async () => {
      expect(created.name, assertMessage({ request, expected: `name is "${sent.name}"`, actual: created.name })).toBe(sent.name);
      expect(created.price, assertMessage({ request, expected: `price is ${sent.price}`, actual: created.price })).toBe(sent.price);
      expect(created.is_location_offer, assertMessage({ request, expected: 'is_location_offer is false', actual: created.is_location_offer })).toBe(false);
      expect(created.is_rental, assertMessage({ request, expected: 'is_rental is false', actual: created.is_rental })).toBe(false);
    });

    await test.step("Verify the body's category id, brand id and product_image id equal the ids sent.", async () => {
      expect(created.category?.id, assertMessage({ request, expected: `category.id is ${sent.category_id}`, actual: created.category })).toBe(sent.category_id);
      expect(created.brand?.id, assertMessage({ request, expected: `brand.id is ${sent.brand_id}`, actual: created.brand })).toBe(sent.brand_id);
      expect(
        created.product_image?.id,
        assertMessage({ request, expected: `product_image.id is ${sent.product_image_id}`, actual: created.product_image })
      ).toBe(sent.product_image_id);
    });

    await test.step('Verify GET /products/{productId} with the new id returns 200 with the same name.', async () => {
      const getRequest = { method: 'GET', path: `/products/${created.id}` };
      const getResponse = await productsClient.getById(created.id);
      await attachJson('Get Product Response', { status: getResponse.status, body: getResponse.body });
      expect(getResponse.status, assertMessage({ request: getRequest, expected: 'Status 200', actual: getResponse.status })).toBe(200);
      const product = JSON.parse(getResponse.body) as ProductDetails;
      expect(product.name, assertMessage({ request: getRequest, expected: `name is "${sent.name}"`, actual: product.name })).toBe(sent.name);
    });
  });

  test('API-0034: Create product without the required fields returns 422 for each of them', async ({
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    await test.step('Send POST /products with an empty JSON object as the body.', async () => {
      ({ request, response } = await sendCreate(productsClient, {}, adminProductsService, cleanup));
    });

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step(
      'Verify the body has the keys name, price, category_id, brand_id, product_image_id, is_location_offer and is_rental, each with at least one message.',
      async () => {
        for (const field of ['name', 'price', 'category_id', 'brand_id', 'product_image_id', 'is_location_offer', 'is_rental']) {
          expectFieldMessages(response, field, request);
        }
      }
    );

    await test.step('Verify the body\'s name messages include "The name field is required.".', async () => {
      const messages = (JSON.parse(response.body) as Record<string, unknown>)['name'];
      expect(
        Array.isArray(messages) && messages.includes('The name field is required.'),
        assertMessage({ request, expected: 'name messages include "The name field is required."', actual: messages })
      ).toBe(true);
    });
  });

  test('API-0035: Create product with a name longer than 120 characters returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

    await test.step(
      'Send POST /products with a 121-character name that starts with a unique product name, a positive price, those ids, is_location_offer false and is_rental false.',
      async () => {
        const body = ProductFactory.createProduct(refs, ProductFactory.nameTooLong());
        ({ request, response } = await sendCreate(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has a name key with at least one message.', async () => {
      expectFieldMessages(response, 'name', request);
    });
  });

  test('API-0036: Create product with a description longer than 1250 characters returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

    await test.step(
      'Send POST /products with a unique product name, a 1251-character description, a positive price, those ids, is_location_offer false and is_rental false.',
      async () => {
        const body = ProductFactory.createProduct(refs, ProductFactory.descriptionTooLong());
        ({ request, response } = await sendCreate(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has a description key with at least one message.', async () => {
      expectFieldMessages(response, 'description', request);
    });
  });

  test('API-0037: Create product with a subscript character in the name returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

    await test.step(
      'Send POST /products with a unique product name followed by a Unicode subscript character, a positive price, those ids, is_location_offer false and is_rental false.',
      async () => {
        const body = ProductFactory.createProduct(refs, ProductFactory.nameWithSubscript());
        ({ request, response } = await sendCreate(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has a name key with at least one message.', async () => {
      expectFieldMessages(response, 'name', request);
    });
  });

  test('API-0038: Create product with a superscript character in the description returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

    await test.step(
      'Send POST /products with a unique product name, a description that contains a Unicode superscript character, a positive price, those ids, is_location_offer false and is_rental false.',
      async () => {
        const body = ProductFactory.createProduct(refs, ProductFactory.descriptionWithSuperscript());
        ({ request, response } = await sendCreate(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });

    await test.step('Verify the body has a description key with at least one message.', async () => {
      expectFieldMessages(response, 'description', request);
    });
  });

  test('API-0039: Create product with an unknown category id returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    test.fail(true, "Known issue: Returns 500 instead of 422 when category_id doesn't exist.");
    let request: Request;
    let response: ApiResponse;

    const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's brand id and product image id.", [
      'brandId',
      'productImageId',
    ]);

    await test.step(
      'Send POST /products with a unique product name, a positive price, that brand id and product image id, is_location_offer false, is_rental false and a category_id that no category has.',
      async () => {
        const body = ProductFactory.createProduct({
          brandId: refs.brandId!,
          productImageId: refs.productImageId!,
          categoryId: TestConstants.products.unknownId,
        });
        ({ request, response } = await sendCreate(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });
  });

  test('API-0040: Create product with an unknown brand id returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    test.fail(true, "Known issue: Returns 500 instead of 422 when brand_id doesn't exist.");
    let request: Request;
    let response: ApiResponse;

    const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's category id and product image id.", [
      'categoryId',
      'productImageId',
    ]);

    await test.step(
      'Send POST /products with a unique product name, a positive price, that category id and product image id, is_location_offer false, is_rental false and a brand_id that no brand has.',
      async () => {
        const body = ProductFactory.createProduct({
          brandId: TestConstants.products.unknownId,
          productImageId: refs.productImageId!,
          categoryId: refs.categoryId!,
        });
        ({ request, response } = await sendCreate(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });
  });

  test('API-0041: Create product with an unknown product image id returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    test.fail(true, "Known issue: Returns 500 instead of 422 when product_image_id doesn't exist.");
    let request: Request;
    let response: ApiResponse;

    const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's brand id and category id.", [
      'brandId',
      'categoryId',
    ]);

    await test.step(
      'Send POST /products with a unique product name, a positive price, that brand id and category id, is_location_offer false, is_rental false and a product_image_id that no product image has.',
      async () => {
        const body = ProductFactory.createProduct({
          brandId: refs.brandId!,
          productImageId: TestConstants.products.unknownId,
          categoryId: refs.categoryId!,
        });
        ({ request, response } = await sendCreate(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 422', actual: response.status })).toBe(422);
    });
  });

  test('API-0042: Create product without a token returns 401', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    test.fail(true, 'Known issue: Accepts POST without a token instead of returning 401.');
    let request: Request;
    let response: ApiResponse;

    const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

    await test.step(
      'Send POST /products with a unique product name, a positive price, those ids, is_location_offer false and is_rental false, without an Authorization header.',
      async () => {
        const body = ProductFactory.createProduct(refs);
        ({ request, response } = await sendCreate(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status 401', actual: response.status })).toBe(401);
    });
  });
});
