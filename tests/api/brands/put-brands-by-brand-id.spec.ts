import { test, expect, createBrand, readBrand, takeOtherBrandSlug, BRAND_CREATE_ID_SLUG_STEP, AUTH, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { BrandsClient } from '@api/clients/BrandsClient';
import { TestConstants } from '@data/TestConstants';
import { BrandFactory } from '@data/factories/BrandFactory';
import { expectFieldMessageIncludes, expectFieldMessages, expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/brands/put-brands-by-brand-id.yml

type PutBrandRequest = { method: 'PUT'; path: string; auth: string; body: unknown };

/** Sends PUT /brands/{brandId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendPutBrand(
  brandsClient: BrandsClient,
  brandId: string,
  body: Record<string, unknown>,
  auth: string
): Promise<{ request: PutBrandRequest; response: ApiResponse }> {
  const request: PutBrandRequest = { method: 'PUT', path: `/brands/${brandId}`, auth, body };
  return sendAndAttach('Update Brand', request, () => brandsClient.update(brandId, body));
}

test.describe('@brands-api - Brands API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0132: Update brand returns success and saves the new name and slug', async ({ adminBrandsService, brandsService, brandsClientWithToken, cleanup }) => {
      const body = BrandFactory.updateNameAndSlug();
      let request: PutBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup);

      await test.step("Send PUT /brands/{brandId} with that id and a body with a new unique brand name and a new unique slug, with the admin's token.", async () => {
        ({ request, response } = await sendPutBrand(brandsClientWithToken, brand.id, body, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      // The brand was never read before the PUT, so no cached copy of it can exist.
      await test.step('Verify GET /brands/{brandId} with that id returns the new name and the new slug.', async () => {
        const fetched = await readBrand(brandsService, brand.id);
        expect(
          { name: fetched.name, slug: fetched.slug },
          assertMessage({ request: { method: 'GET', path: `/brands/${brand.id}` }, expected: `name and slug as sent: ${JSON.stringify(body)}`, actual: fetched })
        ).toEqual(body);
      });
    });

    test('API-0133: Update brand with a name longer than 120 characters returns 422', async ({ adminBrandsService, brandsClientWithToken, cleanup }) => {
      let request: PutBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup);

      await test.step(
        "Send PUT /brands/{brandId} with that id and a body with only a 121-character name that starts with a unique brand name, with the admin's token.",
        async () => {
          ({ request, response } = await sendPutBrand(brandsClientWithToken, brand.id, BrandFactory.updateNameTooLong(), AUTH.admin));
        }
      );

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a name key with at least one message.', async () => {
        expectFieldMessages(request, response, 'name');
      });
    });

    test('API-0134: Update brand with a slug outside letters, digits, dashes and underscores returns 422', async ({
      adminBrandsService,
      brandsClientWithToken,
      cleanup,
    }) => {
      let request: PutBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup);

      await test.step(
        'Send PUT /brands/{brandId} with that id and a body with only a slug made of a unique slug followed by " x!" (a space and an exclamation mark), with the admin\'s token.',
        async () => {
          ({ request, response } = await sendPutBrand(brandsClientWithToken, brand.id, BrandFactory.updateInvalidSlug(), AUTH.admin));
        }
      );

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a slug key with at least one message.', async () => {
        expectFieldMessages(request, response, 'slug');
      });
    });

    test("API-0135: Update brand with a name that isn't a string returns 422", async ({ adminBrandsService, brandsClientWithToken, cleanup }) => {
      let request: PutBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup);

      await test.step("Send PUT /brands/{brandId} with that id and a body with only name set to the number 123, with the admin's token.", async () => {
        ({ request, response } = await sendPutBrand(brandsClientWithToken, brand.id, BrandFactory.nameNotString(), AUTH.admin));
      });

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a name key with at least one message.', async () => {
        expectFieldMessages(request, response, 'name');
      });
    });

    test("API-0138: Update brand with another brand's slug returns 409", async ({ adminBrandsService, brandsService, brandsClientWithToken, cleanup }) => {
      let request: PutBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup, BRAND_CREATE_ID_SLUG_STEP);
      const otherSlug = await takeOtherBrandSlug(brandsService, brand.id);

      await test.step("Send PUT /brands/{brandId} with the new brand's id and a body with only that other slug, with the admin's token.", async () => {
        ({ request, response } = await sendPutBrand(brandsClientWithToken, brand.id, BrandFactory.updateSlug(otherSlug), AUTH.admin));
      });

      await test.step('Verify the response status is 409.', async () => {
        expectStatus(request, response, 409);
      });

      await test.step("Verify GET /brands/{brandId} with the new brand's id still returns its own slug.", async () => {
        const fetched = await readBrand(brandsService, brand.id);
        expect(fetched.slug, assertMessage({ request: { method: 'GET', path: `/brands/${brand.id}` }, expected: `slug "${brand.slug}"`, actual: fetched })).toBe(
          brand.slug
        );
      });
    });

    test("API-0139: Update brand with another brand's slug names the slug in the error", async ({
      adminBrandsService,
      brandsService,
      brandsClientWithToken,
      cleanup,
    }) => {
      let request: PutBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup);
      const otherSlug = await takeOtherBrandSlug(brandsService, brand.id);
      test.fail(true, 'Known issue BUG-012: Returns { message: "Duplicate Entry" } instead of the slug\'s validation message for a duplicate slug.');

      await test.step("Send PUT /brands/{brandId} with the new brand's id and a body with only that other slug, with the admin's token.", async () => {
        ({ request, response } = await sendPutBrand(brandsClientWithToken, brand.id, BrandFactory.updateSlug(otherSlug), AUTH.admin));
      });

      await test.step('Verify the body\'s slug messages include "A brand already exists with this slug.".', async () => {
        expectFieldMessageIncludes(request, response, 'slug', 'A brand already exists with this slug.');
      });
    });

    test('API-0140: Update brand without a token returns 401', async ({ adminBrandsService, brandsClient, cleanup }) => {
      let request: PutBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup);
      test.fail(true, 'Known issue BUG-009: Accepts PUT without a token instead of returning 401.');

      await test.step('Send PUT /brands/{brandId} with that id and a body with only a new unique brand name, without an Authorization header.', async () => {
        ({ request, response } = await sendPutBrand(brandsClient, brand.id, BrandFactory.updateName(), 'none'));
      });

      await test.step('Verify the response status is 401.', async () => {
        expectStatus(request, response, 401);
      });
    });
  });

  test('API-0136: Update brand with an unknown id returns 404', async ({ brandsClient }) => {
    let request: PutBrandRequest;
    let response: ApiResponse;

    await test.step('Send PUT /brands/{brandId} with a well-formed ULID that no brand has and a body with only a unique brand name.', async () => {
      ({ request, response } = await sendPutBrand(brandsClient, TestConstants.brands.unknownId, BrandFactory.updateName(), 'none'));
    });

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step('Verify the body\'s message is "Requested item not found".', async () => {
      expectMessage(request, response, 'Requested item not found');
    });
  });

  test('API-0137: Update brand with an unknown id and an invalid body returns 422', async ({ brandsClient }) => {
    let request: PutBrandRequest;
    let response: ApiResponse;

    await test.step(
      'Send PUT /brands/{brandId} with a well-formed ULID that no brand has and a body with only a 121-character name that starts with a unique brand name.',
      async () => {
        ({ request, response } = await sendPutBrand(brandsClient, TestConstants.brands.unknownId, BrandFactory.updateNameTooLong(), 'none'));
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
