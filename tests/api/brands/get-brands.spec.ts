import { test, expect, expectBrandItems } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Brand } from '@api/dto/brand';
import { expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/brands/get-brands.yml

test.describe('@brands-api - Brands API', () => {
  test('API-0119: List brands returns the brands', { tag: '@smoke' }, async ({ brandsClient }) => {
    const request = { method: 'GET', path: '/brands' };
    let response: ApiResponse;
    let body: Brand[];

    await test.step('Send GET /brands.', async () => {
      response = await brandsClient.list();
      await attachJson('List Brands Request', request);
      await attachJson('List Brands Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
      body = JSON.parse(response.body) as Brand[];
    });

    await test.step('Verify the body is a non-empty array.', async () => {
      expect(Array.isArray(body) && body.length > 0, assertMessage({ request, expected: 'The body is a non-empty array', actual: body })).toBe(true);
    });

    await test.step('Verify every item has a non-empty string id, name and slug.', async () => {
      expectBrandItems(request, body);
    });
  });
});
