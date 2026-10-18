import { test, expect, createBrand, takeProductRefs, AUTH, sendAndAttach, checkStatusAndMessage, type AuthLabel } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { BrandsClient } from '@api/clients/BrandsClient';
import { TestConstants } from '@data/TestConstants';
import { ProductFactory, type ProductRefs } from '@data/factories/ProductFactory';
import { expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/brands/delete-brands-by-brand-id.yml

type DeleteBrandRequest = { method: 'DELETE'; path: string; auth: AuthLabel };

/** Sends DELETE /brands/{brandId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendDeleteBrand(brandsClient: BrandsClient, brandId: string, auth: AuthLabel): Promise<{ request: DeleteBrandRequest; response: ApiResponse }> {
  const request: DeleteBrandRequest = { method: 'DELETE', path: `/brands/${brandId}`, auth };
  return sendAndAttach('Delete Brand', request, () => brandsClient.deleteById(brandId));
}

/** Sends GET /brands/{brandId} for a Verify step and checks its status. */
async function expectGetBrandStatus(brandsClient: BrandsClient, brandId: string, status: number): Promise<void> {
  const { request: getRequest, response: getResponse } = await sendAndAttach('Get Brand', { method: 'GET', path: `/brands/${brandId}` }, () => brandsClient.getById(brandId));
  expectStatus(getRequest, getResponse, status);
}

test.describe('@brands-api - Brands API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0148: Admin deletes a brand', async ({ adminBrandsService, brandsClient, brandsClientWithToken, cleanup }) => {
      let request: DeleteBrandRequest;
      let response: ApiResponse;

      // The DELETE under test removes the brand; cleanup is a backstop if it fails, and a 404 then counts as done.
      const brand = await createBrand(adminBrandsService, cleanup);

      await test.step("Send DELETE /brands/{brandId} with that id, with the admin's token.", async () => {
        ({ request, response } = await sendDeleteBrand(brandsClientWithToken, brand.id, AUTH.admin));
      });

      await test.step('Verify the response status is 204.', async () => {
        expectStatus(request, response, 204);
      });

      // The brand was never read before the DELETE, and the DELETE clears its cache entry.
      await test.step('Verify GET /brands/{brandId} with that id returns 404.', async () => {
        await expectGetBrandStatus(brandsClient, brand.id, 404);
      });
    });

    test('API-0149: Delete brand without a token returns 401', async ({ adminBrandsService, brandsClient, cleanup }) => {
      const brand = await createBrand(adminBrandsService, cleanup);

      await checkStatusAndMessage(
        'Send DELETE /brands/{brandId} with that id, without an Authorization header.',
        () => sendDeleteBrand(brandsClient, brand.id, AUTH.none),
        401,
        'Unauthorized'
      );
    });

    test('API-0150: Delete brand with an invalid token returns 401', async ({ adminBrandsService, brandsClientWithInvalidToken, cleanup }) => {
      const brand = await createBrand(adminBrandsService, cleanup);

      await checkStatusAndMessage(
        'Send DELETE /brands/{brandId} with that id, with an invalid token.',
        () => sendDeleteBrand(brandsClientWithInvalidToken, brand.id, AUTH.malformed),
        401,
        'Unauthorized'
      );
    });

    test('API-0152: Delete brand with an unknown id returns 404', async ({ brandsClientWithToken }) => {
      await checkStatusAndMessage(
        "Send DELETE /brands/{brandId} with a well-formed ULID that no brand has, with the admin's token.",
        () => sendDeleteBrand(brandsClientWithToken, TestConstants.brands.unknownId, AUTH.admin),
        404,
        'Requested item not found'
      );
    });

    test('API-0153: Delete brand that a product uses returns 409', async ({
      adminBrandsService,
      brandsClient,
      brandsClientWithToken,
      productsService,
      adminProductsService,
      cleanup,
    }) => {
      let request: DeleteBrandRequest;
      let response: ApiResponse;

      // Cleanup runs newest first: the product (registered after the brand) is deleted before the brand it uses.
      const brand = await createBrand(adminBrandsService, cleanup);
      const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's category id and product image id.", [
        'categoryId',
        'productImageId',
      ]);

      await test.step(
        "Send POST /products with a unique product name, a positive price, that category id, the new brand's id as brand_id, that product image id, is_location_offer false and is_rental false, with the admin's token, and take the new product's id.",
        async () => {
          const body = ProductFactory.createProduct({ ...refs, brandId: brand.id } as ProductRefs);
          await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: AUTH.admin, body });
          const product = await adminProductsService.create(body);
          cleanup.add(() => adminProductsService.delete(product.id));
          await attachJson('Create Product Response', product);
          expect(product.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: product })).toBeTruthy();
        }
      );

      await test.step("Send DELETE /brands/{brandId} with the new brand's id, with the admin's token.", async () => {
        ({ request, response } = await sendDeleteBrand(brandsClientWithToken, brand.id, AUTH.admin));
      });

      await test.step('Verify the response status is 409.', async () => {
        expectStatus(request, response, 409);
      });

      await test.step('Verify the body\'s success is false and its message is "Seems like this brand is used elsewhere.".', async () => {
        expectSuccess(request, response, false);
        expectMessage(request, response, 'Seems like this brand is used elsewhere.');
      });

      await test.step("Verify GET /brands/{brandId} with the new brand's id returns 200.", async () => {
        await expectGetBrandStatus(brandsClient, brand.id, 200);
      });
    });
  });

  test('API-0151: Delete brand as a non-admin user returns 403', async ({ adminBrandsService, brandsClientWithToken, cleanup }) => {
    const brand = await createBrand(adminBrandsService, cleanup);

    await checkStatusAndMessage(
      "Send DELETE /brands/{brandId} with that id, with the default user's token.",
      () => sendDeleteBrand(brandsClientWithToken, brand.id, AUTH.defaultUser),
      403,
      'Forbidden'
    );
  });
});
