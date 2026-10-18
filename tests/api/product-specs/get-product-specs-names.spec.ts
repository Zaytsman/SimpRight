import { test, expect, AUTH, createProductToUpdate, createProductWithSpec, createSpec, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductSpecsClient } from '@api/clients/ProductSpecsClient';
import type { SpecName } from '@api/dto/productSpec';
import { expectSomeItems, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/product-specs/get-product-specs-names.yml

const NAMES_STEP = 'Send GET /product-specs/names.';

type NamesRequest = { method: 'GET'; path: string; auth: string };

/** Sends GET /product-specs/names without a token and attaches the request and the response. */
async function sendNames(productSpecsClient: ProductSpecsClient): Promise<{ request: NamesRequest; response: ApiResponse }> {
  const request: NamesRequest = { method: 'GET', path: '/product-specs/names', auth: AUTH.none };
  return sendAndAttach('Spec Names', request, () => productSpecsClient.names());
}

test.describe('@product-specs-api - Product Specs API', () => {
  // Guest scenario: no login. The others send the names request without a token too.
  test.use({ authMode: 'none' });

  test('API-0574: List spec names returns 200 with names, values and units', async ({ productSpecsClient }) => {
    let request: NamesRequest;
    let response: ApiResponse;
    let body: SpecName[] = [];

    await test.step('Send GET /product-specs/names, without an Authorization header.', async () => {
      ({ request, response } = await sendNames(productSpecsClient));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body is a non-empty array.', async () => {
      body = parseJson<SpecName[]>(request, response);
      expect(Array.isArray(body) && body.length > 0, assertMessage({ request, expected: 'The body is a non-empty array', actual: body })).toBe(true);
    });

    await test.step('Verify every item has a name string, a values array of strings and a unit that is a string or null.', async () => {
      expectSomeItems(request, body, 'The body');
      for (const item of body) {
        const ok =
          typeof item.name === 'string' &&
          Array.isArray(item.values) &&
          item.values.every((value) => typeof value === 'string') &&
          'unit' in item &&
          (item.unit === null || typeof item.unit === 'string');
        expect(ok, assertMessage({ request, expected: 'The item has a name string, a values array of strings and a unit that is a string or null', actual: item })).toBe(true);
      }
    });

    await test.step('Verify no name appears twice.', async () => {
      const names = body.map((item) => item.name);
      const repeated = names.filter((name, index) => names.indexOf(name) !== index);
      expect(repeated, assertMessage({ request, expected: 'No name appears twice', actual: repeated })).toEqual([]);
    });

    await test.step("Verify no item's values has a repeated value.", async () => {
      const withRepeats = body.filter((item) => new Set(item.values).size !== item.values.length);
      expect(withRepeats, assertMessage({ request, expected: 'No item has a repeated value', actual: withRepeats })).toEqual([]);
    });
  });

  test('API-0575: A spec added to a product appears in the spec names', async ({
    productsService,
    adminProductsService,
    productSpecsClient,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: NamesRequest;
    let response: ApiResponse;
    let matches: SpecName[] = [];

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);
    const spec = await createSpec(
      productSpecsServiceWithToken,
      productId,
      cleanup,
      'Send POST /products/{productId}/specs with the new product\'s id and a body with a unique spec_name, spec_value "1.5" and spec_unit "kg", with the default user\'s token.'
    );

    await test.step(NAMES_STEP, async () => {
      ({ request, response } = await sendNames(productSpecsClient));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step('Verify the body has exactly one item whose name is that spec_name.', async () => {
      matches = (parseJson<SpecName[]>(request, response)).filter((item) => item.name === spec.spec_name);
      expect(matches.length, assertMessage({ request, expected: `Exactly one item named "${spec.spec_name}"`, actual: matches })).toBe(1);
    });

    await test.step('Verify that item\'s values are ["1.5"] and its unit is "kg".', async () => {
      const item = matches[0]!;
      expect({ values: item.values, unit: item.unit }, assertMessage({ request, expected: 'values ["1.5"] and unit "kg"', actual: item })).toEqual({
        values: ['1.5'],
        unit: 'kg',
      });
    });
  });

  test('API-0576: A deleted spec disappears from the spec names', async ({
    productsService,
    adminProductsService,
    productSpecsClient,
    productSpecsService,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let names: SpecName[] = [];
    let request: NamesRequest;
    let response: ApiResponse;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step(NAMES_STEP, async () => {
      names = await productSpecsService.names();
      await attachJson('Spec Names Response', names);
    });

    await test.step("Verify an item's name is that spec_name.", async () => {
      expect(
        names.some((item) => item.name === spec.spec_name),
        assertMessage({ request: { method: 'GET', path: '/product-specs/names' }, expected: `An item named "${spec.spec_name}"`, actual: names.map((item) => item.name) })
      ).toBe(true);
    });

    await test.step("Send DELETE /products/{productId}/specs/{specId} with the new product's id, the new spec's id and the default user's token.", async () => {
      await attachJson('Delete Spec Request', { method: 'DELETE', path: `/products/${productId}/specs/${spec.id}`, auth: AUTH.defaultUser });
      await productSpecsServiceWithToken.delete(productId, spec.id);
    });

    await test.step(NAMES_STEP, async () => {
      ({ request, response } = await sendNames(productSpecsClient));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify no item's name is that spec_name.", async () => {
      const matches = (parseJson<SpecName[]>(request, response)).filter((item) => item.name === spec.spec_name);
      expect(matches, assertMessage({ request, expected: `No item named "${spec.spec_name}"`, actual: matches })).toEqual([]);
    });
  });
});
