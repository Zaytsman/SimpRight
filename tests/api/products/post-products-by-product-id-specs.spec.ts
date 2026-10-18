import { test, expect, AUTH, createProductToUpdate, readSpec, takeFirstProductId, removeIfCreated, sendAndAttach } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductSpecsClient } from '@api/clients/ProductSpecsClient';
import type { ProductSpec } from '@api/dto/product';
import type { CreateProductSpecRequest } from '@api/dto/productSpec';
import type { ProductSpecsService } from '@api/services/ProductSpecsService';
import type { ProductsService } from '@api/services/ProductsService';
import type { Cleanup } from '@fixtures/base';
import { TestConstants } from '@data/TestConstants';
import { ProductSpecFactory } from '@data/factories/ProductSpecFactory';
import { describeAccept, expectErrorKeys, expectErrorKeysPresent, expectMessage, expectStatus, parseJson } from '@utils/apiChecks';
import { assertMessage, attachJson } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/post-products-by-product-id-specs.yml

type CreateSpecRequest = { method: 'POST'; path: string; auth: string; accept: string; body: unknown };

/**
 * Sends POST /products/{productId}/specs with the given client (`auth` describes its token) and attaches the request and
 * the response. The POST is the call under test, so a spec exists only when the response says so: its removal (with the
 * default user's token) is registered only for a 2xx response with an id, which covers a validation or auth case that
 * unexpectedly creates one, also on a seeded product.
 */
async function sendCreateSpec(
  productSpecsClient: ProductSpecsClient,
  productId: string,
  body: CreateProductSpecRequest | Record<string, unknown>,
  auth: string,
  remover: { productSpecsServiceWithToken: ProductSpecsService; cleanup: Cleanup },
  options: { accept?: string | null; followRedirects?: boolean } = {}
): Promise<{ request: CreateSpecRequest; response: ApiResponse }> {
  const request: CreateSpecRequest = { method: 'POST', path: `/products/${productId}/specs`, auth, accept: describeAccept(options.accept), body };
  return sendAndAttach('Create Spec', request, async () => {
    const response = await productSpecsClient.create(productId, body, { accept: options.accept, maxRedirects: options.followRedirects === false ? 0 : undefined });
    removeIfCreated(response, remover.cleanup, (id) => remover.productSpecsServiceWithToken.delete(productId, id));
    return response;
  });
}

/**
 * A 422 scenario on the first listed product that checks one errors key: takes the first item's id, sends the body
 * (step title `sendStep`) with the default user's token, then checks the status and the key.
 */
