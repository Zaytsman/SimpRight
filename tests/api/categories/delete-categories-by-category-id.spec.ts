import { test, expect, createCategory, takeProductRefs, PARENT_CREATE_STEP, CHILD_CREATE_STEP } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CategoriesClient } from '@api/clients/CategoriesClient';
import { TestConstants } from '@data/TestConstants';
import { ProductFactory, type ProductRefs } from '@data/factories/ProductFactory';
import { expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/categories/delete-categories-by-category-id.yml

type DeleteCategoryRequestInfo = { method: 'DELETE'; path: string; auth: string };

/** Sends DELETE /categories/{categoryId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendDeleteCategory(
  categoriesClient: CategoriesClient,
  categoryId: string,
  auth: string
): Promise<{ request: DeleteCategoryRequestInfo; response: ApiResponse }> {
  const request: DeleteCategoryRequestInfo = { method: 'DELETE', path: `/categories/${categoryId}`, auth };
  const response = await categoriesClient.deleteById(categoryId);
  await attachJson('Delete Category Request', request);
  await attachJson('Delete Category Response', { status: response.status, body: response.body });
  return { request, response };
}

/** Sends GET /categories/tree/{categoryId} for a Verify step and checks its status. */
async function expectGetCategoryStatus(categoriesClient: CategoriesClient, categoryId: string, status: number): Promise<void> {
  const getRequest = { method: 'GET', path: `/categories/tree/${categoryId}` };
  const getResponse = await categoriesClient.getTreeById(categoryId);
  await attachJson('Get Category Response', { status: getResponse.status, body: getResponse.body });
  expectStatus(getRequest, getResponse, status);
}

test.describe('@categories-api - Categories API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0223: Admin deletes a category', async ({ adminCategoriesService, categoriesClient, categoriesClientWithToken, cleanup }) => {
      let request: DeleteCategoryRequestInfo;
      let response: ApiResponse;

      // The DELETE under test removes the category; cleanup is a backstop if it fails, and a 404 then counts as done.
      const category = await createCategory(adminCategoriesService, cleanup);

      await test.step("Send DELETE /categories/{categoryId} with that id, with the admin's token.", async () => {
        ({ request, response } = await sendDeleteCategory(categoriesClientWithToken, category.id, "admin's token"));
      });

      await test.step('Verify the response status is 204.', async () => {
        expectStatus(request, response, 204);
      });

      // The category was never read before the DELETE, and the DELETE clears its cache entry.
      await test.step('Verify GET /categories/tree/{categoryId} with that id returns 404.', async () => {
        await expectGetCategoryStatus(categoriesClient, category.id, 404);
      });
    });

    test('API-0224: Delete category without a token returns 401', async ({ adminCategoriesService, categoriesClient, cleanup }) => {
      let request: DeleteCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);

      await test.step('Send DELETE /categories/{categoryId} with that id, without an Authorization header.', async () => {
        ({ request, response } = await sendDeleteCategory(categoriesClient, category.id, 'none'));
      });

      await test.step('Verify the response status is 401.', async () => {
        expectStatus(request, response, 401);
      });

      await test.step('Verify the body\'s message is "Unauthorized".', async () => {
        expectMessage(request, response, 'Unauthorized');
      });
    });

    test('API-0225: Delete category with an invalid token returns 401', async ({ adminCategoriesService, categoriesClientWithInvalidToken, cleanup }) => {
      let request: DeleteCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);

      await test.step('Send DELETE /categories/{categoryId} with that id, with an invalid token.', async () => {
        ({ request, response } = await sendDeleteCategory(categoriesClientWithInvalidToken, category.id, 'invalid token'));
      });

      await test.step('Verify the response status is 401.', async () => {
        expectStatus(request, response, 401);
      });

      await test.step('Verify the body\'s message is "Unauthorized".', async () => {
        expectMessage(request, response, 'Unauthorized');
      });
    });

    test('API-0227: Delete category with an unknown id returns 404', async ({ categoriesClientWithToken }) => {
      let request: DeleteCategoryRequestInfo;
      let response: ApiResponse;

      await test.step("Send DELETE /categories/{categoryId} with a well-formed ULID that no category has, with the admin's token.", async () => {
        ({ request, response } = await sendDeleteCategory(categoriesClientWithToken, TestConstants.categories.unknownId, "admin's token"));
      });

      await test.step('Verify the response status is 404.', async () => {
        expectStatus(request, response, 404);
      });

      await test.step('Verify the body\'s message is "Requested item not found".', async () => {
        expectMessage(request, response, 'Requested item not found');
      });
    });

    test('API-0228: Delete category that has sub-categories returns 409', async ({ adminCategoriesService, categoriesClient, categoriesClientWithToken, cleanup }) => {
      let request: DeleteCategoryRequestInfo;
      let response: ApiResponse;

      // Cleanup runs newest first: the sub-category is deleted before its parent.
      const parent = await createCategory(adminCategoriesService, cleanup, PARENT_CREATE_STEP);
      await createCategory(adminCategoriesService, cleanup, CHILD_CREATE_STEP, { parent_id: parent.id });

      await test.step("Send DELETE /categories/{categoryId} with the parent's id, with the admin's token.", async () => {
        ({ request, response } = await sendDeleteCategory(categoriesClientWithToken, parent.id, "admin's token"));
      });

      await test.step('Verify the response status is 409.', async () => {
        expectStatus(request, response, 409);
      });

      await test.step('Verify the body\'s success is false and its message is "Seems like this category is used elsewhere.".', async () => {
        expectSuccess(request, response, false);
        expectMessage(request, response, 'Seems like this category is used elsewhere.');
      });

      await test.step("Verify GET /categories/tree/{categoryId} with the parent's id returns 200.", async () => {
        await expectGetCategoryStatus(categoriesClient, parent.id, 200);
      });
    });

    test('API-0229: Delete category that a product uses returns 409', async ({
      adminCategoriesService,
      categoriesClient,
      categoriesClientWithToken,
      productsService,
      adminProductsService,
      cleanup,
    }) => {
      let request: DeleteCategoryRequestInfo;
      let response: ApiResponse;

      // Cleanup runs newest first: the product (registered after the category) is deleted before the category it uses.
      const category = await createCategory(adminCategoriesService, cleanup);
      const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's brand id and product image id.", [
        'brandId',
        'productImageId',
      ]);

      await test.step(
        "Send POST /products with a unique product name, a positive price, the new category's id as category_id, that brand id, that product image id, is_location_offer false and is_rental false, with the admin's token, and take the new product's id.",
        async () => {
          const body = ProductFactory.createProduct({ ...refs, categoryId: category.id } as ProductRefs);
          await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: "admin's token", body });
          const product = await adminProductsService.create(body);
          cleanup.add(() => adminProductsService.delete(product.id));
          await attachJson('Create Product Response', product);
          expect(product.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: product })).toBeTruthy();
        }
      );

      await test.step("Send DELETE /categories/{categoryId} with the new category's id, with the admin's token.", async () => {
        ({ request, response } = await sendDeleteCategory(categoriesClientWithToken, category.id, "admin's token"));
      });

      await test.step('Verify the response status is 409.', async () => {
        expectStatus(request, response, 409);
      });

      await test.step('Verify the body\'s success is false and its message is "Seems like this category is used elsewhere.".', async () => {
        expectSuccess(request, response, false);
        expectMessage(request, response, 'Seems like this category is used elsewhere.');
      });

      await test.step("Verify GET /categories/tree/{categoryId} with the new category's id returns 200.", async () => {
        await expectGetCategoryStatus(categoriesClient, category.id, 200);
      });
    });
  });

  test('API-0226: Delete category as a non-admin user returns 403', async ({ adminCategoriesService, categoriesClientWithToken, cleanup }) => {
    let request: DeleteCategoryRequestInfo;
    let response: ApiResponse;

    const category = await createCategory(adminCategoriesService, cleanup);

    await test.step("Send DELETE /categories/{categoryId} with that id, with the default user's token.", async () => {
      ({ request, response } = await sendDeleteCategory(categoriesClientWithToken, category.id, "default user's token"));
    });

    await test.step('Verify the response status is 403.', async () => {
      expectStatus(request, response, 403);
    });

    await test.step('Verify the body\'s message is "Forbidden".', async () => {
      expectMessage(request, response, 'Forbidden');
    });
  });
});
