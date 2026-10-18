import { test, expect, createCategory, readCategory, removeCategoryIfCreated, PARENT_CREATE_STEP, AUTH } from '@fixtures';
import type { Cleanup } from '@fixtures/base';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { CategoriesClient } from '@api/clients/CategoriesClient';
import type { CreatedCategory } from '@api/dto/category';
import type { CategoriesService } from '@api/services/CategoriesService';
import { TestConstants } from '@data/TestConstants';
import { CategoryFactory } from '@data/factories/CategoryFactory';
import { expectFieldMessageIncludes, expectFieldMessages, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/categories/post-categories.yml

type CreateCategoryRequestInfo = { method: 'POST'; path: '/categories'; auth: string; body: unknown };

/**
 * Sends POST /categories with the given client (`auth` describes its token), registers the category's removal (as admin)
 * when one was created, and attaches what was sent and what came back.
 */
async function sendCreateCategory(
  categoriesClient: CategoriesClient,
  body: unknown,
  adminCategoriesService: CategoriesService,
  cleanup: Cleanup,
  auth = 'none'
): Promise<{ request: CreateCategoryRequestInfo; response: ApiResponse }> {
  const request: CreateCategoryRequestInfo = { method: 'POST', path: '/categories', auth, body };
  const response = await categoriesClient.create(body as Record<string, unknown>);
  removeCategoryIfCreated(response, adminCategoriesService, cleanup);
  await attachJson('Create Category Request', request);
  await attachJson('Create Category Response', { status: response.status, body: response.body });
  return { request, response };
}

test.describe('@categories-api - Categories API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0165: Create category returns 201 with the new category', async ({ categoriesClient, categoriesClientWithToken, adminCategoriesService, cleanup }) => {
      const body = CategoryFactory.createCategory();
      let request: CreateCategoryRequestInfo;
      let response: ApiResponse;
      let created: CreatedCategory;

      await test.step(
        "Send POST /categories with a unique category name and a unique slug, with the admin's token, and take the new category's id.",
        async () => {
          ({ request, response } = await sendCreateCategory(categoriesClientWithToken, body, adminCategoriesService, cleanup, AUTH.admin));
        }
      );

      await test.step('Verify the response status is 201.', async () => {
        expectStatus(request, response, 201);
        created = parseJson<CreatedCategory>(request, response);
      });

      await test.step("Verify the body's name and slug equal the values sent.", async () => {
        expect({ name: created.name, slug: created.slug }, assertMessage({ request, expected: 'name and slug as sent', actual: created })).toEqual(body);
      });

      await test.step('Verify the body has a non-empty id.', async () => {
        expect(typeof created.id === 'string' && created.id.length > 0, assertMessage({ request, expected: 'A non-empty id', actual: created })).toBe(true);
      });

      await test.step(
        'Verify GET /categories/tree/{categoryId} with the new id returns 200 with the same name and slug, a null parent_id and an empty sub_categories.',
        async () => {
          const getRequest = { method: 'GET', path: `/categories/tree/${created.id}` };
          const getResponse = await categoriesClient.getTreeById(created.id);
          await attachJson('Get Category Response', { status: getResponse.status, body: getResponse.body });
          expectStatus(getRequest, getResponse, 200);
          const fetched = JSON.parse(getResponse.body) as Record<string, unknown>;
          expect(
            { name: fetched.name, slug: fetched.slug, parent_id: fetched.parent_id, sub_categories: fetched.sub_categories },
            assertMessage({ request: getRequest, expected: `name and slug as sent (${JSON.stringify(body)}), parent_id null, sub_categories []`, actual: fetched })
          ).toEqual({ ...body, parent_id: null, sub_categories: [] });
        }
      );
    });

    test('API-0166: Create category with a parent_id creates a sub-category', async ({
      categoriesService,
      categoriesClientWithToken,
      adminCategoriesService,
      cleanup,
    }) => {
      let request: CreateCategoryRequestInfo;
      let response: ApiResponse;
      let created: CreatedCategory;

      // Cleanup runs newest first: the sub-category (registered when it's created) is deleted before its parent.
      const parent = await createCategory(adminCategoriesService, cleanup, PARENT_CREATE_STEP);

      await test.step(
        "Send POST /categories with a unique category name, a unique slug and the parent's id as parent_id, with the admin's token, and take the new category's id.",
        async () => {
          const body = CategoryFactory.createCategory({ parent_id: parent.id });
          ({ request, response } = await sendCreateCategory(categoriesClientWithToken, body, adminCategoriesService, cleanup, AUTH.admin));
        }
      );

      await test.step('Verify the response status is 201.', async () => {
        expectStatus(request, response, 201);
        created = parseJson<CreatedCategory>(request, response);
      });

      await test.step("Verify the body's parent_id equals the parent's id.", async () => {
        expect(created.parent_id, assertMessage({ request, expected: `parent_id ${parent.id}`, actual: created })).toBe(parent.id);
      });

      await test.step("Verify GET /categories/tree/{categoryId} with the new id returns the parent's id as parent_id.", async () => {
        const fetched = await readCategory(categoriesService, created.id);
        expect(
          fetched.parent_id,
          assertMessage({ request: { method: 'GET', path: `/categories/tree/${created.id}` }, expected: `parent_id ${parent.id}`, actual: fetched })
        ).toBe(parent.id);
      });

      // The parent was never read before the sub-category was created, so no cached copy of it can exist.
      await test.step(
        "Verify GET /categories/tree/{categoryId} with the parent's id returns sub_categories with exactly one item, whose id is the new category's id.",
        async () => {
          const fetched = await readCategory(categoriesService, parent.id);
          expect(
            (fetched.sub_categories ?? []).map((sub) => sub.id),
            assertMessage({ request: { method: 'GET', path: `/categories/tree/${parent.id}` }, expected: `sub_categories is exactly [${created.id}]`, actual: fetched })
          ).toEqual([created.id]);
        }
      );
    });

    test('API-0175: Create category ignores fields other than name, slug and parent_id', async ({
      categoriesClient,
      categoriesClientWithToken,
      adminCategoriesService,
      cleanup,
    }) => {
      const body = CategoryFactory.createWithExtraField();
      let request: CreateCategoryRequestInfo;
      let response: ApiResponse;
      let createdId = '';

      await test.step(
        'Send POST /categories with a unique category name, a unique slug and a description field set to "ignored", with the admin\'s token, and take the new category\'s id.',
        async () => {
          ({ request, response } = await sendCreateCategory(categoriesClientWithToken, body, adminCategoriesService, cleanup, AUTH.admin));
          createdId = response.isSuccess ? ((parseJson<CreatedCategory>(request, response)).id ?? '') : '';
        }
      );

      await test.step('Verify the response status is 201.', async () => {
        expectStatus(request, response, 201);
      });

      await test.step('Verify the body has the keys id, name and slug only.', async () => {
        const keys = Object.keys(parseJson<object>(request, response)).sort();
        expect(keys, assertMessage({ request, expected: 'Keys id, name and slug only', actual: response.body })).toEqual(['id', 'name', 'slug']);
      });

      await test.step('Verify GET /categories/tree/{categoryId} with the new id has no description key.', async () => {
        const getRequest = { method: 'GET', path: `/categories/tree/${createdId}` };
        const getResponse = await categoriesClient.getTreeById(createdId);
        await attachJson('Get Category Response', { status: getResponse.status, body: getResponse.body });
        expectStatus(getRequest, getResponse, 200);
        const fetched = JSON.parse(getResponse.body) as Record<string, unknown>;
        expect('description' in fetched, assertMessage({ request: getRequest, expected: 'No description key', actual: fetched })).toBe(false);
      });
    });
  });

  test('API-0167: Create category without the required fields returns 422 for each of them', async ({ categoriesClient, adminCategoriesService, cleanup }) => {
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /categories with an empty JSON object as the body.', async () => {
      ({ request, response } = await sendCreateCategory(categoriesClient, {}, adminCategoriesService, cleanup));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has the keys name and slug, each with at least one message.', async () => {
      expectFieldMessages(request, response, 'name');
      expectFieldMessages(request, response, 'slug');
    });

    await test.step('Verify the body\'s name messages include "The name field is required." and its slug messages include "The slug field is required.".', async () => {
      expectFieldMessageIncludes(request, response, 'name', 'The name field is required.');
      expectFieldMessageIncludes(request, response, 'slug', 'The slug field is required.');
    });
  });

  test('API-0168: Create category with a slug outside letters, digits, dashes and underscores returns 422', async ({
    categoriesClient,
    adminCategoriesService,
    cleanup,
  }) => {
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step(
      'Send POST /categories with a unique category name and a slug made of a unique slug followed by " x!" (a space and an exclamation mark).',
      async () => {
        const body = CategoryFactory.createCategory({ slug: CategoryFactory.slugWithInvalidChars() });
        ({ request, response } = await sendCreateCategory(categoriesClient, body, adminCategoriesService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a slug key with at least one message.', async () => {
      expectFieldMessages(request, response, 'slug');
    });
  });

  test('API-0169: Create category with a name longer than 120 characters returns 422', async ({ categoriesClient, adminCategoriesService, cleanup }) => {
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /categories with a 121-character name that starts with a unique category name, and a unique slug.', async () => {
      const body = CategoryFactory.createCategory({ name: CategoryFactory.nameTooLong() });
      ({ request, response } = await sendCreateCategory(categoriesClient, body, adminCategoriesService, cleanup));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a name key with at least one message.', async () => {
      expectFieldMessages(request, response, 'name');
    });
  });

  test('API-0170: Create category with a slug longer than 120 characters returns 422', async ({ categoriesClient, adminCategoriesService, cleanup }) => {
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step(
      'Send POST /categories with a unique category name and a 121-character slug that starts with a unique slug and contains only letters, digits and dashes.',
      async () => {
        const body = CategoryFactory.createCategory({ slug: CategoryFactory.slugTooLong() });
        ({ request, response } = await sendCreateCategory(categoriesClient, body, adminCategoriesService, cleanup));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a slug key with at least one message.', async () => {
      expectFieldMessages(request, response, 'slug');
    });
  });

  test("API-0171: Create category with a parent_id that isn't a string returns 422", async ({ categoriesClient, adminCategoriesService, cleanup }) => {
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /categories with a unique category name, a unique slug and parent_id set to the number 123.', async () => {
      ({ request, response } = await sendCreateCategory(categoriesClient, CategoryFactory.createWithParentIdNotString(), adminCategoriesService, cleanup));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a parent_id key with at least one message.', async () => {
      expectFieldMessages(request, response, 'parent_id');
    });
  });

  test('API-0172: Create category with a subscript character in the name returns 422', async ({ categoriesClient, adminCategoriesService, cleanup }) => {
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /categories with a unique category name followed by a Unicode subscript character, and a unique slug.', async () => {
      const body = CategoryFactory.createCategory({ name: CategoryFactory.nameWithSubscript() });
      ({ request, response } = await sendCreateCategory(categoriesClient, body, adminCategoriesService, cleanup));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a name key with at least one message.', async () => {
      expectFieldMessages(request, response, 'name');
    });
  });

  test('API-0173: Create category with an existing slug returns 409', async ({ categoriesClient, adminCategoriesService, cleanup }) => {
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /categories with a unique category name and the slug hand-tools.', async () => {
      const body = CategoryFactory.createCategory({ slug: TestConstants.categories.handTools });
      ({ request, response } = await sendCreateCategory(categoriesClient, body, adminCategoriesService, cleanup));
    });

    await test.step('Verify the response status is 409.', async () => {
      expectStatus(request, response, 409);
    });

    await test.step('Verify the body\'s slug messages include "A category already exists with this slug.".', async () => {
      expectFieldMessageIncludes(request, response, 'slug', 'A category already exists with this slug.');
    });
  });

  test('API-0174: Create category with an existing slug and a too-long name returns 422', async ({ categoriesClient, adminCategoriesService, cleanup }) => {
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /categories with a 121-character name that starts with a unique category name, and the slug hand-tools.', async () => {
      const body = CategoryFactory.createCategory({ name: CategoryFactory.nameTooLong(), slug: TestConstants.categories.handTools });
      ({ request, response } = await sendCreateCategory(categoriesClient, body, adminCategoriesService, cleanup));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a name key with at least one message.', async () => {
      expectFieldMessages(request, response, 'name');
    });
  });

  test('API-0176: Create category with an unknown parent_id returns 422', async ({ categoriesClient, adminCategoriesService, cleanup }) => {
    test.fail(true, 'Known issue BUG-015: Returns 500 instead of 422 when parent_id is not the id of an existing category.');
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /categories with a unique category name, a unique slug and a well-formed ULID that no category has as parent_id.', async () => {
      const body = CategoryFactory.createCategory({ parent_id: TestConstants.categories.unknownId });
      ({ request, response } = await sendCreateCategory(categoriesClient, body, adminCategoriesService, cleanup));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });
  });

  test('API-0177: Create category without a token returns 401', async ({ categoriesClient, adminCategoriesService, cleanup }) => {
    test.fail(true, 'Known issue BUG-014: Accepts POST without a token instead of returning 401.');
    let request: CreateCategoryRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /categories with a unique category name and a unique slug, without an Authorization header.', async () => {
      ({ request, response } = await sendCreateCategory(categoriesClient, CategoryFactory.createCategory(), adminCategoriesService, cleanup));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });
  });
});
