import { test, expect, AUTH, createProductAndTakeOtherId, createProductWithSpec, createSpec, readSpec, sendGetSpec, takeFirstProductId, sendAndAttach, type SpecSetupFixtures } from '@fixtures';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductSpecsClient } from '@api/clients/ProductSpecsClient';
import type { ProductSpec } from '@api/dto/product';
import type { UpdateProductSpecRequest } from '@api/dto/productSpec';
import { TestConstants } from '@data/TestConstants';
import { ProductSpecFactory } from '@data/factories/ProductSpecFactory';
import { describeAccept, expectErrorKeys, expectMessage, expectStatus, expectSuccess } from '@utils/apiChecks';
import { assertMessage } from '@utils/assertHelpers';

// Scenarios: test-scenarios/api/products/put-products-by-product-id-specs-by-spec-id.yml

const NOT_FOUND = 'Requested item not found';
const READ_BACK_STEP = "Send GET /products/{productId}/specs/{specId} with the new product's id and the new spec's id.";

type UpdateSpecRequest = { method: 'PUT'; path: string; auth: string; accept: string; body: unknown };

/** Sends PUT /products/{productId}/specs/{specId} with the given client (`auth` describes its token) and attaches the request and the response. */
async function sendUpdateSpec(
  productSpecsClient: ProductSpecsClient,
  productId: string,
  specId: string,
  body: UpdateProductSpecRequest | Record<string, unknown>,
  auth: string,
  options: { accept?: string | null; followRedirects?: boolean } = {}
): Promise<{ request: UpdateSpecRequest; response: ApiResponse }> {
  const request: UpdateSpecRequest = { method: 'PUT', path: `/products/${productId}/specs/${specId}`, auth, accept: describeAccept(options.accept), body };
  return sendAndAttach('Update Spec', request, () =>
    productSpecsClient.update(productId, specId, body, { accept: options.accept, maxRedirects: options.followRedirects === false ? 0 : undefined })
  );
}

/** The spec's three values, for comparing a read-back with what was sent or created. */
function valuesOf(spec: Pick<ProductSpec, 'spec_name' | 'spec_value' | 'spec_unit'>): Pick<ProductSpec, 'spec_name' | 'spec_value' | 'spec_unit'> {
  return { spec_name: spec.spec_name, spec_value: spec.spec_value, spec_unit: spec.spec_unit };
}

/**
 * A 422 scenario on a new product's new spec that checks one errors key: the three setup steps, the PUT with the body
 * (step title `sendStep`) and the default user's token, then the status and the key.
 */