async function checkInvalidBody(
  fixtures: { productsService: ProductsService; productSpecsClientWithToken: ProductSpecsClient; productSpecsServiceWithToken: ProductSpecsService; cleanup: Cleanup },
  sendStep: string,
  body: Record<string, unknown>,
  key: string
): Promise<void> {
  let request: CreateSpecRequest;
  let response: ApiResponse;

  const productId = await takeFirstProductId(fixtures.productsService);

  await test.step(sendStep, async () => {
    ({ request, response } = await sendCreateSpec(fixtures.productSpecsClientWithToken, productId, body, AUTH.defaultUser, fixtures));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(`Verify the body's errors has a ${key} key with at least one message.`, async () => {
    expectErrorKeys(request, response, [key]);
  });
}

test.describe('@products-api - Products API', () => {
  test('API-0534: Add a spec to a product returns 201 and the spec', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsService,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    const body = ProductSpecFactory.createSpec();
    let request: CreateSpecRequest;
    let response: ApiResponse;
    let created: ProductSpec;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step(
      'Send POST /products/{productId}/specs with the new product\'s id, a body with a unique spec_name, spec_value "1.5" and spec_unit "kg", and the default user\'s token, and take the new spec\'s id.',
      async () => {
        ({ request, response } = await sendCreateSpec(productSpecsClientWithToken, productId, body, AUTH.defaultUser, { productSpecsServiceWithToken, cleanup }));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
      created = parseJson<ProductSpec>(request, response);
    });

    await test.step("Verify the body's product_id equals the new product's id.", async () => {
      expect(created.product_id, assertMessage({ request, expected: `product_id is ${productId}`, actual: created })).toBe(productId);
    });

    await test.step("Verify the body's spec_name, spec_value and spec_unit equal the sent values.", async () => {
      expect(
        { spec_name: created.spec_name, spec_value: created.spec_value, spec_unit: created.spec_unit },
        assertMessage({ request, expected: `The sent values ${JSON.stringify(body)}`, actual: created })
      ).toEqual(body);
    });

    await test.step("Verify the body's id is a non-empty string.", async () => {
      expect(typeof created.id === 'string' && created.id.length > 0, assertMessage({ request, expected: 'id is a non-empty string', actual: created })).toBe(true);
    });

    await test.step(
      "Verify GET /products/{productId}/specs with the new product's id returns a spec with that id and those spec_name, spec_value and spec_unit.",
      async () => {
        const specs = await productSpecsService.list(productId);
        await attachJson('List Specs Response', specs);
        const match = specs.find((spec) => spec.id === created.id);
        expect(
          match && { spec_name: match.spec_name, spec_value: match.spec_value, spec_unit: match.spec_unit },
          assertMessage({
            request: { method: 'GET', path: `/products/${productId}/specs` },
            expected: `A spec with id ${created.id} and ${JSON.stringify(body)}`,
            actual: specs,
          })
        ).toEqual(body);
      }
    );
  });

  test('API-0535: Add a spec without spec_unit returns spec_unit null', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsService,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: CreateSpecRequest;
    let response: ApiResponse;
    let created: ProductSpec;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step(
      'Send POST /products/{productId}/specs with the new product\'s id, a body with a unique spec_name and spec_value "1.5" and no spec_unit, and the default user\'s token, and take the new spec\'s id.',
      async () => {
        ({ request, response } = await sendCreateSpec(productSpecsClientWithToken, productId, ProductSpecFactory.createSpecWithoutUnit(), AUTH.defaultUser, {
          productSpecsServiceWithToken,
          cleanup,
        }));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(request, response, 201);
      created = parseJson<ProductSpec>(request, response);
    });

    await test.step("Verify the body's spec_unit is null.", async () => {
      expect(created.spec_unit, assertMessage({ request, expected: 'spec_unit is null', actual: created })).toBeNull();
    });

    await test.step(
      "Verify GET /products/{productId}/specs/{specId} with the new product's id and the new spec's id returns spec_unit null.",
      async () => {
        const spec = await readSpec(productSpecsService, productId, created.id);
        expect(
          spec.spec_unit,
          assertMessage({ request: { method: 'GET', path: `/products/${productId}/specs/${created.id}` }, expected: 'spec_unit is null', actual: spec })
        ).toBeNull();
      }
    );
  });

  test('API-0536: Add a spec without a token returns 401', async ({ productsService, adminProductsService, productSpecsClient, productSpecsServiceWithToken, cleanup }) => {
    let request: CreateSpecRequest;
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step(
      'Send POST /products/{productId}/specs with the new product\'s id and a body with a unique spec_name and spec_value "1.5", without an Authorization header.',
      async () => {
        ({ request, response } = await sendCreateSpec(productSpecsClient, productId, ProductSpecFactory.createSpecWithoutUnit(), 'none', {
          productSpecsServiceWithToken,
          cleanup,
        }));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0537: Add a spec with an invalid token returns 401', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithInvalidToken,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: CreateSpecRequest;
    let response: ApiResponse;

    const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);

    await test.step(
      'Send POST /products/{productId}/specs with the new product\'s id and a body with a unique spec_name and spec_value "1.5", with an invalid token.',
      async () => {
        ({ request, response } = await sendCreateSpec(productSpecsClientWithInvalidToken, productId, ProductSpecFactory.createSpecWithoutUnit(), 'invalid token', {
          productSpecsServiceWithToken,
          cleanup,
        }));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0538: Add a spec without the required fields returns 422', async ({ productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    let request: CreateSpecRequest;
    let response: ApiResponse;

    const productId = await takeFirstProductId(productsService);

    await test.step("Send POST /products/{productId}/specs with that id and an empty body {}, with the default user's token.", async () => {
      ({ request, response } = await sendCreateSpec(productSpecsClientWithToken, productId, ProductSpecFactory.empty(), AUTH.defaultUser, { productSpecsServiceWithToken, cleanup }));
    });

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step('Verify the body has a message.', async () => {
      const body = parseJson<{ message?: unknown }>(request, response);
      expect(typeof body.message === 'string' && body.message.length > 0, assertMessage({ request, expected: 'The body has a non-empty message', actual: body })).toBe(true);
    });

    await test.step("Verify the body's errors has the keys spec_name and spec_value, each with at least one message.", async () => {
      expectErrorKeys(request, response, ['spec_name', 'spec_value']);
    });
  });

  test('API-0539: Add a spec with a spec_name longer than 100 characters returns 422', async ({ productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    await checkInvalidBody(
      { productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      'Send POST /products/{productId}/specs with that id and a body with a 101-character spec_name and spec_value "1.5", with the default user\'s token.',
      ProductSpecFactory.specNameTooLong(),
      'spec_name'
    );
  });

  test('API-0540: Add a spec with a spec_value longer than 255 characters returns 422', async ({ productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    await checkInvalidBody(
      { productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      "Send POST /products/{productId}/specs with that id and a body with a unique spec_name and a 256-character spec_value, with the default user's token.",
      ProductSpecFactory.specValueTooLong(),
      'spec_value'
    );
  });

  test('API-0541: Add a spec with a spec_unit longer than 30 characters returns 422', async ({ productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    await checkInvalidBody(
      { productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      'Send POST /products/{productId}/specs with that id and a body with a unique spec_name, spec_value "1.5" and a 31-character spec_unit, with the default user\'s token.',
      ProductSpecFactory.specUnitTooLong(),
      'spec_unit'
    );
  });

  test("API-0542: Add a spec with a spec_value that isn't a string returns 422", async ({ productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    await checkInvalidBody(
      { productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      "Send POST /products/{productId}/specs with that id and a body with a unique spec_name and spec_value set to the number 1.5, with the default user's token.",
      ProductSpecFactory.specValueNotString(),
      'spec_value'
    );
  });

  test("API-0543: Add a spec with a spec_unit that isn't a string returns 422", async ({ productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    await checkInvalidBody(
      { productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      'Send POST /products/{productId}/specs with that id and a body with a unique spec_name, spec_value "1.5" and spec_unit set to the number 5, with the default user\'s token.',
      ProductSpecFactory.specUnitNotString(),
      'spec_unit'
    );
  });

  test('API-0544: Add a spec with an empty spec_name returns 422', async ({ productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    await checkInvalidBody(
      { productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      'Send POST /products/{productId}/specs with that id and a body with spec_name set to an empty string and spec_value "1.5", with the default user\'s token.',
      ProductSpecFactory.emptySpecName(),
      'spec_name'
    );
  });

  test('API-0545: Add an invalid spec to an unknown product returns 422, not 500', async ({ productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    let request: CreateSpecRequest;
    let response: ApiResponse;

    await test.step(
      "Send POST /products/{productId}/specs with a well-formed ULID that no product has and an empty body {}, with the default user's token.",
      async () => {
        ({ request, response } = await sendCreateSpec(productSpecsClientWithToken, TestConstants.products.unknownId, ProductSpecFactory.empty(), AUTH.defaultUser, {
          productSpecsServiceWithToken,
          cleanup,
        }));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step("Verify the body's errors has the keys spec_name and spec_value.", async () => {
      expectErrorKeysPresent(request, response, ['spec_name', 'spec_value']);
    });
  });

  test('API-0546: Add an invalid spec without an Accept header returns 302', async ({ productsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    let request: CreateSpecRequest;
    let response: ApiResponse;

    const productId = await takeFirstProductId(productsService);

    await test.step(
      "Send POST /products/{productId}/specs with that id and an empty body {}, with the default user's token, with the Accept header left out and without following redirects.",
      async () => {
        ({ request, response } = await sendCreateSpec(
          productSpecsClientWithToken,
          productId,
          ProductSpecFactory.empty(),
          AUTH.defaultUser,
          { productSpecsServiceWithToken, cleanup },
          { accept: null, followRedirects: false }
        ));
      }
    );

    await test.step('Verify the response status is 302.', async () => {
      expectStatus(request, response, 302);
    });
  });

  test('API-0547: Add a spec to an unknown product returns 404', async ({ productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    test.fail(true, 'Known issue BUG-043: Returns 500 instead of 404 for an unknown product id.');
    let request: CreateSpecRequest;
    let response: ApiResponse;

    await test.step(
      'Send POST /products/{productId}/specs with a well-formed ULID that no product has and a body with a unique spec_name and spec_value "1.5", with the default user\'s token.',
      async () => {
        ({ request, response } = await sendCreateSpec(
          productSpecsClientWithToken,
          TestConstants.products.unknownId,
          ProductSpecFactory.createSpecWithoutUnit(),
          AUTH.defaultUser,
          { productSpecsServiceWithToken, cleanup }
        ));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });
  });
});
