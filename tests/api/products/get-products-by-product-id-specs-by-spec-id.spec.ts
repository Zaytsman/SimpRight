import { test, expect, findProductWithSpecs, sendGetSpec, takeFirstProductId, type GetSpecRequest, AUTH } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductSpec } from '@api/dto/product';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/get-products-by-product-id-specs-by-spec-id.yml

const NOT_FOUND = 'Requested item not found';

test.describe('@products-api - Products API', () => {
  // Guest scenarios: no login. The others send no token either.
  test.use({ authMode: 'none' });

  test('API-0548: Get a spec returns 200 and the spec', async ({ productsService, productSpecsClient }) => {
    let request: GetSpecRequest;
    let response: ApiResponse;
    let body: ProductSpec;

    const product = await findProductWithSpecs(
      productsService,
      "Find a product with at least one spec: send GET /products/{productId} for the items of GET /products until one returns a non-empty specs array, and take its id and its first spec's id, spec_name, spec_value and spec_unit."
    );
    const spec = product.specs[0]!;

    await test.step("Send GET /products/{productId}/specs/{specId} with that product's id and that spec's id, without an Authorization header.", async () => {
      ({ request, response } = await sendGetSpec(productSpecsClient, product.id, spec.id, AUTH.none));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<ProductSpec>(request, response);
    });

    await test.step("Verify the body's id equals the spec's id and its product_id equals the product's id.", async () => {
      expect(
        { id: body.id, product_id: body.product_id },
        assertMessage({ request, expected: `id ${spec.id} and product_id ${product.id}`, actual: body })
      ).toEqual({ id: spec.id, product_id: product.id });
    });

    await test.step("Verify the body's spec_name, spec_value and spec_unit equal the values taken from the product.", async () => {
      const expected = { spec_name: spec.spec_name, spec_value: spec.spec_value, spec_unit: spec.spec_unit };
      expect(
        { spec_name: body.spec_name, spec_value: body.spec_value, spec_unit: body.spec_unit },
        assertMessage({ request, expected: `The values from GET /products/${product.id}: ${JSON.stringify(expected)}`, actual: body })
      ).toEqual(expected);
    });
  });

  test('API-0549: Get a spec with an unknown spec id returns 404', async ({ productsService, productSpecsClient }) => {
    let request: GetSpecRequest;
    let response: ApiResponse;

    const productId = await takeFirstProductId(productsService);

    await test.step('Send GET /products/{productId}/specs/{specId} with that id and a well-formed ULID that no spec has.', async () => {
      ({ request, response } = await sendGetSpec(productSpecsClient, productId, TestConstants.productSpecs.unknownId, AUTH.none));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step(`Verify the body's message is "${NOT_FOUND}".`, async () => {
      expectMessage(request, response, NOT_FOUND);
    });
  });

  test("API-0550: Get a spec under another product's id returns 404", async ({ productsService, productSpecsClient }) => {
    let otherProductId = '';
    let request: GetSpecRequest;
    let response: ApiResponse;

    const product = await findProductWithSpecs(
      productsService,
      "Find a product with at least one spec: send GET /products/{productId} for the items of GET /products until one returns a non-empty specs array, and take its id and its first spec's id."
    );
    const specId = product.specs[0]!.id;

    await test.step("Take the id of another item of GET /products that differs from that product's id.", async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      otherProductId = list.data.find((item) => item.id !== product.id)?.id ?? '';
      expect(
        Boolean(otherProductId),
        assertMessage({ request: { method: 'GET', path: '/products' }, expected: `An item whose id differs from ${product.id}`, actual: list.data.map((item) => item.id) })
      ).toBe(true);
    });

    await test.step("Send GET /products/{productId}/specs/{specId} with the other product's id and that spec's id.", async () => {
      ({ request, response } = await sendGetSpec(productSpecsClient, otherProductId, specId, AUTH.none));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step(`Verify the body's message is "${NOT_FOUND}".`, async () => {
      expectMessage(request, response, NOT_FOUND);
    });
  });

  test('API-0551: Get a spec of an unknown product returns 404', async ({ productsService, productSpecsClient }) => {
    let request: GetSpecRequest;
    let response: ApiResponse;

    const product = await findProductWithSpecs(
      productsService,
      "Find a product with at least one spec: send GET /products/{productId} for the items of GET /products until one returns a non-empty specs array, and take its first spec's id."
    );
    const specId = product.specs[0]!.id;

    await test.step("Send GET /products/{productId}/specs/{specId} with a well-formed ULID that no product has and that spec's id.", async () => {
      ({ request, response } = await sendGetSpec(productSpecsClient, TestConstants.products.unknownId, specId, AUTH.none));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step(`Verify the body's message is "${NOT_FOUND}".`, async () => {
      expectMessage(request, response, NOT_FOUND);
    });
  });

  test('API-0552: Get a spec with lower-case ids returns the same spec', async ({ productsService, productSpecsClient }) => {
    let request: GetSpecRequest;
    let response: ApiResponse;

    const product = await findProductWithSpecs(
      productsService,
      "Find a product with at least one spec: send GET /products/{productId} for the items of GET /products until one returns a non-empty specs array, and take its id and its first spec's id and spec_name."
    );
    const spec = product.specs[0]!;

    await test.step("Send GET /products/{productId}/specs/{specId} with the product's id and the spec's id, both in lower case, without an Authorization header.", async () => {
      ({ request, response } = await sendGetSpec(productSpecsClient, product.id.toLowerCase(), spec.id.toLowerCase(), AUTH.none));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's spec_name equals the taken spec_name.", async () => {
      const body = parseJson<ProductSpec>(request, response);
      expect(body.spec_name, assertMessage({ request, expected: `spec_name is "${spec.spec_name}"`, actual: body })).toBe(spec.spec_name);
    });
  });
});
