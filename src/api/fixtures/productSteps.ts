import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { ApiResponse } from '../clients/BaseClient';
import type { ProductsClient } from '../clients/ProductsClient';
import type { Paginated } from '../dto/common';
import type { CreateProductRequest, Product, ProductDetails } from '../dto/product';
import type { ProductsService } from '../services/ProductsService';
import { ProductFactory, type ProductRefs } from '../../data/factories/ProductFactory';
import { assertMessage, attachJson } from '../../utils/assertHelpers';
import { expectFieldMessages, expectStatus } from '../../utils/apiChecks';
import { AUTH, fieldMessagesStep, removeIfCreated, sendAndAttach, type AuthLabel } from './apiSteps';

/**
 * Steps shared by the Products specs that change a product (PUT and PATCH /products/{productId}).
 * The titles are the scenario steps verbatim; both scenario files use the same wording.
 */
export const PRODUCT_LIST_STEP = "Send GET /products and take the first item's brand id, category id and product image id.";
export const PRODUCT_CREATE_STEP =
  "Send POST /products with a unique product name, a positive price, those ids, is_location_offer false and is_rental false, and take the new product's id.";
const FIRST_PRODUCT_ID_STEP = "Send GET /products and take the first item's id.";

/**
 * The two setup steps, with their titles verbatim: take the ids of seeded records from the first
 * listed product, then create a product to change (as admin, so setup doesn't rely on writes without
 * a token) and register its removal right away. Returns the new product's id.
 */
export async function createProductToUpdate(
  productsService: ProductsService,
  adminProductsService: ProductsService,
  cleanup: Cleanup
): Promise<string> {
  const refs = await takeProductRefs(productsService);
  return (await createProduct(adminProductsService, cleanup, refs)).id;
}

/**
 * A product-create step (title `title`, default PRODUCT_CREATE_STEP): creates a product with the given ids of seeded
 * records, a unique name, price 9.99 and both flags false unless `overrides` say otherwise, as admin (so setup doesn't
 * rely on writes without a token), and registers its removal right away. Returns the new product.
 */
export async function createProduct(
  adminProductsService: ProductsService,
  cleanup: Cleanup,
  refs: Partial<ProductRefs>,
  title: string = PRODUCT_CREATE_STEP,
  overrides: Partial<CreateProductRequest> = {}
): Promise<Product> {
  return test.step(title, async () => {
    const body = ProductFactory.createProduct(refs as ProductRefs, overrides);
    await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: AUTH.admin, body });
    const product = await adminProductsService.create(body);
    cleanup.add(() => adminProductsService.delete(product.id));
    await attachJson('Create Product Response', product);
    expect(product.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: product })).toBeTruthy();
    return product;
  });
}

const ALL_REFS: (keyof ProductRefs)[] = ['brandId', 'categoryId', 'productImageId'];
const REF_LABELS: Record<keyof ProductRefs, string> = { brandId: 'a brand id', categoryId: 'a category id', productImageId: 'a product image id' };

/**
 * The step "Send GET /products and take the first item's ... ids." under the scenario's own title
 * (default: all three ids). Asserts only the ids in `required`, so a step that takes two ids doesn't
 * check the third. Returns the first product's ids.
 */
export async function takeProductRefs(
  productsService: ProductsService,
  title: string = PRODUCT_LIST_STEP,
  required: (keyof ProductRefs)[] = ALL_REFS
): Promise<Partial<ProductRefs>> {
  return test.step(title, async () => {
    const list = await productsService.list();
    await attachJson('List Products Response', list);
    return firstProductRefs(list, required);
  });
}

/**
 * The ids a "take the first item's ... ids" step takes from a GET /products page: checks that the page has an item and
 * that the first one has the ids in `required` (default: all three), and returns its ids. Not a step.
 */
