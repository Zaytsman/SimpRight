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

/** The checks of a "Verify the body has a <field> key with at least one message." step. */
export function expectFieldMessages(response: ApiResponse, field: string, request: unknown): void {
  const body = JSON.parse(response.body) as ValidationErrors;
  const messages = body[field];
  expect(
    Array.isArray(messages) && messages.length > 0,
    assertMessage({ request, expected: `Body has a "${field}" key with at least one message`, actual: body })
  ).toBe(true);
}
