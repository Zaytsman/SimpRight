import { test, expect, expectBrandItems, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Brand } from '@api/dto/brand';
import { expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/brands/get-brands.yml

test.describe('@brands-api - Brands API', () => {
  test('API-0119: List brands returns the brands', { tag: '@smoke' }, async ({ brandsClient }) => {
    const request = { method: 'GET', path: '/brands' };
    let response: ApiResponse;
    let body: Brand[];

    await test.step('Send GET /brands.', async () => {
      ({ response } = await sendAndAttach('List Brands', request, () => brandsClient.list()));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = parseJson<Brand[]>(request, response);
    });

    await test.step('Verify the body is a non-empty array.', async () => {
      expect(Array.isArray(body) && body.length > 0, assertMessage({ request, expected: 'The body is a non-empty array', actual: body })).toBe(true);
    });

    await test.step('Verify every item has a non-empty string id, name and slug.', async () => {
      expectBrandItems(request, body);
    });
  });
});
