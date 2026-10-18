import { test, expect, takeProductRefs, sendCreateProduct, PRODUCT_LIST_STEP, fieldMessagesStep, type CreateProductRequestInfo, type ProductChangeFixtures, AUTH, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CreateProductRequest, Product, ProductDetails } from '@api/dto/product';
import { TestConstants } from '@data/TestConstants';
import { ProductFactory, type ProductRefs } from '@data/factories/ProductFactory';
import { expectFieldMessages, expectStatus, expectStatusAndBody, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/post-products.yml

type Request = CreateProductRequestInfo;

/**
 * The template of the "Create product with <an invalid name or description> returns 422" scenarios (API-0035..0038):
 * takes the first listed product's ids, sends POST /products without a token with the body `bodyFrom(refs)` builds
 * (title `sendStep`; a product it creates anyway is removed), then checks the 422 and the field's messages.
 */
async function checkInvalidCreate(
  { productsService, adminProductsService, productsClient, cleanup }: ProductChangeFixtures,
  sendStep: string,
  bodyFrom: (refs: ProductRefs) => CreateProductRequest,
  field: string
): Promise<void> {
  let request: Request;
  let response: ApiResponse;

  const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

  await test.step(sendStep, async () => {
    ({ request, response } = await sendCreateProduct(productsClient, bodyFrom(refs), adminProductsService, cleanup));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(fieldMessagesStep(field), async () => {
    expectFieldMessages(request, response, field);
  });
}

test.describe('@products-api - Products API', () => {
  test('API-0033: Create product returns 201 with the new product', { tag: '@smoke' }, async ({
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
        ({ request, response } = await sendCreateProduct(productsClient, sent, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
    });

    await test.step('Verify the body has a non-empty id.', async () => {
      created = parseJson<Product>(request, response);
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
      const { request: getRequest, response: getResponse } = await sendAndAttach('Get Product', { method: 'GET', path: `/products/${created.id}` }, () =>
        productsClient.getById(created.id)
      );
      const product = expectStatusAndBody<ProductDetails>(getRequest, getResponse, 200);
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
      ({ request, response } = await sendCreateProduct(productsClient, {}, adminProductsService, cleanup));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step(
      'Verify the body has the keys name, price, category_id, brand_id, product_image_id, is_location_offer and is_rental, each with at least one message.',
      async () => {
        for (const field of ['name', 'price', 'category_id', 'brand_id', 'product_image_id', 'is_location_offer', 'is_rental']) {
          expectFieldMessages(request, response, field);
        }
      }
    );

    await test.step('Verify the body\'s name messages include "The name field is required.".', async () => {
      const messages = (parseJson<Record<string, unknown>>(request, response))['name'];
      expect(
        Array.isArray(messages) && messages.includes('The name field is required.'),
        assertMessage({ request, expected: 'name messages include "The name field is required."', actual: messages })
      ).toBe(true);
    });
  });

  test('API-0035: Create product with a name longer than 120 characters returns 422', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidCreate(
      { productsService, adminProductsService, productsClient, cleanup },
      'Send POST /products with a 121-character name that starts with a unique product name, a positive price, those ids, is_location_offer false and is_rental false.',
      (refs) => ProductFactory.createProduct(refs, ProductFactory.nameTooLong()),
      'name',
    );
  });

  test('API-0036: Create product with a description longer than 1250 characters returns 422', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidCreate(
      { productsService, adminProductsService, productsClient, cleanup },
      'Send POST /products with a unique product name, a 1251-character description, a positive price, those ids, is_location_offer false and is_rental false.',
      (refs) => ProductFactory.createProduct(refs, ProductFactory.descriptionTooLong()),
      'description',
    );
  });

  test('API-0037: Create product with a subscript character in the name returns 422', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidCreate(
      { productsService, adminProductsService, productsClient, cleanup },
      'Send POST /products with a unique product name followed by a Unicode subscript character, a positive price, those ids, is_location_offer false and is_rental false.',
      (refs) => ProductFactory.createProduct(refs, ProductFactory.nameWithSubscript()),
      'name',
    );
  });

  test('API-0038: Create product with a superscript character in the description returns 422', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    await checkInvalidCreate(
      { productsService, adminProductsService, productsClient, cleanup },
      'Send POST /products with a unique product name, a description that contains a Unicode superscript character, a positive price, those ids, is_location_offer false and is_rental false.',
      (refs) => ProductFactory.createProduct(refs, ProductFactory.descriptionWithSuperscript()),
      'description',
    );
  });

  test('API-0039: Create product with an unknown category id returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's brand id and product image id.", [
      'brandId',
      'productImageId',
    ]);
    test.fail(true, "Known issue BUG-002: Returns 500 instead of 422 when category_id doesn't exist.");

    await test.step(
      'Send POST /products with a unique product name, a positive price, that brand id and product image id, is_location_offer false, is_rental false and a category_id that no category has.',
      async () => {
        const body = ProductFactory.createProduct({
          brandId: refs.brandId!,
          productImageId: refs.productImageId!,
          categoryId: TestConstants.products.unknownId,
        });
        ({ request, response } = await sendCreateProduct(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test('API-0040: Create product with an unknown brand id returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's category id and product image id.", [
      'categoryId',
      'productImageId',
    ]);
    test.fail(true, "Known issue BUG-002: Returns 500 instead of 422 when brand_id doesn't exist.");

    await test.step(
      'Send POST /products with a unique product name, a positive price, that category id and product image id, is_location_offer false, is_rental false and a brand_id that no brand has.',
      async () => {
        const body = ProductFactory.createProduct({
          brandId: TestConstants.products.unknownId,
          productImageId: refs.productImageId!,
          categoryId: refs.categoryId!,
        });
        ({ request, response } = await sendCreateProduct(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test('API-0041: Create product with an unknown product image id returns 422', async ({
    productsService,
    adminProductsService,
    productsClient,
    cleanup,
  }) => {
    let request: Request;
    let response: ApiResponse;

    const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's brand id and category id.", [
      'brandId',
      'categoryId',
    ]);
    test.fail(true, "Known issue BUG-002: Returns 500 instead of 422 when product_image_id doesn't exist.");

    await test.step(
      'Send POST /products with a unique product name, a positive price, that brand id and category id, is_location_offer false, is_rental false and a product_image_id that no product image has.',
      async () => {
        const body = ProductFactory.createProduct({
          brandId: refs.brandId!,
          productImageId: TestConstants.products.unknownId,
          categoryId: refs.categoryId!,
        });
        ({ request, response } = await sendCreateProduct(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test('API-0042: Create product without a token returns 401', async ({ productsService, adminProductsService, productsClient, cleanup }) => {
    let request: Request;
    let response: ApiResponse;

    const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;
    test.fail(true, 'Known issue BUG-001: Accepts POST without a token instead of returning 401.');

    await test.step(
      'Send POST /products with a unique product name, a positive price, those ids, is_location_offer false and is_rental false, without an Authorization header.',
      async () => {
        const body = ProductFactory.createProduct(refs);
        ({ request, response } = await sendCreateProduct(productsClient, body, adminProductsService, cleanup));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });
  });

  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0073: Create product with a CO2 rating and stock stores both', async ({
      productsService,
      adminProductsService,
      productsClientWithToken,
      cleanup,
    }) => {
      let request: Request;
      let response: ApiResponse;
      let productId = '';
      let product: ProductDetails;

      const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

      await test.step(
        'Send POST /products with a unique product name, a positive price, those ids, is_location_offer false, is_rental false, co2_rating "A" and stock 10, and take the new product\'s id.',
        async () => {
          const body = ProductFactory.createProduct(refs, { co2_rating: 'A', stock: 10 });
          ({ request, response } = await sendCreateProduct(productsClientWithToken, body, adminProductsService, cleanup, AUTH.admin));
          if (response.isSuccess) productId = (parseJson<Product>(request, response)).id;
        }
      );

      await test.step('Verify the response status is 201.', async () => {
        expectStatus(request, response, 201);
      });

      await test.step('Verify the body\'s co2_rating is "A".', async () => {
        const created = parseJson<Product>(request, response);
        expect(created.co2_rating, assertMessage({ request, expected: 'co2_rating is "A"', actual: created.co2_rating })).toBe('A');
      });

      await test.step("Send GET /products/{productId} with the new id and the admin token.", async () => {
        await attachJson('Get Product Request', { method: 'GET', path: `/products/${productId}`, auth: AUTH.admin });
        product = await adminProductsService.getById(productId);
        await attachJson('Get Product Response', product);
      });

      await test.step('Verify its co2_rating is "A" and its is_eco_friendly is true.', async () => {
        const getRequest = { method: 'GET', path: `/products/${productId}`, auth: AUTH.admin };
        expect(product.co2_rating, assertMessage({ request: getRequest, expected: 'co2_rating is "A"', actual: product.co2_rating })).toBe('A');
        expect(product.is_eco_friendly, assertMessage({ request: getRequest, expected: 'is_eco_friendly is true', actual: product.is_eco_friendly })).toBe(true);
      });

      await test.step('Verify its in_stock is 10.', async () => {
        const getRequest = { method: 'GET', path: `/products/${productId}`, auth: AUTH.admin };
        expect(product.in_stock, assertMessage({ request: getRequest, expected: 'in_stock is 10 (the stock count)', actual: product.in_stock })).toBe(10);
      });
    });
  });
});
