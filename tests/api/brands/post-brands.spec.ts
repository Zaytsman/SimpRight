import { test, expect, removeBrandIfCreated, AUTH, checkRejectedBody, sendAndAttach } from '@fixtures';
import type { Cleanup } from '@fixtures/base';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { BrandsClient } from '@api/clients/BrandsClient';
import type { Brand } from '@api/dto/brand';
import type { BrandsService } from '@api/services/BrandsService';
import { BrandFactory } from '@data/factories/BrandFactory';
import { expectFieldMessageIncludes, expectFieldMessages, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/brands/post-brands.yml

type CreateBrandRequestInfo = { method: 'POST'; path: '/brands'; auth: string; body: unknown };

/**
 * Sends POST /brands with the given client (`auth` describes its token), registers the brand's removal (as admin) when
 * one was created, and attaches what was sent and what came back.
 */
async function sendCreateBrand(
  brandsClient: BrandsClient,
  body: unknown,
  adminBrandsService: BrandsService,
  cleanup: Cleanup,
  auth: string = AUTH.none
): Promise<{ request: CreateBrandRequestInfo; response: ApiResponse }> {
  const request: CreateBrandRequestInfo = { method: 'POST', path: '/brands', auth, body };
  return sendAndAttach('Create Brand', request, async () => {
    const response = await brandsClient.create(body as Record<string, unknown>);
    removeBrandIfCreated(response, adminBrandsService, cleanup);
    return response;
  });
}

/** The setup step "Send GET /brands and take the first brand's slug." */
async function takeFirstBrandSlug(brandsService: BrandsService): Promise<string> {
  let slug = '';
  await test.step("Send GET /brands and take the first brand's slug.", async () => {
    const brands = await brandsService.list();
    await attachJson('List Brands Response', brands);
    expect(brands[0]?.slug, assertMessage({ request: { method: 'GET', path: '/brands' }, expected: 'The first brand has a slug', actual: brands })).toBeTruthy();
    slug = brands[0]!.slug;
  });
  return slug;
}

test.describe('@brands-api - Brands API', () => {
  test.describe(() => {
    test.use({ role: 'admin' });

    test('API-0120: Create brand returns 201 with the new brand', async ({ brandsClient, brandsClientWithToken, adminBrandsService, cleanup }) => {
      const body = BrandFactory.createBrand();
      let request: CreateBrandRequestInfo;
      let response: ApiResponse;
      let created: Brand;

      await test.step("Send POST /brands with a unique brand name and a unique slug, with the admin's token, and take the new brand's id.", async () => {
        ({ request, response } = await sendCreateBrand(brandsClientWithToken, body, adminBrandsService, cleanup, AUTH.admin));
      });

      await test.step('Verify the response status is 201.', async () => {
        expectStatus(request, response, 201);
        created = parseJson<Brand>(request, response);
      });

      await test.step("Verify the body's name and slug equal the values sent.", async () => {
        expect({ name: created.name, slug: created.slug }, assertMessage({ request, expected: 'name and slug as sent', actual: created })).toEqual(body);
      });

      await test.step('Verify the body has a non-empty id.', async () => {
        expect(typeof created.id === 'string' && created.id.length > 0, assertMessage({ request, expected: 'A non-empty id', actual: created })).toBe(true);
      });

      await test.step('Verify GET /brands/{brandId} with the new id returns 200 with the same name and slug.', async () => {
        const { request: getRequest, response: getResponse } = await sendAndAttach('Get Brand', { method: 'GET', path: `/brands/${created.id}` }, () => brandsClient.getById(created.id));
        expectStatus(getRequest, getResponse, 200);
        const fetched = parseJson<Brand>(getRequest, getResponse);
        expect({ name: fetched.name, slug: fetched.slug }, assertMessage({ request: getRequest, expected: `name and slug as sent: ${JSON.stringify(body)}`, actual: fetched })).toEqual(
          body
        );
      });
    });

    test('API-0128: Create brand ignores fields other than name and slug', async ({ brandsClient, brandsClientWithToken, adminBrandsService, cleanup }) => {
      const body = { ...BrandFactory.createBrand(), description: 'ignored' };
      let request: CreateBrandRequestInfo;
      let response: ApiResponse;
      let createdId = '';

      await test.step(
        'Send POST /brands with a unique brand name, a unique slug and a description field set to "ignored", with the admin\'s token, and take the new brand\'s id.',
        async () => {
          ({ request, response } = await sendCreateBrand(brandsClientWithToken, body, adminBrandsService, cleanup, AUTH.admin));
          createdId = response.isSuccess ? ((parseJson<Brand>(request, response)).id ?? '') : '';
        }
      );

      await test.step('Verify the response status is 201.', async () => {
        expectStatus(request, response, 201);
      });

      await test.step('Verify the body has the keys id, name and slug only.', async () => {
        const keys = Object.keys(parseJson<object>(request, response)).sort();
        expect(keys, assertMessage({ request, expected: 'Keys id, name and slug only', actual: response.body })).toEqual(['id', 'name', 'slug']);
      });

      await test.step('Verify GET /brands/{brandId} with the new id has no description key.', async () => {
        const { request: getRequest, response: getResponse } = await sendAndAttach('Get Brand', { method: 'GET', path: `/brands/${createdId}` }, () => brandsClient.getById(createdId));
        expectStatus(getRequest, getResponse, 200);
        const fetched = parseJson<Record<string, unknown>>(getRequest, getResponse);
        expect('description' in fetched, assertMessage({ request: getRequest, expected: 'No description key', actual: fetched })).toBe(false);
      });
    });
  });

  test('API-0121: Create brand without the required fields returns 422 for each of them', async ({ brandsClient, adminBrandsService, cleanup }) => {
    let request: CreateBrandRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /brands with an empty JSON object as the body.', async () => {
      ({ request, response } = await sendCreateBrand(brandsClient, {}, adminBrandsService, cleanup));
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

  test('API-0122: Create brand with a slug outside letters, digits, dashes and underscores returns 422', async ({ brandsClient, adminBrandsService, cleanup }) => {
    await checkRejectedBody(
      'Send POST /brands with a unique brand name and a slug made of a unique slug followed by " x!" (a space and an exclamation mark).',
      () => {
        const body = BrandFactory.createBrand({ slug: BrandFactory.slugWithInvalidChars() });
        return sendCreateBrand(brandsClient, body, adminBrandsService, cleanup);
      },
      'slug'
    );
  });

  test('API-0123: Create brand with a name longer than 120 characters returns 422', async ({ brandsClient, adminBrandsService, cleanup }) => {
    await checkRejectedBody(
      'Send POST /brands with a 121-character name that starts with a unique brand name, and a unique slug.',
      () => {
        const body = BrandFactory.createBrand({ name: BrandFactory.nameTooLong() });
        return sendCreateBrand(brandsClient, body, adminBrandsService, cleanup);
      },
      'name'
    );
  });

  test('API-0124: Create brand with a slug longer than 120 characters returns 422', async ({ brandsClient, adminBrandsService, cleanup }) => {
    await checkRejectedBody(
      'Send POST /brands with a unique brand name and a 121-character slug that starts with a unique slug and contains only letters, digits and dashes.',
      () => {
        const body = BrandFactory.createBrand({ slug: BrandFactory.slugTooLong() });
        return sendCreateBrand(brandsClient, body, adminBrandsService, cleanup);
      },
      'slug'
    );
  });

  test('API-0125: Create brand with a subscript character in the name returns 422', async ({ brandsClient, adminBrandsService, cleanup }) => {
    await checkRejectedBody(
      'Send POST /brands with a unique brand name followed by a Unicode subscript character, and a unique slug.',
      () => {
        const body = BrandFactory.createBrand({ name: BrandFactory.nameWithSubscript() });
        return sendCreateBrand(brandsClient, body, adminBrandsService, cleanup);
      },
      'name'
    );
  });

  test('API-0126: Create brand with an existing slug returns 409', async ({ brandsService, brandsClient, adminBrandsService, cleanup }) => {
    let request: CreateBrandRequestInfo;
    let response: ApiResponse;

    const slug = await takeFirstBrandSlug(brandsService);

    await test.step('Send POST /brands with a unique brand name and that slug.', async () => {
      ({ request, response } = await sendCreateBrand(brandsClient, BrandFactory.createBrand({ slug }), adminBrandsService, cleanup));
    });

    await test.step('Verify the response status is 409.', async () => {
      expectStatus(request, response, 409);
    });

    await test.step('Verify the body\'s slug messages include "A brand already exists with this slug.".', async () => {
      expectFieldMessageIncludes(request, response, 'slug', 'A brand already exists with this slug.');
    });
  });

  test('API-0127: Create brand with an existing slug and a too-long name returns 422', async ({ brandsService, brandsClient, adminBrandsService, cleanup }) => {
    let request: CreateBrandRequestInfo;
    let response: ApiResponse;

    const slug = await takeFirstBrandSlug(brandsService);

    await test.step('Send POST /brands with a 121-character name that starts with a unique brand name, and that slug.', async () => {
      ({ request, response } = await sendCreateBrand(brandsClient, BrandFactory.createBrand({ name: BrandFactory.nameTooLong(), slug }), adminBrandsService, cleanup));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a name key with at least one message.', async () => {
      expectFieldMessages(request, response, 'name');
    });
  });

  test('API-0129: Create brand without a token returns 401', async ({ brandsClient, adminBrandsService, cleanup }) => {
    test.fail(true, 'Known issue BUG-009: Accepts POST without a token instead of returning 401.');
    let request: CreateBrandRequestInfo;
    let response: ApiResponse;

    await test.step('Send POST /brands with a unique brand name and a unique slug, without an Authorization header.', async () => {
      ({ request, response } = await sendCreateBrand(brandsClient, BrandFactory.createBrand(), adminBrandsService, cleanup));
    });

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });
  });
});
