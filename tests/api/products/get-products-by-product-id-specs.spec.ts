import { test, expect, createProductToUpdate, findProductWithSpecs } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductSpecsClient } from '@api/clients/ProductSpecsClient';
import type { ProductSpec } from '@api/dto/product';
import { TestConstants } from '@data/TestConstants';
import { ProductSpecFactory } from '@data/factories/ProductSpecFactory';
import { expectEmptyArray, expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/get-products-by-product-id-specs.yml

const FIND_PRODUCT_STEP =
  'Find a product with at least one spec: send GET /products/{productId} for the items of GET /products until one returns a non-empty specs array, and take its id and its specs.';

type ListSpecsRequest = { method: 'GET'; path: string; auth: string; query?: Record<string, string> };

/** Sends GET /products/{productId}/specs without a token and attaches the request and the response. */
async function sendListSpecs(
  productSpecsClient: ProductSpecsClient,
  productId: string,
  query?: Record<string, string>
): Promise<{ request: ListSpecsRequest; response: ApiResponse }> {
  const request: ListSpecsRequest = { method: 'GET', path: `/products/${productId}/specs`, auth: 'none', ...(query ? { query } : {}) };
  const response = await productSpecsClient.list(productId, query);
  await attachJson('List Specs Request', request);
  await attachJson('List Specs Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The spec ids of a list body, sorted, so two lists compare as sets. */
function sortedIds(specs: ProductSpec[]): string[] {
  return specs.map((spec) => spec.id).sort();
}

test.describe('@products-api - Products API', () => {
  // Guest scenarios: no login (API-0531's setup gets the admin's token from its fixture).
  test.use({ authMode: 'none' });

  test("API-0529: List a product's specs returns 200 and its specs", async ({ productsService, productSpecsClient }) => {
    let request: ListSpecsRequest;
    let response: ApiResponse;
    let body: ProductSpec[] = [];

    const product = await findProductWithSpecs(productsService, FIND_PRODUCT_STEP);

    await test.step('Send GET /products/{productId}/specs with that id, without an Authorization header.', async () => {
      ({ request, response } = await sendListSpecs(productSpecsClient, product.id));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is a non-empty array.', async () => {
      body = JSON.parse(response.body) as ProductSpec[];
      expect(Array.isArray(body) && body.length > 0, assertMessage({ request, expected: 'The body is a non-empty array', actual: body })).toBe(true);
    });

    await test.step(
      'Verify every item has id, product_id, spec_name, spec_value and spec_unit, with product_id equal to that id and spec_unit a string or null.',
      async () => {
        for (const item of body) {
          const ok =
            typeof item.id === 'string' &&
            item.product_id === product.id &&
            typeof item.spec_name === 'string' &&
            typeof item.spec_value === 'string' &&
            'spec_unit' in item &&
            (item.spec_unit === null || typeof item.spec_unit === 'string');
          expect(
            ok,
            assertMessage({
              request,
              expected: `The item has id, product_id ${product.id}, spec_name, spec_value and spec_unit (a string or null)`,
              actual: item,
            })
          ).toBe(true);
        }
      }
    );

    await test.step("Verify the items' ids are the same set as the ids in that product's specs array.", async () => {
      const expected = sortedIds(product.specs);
      expect(sortedIds(body), assertMessage({ request, expected: `The spec ids of GET /products/${product.id}: ${expected.join(', ')}`, actual: sortedIds(body) })).toEqual(
        expected
      );
    });
  });

  test("API-0530: List specs of a product that doesn't exist returns an empty array", async ({ productSpecsClient }) => {
    let request: ListSpecsRequest;
    let response: ApiResponse;

    await test.step('Send GET /products/{productId}/specs with a well-formed ULID that no product has, without an Authorization header.', async () => {
      ({ request, response } = await sendListSpecs(productSpecsClient, TestConstants.products.unknownId));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is an empty array.', async () => {
      expectEmptyArray(request, response);
    });
  });

  test('API-0531: List specs of a product without specs returns an empty array', async ({ productsService, adminProductsService, productSpecsClient, cleanup }) => {
    let request: ListSpecsRequest;
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step("Send GET /products/{productId}/specs with the new product's id.", async () => {
      ({ request, response } = await sendListSpecs(productSpecsClient, productId));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is an empty array.', async () => {
      expectEmptyArray(request, response);
    });
  });

  test('API-0532: List specs ignores query parameters', async ({ productsService, productSpecsClient }) => {
    let idsWithoutQuery: string[] = [];
    let request: ListSpecsRequest;
    let response: ApiResponse;

    const product = await findProductWithSpecs(productsService, FIND_PRODUCT_STEP);

    await test.step('Send GET /products/{productId}/specs with that id and take the spec ids of the body.', async () => {
      const first = await sendListSpecs(productSpecsClient, product.id);
      expectStatus(first.request, first.response, 200);
      idsWithoutQuery = sortedIds(JSON.parse(first.response.body) as ProductSpec[]);
    });

    await test.step(
      "Send GET /products/{productId}/specs with that id and the query parameter spec_name set to a value that matches none of the product's spec names.",
      async () => {
        // A unique name: no spec has it unless a test creates one with it.
        ({ request, response } = await sendListSpecs(productSpecsClient, product.id, { spec_name: ProductSpecFactory.specName() }));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's ids are the same set as without the query parameter.", async () => {
      const ids = sortedIds(JSON.parse(response.body) as ProductSpec[]);
      expect(ids, assertMessage({ request, expected: `The ids without the query parameter: ${idsWithoutQuery.join(', ')}`, actual: ids })).toEqual(idsWithoutQuery);
    });
  });

  test('API-0533: List specs with a lower-case product id returns the same specs', async ({ productsService, productSpecsClient }) => {
    let request: ListSpecsRequest;
    let response: ApiResponse;

    const product = await findProductWithSpecs(productsService, FIND_PRODUCT_STEP);

    await test.step('Send GET /products/{productId}/specs with that id in lower case.', async () => {
      ({ request, response } = await sendListSpecs(productSpecsClient, product.id.toLowerCase()));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's ids are the same set as the ids in that product's specs array.", async () => {
      const expected = sortedIds(product.specs);
      const ids = sortedIds(JSON.parse(response.body) as ProductSpec[]);
      expect(ids, assertMessage({ request, expected: `The spec ids of GET /products/${product.id}: ${expected.join(', ')}`, actual: ids })).toEqual(expected);
    });
  });
});