async function checkInvalidUpdate(
  fixtures: SpecSetupFixtures & { productSpecsClientWithToken: ProductSpecsClient },
  sendStep: string,
  body: Record<string, unknown>,
  key: string
): Promise<void> {
  let request: UpdateSpecRequest;
  let response: ApiResponse;

  const { productId, spec } = await createProductWithSpec(fixtures);

  await test.step(sendStep, async () => {
    ({ request, response } = await sendUpdateSpec(fixtures.productSpecsClientWithToken, productId, spec.id, body, AUTH.defaultUser));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(`Verify the body's errors has a ${key} key with at least one message.`, async () => {
    expectErrorKeys(request, response, [key]);
  });
}

test.describe('@products-api - Products API', () => {
  test("API-0553: Update a spec's value returns success and keeps the other fields", async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsService,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;
    let fetched: ProductSpec;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step(
      'Send PUT /products/{productId}/specs/{specId} with the new product\'s id, the new spec\'s id and a body with spec_value "2.5", with the default user\'s token.',
      async () => {
        ({ request, response } = await sendUpdateSpec(productSpecsClientWithToken, productId, spec.id, ProductSpecFactory.updateValue(), AUTH.defaultUser));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step(READ_BACK_STEP, async () => {
      fetched = await readSpec(productSpecsService, productId, spec.id);
    });

    await test.step('Verify its spec_value is "2.5".', async () => {
      expect(fetched.spec_value, assertMessage({ request: { method: 'GET', path: `/products/${productId}/specs/${spec.id}` }, expected: 'spec_value is "2.5"', actual: fetched })).toBe(
        '2.5'
      );
    });

    await test.step('Verify its spec_name and spec_unit equal the values the spec was created with.', async () => {
      expect(
        { spec_name: fetched.spec_name, spec_unit: fetched.spec_unit },
        assertMessage({ request: { method: 'GET', path: `/products/${productId}/specs/${spec.id}` }, expected: 'spec_name and spec_unit as created', actual: { created: spec, fetched } })
      ).toEqual({ spec_name: spec.spec_name, spec_unit: spec.spec_unit });
    });
  });

  test("API-0554: Update a spec's name, value and unit saves all three", async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsService,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    const body = ProductSpecFactory.updateAll();
    let request: UpdateSpecRequest;
    let response: ApiResponse;
    let fetched: ProductSpec;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step(
      'Send PUT /products/{productId}/specs/{specId} with the new product\'s id, the new spec\'s id and a body with a new unique spec_name, spec_value "9" and spec_unit "g", with the default user\'s token.',
      async () => {
        ({ request, response } = await sendUpdateSpec(productSpecsClientWithToken, productId, spec.id, body, AUTH.defaultUser));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step(READ_BACK_STEP, async () => {
      fetched = await readSpec(productSpecsService, productId, spec.id);
    });

    await test.step('Verify its spec_name, spec_value and spec_unit equal the new values.', async () => {
      expect(
        valuesOf(fetched),
        assertMessage({ request: { method: 'GET', path: `/products/${productId}/specs/${spec.id}` }, expected: `The new values ${JSON.stringify(body)}`, actual: fetched })
      ).toEqual(body);
    });
  });

  test('API-0555: Update a spec with spec_unit null clears the unit', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsService,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;
    let fetched: ProductSpec;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step(
      "Send PUT /products/{productId}/specs/{specId} with the new product's id, the new spec's id and a body with spec_unit set to null, with the default user's token.",
      async () => {
        ({ request, response } = await sendUpdateSpec(productSpecsClientWithToken, productId, spec.id, ProductSpecFactory.clearUnit(), AUTH.defaultUser));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step(READ_BACK_STEP, async () => {
      fetched = await readSpec(productSpecsService, productId, spec.id);
    });

    await test.step('Verify its spec_unit is null.', async () => {
      expect(fetched.spec_unit, assertMessage({ request: { method: 'GET', path: `/products/${productId}/specs/${spec.id}` }, expected: 'spec_unit is null', actual: fetched })).toBeNull();
    });

    await test.step('Verify its spec_name and spec_value equal the values the spec was created with.', async () => {
      expect(
        { spec_name: fetched.spec_name, spec_value: fetched.spec_value },
        assertMessage({ request: { method: 'GET', path: `/products/${productId}/specs/${spec.id}` }, expected: 'spec_name and spec_value as created', actual: { created: spec, fetched } })
      ).toEqual({ spec_name: spec.spec_name, spec_value: spec.spec_value });
    });
  });

  test('API-0556: Update a spec with an empty body changes nothing', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsService,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;
    let fetched: ProductSpec;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step("Send PUT /products/{productId}/specs/{specId} with the new product's id, the new spec's id and an empty body {}, with the default user's token.", async () => {
      ({ request, response } = await sendUpdateSpec(productSpecsClientWithToken, productId, spec.id, ProductSpecFactory.empty(), AUTH.defaultUser));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step("Verify the body's success is true.", async () => {
      expectSuccess(request, response, true);
    });

    await test.step(READ_BACK_STEP, async () => {
      fetched = await readSpec(productSpecsService, productId, spec.id);
    });

    await test.step('Verify its spec_name, spec_value and spec_unit equal the values the spec was created with.', async () => {
      expect(
        valuesOf(fetched),
        assertMessage({ request: { method: 'GET', path: `/products/${productId}/specs/${spec.id}` }, expected: 'The values the spec was created with', actual: { created: spec, fetched } })
      ).toEqual(valuesOf(spec));
    });
  });

  test('API-0557: Update a spec ignores a product_id in the body', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsClient,
    productSpecsService,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;
    let fetched: ProductSpec;

    const { productId, otherProductId } = await createProductAndTakeOtherId(productsService, adminProductsService, cleanup);
    const spec = await createSpec(productSpecsServiceWithToken, productId, cleanup);

    await test.step(
      'Send PUT /products/{productId}/specs/{specId} with the new product\'s id, the new spec\'s id and a body with spec_value "2.5" and product_id set to the other item\'s id, with the default user\'s token.',
      async () => {
        // If the API moved the spec to the other (seeded) product, the new product's removal wouldn't take it along:
        // remove it under the other id too (a 204 no-op when it isn't there).
        cleanup.add(() => productSpecsServiceWithToken.delete(otherProductId, spec.id));
        ({ request, response } = await sendUpdateSpec(productSpecsClientWithToken, productId, spec.id, ProductSpecFactory.updateValueWithProductId(otherProductId), AUTH.defaultUser));
      }
    );

    await test.step('Verify the response status is 200.', async () => {
      expectStatus(request, response, 200);
    });

    await test.step(READ_BACK_STEP, async () => {
      fetched = await readSpec(productSpecsService, productId, spec.id);
    });

    await test.step('Verify its product_id equals the new product\'s id and its spec_value is "2.5".', async () => {
      expect(
        { product_id: fetched.product_id, spec_value: fetched.spec_value },
        assertMessage({ request: { method: 'GET', path: `/products/${productId}/specs/${spec.id}` }, expected: `product_id ${productId} and spec_value "2.5"`, actual: fetched })
      ).toEqual({ product_id: productId, spec_value: '2.5' });
    });

    await test.step("Verify GET /products/{productId}/specs/{specId} with the other item's id and the new spec's id returns 404.", async () => {
      const other = await sendGetSpec(productSpecsClient, otherProductId, spec.id, 'none');
      expectStatus(other.request, other.response, 404);
    });
  });

  test('API-0558: Update a spec without a token returns 401', async ({ productsService, adminProductsService, productSpecsClient, productSpecsServiceWithToken, cleanup }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step(
      'Send PUT /products/{productId}/specs/{specId} with the new product\'s id, the new spec\'s id and a body with spec_value "2.5", without an Authorization header.',
      async () => {
        ({ request, response } = await sendUpdateSpec(productSpecsClient, productId, spec.id, ProductSpecFactory.updateValue(), 'none'));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0559: Update a spec with an invalid token returns 401', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithInvalidToken,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step(
      'Send PUT /products/{productId}/specs/{specId} with the new product\'s id, the new spec\'s id and a body with spec_value "2.5", with an invalid token.',
      async () => {
        ({ request, response } = await sendUpdateSpec(productSpecsClientWithInvalidToken, productId, spec.id, ProductSpecFactory.updateValue(), 'invalid token'));
      }
    );

    await test.step('Verify the response status is 401.', async () => {
      expectStatus(request, response, 401);
    });

    await test.step('Verify the body\'s message is "Unauthorized".', async () => {
      expectMessage(request, response, 'Unauthorized');
    });
  });

  test('API-0560: Update a spec with an unknown spec id returns 404', async ({ productsService, productSpecsClientWithToken }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;

    const productId = await takeFirstProductId(productsService);

    await test.step(
      'Send PUT /products/{productId}/specs/{specId} with that id, a well-formed ULID that no spec has and a body with spec_value "2.5", with the default user\'s token.',
      async () => {
        ({ request, response } = await sendUpdateSpec(productSpecsClientWithToken, productId, TestConstants.productSpecs.unknownId, ProductSpecFactory.updateValue(), AUTH.defaultUser));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step(`Verify the body's message is "${NOT_FOUND}".`, async () => {
      expectMessage(request, response, NOT_FOUND);
    });
  });

  test("API-0561: Update a spec under another product's id returns 404 and changes nothing", async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsService,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;

    const { productId, otherProductId } = await createProductAndTakeOtherId(productsService, adminProductsService, cleanup);
    const spec = await createSpec(productSpecsServiceWithToken, productId, cleanup);

    await test.step(
      'Send PUT /products/{productId}/specs/{specId} with the other item\'s id, the new spec\'s id and a body with spec_value "2.5", with the default user\'s token.',
      async () => {
        ({ request, response } = await sendUpdateSpec(productSpecsClientWithToken, otherProductId, spec.id, ProductSpecFactory.updateValue(), AUTH.defaultUser));
      }
    );

    await test.step('Verify the response status is 404.', async () => {
      expectStatus(request, response, 404);
    });

    await test.step(`Verify the body's message is "${NOT_FOUND}".`, async () => {
      expectMessage(request, response, NOT_FOUND);
    });

    await test.step(
      "Verify GET /products/{productId}/specs/{specId} with the new product's id and the new spec's id returns the spec_value the spec was created with.",
      async () => {
        const fetched = await readSpec(productSpecsService, productId, spec.id);
        expect(
          fetched.spec_value,
          assertMessage({ request: { method: 'GET', path: `/products/${productId}/specs/${spec.id}` }, expected: `spec_value "${spec.spec_value}" as created`, actual: fetched })
        ).toBe(spec.spec_value);
      }
    );
  });

  test('API-0562: Update a spec with a spec_name longer than 100 characters returns 422', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    await checkInvalidUpdate(
      { productsService, adminProductsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      "Send PUT /products/{productId}/specs/{specId} with the new product's id, the new spec's id and a body with a 101-character spec_name, with the default user's token.",
      ProductSpecFactory.updateSpecNameTooLong(),
      'spec_name'
    );
  });

  test('API-0563: Update a spec with a spec_value longer than 255 characters returns 422', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    await checkInvalidUpdate(
      { productsService, adminProductsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      "Send PUT /products/{productId}/specs/{specId} with the new product's id, the new spec's id and a body with a 256-character spec_value, with the default user's token.",
      ProductSpecFactory.updateSpecValueTooLong(),
      'spec_value'
    );
  });

  test('API-0564: Update a spec with a spec_unit longer than 30 characters returns 422', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    await checkInvalidUpdate(
      { productsService, adminProductsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      "Send PUT /products/{productId}/specs/{specId} with the new product's id, the new spec's id and a body with a 31-character spec_unit, with the default user's token.",
      ProductSpecFactory.updateSpecUnitTooLong(),
      'spec_unit'
    );
  });

  test('API-0565: Update a spec with spec_name null returns 422', async ({ productsService, adminProductsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    await checkInvalidUpdate(
      { productsService, adminProductsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      "Send PUT /products/{productId}/specs/{specId} with the new product's id, the new spec's id and a body with spec_name set to null, with the default user's token.",
      ProductSpecFactory.updateSpecNameNull(),
      'spec_name'
    );
  });

  test('API-0566: Update a spec with an empty spec_value returns 422', async ({ productsService, adminProductsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup }) => {
    await checkInvalidUpdate(
      { productsService, adminProductsService, productSpecsClientWithToken, productSpecsServiceWithToken, cleanup },
      "Send PUT /products/{productId}/specs/{specId} with the new product's id, the new spec's id and a body with spec_value set to an empty string, with the default user's token.",
      ProductSpecFactory.updateSpecValueEmpty(),
      'spec_value'
    );
  });

  test('API-0567: Update an unknown spec with an invalid body returns 422, not 404', async ({ productsService, productSpecsClientWithToken }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;

    const productId = await takeFirstProductId(productsService);

    await test.step(
      "Send PUT /products/{productId}/specs/{specId} with that id, a well-formed ULID that no spec has and a body with a 256-character spec_value, with the default user's token.",
      async () => {
        ({ request, response } = await sendUpdateSpec(
          productSpecsClientWithToken,
          productId,
          TestConstants.productSpecs.unknownId,
          ProductSpecFactory.updateSpecValueTooLong(),
          AUTH.defaultUser
        ));
      }
    );

    await test.step('Verify the response status is 422.', async () => {
      expectStatus(request, response, 422);
    });

    await test.step("Verify the body's errors has a spec_value key with at least one message.", async () => {
      expectErrorKeys(request, response, ['spec_value']);
    });
  });

  test('API-0568: Update a spec with an invalid body and no Accept header returns 302', async ({
    productsService,
    adminProductsService,
    productSpecsClientWithToken,
    productSpecsServiceWithToken,
    cleanup,
  }) => {
    let request: UpdateSpecRequest;
    let response: ApiResponse;

    const { productId, spec } = await createProductWithSpec({ productsService, adminProductsService, productSpecsServiceWithToken, cleanup });

    await test.step(
      "Send PUT /products/{productId}/specs/{specId} with the new product's id, the new spec's id and a body with a 101-character spec_name, with the default user's token, with the Accept header left out and without following redirects.",
      async () => {
        ({ request, response } = await sendUpdateSpec(productSpecsClientWithToken, productId, spec.id, ProductSpecFactory.updateSpecNameTooLong(), AUTH.defaultUser, {
          accept: null,
          followRedirects: false,
        }));
      }
    );

    await test.step('Verify the response status is 302.', async () => {
      expectStatus(request, response, 302);
    });
  });
});
