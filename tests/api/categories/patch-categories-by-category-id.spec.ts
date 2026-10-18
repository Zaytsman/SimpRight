import { test, expect, createCategory, readCategory, CATEGORY_CREATE_ID_SLUG_STEP, AUTH, sendAndAttach, checkRejectedBody, checkStatusAndMessage } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CategoriesClient } from '@api/clients/CategoriesClient';
import { TestConstants } from '@data/TestConstants';
import { CategoryFactory } from '@data/factories/CategoryFactory';
import { expectFieldMessages, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/categories/patch-categories-by-category-id.yml

type PatchCategoryRequestInfo = { method: 'PATCH'; path: string; auth: string; body: unknown };

/** Sends PATCH /categories/{categoryId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendPatchCategory(
  categoriesClient: CategoriesClient,
  categoryId: string,
  body: Record<string, unknown>,
  auth: string
): Promise<{ request: PatchCategoryRequestInfo; response: ApiResponse }> {
  const request: PatchCategoryRequestInfo = { method: 'PATCH', path: `/categories/${categoryId}`, auth, body };
  return sendAndAttach('Patch Category', request, () => categoriesClient.partialUpdate(categoryId, body));
}

test.describe('@categories-api - Categories API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0214: Partially update category name returns success and keeps the slug', async ({
      adminCategoriesService,
      categoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      const body = CategoryFactory.updateName();
      let request: PatchCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup, CATEGORY_CREATE_ID_SLUG_STEP);

      await test.step("Send PATCH /categories/{categoryId} with that id and a body with only a new unique category name, with the admin's token.", async () => {
        ({ request, response } = await sendPatchCategory(categoriesClientWithToken, category.id, body, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      // The category was never read before the PATCH, and the PATCH clears its cache entry.
      await test.step('Verify GET /categories/tree/{categoryId} with that id returns the new name and the original slug.', async () => {
        const fetched = await readCategory(categoriesService, category.id);
        expect(
          { name: fetched.name, slug: fetched.slug },
          assertMessage({
            request: { method: 'GET', path: `/categories/tree/${category.id}` },
            expected: `name "${body.name}", slug "${category.slug}"`,
            actual: fetched,
          })
        ).toEqual({ name: body.name, slug: category.slug });
      });
    });

    test('API-0215: Partially update category with an empty slug returns 422', async ({ adminCategoriesService, categoriesClientWithToken, cleanup }) => {
      const category = await createCategory(adminCategoriesService, cleanup);

      await checkRejectedBody(
        "Send PATCH /categories/{categoryId} with that id and a body with only slug set to an empty string, with the admin's token.",
        () => sendPatchCategory(categoriesClientWithToken, category.id, CategoryFactory.updateSlug(''), AUTH.admin),
        'slug'
      );
    });

    test('API-0216: Partially update category with a slug outside letters, digits, dashes and underscores returns 422', async ({
      adminCategoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      const category = await createCategory(adminCategoriesService, cleanup);

      await checkRejectedBody(
        'Send PATCH /categories/{categoryId} with that id and a body with only a slug made of a unique slug followed by " x!" (a space and an exclamation mark), with the admin\'s token.',
        () => sendPatchCategory(categoriesClientWithToken, category.id, CategoryFactory.updateInvalidSlug(), AUTH.admin),
        'slug'
      );
    });

    test('API-0217: Partially update category with a name longer than 120 characters returns 422', async ({
      adminCategoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      const category = await createCategory(adminCategoriesService, cleanup);

      await checkRejectedBody(
        "Send PATCH /categories/{categoryId} with that id and a body with only a 121-character name that starts with a unique category name, with the admin's token.",
        () => sendPatchCategory(categoriesClientWithToken, category.id, CategoryFactory.updateNameTooLong(), AUTH.admin),
        'name'
      );
    });

    test("API-0219: Partially update category with another category's slug returns 409", async ({
      adminCategoriesService,
      categoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      let request: PatchCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup, CATEGORY_CREATE_ID_SLUG_STEP);

      await test.step("Send PATCH /categories/{categoryId} with that id and a body with only the slug hand-tools, with the admin's token.", async () => {
        ({ request, response } = await sendPatchCategory(
          categoriesClientWithToken,
          category.id,
          CategoryFactory.updateSlug(TestConstants.categories.handTools),
          AUTH.admin
        ));
      });

      await test.step('Verify the response status is 409.', async () => {
        expectStatus(request, response, 409);
      });

      await test.step('Verify the body has a slug key with at least one message.', async () => {
        expectFieldMessages(request, response, 'slug');
      });

      // The category was never read before the PATCH, so no cached copy of it can exist.
      await test.step('Verify GET /categories/tree/{categoryId} with that id still returns its own slug.', async () => {
        const fetched = await readCategory(categoriesService, category.id);
        expect(
          fetched.slug,
          assertMessage({ request: { method: 'GET', path: `/categories/tree/${category.id}` }, expected: `slug "${category.slug}"`, actual: fetched })
        ).toBe(category.slug);
      });
    });

    test('API-0220: Partially update category with its own slug returns success', async ({
      adminCategoriesService,
      categoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      let request: PatchCategoryRequestInfo;
      let response: ApiResponse;
      let body: ReturnType<typeof CategoryFactory.updateNameWithSlug>;

      const category = await createCategory(adminCategoriesService, cleanup, CATEGORY_CREATE_ID_SLUG_STEP);
      test.fail(true, "Known issue BUG-018: Returns 409 instead of 200 when the body repeats the category's own slug.");

      await test.step(
        "Send PATCH /categories/{categoryId} with that id and a body with a new unique category name and the category's own slug, with the admin's token.",
        async () => {
          body = CategoryFactory.updateNameWithSlug(category.slug);
          ({ request, response } = await sendPatchCategory(categoriesClientWithToken, category.id, body, AUTH.admin));
        }
      );

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify GET /categories/tree/{categoryId} with that id returns the new name.', async () => {
        const fetched = await readCategory(categoriesService, category.id);
        expect(
          fetched.name,
          assertMessage({ request: { method: 'GET', path: `/categories/tree/${category.id}` }, expected: `name "${body.name}"`, actual: fetched })
        ).toBe(body.name);
      });
    });

    test('API-0221: Partially update category with an unknown parent_id returns 422', async ({ adminCategoriesService, categoriesClientWithToken, cleanup }) => {
      let request: PatchCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);
      test.fail(true, 'Known issue BUG-015: Returns 500 instead of 422 when parent_id is not the id of an existing category.');

      await test.step(
        "Send PATCH /categories/{categoryId} with that id and a body with only a well-formed ULID that no category has as parent_id, with the admin's token.",
        async () => {
          ({ request, response } = await sendPatchCategory(
            categoriesClientWithToken,
            category.id,
            CategoryFactory.updateParent(TestConstants.categories.unknownId),
            AUTH.admin
          ));
        }
      );

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });
    });

    test('API-0222: Partially update category without a token returns 401', async ({ adminCategoriesService, categoriesClient, cleanup }) => {
      let request: PatchCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);
      test.fail(true, 'Known issue BUG-014: Accepts PATCH without a token instead of returning 401.');

      await test.step('Send PATCH /categories/{categoryId} with that id and a body with only a new unique category name, without an Authorization header.', async () => {
        ({ request, response } = await sendPatchCategory(categoriesClient, category.id, CategoryFactory.updateName(), 'none'));
      });

      await test.step('Verify the response status is 401.', async () => {
        expectStatus(request, response, 401);
      });
    });
  });

  test('API-0218: Partially update category with an unknown id returns 404', async ({ categoriesClient }) => {
    await checkStatusAndMessage(
      'Send PATCH /categories/{categoryId} with a well-formed ULID that no category has and a body with only a unique category name.',
      () => sendPatchCategory(categoriesClient, TestConstants.categories.unknownId, CategoryFactory.updateName(), 'none'),
      404,
      'Requested item not found'
    );
  });
});
