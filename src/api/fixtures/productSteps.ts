import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { ApiResponse } from '../clients/BaseClient';
import type { ValidationErrors } from '../dto/common';
import type { ProductsService } from '../services/ProductsService';
import { ProductFactory, type ProductRefs } from '../../data/factories/ProductFactory';
import { assertMessage, attachJson } from '../../utils/assertHelpers';

/**
 * Steps shared by the Products specs that change a product (PUT and PATCH /products/{productId}).
 * The titles are the scenario steps verbatim; both scenario files use the same wording.
 */
export const PRODUCT_LIST_STEP = "Send GET /products and take the first item's brand id, category id and product image id.";
export const PRODUCT_CREATE_STEP =
  "Send POST /products with a unique product name, a positive price, those ids, is_location_offer false and is_rental false, and take the new product's id.";

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
  let refs: ProductRefs;
  let productId = '';

  await test.step(PRODUCT_LIST_STEP, async () => {
    const list = await productsService.list();
    await attachJson('List Products Response', list);
    expect(list.data.length, assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
    const first = list.data[0]!;
    refs = { brandId: first.brand?.id, categoryId: first.category?.id, productImageId: first.product_image?.id };
    expect(
      Boolean(refs.brandId && refs.categoryId && refs.productImageId),
      assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'The first product has a brand id, a category id and a product image id', actual: refs })
    ).toBe(true);
  });

  await test.step(PRODUCT_CREATE_STEP, async () => {
    const body = ProductFactory.createProduct(refs);
    await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: "admin's token", body });
    const product = await adminProductsService.create(body);
    cleanup.add(() => adminProductsService.delete(product.id));
    await attachJson('Create Product Response', product);
    expect(product.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: product })).toBeTruthy();
    productId = product.id;
  });

  return productId;
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
  let refs: Partial<ProductRefs> = {};

  await test.step(title, async () => {
    const list = await productsService.list();
    await attachJson('List Products Response', list);
    expect(list.data.length, assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
    const first = list.data[0]!;
    refs = { brandId: first.brand?.id, categoryId: first.category?.id, productImageId: first.product_image?.id };
    expect(
      required.every((key) => Boolean(refs[key])),
      assertMessage({
        request: { method: 'GET', path: '/products' },
        expected: `The first product has ${required.map((key) => REF_LABELS[key]).join(', ')}`,
        actual: refs,
      })
    ).toBe(true);
  });

  return refs;
}

/** Setup steps of the PUT and PATCH scenarios that move a product to other seeded records (same wording in both files). */
export const OTHER_REFS_LIST_STEP =
  "Send GET /products and take the first item's brand id, category id and product image id, and from other items of GET /products a brand id, a category id and a product image id that differ from them.";
export const PRODUCT_CREATE_FIRST_REFS_STEP =
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
  let firstRefs: ProductRefs;
  let otherRefs: Partial<ProductRefs> = {};
  let productId = '';

  await test.step(OTHER_REFS_LIST_STEP, async () => {
    const list = await productsService.list();
    await attachJson('List Products Response', list);
    expect(list.data.length, assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
    const first = list.data[0]!;
    firstRefs = { brandId: first.brand?.id, categoryId: first.category?.id, productImageId: first.product_image?.id };
    expect(
      Boolean(firstRefs.brandId && firstRefs.categoryId && firstRefs.productImageId),
      assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'The first product has a brand id, a category id and a product image id', actual: firstRefs })
    ).toBe(true);

    const pickOthers = (items: typeof list.data): void => {
      for (const item of items) {
        if (!otherRefs.brandId && item.brand?.id && item.brand.id !== firstRefs.brandId) otherRefs.brandId = item.brand.id;
        if (!otherRefs.categoryId && item.category?.id && item.category.id !== firstRefs.categoryId) otherRefs.categoryId = item.category.id;
        if (!otherRefs.productImageId && item.product_image?.id && item.product_image.id !== firstRefs.productImageId) {
          otherRefs.productImageId = item.product_image.id;
        }
      }
    };
    pickOthers(list.data.slice(1));
    if (!(otherRefs.brandId && otherRefs.categoryId && otherRefs.productImageId) && list.last_page > 1) {
      const pageTwo = await productsService.list({ page: 2 });
      await attachJson('List Products Page 2 Response', pageTwo);
      pickOthers(pageTwo.data);
    }
    expect(
      Boolean(otherRefs.brandId && otherRefs.categoryId && otherRefs.productImageId),
      assertMessage({
        request: { method: 'GET', path: '/products', query: { page: '1 and 2' } },
        expected: "Other items have a brand id, a category id and a product image id that differ from the first item's",
        actual: { first: firstRefs, other: otherRefs },
      })
    ).toBe(true);
  });

  await test.step(PRODUCT_CREATE_FIRST_REFS_STEP, async () => {
    const body = ProductFactory.createProduct(firstRefs);
    await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: "admin's token", body });
    const product = await adminProductsService.create(body);
    cleanup.add(() => adminProductsService.delete(product.id));
    await attachJson('Create Product Response', product);
    expect(product.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: product })).toBeTruthy();
    productId = product.id;
  });

  return { productId, otherRefs: otherRefs as ProductRefs };
}

/** The spec lookup step, shared by GET /products (API-0011) and QUERY /products (API-0070). */
export const FIND_PRODUCT_SPEC_STEP =
  "Find a product with at least one spec: send GET /products/{productId} for the items of GET /products until one returns a non-empty specs array, and take its first spec's spec_name and spec_value.";

/** The FIND_PRODUCT_SPEC_STEP step: returns the first spec of the first product on page 1 that has one. */
export async function findProductSpec(productsService: ProductsService): Promise<{ specName: string; specValue: string }> {
  let specName = '';
  let specValue = '';

  await test.step(FIND_PRODUCT_SPEC_STEP, async () => {
    const list = await productsService.list();
    await attachJson('List Products Response', list);
    const checked: string[] = [];
    for (const item of list.data) {
      const details = await productsService.getById(item.id);
      checked.push(item.id);
      if (details.specs?.length) {
        await attachJson('Get Product Response', details);
        specName = details.specs[0]!.spec_name;
        specValue = details.specs[0]!.spec_value;
        break;
      }
    }
    expect(
      Boolean(specName),
      assertMessage({
        request: { method: 'GET', path: '/products' },
        expected: 'A product on page 1 of GET /products has at least one spec',
        actual: { productsChecked: checked, withSpecs: 0 },
      })
    ).toBe(true);
  });

  return { specName, specValue };
}

/** The checks of a "Verify the body has a <field> key with at least one message." step. */
export function expectFieldMessages(response: ApiResponse, field: string, request: unknown): void {
  const body = JSON.parse(response.body) as ValidationErrors;
  const messages = body[field];
  expect(
    Array.isArray(messages) && messages.length > 0,
    assertMessage({ request, expected: `Body has a "${field}" key with at least one message`, actual: body })
  ).toBe(true);
}
