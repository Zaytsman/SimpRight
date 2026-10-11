import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { ApiResponse } from '../clients/BaseClient';
import type { ProductSpecsClient } from '../clients/ProductSpecsClient';
import type { ProductSpec } from '../dto/product';
import type { ProductSpecsService } from '../services/ProductSpecsService';
import type { ProductsService } from '../services/ProductsService';
import type { ProductRefs } from '../../data/factories/ProductFactory';
import { ProductSpecFactory } from '../../data/factories/ProductSpecFactory';
import { assertMessage, attachJson } from '../../utils/assertHelpers';
import { createProductFromRefs, createProductToUpdate, firstListedProductId, firstProductRefs } from './productSteps';

/**
 * Steps shared by the product specs specs (/products/{productId}/specs and /product-specs/names). The titles are the
 * scenario steps verbatim; the files use the same wording, and the variants pass their own title.
 * Specs are created only on throwaway products: seeded products are never given, changed or stripped of specs.
 */
const SPEC_CREATE_STEP =
  'Send POST /products/{productId}/specs with the new product\'s id, a body with a unique spec_name, spec_value "1.5" and spec_unit "kg", and the default user\'s token, and take the new spec\'s id.';
const FIRST_PRODUCT_ID_STEP = "Send GET /products and take the first item's id.";
const OTHER_PRODUCT_LIST_STEP = "Send GET /products and take the first item's brand id, category id and product image id, and the id of another item.";

/** How the attached requests describe the token of the spec writes ("with the default user's token"). */
export const DEFAULT_TOKEN = "default user's token";

/** The fixtures the spec setup helpers use. */
export type SpecSetupFixtures = {
  productsService: ProductsService;
  adminProductsService: ProductsService;
  productSpecsServiceWithToken: ProductSpecsService;
  cleanup: Cleanup;
};

/** The FIRST_PRODUCT_ID_STEP step (or a variant with the title `title`): the id of the first item of GET /products. */
export async function takeFirstProductId(productsService: ProductsService, title: string = FIRST_PRODUCT_ID_STEP): Promise<string> {
  let productId = '';
  await test.step(title, async () => {
    productId = await firstListedProductId(productsService);
  });
  return productId;
}

/**
 * A spec-create setup step (title `title`, default SPEC_CREATE_STEP): adds a spec with a unique name, value "1.5" and
 * unit "kg" to the product with the default user's token, and registers its removal right away. DELETE answers 204 also
 * when the spec is already gone, so tests that delete it themselves are fine; the product's removal, registered
 * earlier, runs after it.
 */
export async function createSpec(
  productSpecsServiceWithToken: ProductSpecsService,
  productId: string,
  cleanup: Cleanup,
  title: string = SPEC_CREATE_STEP
): Promise<ProductSpec> {
  let created: ProductSpec | undefined;

  await test.step(title, async () => {
    const body = ProductSpecFactory.createSpec();
    const path = `/products/${productId}/specs`;
    await attachJson('Create Spec Request', { method: 'POST', path, auth: DEFAULT_TOKEN, body });
    const spec = await productSpecsServiceWithToken.create(productId, body);
    cleanup.add(() => productSpecsServiceWithToken.delete(productId, spec.id));
    await attachJson('Create Spec Response', spec);
    expect(spec.id, assertMessage({ request: { method: 'POST', path, body }, expected: 'The new spec has an id', actual: spec })).toBeTruthy();
    created = spec;
  });

  return created!;
}

/**
 * The three setup steps most spec scenarios start with, titles verbatim: take the first listed product's ids, create a
 * product with them (as admin) and add a spec to it (default user). Returns the new product's id and the new spec.
 */
export async function createProductWithSpec({
  productsService,
  adminProductsService,
  productSpecsServiceWithToken,
  cleanup,
}: SpecSetupFixtures): Promise<{ productId: string; spec: ProductSpec }> {
  const productId = await createProductToUpdate(productsService, adminProductsService, cleanup);
  const spec = await createSpec(productSpecsServiceWithToken, productId, cleanup);
  return { productId, spec };
}

/**
 * The OTHER_PRODUCT_LIST_STEP step, then PRODUCT_CREATE_STEP: takes the first listed product's ids and the id of another
 * item on page 1 (a seeded product that differs from the first), then creates a product with the first item's ids (as
 * admin) and registers its removal. Returns the new product's id and the other item's id.
 */
export async function createProductAndTakeOtherId(
  productsService: ProductsService,
  adminProductsService: ProductsService,
  cleanup: Cleanup
): Promise<{ productId: string; otherProductId: string }> {
  let refs: Partial<ProductRefs> = {};
  let otherProductId = '';

  await test.step(OTHER_PRODUCT_LIST_STEP, async () => {
    const list = await productsService.list();
    await attachJson('List Products Response', list);
    refs = firstProductRefs(list);
    const firstId = list.data[0]!.id;
    otherProductId = list.data.find((item) => item.id !== firstId)?.id ?? '';
    expect(
      Boolean(otherProductId),
      assertMessage({ request: { method: 'GET', path: '/products' }, expected: `Another item whose id differs from ${firstId}`, actual: list.data.map((item) => item.id) })
    ).toBe(true);
  });

  const productId = await createProductFromRefs(refs as ProductRefs, adminProductsService, cleanup);
  return { productId, otherProductId };
}

/** A read-back for a step: GET /products/{productId}/specs/{specId} through the service (fails the step unless it succeeds), attached. */
export async function readSpec(productSpecsService: ProductSpecsService, productId: string, specId: string): Promise<ProductSpec> {
  const spec = await productSpecsService.getById(productId, specId);
  await attachJson('Get Spec Response', spec);
  return spec;
}

/** The request record that `sendGetSpec` attaches and that assertion messages show. */
export type GetSpecRequest = { method: 'GET'; path: string; auth: string };

/**
 * Sends GET /products/{productId}/specs/{specId} with the given client (`auth` describes its token) and attaches the
 * request and the response. For steps that check the status; the step asserts it.
 */
export async function sendGetSpec(
  productSpecsClient: ProductSpecsClient,
  productId: string,
  specId: string,
  auth: string
): Promise<{ request: GetSpecRequest; response: ApiResponse }> {
  const request: GetSpecRequest = { method: 'GET', path: `/products/${productId}/specs/${specId}`, auth };
  const response = await productSpecsClient.getById(productId, specId);
  await attachJson('Get Spec Request', request);
  await attachJson('Get Spec Response', { status: response.status, body: response.body });
  return { request, response };
}
