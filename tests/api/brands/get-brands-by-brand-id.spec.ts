import { test, expect } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { Brand } from '@api/dto/brand';
import { TestConstants } from '@data/TestConstants';
import { expectMessage, expectStatus } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/brands/get-brands-by-brand-id.yml

type GetBrandRequest = { method: 'GET'; path: string };

test.describe('@brands-api - Brands API', () => {
  test('API-0130: Get brand returns 200 with the brand', async ({ brandsService, brandsClient }) => {
    let listed: Brand;
    let request: GetBrandRequest;
    let response: ApiResponse;

    await test.step("Send GET /brands and take the first brand's id, name and slug.", async () => {
      const brands = await brandsService.list();
      await attachJson('List Brands Response', brands);
      expect(brands.length, assertMessage({ request: { method: 'GET', path: '/brands' }, expected: 'At least one brand', actual: brands })).toBeGreaterThan(0);
      listed = brands[0]!;
    });

    await test.step('Send GET /brands/{brandId} with that id.', async () => {
      request = { method: 'GET', path: `/brands/${listed.id}` };
      response = await brandsClient.getById(listed.id);
      await attachJson('Get Brand Request', request);
      await attachJson('Get Brand Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's id, name and slug equal the list item's.", async () => {
      const body = JSON.parse(response.body) as Brand;
      expect(
        { id: body.id, name: body.name, slug: body.slug },
        assertMessage({ request, expected: `id, name and slug of the list item: ${JSON.stringify(listed)}`, actual: body })
      ).toEqual({ id: listed.id, name: listed.name, slug: listed.slug });
    });
  });

  test('API-0131: Get brand with an unknown id returns 404', async ({ brandsClient }) => {
    const unknownId = TestConstants.brands.unknownId;
    const request: GetBrandRequest = { method: 'GET', path: `/brands/${unknownId}` };
    let response: ApiResponse;

    await test.step('Send GET /brands/{brandId} with a well-formed ULID that no brand has.', async () => {
      response = await brandsClient.getById(unknownId);
      await attachJson('Get Brand Request', request);
      await attachJson('Get Brand Response', { status: response.status, body: response.body });
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });
});
