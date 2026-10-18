import { test, expect, createBrand, readBrand, takeOtherBrandSlug, BRAND_CREATE_ID_SLUG_STEP, AUTH, sendAndAttach, checkStatusAndMessage, type AuthLabel } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { BrandsClient } from '@api/clients/BrandsClient';
import { TestConstants } from '@data/TestConstants';
import { BrandFactory } from '@data/factories/BrandFactory';
import { expectFieldMessages, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/brands/patch-brands-by-brand-id.yml

type PatchBrandRequest = { method: 'PATCH'; path: string; auth: AuthLabel; body: unknown };

/** Sends PATCH /brands/{brandId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendPatchBrand(
  brandsClient: BrandsClient,
  brandId: string,
  body: Record<string, unknown>,
  auth: AuthLabel
): Promise<{ request: PatchBrandRequest; response: ApiResponse }> {
  const request: PatchBrandRequest = { method: 'PATCH', path: `/brands/${brandId}`, auth, body };
  return sendAndAttach('Patch Brand', request, () => brandsClient.partialUpdate(brandId, body));
}

test.describe('@brands-api - Brands API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0141: Partially update brand name returns success and keeps the slug', async ({ adminBrandsService, brandsService, brandsClientWithToken, cleanup }) => {
      const body = BrandFactory.updateName();
      let request: PatchBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup, BRAND_CREATE_ID_SLUG_STEP);

      await test.step("Send PATCH /brands/{brandId} with that id and a body with only a new unique brand name, with the admin's token.", async () => {
        ({ request, response } = await sendPatchBrand(brandsClientWithToken, brand.id, body, AUTH.admin));
      });

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step("Verify the body's success is true.", async () => {
        expectSuccess(request, response, true);
      });

      // The brand was never read before the PATCH, so no cached copy of it can exist.
      await test.step('Verify GET /brands/{brandId} with that id returns the new name and the original slug.', async () => {
        const fetched = await readBrand(brandsService, brand.id);
        expect(
          { name: fetched.name, slug: fetched.slug },
          assertMessage({ request: { method: 'GET', path: `/brands/${brand.id}` }, expected: `name "${body.name}", slug "${brand.slug}"`, actual: fetched })
        ).toEqual({ name: body.name, slug: brand.slug });
      });
    });

    test('API-0142: Partially update brand with a slug outside letters, digits, dashes and underscores returns 422', async ({
      adminBrandsService,
      brandsClientWithToken,
      cleanup,
    }) => {
      let request: PatchBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup);

      await test.step(
        'Send PATCH /brands/{brandId} with that id and a body with only a slug made of a unique slug followed by " x!" (a space and an exclamation mark), with the admin\'s token.',
        async () => {
          ({ request, response } = await sendPatchBrand(brandsClientWithToken, brand.id, BrandFactory.updateInvalidSlug(), AUTH.admin));
        }
      );

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a slug key with at least one message.', async () => {
        expectFieldMessages(request, response, 'slug');
      });
    });

    test('API-0143: Partially update brand with a name longer than 120 characters returns 422', async ({ adminBrandsService, brandsClientWithToken, cleanup }) => {
      let request: PatchBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup);

      await test.step(
        "Send PATCH /brands/{brandId} with that id and a body with only a 121-character name that starts with a unique brand name, with the admin's token.",
        async () => {
          ({ request, response } = await sendPatchBrand(brandsClientWithToken, brand.id, BrandFactory.updateNameTooLong(), AUTH.admin));
        }
      );

      await test.step('Verify the response status is 422.', async () => {
        expectStatus(request, response, 422);
      });

      await test.step('Verify the body has a name key with at least one message.', async () => {
        expectFieldMessages(request, response, 'name');
      });
    });

    test("API-0145: Partially update brand with another brand's slug returns 409", async ({
      adminBrandsService,
      brandsService,
      brandsClientWithToken,
      cleanup,
    }) => {
      let request: PatchBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup, BRAND_CREATE_ID_SLUG_STEP);
      const otherSlug = await takeOtherBrandSlug(brandsService, brand.id);

      await test.step("Send PATCH /brands/{brandId} with the new brand's id and a body with only that other slug, with the admin's token.", async () => {
        ({ request, response } = await sendPatchBrand(brandsClientWithToken, brand.id, BrandFactory.updateSlug(otherSlug), AUTH.admin));
      });

      await test.step('Verify the response status is 409.', async () => {
        expectStatus(request, response, 409);
      });

      await test.step('Verify the body has a slug key with at least one message.', async () => {
        expectFieldMessages(request, response, 'slug');
      });

      await test.step("Verify GET /brands/{brandId} with the new brand's id still returns its own slug.", async () => {
        const fetched = await readBrand(brandsService, brand.id);
        expect(fetched.slug, assertMessage({ request: { method: 'GET', path: `/brands/${brand.id}` }, expected: `slug "${brand.slug}"`, actual: fetched })).toBe(
          brand.slug
        );
      });
    });

    test('API-0146: Partially update brand with its own slug returns success', async ({ adminBrandsService, brandsService, brandsClientWithToken, cleanup }) => {
      let request: PatchBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup, BRAND_CREATE_ID_SLUG_STEP);
      const body = BrandFactory.updateNameWithSlug(brand.slug);
      const newName = body.name;
      test.fail(true, "Known issue BUG-010: Returns 409 instead of 200 when the body repeats the brand's own slug.");

      await test.step(
        "Send PATCH /brands/{brandId} with that id and a body with a new unique brand name and the brand's own slug, with the admin's token.",
        async () => {
          ({ request, response } = await sendPatchBrand(brandsClientWithToken, brand.id, body, AUTH.admin));
        }
      );

      await test.step('Verify the response status is 200.', async () => {
        expectStatus(request, response, 200);
      });

      await test.step('Verify GET /brands/{brandId} with that id returns the new name.', async () => {
        const fetched = await readBrand(brandsService, brand.id);
        expect(fetched.name, assertMessage({ request: { method: 'GET', path: `/brands/${brand.id}` }, expected: `name "${newName}"`, actual: fetched })).toBe(newName);
      });
    });

    test('API-0147: Partially update brand without a token returns 401', async ({ adminBrandsService, brandsClient, cleanup }) => {
      let request: PatchBrandRequest;
      let response: ApiResponse;

      const brand = await createBrand(adminBrandsService, cleanup);
      test.fail(true, 'Known issue BUG-009: Accepts PATCH without a token instead of returning 401.');

      await test.step('Send PATCH /brands/{brandId} with that id and a body with only a new unique brand name, without an Authorization header.', async () => {
        ({ request, response } = await sendPatchBrand(brandsClient, brand.id, BrandFactory.updateName(), AUTH.none));
      });

      await test.step('Verify the response status is 401.', async () => {
        expectStatus(request, response, 401);
      });
    });
  });

  test('API-0144: Partially update brand with an unknown id returns 404', async ({ brandsClient }) => {
    await checkStatusAndMessage(
      'Send PATCH /brands/{brandId} with a well-formed ULID that no brand has and a body with only a unique brand name.',
      () => sendPatchBrand(brandsClient, TestConstants.brands.unknownId, BrandFactory.updateName(), AUTH.none),
      404,
      'Requested item not found'
    );
  });
});