export function firstProductRefs(list: Paginated<Product>, required: (keyof ProductRefs)[] = ALL_REFS): Partial<ProductRefs> {
  expect(list.data.length, assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
  const first = list.data[0]!;
  const refs: Partial<ProductRefs> = { brandId: first.brand?.id, categoryId: first.category?.id, productImageId: first.product_image?.id };
  expect(
    required.every((key) => Boolean(refs[key])),
    assertMessage({
      request: { method: 'GET', path: '/products' },
      expected: `The first product has ${required.map((key) => REF_LABELS[key]).join(', ')}`,
      actual: refs,
    })
  ).toBe(true);
  return refs;
}

/** Setup steps of the PUT and PATCH scenarios that move a product to other seeded records (same wording in both files). */
const OTHER_REFS_LIST_STEP =
  "Send GET /products and take the first item's brand id, category id and product image id, and from other items of GET /products a brand id, a category id and a product image id that differ from them.";
const PRODUCT_CREATE_FIRST_REFS_STEP =
  "Send POST /products with a unique product name, a positive price, the first item's ids, is_location_offer false and is_rental false, and take the new product's id.";

/**
 * The two setup steps OTHER_REFS_LIST_STEP and PRODUCT_CREATE_FIRST_REFS_STEP: take the first listed product's
 * ids, then from the other items (page 1, and page 2 if page 1 lacks one) a brand id, a category id and a product
 * image id that differ from them; create a product with the first item's ids (as admin) and register its removal.
 * Returns the new product's id and the other ids.
 */
export async function createProductWithOtherRefs(
  productsService: ProductsService,
  adminProductsService: ProductsService,
  cleanup: Cleanup
): Promise<{ productId: string; otherRefs: ProductRefs }> {
  const { firstRefs, otherRefs } = await test.step(OTHER_REFS_LIST_STEP, async () => {
    const list = await productsService.list();
    await attachJson('List Products Response', list);
    const first = firstProductRefs(list);
    const others: Partial<ProductRefs> = {};

    const pickOthers = (items: typeof list.data): void => {
      for (const item of items) {
        if (!others.brandId && item.brand?.id && item.brand.id !== first.brandId) others.brandId = item.brand.id;
        if (!others.categoryId && item.category?.id && item.category.id !== first.categoryId) others.categoryId = item.category.id;
        if (!others.productImageId && item.product_image?.id && item.product_image.id !== first.productImageId) {
          others.productImageId = item.product_image.id;
        }
      }
    };
    pickOthers(list.data.slice(1));
    if (!(others.brandId && others.categoryId && others.productImageId) && list.last_page > 1) {
      const pageTwo = await productsService.list({ page: 2 });
      await attachJson('List Products Page 2 Response', pageTwo);
      pickOthers(pageTwo.data);
    }
    expect(
      Boolean(others.brandId && others.categoryId && others.productImageId),
      assertMessage({
        request: { method: 'GET', path: '/products', query: { page: '1 and 2' } },
        expected: "Other items have a brand id, a category id and a product image id that differ from the first item's",
        actual: { first, other: others },
      })
    ).toBe(true);
    return { firstRefs: first, otherRefs: others as ProductRefs };
  });

  const product = await createProduct(adminProductsService, cleanup, firstRefs, PRODUCT_CREATE_FIRST_REFS_STEP);
  return { productId: product.id, otherRefs };
}

/** The spec lookup step, shared by GET /products (API-0011) and QUERY /products (API-0070). */
const FIND_PRODUCT_SPEC_STEP =
  "Find a product with at least one spec: send GET /products/{productId} for the items of GET /products until one returns a non-empty specs array, and take its first spec's spec_name and spec_value.";

/** The FIND_PRODUCT_SPEC_STEP step: returns the first spec of the first product on page 1 that has one. */
export async function findProductSpec(productsService: ProductsService): Promise<{ specName: string; specValue: string }> {
  const product = await findProductWithSpecs(productsService, FIND_PRODUCT_SPEC_STEP);
  return { specName: product.specs[0]!.spec_name, specValue: product.specs[0]!.spec_value };
}

/**
 * A "Find a product with at least one spec: send GET /products/{productId} for the items of GET /products until one
 * returns a non-empty specs array, and take ..." step (title `title`): returns the details of the first product on page 1
 * of GET /products whose specs aren't empty.
 */
export async function findProductWithSpecs(productsService: ProductsService, title: string): Promise<ProductDetails> {
  return test.step(title, async () => {
    const list = await productsService.list();
    await attachJson('List Products Response', list);
    const checked: string[] = [];
    let found: ProductDetails | undefined;
    for (const item of list.data) {
      const details = await productsService.getById(item.id);
      checked.push(item.id);
      if (details.specs?.length) {
        await attachJson('Get Product Response', details);
        found = details;
        break;
      }
    }
    expect(
      Boolean(found),
      assertMessage({
        request: { method: 'GET', path: '/products' },
        expected: 'A product on page 1 of GET /products has at least one spec',
        actual: { productsChecked: checked, withSpecs: 0 },
      })
    ).toBe(true);
    return found!;
  });
}

/** Not a step: the id of the first item of GET /products, for steps that need "an existing product's id (taken from GET /products)". */
export async function firstListedProductId(productsService: ProductsService): Promise<string> {
  const list = await productsService.list();
  await attachJson('List Products Response', list);
  const id = list.data[0]?.id;
  expect(Boolean(id), assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBe(true);
  return id!;
}

/** A "Send GET /products and take the first item's id ..." step (title `title`, default FIRST_PRODUCT_ID_STEP): that id. */
export async function takeFirstProductId(productsService: ProductsService, title: string = FIRST_PRODUCT_ID_STEP): Promise<string> {
  return test.step(title, () => firstListedProductId(productsService));
}

/** The fixtures `checkInvalidProductChange` uses. */
export type ProductChangeFixtures = {
  productsService: ProductsService;
  adminProductsService: ProductsService;
  productsClient: ProductsClient;
  cleanup: Cleanup;
};

/**
 * The template of the "Update / Partially update product with <an invalid field> returns 422" scenarios: the two setup
 * steps (create a product to change), the PUT or PATCH of `body` without a token (title `sendStep`), then the 422 and
 * the field's messages. Every member of the family has exactly these steps; only `sendStep`, `body` and `field` vary.
 */
export async function checkInvalidProductChange(
  fixtures: ProductChangeFixtures,
  method: 'PUT' | 'PATCH',
  sendStep: string,
  body: Record<string, unknown>,
  field: string
): Promise<void> {
  let request: { method: string; path: string; auth: AuthLabel; body: unknown };
  let response: ApiResponse;

  const productId = await createProductToUpdate(fixtures.productsService, fixtures.adminProductsService, fixtures.cleanup);

  await test.step(sendStep, async () => {
    const send = () => (method === 'PUT' ? fixtures.productsClient.update(productId, body) : fixtures.productsClient.partialUpdate(productId, body));
    ({ request, response } = await sendAndAttach(method === 'PUT' ? 'Update Product' : 'Patch Product', { method, path: `/products/${productId}`, auth: AUTH.none, body }, send));
  });

  await test.step('Verify the response status is 422.', async () => {
    expectStatus(request, response, 422);
  });

  await test.step(fieldMessagesStep(field), async () => {
    expectFieldMessages(request, response, field);
  });
}

/** The request record that `sendCreateProduct` attaches and that assertion messages show. */
export type CreateProductRequestInfo = { method: string; path: string; auth: AuthLabel; body: unknown };

/**
 * Sends POST /products with the given client (the public one, without a token, unless a test passes another),
 * attaches what was sent and what came back, and registers the product's removal (as admin, DELETE is admin-only) when
 * one was created. `auth` describes the client's token in the attached request. Used where the create is the call
 * whose status a step checks.
 */
export async function sendCreateProduct(
  productsClient: ProductsClient,
  body: CreateProductRequest | Record<string, unknown>,
  adminProductsService: ProductsService,
  cleanup: Cleanup,
  auth: AuthLabel = AUTH.none
): Promise<{ request: CreateProductRequestInfo; response: ApiResponse }> {
  const request: CreateProductRequestInfo = { method: 'POST', path: '/products', auth, body };
  return sendAndAttach('Create Product', request, async () => {
    const response = await productsClient.create(body);
    removeIfCreated(response, cleanup, (id) => adminProductsService.delete(id));
    return response;
  });
}
