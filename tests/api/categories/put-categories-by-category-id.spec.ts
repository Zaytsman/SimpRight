import { test, expect, createCategory, readCategory, CATEGORY_CREATE_ID_SLUG_STEP, PARENT_CREATE_STEP, CHILD_CREATE_STEP } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CategoriesClient } from '@api/clients/CategoriesClient';
import type { CategoriesService } from '@api/services/CategoriesService';
import { TestConstants } from '@data/TestConstants';
import { CategoryFactory } from '@data/factories/CategoryFactory';
import { expectFieldMessageIncludes, expectFieldMessages, expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/categories/put-categories-by-category-id.yml

type UpdateCategoryRequestInfo = { method: 'PUT'; path: string; auth: string; body: unknown };

/** Sends PUT /categories/{categoryId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendUpdateCategory(
  categoriesClient: CategoriesClient,
  categoryId: string,
  body: Record<string, unknown>,
  auth: string
): Promise<{ request: UpdateCategoryRequestInfo; response: ApiResponse }> {
  const request: UpdateCategoryRequestInfo = { method: 'PUT', path: `/categories/${categoryId}`, auth, body };
  const response = await categoriesClient.update(categoryId, body);
  await attachJson('Update Category Request', request);
  await attachJson('Update Category Response', { status: response.status, body: response.body });
  return { request, response };
}

/** A Verify step's read of GET /categories/tree through the service (fails the step unless it succeeds): the ids of its items. */
async function readTreeItemIds(categoriesService: CategoriesService): Promise<string[]> {
  const tree = await categoriesService.tree();
  await attachJson('Category Tree Response', tree);
  return tree.map((item) => item.id);
}

test.describe('@categories-api - Categories API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0201: Update category returns success and saves the new name and slug', async ({
      adminCategoriesService,
      categoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      const body = CategoryFactory.updateNameAndSlug();
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);

      await test.step("Send PUT /categories/{categoryId} with that id and a body with a new unique category name and a new unique slug, with the admin's token.", async () => {
        ({ request, response } = await sendUpdateCategory(categoriesClientWithToken, category.id, body, "admin's token"));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      // The category was never read before the PUT, and the PUT clears its cache entry.
      await test.step('Verify GET /categories/tree/{categoryId} with that id returns the new name and the new slug.', async () => {
        const fetched = await readCategory(categoriesService, category.id);
        expect(
          { name: fetched.name, slug: fetched.slug },
          assertMessage({ request: { method: 'GET', path: `/categories/tree/${category.id}` }, expected: `name and slug as sent: ${JSON.stringify(body)}`, actual: fetched })
        ).toEqual(body);
      });
    });

    test('API-0202: Update category with a parent_id makes it a sub-category of that parent', async ({
      adminCategoriesService,
      categoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      // Cleanup runs newest first: the category that becomes the sub-category is deleted before its new parent.
      const parent = await createCategory(adminCategoriesService, cleanup, PARENT_CREATE_STEP);
      const category = await createCategory(adminCategoriesService, cleanup);

      await test.step(
        "Send PUT /categories/{categoryId} with the new category's id and a body with only the parent's id as parent_id, with the admin's token.",
        async () => {
          ({ request, response } = await sendUpdateCategory(categoriesClientWithToken, category.id, CategoryFactory.updateParent(parent.id), "admin's token"));
        }
      );

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify GET /categories/tree/{categoryId} with the new category's id returns the parent's id as parent_id.", async () => {
        const fetched = await readCategory(categoriesService, category.id);
        expect(
          fetched.parent_id,
          assertMessage({ request: { method: 'GET', path: `/categories/tree/${category.id}` }, expected: `parent_id ${parent.id}`, actual: fetched })
        ).toBe(parent.id);
      });

      await test.step("Verify GET /categories/tree doesn't include the new category's id among its items.", async () => {
        const ids = await readTreeItemIds(categoriesService);
        expect(
          ids.includes(category.id),
          assertMessage({ request: { method: 'GET', path: '/categories/tree' }, expected: `No item with id ${category.id}`, actual: ids })
        ).toBe(false);
      });
    });

    test('API-0203: Update category with a null parent_id makes it a top-level category', async ({
      adminCategoriesService,
      categoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      // Cleanup runs newest first: the sub-category is deleted before its parent.
      const parent = await createCategory(adminCategoriesService, cleanup, PARENT_CREATE_STEP);
      const child = await createCategory(adminCategoriesService, cleanup, CHILD_CREATE_STEP, { parent_id: parent.id });

      await test.step("Send PUT /categories/{categoryId} with the new category's id and a body with only parent_id set to null, with the admin's token.", async () => {
        ({ request, response } = await sendUpdateCategory(categoriesClientWithToken, child.id, CategoryFactory.updateParent(null), "admin's token"));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify GET /categories/tree/{categoryId} with the new category's id returns a null parent_id.", async () => {
        const fetched = await readCategory(categoriesService, child.id);
        expect(
          fetched.parent_id,
          assertMessage({ request: { method: 'GET', path: `/categories/tree/${child.id}` }, expected: 'parent_id null', actual: fetched })
        ).toBeNull();
      });

      await test.step("Verify GET /categories/tree includes the new category's id among its items.", async () => {
        const ids = await readTreeItemIds(categoriesService);
        expect(
          ids.includes(child.id),
          assertMessage({ request: { method: 'GET', path: '/categories/tree' }, expected: `An item with id ${child.id}`, actual: ids })
        ).toBe(true);
      });
    });

    test('API-0204: Update category with a name longer than 120 characters returns 422', async ({ adminCategoriesService, categoriesClientWithToken, cleanup }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);

      await test.step(
        "Send PUT /categories/{categoryId} with that id and a body with only a 121-character name that starts with a unique category name, with the admin's token.",
        async () => {
          ({ request, response } = await sendUpdateCategory(categoriesClientWithToken, category.id, CategoryFactory.updateNameTooLong(), "admin's token"));
        }
      );

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a name key with at least one message.', async () => {
        expectFieldMessages(request, response, 'name');
      });
    });

    test('API-0205: Update category with a slug outside letters, digits, dashes and underscores returns 422', async ({
      adminCategoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);

      await test.step(
        'Send PUT /categories/{categoryId} with that id and a body with only a slug made of a unique slug followed by " x!" (a space and an exclamation mark), with the admin\'s token.',
        async () => {
          ({ request, response } = await sendUpdateCategory(categoriesClientWithToken, category.id, CategoryFactory.updateInvalidSlug(), "admin's token"));
        }
      );

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a slug key with at least one message.', async () => {
        expectFieldMessages(request, response, 'slug');
      });
    });

    test("API-0206: Update category with a name that isn't a string returns 422", async ({ adminCategoriesService, categoriesClientWithToken, cleanup }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);

      await test.step("Send PUT /categories/{categoryId} with that id and a body with only name set to the number 123, with the admin's token.", async () => {
        ({ request, response } = await sendUpdateCategory(categoriesClientWithToken, category.id, CategoryFactory.nameNotString(), "admin's token"));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a name key with at least one message.', async () => {
        expectFieldMessages(request, response, 'name');
      });
    });

    test("API-0207: Update category with a parent_id that isn't a string returns 422", async ({ adminCategoriesService, categoriesClientWithToken, cleanup }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);

      await test.step("Send PUT /categories/{categoryId} with that id and a body with only parent_id set to the number 123, with the admin's token.", async () => {
        ({ request, response } = await sendUpdateCategory(categoriesClientWithToken, category.id, CategoryFactory.parentIdNotString(), "admin's token"));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a parent_id key with at least one message.', async () => {
        expectFieldMessages(request, response, 'parent_id');
      });
    });

    test("API-0210: Update category with another category's slug returns 409", async ({
      adminCategoriesService,
      categoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup, CATEGORY_CREATE_ID_SLUG_STEP);

      await test.step("Send PUT /categories/{categoryId} with that id and a body with only the slug hand-tools, with the admin's token.", async () => {
        ({ request, response } = await sendUpdateCategory(
          categoriesClientWithToken,
          category.id,
          CategoryFactory.updateSlug(TestConstants.categories.handTools),
          "admin's token"
        ));
      });

      await test.step('Verify the response status is 409.', async () => {
        expectStatus(request, response, 409);
      });

      // The category was never read before the PUT, so no cached copy of it can exist.
      await test.step('Verify GET /categories/tree/{categoryId} with that id still returns its own slug.', async () => {
        const fetched = await readCategory(categoriesService, category.id);
        expect(
          fetched.slug,
          assertMessage({ request: { method: 'GET', path: `/categories/tree/${category.id}` }, expected: `slug "${category.slug}"`, actual: fetched })
        ).toBe(category.slug);
      });
    });

    test("API-0211: Update category with another category's slug names the slug in the error", async ({
      adminCategoriesService,
      categoriesClientWithToken,
      cleanup,
    }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);
      test.fail(true, 'Known issue BUG-019: Returns { message: "Duplicate Entry" } instead of the slug\'s validation message for a duplicate slug.');

      await test.step("Send PUT /categories/{categoryId} with that id and a body with only the slug hand-tools, with the admin's token.", async () => {
        ({ request, response } = await sendUpdateCategory(
          categoriesClientWithToken,
          category.id,
          CategoryFactory.updateSlug(TestConstants.categories.handTools),
          "admin's token"
        ));
      });

      await test.step('Verify the body\'s slug messages include "A category already exists with this slug.".', async () => {
        expectFieldMessageIncludes(request, response, 'slug', 'A category already exists with this slug.');
      });
    });

    test('API-0212: Update category with an unknown parent_id returns 422', async ({ adminCategoriesService, categoriesClientWithToken, cleanup }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);
      test.fail(true, 'Known issue BUG-015: Returns 500 instead of 422 when parent_id is not the id of an existing category.');

      await test.step(
        "Send PUT /categories/{categoryId} with that id and a body with only a well-formed ULID that no category has as parent_id, with the admin's token.",
        async () => {
          ({ request, response } = await sendUpdateCategory(
            categoriesClientWithToken,
            category.id,
            CategoryFactory.updateParent(TestConstants.categories.unknownId),
            "admin's token"
          ));
        }
      );

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });
    });

    test('API-0213: Update category without a token returns 401', async ({ adminCategoriesService, categoriesClient, cleanup }) => {
      let request: UpdateCategoryRequestInfo;
      let response: ApiResponse;

      const category = await createCategory(adminCategoriesService, cleanup);
      test.fail(true, 'Known issue BUG-014: Accepts PUT without a token instead of returning 401.');

      await test.step('Send PUT /categories/{categoryId} with that id and a body with only a new unique category name, without an Authorization header.', async () => {
        ({ request, response } = await sendUpdateCategory(categoriesClient, category.id, CategoryFactory.updateName(), 'none'));
      });

      await test.step('Verify the response status is 401.', async () => {
        expectStatus(request, response, 401);
      });
    });
  });

  test('API-0208: Update category with an unknown id returns 404', async ({ categoriesClient }) => {
    let request: UpdateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send PUT /categories/{categoryId} with a well-formed ULID that no category has and a body with only a unique category name.', async () => {
      ({ request, response } = await sendUpdateCategory(categoriesClient, TestConstants.categories.unknownId, CategoryFactory.updateName(), 'none'));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test('API-0209: Update category with an unknown id and an invalid body returns 422', async ({ categoriesClient }) => {
    let request: UpdateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step(
      'Send PUT /categories/{categoryId} with a well-formed ULID that no category has and a body with only a 121-character name that starts with a unique category name.',
      async () => {
        ({ request, response } = await sendUpdateCategory(categoriesClient, TestConstants.categories.unknownId, CategoryFactory.updateNameTooLong(), 'none'));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a name key with at least one message.', async () => {
      expectFieldMessages(request, response, 'name');
    });
  });
});
