import { test, expect, findProductSpec, takeProductRefs, sendCreateProduct, PRODUCT_LIST_STEP, type CreateProductRequestInfo } from '@fixtures';
import type { Cleanup } from '@fixtures/base';
import type { ApiResponse } from '@api/clients/BaseClient';
import type { ProductsClient } from '@api/clients/ProductsClient';
import type { Paginated } from '@api/dto/common';
import type { CreateProductRequest, Product, ProductListQuery } from '@api/dto/product';
import type { ProductsService } from '@api/services/ProductsService';
import { TestConstants } from '@data/TestConstants';
import { PRODUCT_NAME_PREFIX, ProductFactory, type ProductRefs } from '@data/factories/ProductFactory';
import { assertMessage, attachJson } from '@utils/assertHelpers';
import { expectStatus } from '@utils/apiChecks';

// Scenarios: test-scenarios/api/products/get-products.yml

type ListRequest = { method: 'GET'; path: '/products'; query?: ProductListQuery };

const LIST_REQUEST: ListRequest = { method: 'GET', path: '/products' };

/** Sends GET /products with the query and attaches the request and the response. */
async function sendList(productsClient: ProductsClient, query?: ProductListQuery): Promise<{ request: ListRequest; response: ApiResponse }> {
  const request: ListRequest = { method: 'GET', path: '/products', ...(query ? { query } : {}) };
  const response = await productsClient.list(query);
  await attachJson('List Products Request', request);
  await attachJson('List Products Response', { status: response.status, body: response.body });
  return { request, response };
}

/** The checks of a "Verify the response status is 200." step; returns the parsed body. */
function expectListOk(request: ListRequest, response: ApiResponse): Paginated<Product> {
  expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
  return JSON.parse(response.body) as Paginated<Product>;
}

const isEcoRating = (rating: string | null | undefined): boolean => ['A', 'B'].includes((rating ?? '').toUpperCase());

type RefKind = 'category' | 'brand';
const FILTER_PARAM: Record<RefKind, 'by_category' | 'by_brand'> = { category: 'by_category', brand: 'by_brand' };
const refIdOf = (item: Product, kind: RefKind): string | undefined => (kind === 'category' ? item.category?.id : item.brand?.id);

/** Reads GET /products page by page, collecting distinct ids of `kind` in list order, until `done(ids, firstId)` holds or the pages run out. */
async function collectRefIds(
  productsService: ProductsService,
  kind: RefKind,
  done: (ids: string[], firstId: string | undefined) => boolean
): Promise<{ ids: string[]; firstId: string | undefined }> {
  const firstPage = await productsService.list();
  await attachJson('List Products Response', firstPage);
  const firstId = firstPage.data[0] ? refIdOf(firstPage.data[0], kind) : undefined;
  const ids: string[] = [];
  const collect = (items: Product[]): void => {
    for (const item of items) {
      const id = refIdOf(item, kind);
      if (id && !ids.includes(id)) ids.push(id);
    }
  };
  collect(firstPage.data);
  for (let page = 2; !done(ids, firstId) && page <= firstPage.last_page; page++) {
    const next = await productsService.list({ page });
    await attachJson(`List Products Page ${page} Response`, next);
    collect(next.data);
  }
  return { ids, firstId };
}

/**
 * The first step of API-0319: the second and third categories in list order other than the first item's. Tests that
 * create products use the first item's category, and the PUT/PATCH product specs move their product to the first
 * other category (`createProductWithOtherRefs`) and delete it, so a total read across such a write would change.
 */
async function takeTwoUntouchedCategoryIds(productsService: ProductsService): Promise<[string, string]> {
  const others = (ids: string[], firstId: string | undefined): string[] => ids.filter((id) => id !== firstId);
  const { ids, firstId } = await collectRefIds(productsService, 'category', (found, first) => others(found, first).length >= 3);
  const picked = others(ids, firstId).slice(1, 3);
  expect(
    picked.length,
    assertMessage({ request: LIST_REQUEST, expected: "At least three categories other than the first item's", actual: { firstId, ids } })
  ).toBe(2);
  return [picked[0]!, picked[1]!];
}

/** The first step of API-0320: the first two different brands in list order (the site has only two). */
async function takeTwoBrandIds(productsService: ProductsService): Promise<[string, string]> {
  const { ids } = await collectRefIds(productsService, 'brand', (found) => found.length >= 2);
  expect(ids.length, assertMessage({ request: LIST_REQUEST, expected: 'Items of at least two different brand ids', actual: ids })).toBeGreaterThanOrEqual(2);
  return [ids[0]!, ids[1]!];
}

/** A "Send GET /products with by_<kind> set to <kind> X and take its total as totalX." step, as setup. */
async function takeTotal(productsService: ProductsService, kind: RefKind, id: string): Promise<number> {
  const list = await productsService.list({ [FILTER_PARAM[kind]]: id });
  await attachJson(`List Products ${FILTER_PARAM[kind]}=${id} Response`, list);
  return list.total;
}

/**
 * The create step of API-0322..0324: POST /products with the client (the next step checks its status), with the
 * product's removal registered as soon as one exists. Returns the request, the response, the name and the new id.
 */
async function createListedProduct(
  productsClient: ProductsClient,
  adminProductsService: ProductsService,
  cleanup: Cleanup,
  refs: ProductRefs,
  overrides: Partial<CreateProductRequest>,
  auth: string
): Promise<{ request: CreateProductRequestInfo; response: ApiResponse; name: string; productId: string }> {
  const body = ProductFactory.createProduct(refs, overrides);
  const { request, response } = await sendCreateProduct(productsClient, body, adminProductsService, cleanup, auth);
  const productId = response.isSuccess ? (JSON.parse(response.body) as Product).id : '';
  return { request, response, name: body.name, productId };
}

/** The checks of a "Verify data has exactly one item and its id is the new product's id." step; returns that item. */
function expectOnlyNewProduct(request: ListRequest, body: Paginated<Product>, productId: string): Product {
  const items = body.data.map((item) => ({ id: item.id, name: item.name }));
  expect(body.data.length, assertMessage({ request, expected: 'data has exactly one item', actual: items })).toBe(1);
  expect(body.data[0]!.id, assertMessage({ request, expected: `The item's id is the new product's id ${productId}`, actual: items })).toBe(productId);
  return body.data[0]!;
}

/** Products the tests create have names starting with "Product-" (the factory's prefix); API-0325 ignores them. */
const isTestProduct = (item: Product): boolean => item.name.startsWith(`${PRODUCT_NAME_PREFIX}-`);

/** Checks that every item's category (or brand) id is A's or B's. */
function expectItemsOfAOrB(request: ListRequest, items: Product[], kind: RefKind, idA: string, idB: string): void {
  for (const item of items) {
    expect(
      [idA, idB].includes(refIdOf(item, kind) ?? ''),
      assertMessage({ request, expected: `Item ${item.id}: ${kind} id is ${idA} or ${idB}`, actual: kind === 'category' ? item.category : item.brand })
    ).toBe(true);
  }
}

/** The steps of API-0319, filtering by two categories whose totals no other test changes. */
async function filterByTwoCategories(productsService: ProductsService, productsClient: ProductsClient): Promise<void> {
  let idA = '';
  let idB = '';
  let totalA = 0;
  let totalB = 0;
  let request: ListRequest;
  let response: ApiResponse;
  let body: Paginated<Product>;

  await test.step(
    "Send GET /products and take the ids of the second and third categories in list order other than the first item's category, reading page=2, 3, ... until both are found (other tests create products in the first item's category and move them to the first other one). Call them category A and category B.",
    async () => {
      [idA, idB] = await takeTwoUntouchedCategoryIds(productsService);
    }
  );

  await test.step('Send GET /products with by_category set to category A and take its total as totalA.', async () => {
    totalA = await takeTotal(productsService, 'category', idA);
  });

  await test.step('Send GET /products with by_category set to category B and take its total as totalB.', async () => {
    totalB = await takeTotal(productsService, 'category', idB);
  });

  await test.step("Send GET /products with by_category set to category A's id and category B's id separated by a comma.", async () => {
    ({ request, response } = await sendList(productsClient, { by_category: `${idA},${idB}` }));
  });

  await test.step('Verify the response status is 200.', async () => {
    body = expectListOk(request, response);
  });

  await test.step("Verify data is not empty and every item's category id is category A's id or category B's id.", async () => {
    expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
    expectItemsOfAOrB(request, body.data, 'category', idA, idB);
  });

  await test.step('Verify total equals totalA plus totalB, so both categories are present in the result.', async () => {
    expect(body.total, assertMessage({ request, expected: `total is totalA + totalB = ${totalA} + ${totalB}`, actual: body.total })).toBe(totalA + totalB);
  });
}

/**
 * The steps of API-0320. The site has only two brands, and tests that create products use them, so the brand
 * totals change during a parallel run: the test checks that both brands appear instead of comparing totals.
 */
async function filterByTwoBrands(productsService: ProductsService, productsClient: ProductsClient): Promise<void> {
  let idA = '';
  let idB = '';
  let request: ListRequest;
  let response: ApiResponse;
  let body: Paginated<Product>;

  await test.step(
    'Send GET /products and take the brand ids of two items that have different brands; when the first page holds only one brand, read page=2, 3, ... until a second brand is found. Call them brand A and brand B.',
    async () => {
      [idA, idB] = await takeTwoBrandIds(productsService);
    }
  );

  await test.step("Send GET /products with by_brand set to brand A's id and brand B's id separated by a comma.", async () => {
    ({ request, response } = await sendList(productsClient, { by_brand: `${idA},${idB}` }));
  });

  await test.step('Verify the response status is 200.', async () => {
    body = expectListOk(request, response);
  });

  await test.step("Verify data is not empty and every item's brand id is brand A's id or brand B's id.", async () => {
    expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
    expectItemsOfAOrB(request, body.data, 'brand', idA, idB);
  });

  await test.step(
    "Verify brand A and brand B both appear among the items, reading page=2, 3, ... of the same request until both have appeared, and every item read has brand A's id or brand B's id.",
    async () => {
      const seen = new Set(body.data.map((item) => refIdOf(item, 'brand')));
      for (let page = 2; !(seen.has(idA) && seen.has(idB)) && page <= body.last_page; page++) {
        const { request: pageRequest, response: pageResponse } = await sendList(productsClient, { by_brand: `${idA},${idB}`, page });
        const pageBody = expectListOk(pageRequest, pageResponse);
        expectItemsOfAOrB(pageRequest, pageBody.data, 'brand', idA, idB);
        for (const item of pageBody.data) seen.add(refIdOf(item, 'brand'));
      }
      expect(
        seen.has(idA) && seen.has(idB),
        assertMessage({ request, expected: `Both brand ${idA} and brand ${idB} appear among the items`, actual: [...seen] })
      ).toBe(true);
    }
  );
}

/**
 * The steps of API-0322 (stock 0) and API-0323 (stock 10), which differ only in the stock and the expected
 * in_stock: create a product without a token, then find it by its unique name without a token.
 */
async function createAndFindByStock(
  productsService: ProductsService,
  productsClient: ProductsClient,
  adminProductsService: ProductsService,
  cleanup: Cleanup,
  stock: number,
  inStock: boolean
): Promise<void> {
  let createRequest: CreateProductRequestInfo;
  let createResponse: ApiResponse;
  let productName = '';
  let productId = '';
  let request: ListRequest;
  let response: ApiResponse;
  let body: Paginated<Product>;
  let item: Product;

  const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

  await test.step(
    `Send POST /products with a unique product name, a positive price, those ids, is_location_offer false, is_rental false and stock ${stock}, and take the new product's id.`,
    async () => {
      ({ request: createRequest, response: createResponse, name: productName, productId } = await createListedProduct(
        productsClient,
        adminProductsService,
        cleanup,
        refs,
        { stock },
        'none'
      ));
    }
  );

  await test.step('Verify the response status is 201.', async () => {
    expectStatus(createRequest, createResponse, 201);
  });

  await test.step('Send GET /products with q set to that unique product name, without an Authorization header.', async () => {
    ({ request, response } = await sendList(productsClient, { q: productName }));
  });

  await test.step('Verify the response status is 200.', async () => {
    body = expectListOk(request, response);
  });

  await test.step("Verify data has exactly one item and its id is the new product's id.", async () => {
    item = expectOnlyNewProduct(request, body, productId);
  });

  await test.step(`Verify that item's in_stock is ${inStock}.`, async () => {
    expect(item.in_stock, assertMessage({ request, expected: `in_stock is ${inStock}`, actual: { id: item.id, in_stock: item.in_stock } })).toBe(inStock);
  });
}

test.describe('@products-api - Products API', () => {
  test('API-0002: List products returns the first page of non-rental products', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products without query parameters.', async () => {
      ({ request, response } = await sendList(productsClient));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify the body has current_page, data, from, last_page, per_page, to and total.', async () => {
      for (const field of ['current_page', 'data', 'from', 'last_page', 'per_page', 'to', 'total'] as const) {
        expect(field in body, assertMessage({ request, expected: `Body has "${field}"`, actual: Object.keys(body) })).toBe(true);
      }
    });

    await test.step('Verify current_page is 1 and per_page is 9.', async () => {
      expect(body.current_page, assertMessage({ request, expected: 'current_page is 1', actual: body.current_page })).toBe(1);
      expect(body.per_page, assertMessage({ request, expected: 'per_page is 9', actual: body.per_page })).toBe(9);
    });

    await test.step('Verify data has at most 9 items.', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'At most 9 items', actual: body.data.length })).toBeLessThanOrEqual(9);
    });

    await test.step('Verify each item has id, name, description, price, is_location_offer, is_rental, co2_rating, in_stock, is_eco_friendly, product_image, a category with id, name and slug, and a brand with id and name.', async () => {
      const fields = ['id', 'name', 'description', 'price', 'is_location_offer', 'is_rental', 'co2_rating', 'in_stock', 'is_eco_friendly', 'product_image', 'category', 'brand'] as const;
      for (const item of body.data) {
        for (const field of fields) {
          expect(field in item, assertMessage({ request, expected: `Item ${item.id} has "${field}"`, actual: Object.keys(item) })).toBe(true);
        }
        for (const field of ['id', 'name', 'slug'] as const) {
          expect(
            item.category !== null && typeof item.category === 'object' && field in item.category,
            assertMessage({ request, expected: `Item ${item.id}: category has "${field}"`, actual: item.category })
          ).toBe(true);
        }
        for (const field of ['id', 'name'] as const) {
          expect(
            item.brand !== null && typeof item.brand === 'object' && field in item.brand,
            assertMessage({ request, expected: `Item ${item.id}: brand has "${field}"`, actual: item.brand })
          ).toBe(true);
        }
      }
    });

    await test.step("Verify every item's is_rental is false.", async () => {
      for (const item of body.data) {
        expect(item.is_rental, assertMessage({ request, expected: `Item ${item.id}: is_rental is false`, actual: item.is_rental })).toBe(false);
      }
    });

    await test.step("Verify every item's in_stock is a boolean.", async () => {
      for (const item of body.data) {
        expect(typeof item.in_stock, assertMessage({ request, expected: `Item ${item.id}: in_stock is a boolean`, actual: item.in_stock })).toBe('boolean');
      }
    });

    await test.step("Verify every item's is_eco_friendly is true exactly when its co2_rating is A or B.", async () => {
      for (const item of body.data) {
        const actual = { id: item.id, co2_rating: item.co2_rating, is_eco_friendly: item.is_eco_friendly };
        expect(
          item.is_eco_friendly,
          assertMessage({ request, expected: 'is_eco_friendly is true exactly when co2_rating is A or B (case-insensitive)', actual })
        ).toBe(isEcoRating(item.co2_rating));
      }
    });
  });

  test("API-0003: Filter by brand returns only that brand's products", async ({ productsService, productsClient }) => {
    let brandId: string;
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products and take the brand id of the first item.', async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      expect(list.data.length, assertMessage({ request: LIST_REQUEST, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
      brandId = list.data[0]!.brand?.id;
      expect(brandId, assertMessage({ request: LIST_REQUEST, expected: 'The first product has a brand id', actual: list.data[0] })).toBeTruthy();
    });

    await test.step('Send GET /products with by_brand set to that brand id.', async () => {
      ({ request, response } = await sendList(productsClient, { by_brand: brandId }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify data is not empty and every item's brand id equals that brand id.", async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.brand?.id, assertMessage({ request, expected: `Item ${item.id}: brand id is ${brandId}`, actual: item.brand })).toBe(brandId);
      }
    });
  });

  test("API-0004: Filter by category returns only that category's products", async ({ productsService, productsClient }) => {
    let categoryId: string;
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products and take the category id of the first item.', async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      expect(list.data.length, assertMessage({ request: LIST_REQUEST, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
      categoryId = list.data[0]!.category?.id;
      expect(categoryId, assertMessage({ request: LIST_REQUEST, expected: 'The first product has a category id', actual: list.data[0] })).toBeTruthy();
    });

    await test.step('Send GET /products with by_category set to that category id.', async () => {
      ({ request, response } = await sendList(productsClient, { by_category: categoryId }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify data is not empty and every item's category id equals that category id.", async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.category?.id, assertMessage({ request, expected: `Item ${item.id}: category id is ${categoryId}`, actual: item.category })).toBe(categoryId);
      }
    });
  });

  test('API-0005: Filter by category slug returns the category and its direct sub-categories', async ({ productsService, productsClient }) => {
    let categoryId: string;
    let categorySlug: string;
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step("Send GET /products and take the first item's category id and slug.", async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      expect(list.data.length, assertMessage({ request: LIST_REQUEST, expected: 'At least one product', actual: list.total })).toBeGreaterThan(0);
      categoryId = list.data[0]!.category?.id;
      categorySlug = list.data[0]!.category?.slug;
      expect(
        Boolean(categoryId && categorySlug),
        assertMessage({ request: LIST_REQUEST, expected: 'The first product has a category id and slug', actual: list.data[0]!.category })
      ).toBe(true);
    });

    await test.step('Send GET /products with by_category_slug set to that slug.', async () => {
      ({ request, response } = await sendList(productsClient, { by_category_slug: categorySlug }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify data is not empty.', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
    });

    await test.step(
      "Verify every item's category is that category or a direct sub-category of it: its category id equals that category id, or GET /products/{productId} for the item returns a category parent_id equal to that category id.",
      async () => {
        for (const item of body.data) {
          if (item.category?.id === categoryId) continue;
          const details = await productsService.getById(item.id);
          await attachJson(`Get Product ${item.id} Response`, details);
          expect(
            details.category?.parent_id,
            assertMessage({
              request: { method: 'GET', path: `/products/${item.id}` },
              expected: `Item ${item.id}: category id is ${categoryId}, or its category's parent_id is ${categoryId}`,
              actual: details.category,
            })
          ).toBe(categoryId);
        }
      }
    );
  });

  test('API-0006: Rental filter returns only rental products', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with is_rental=true.', async () => {
      ({ request, response } = await sendList(productsClient, { is_rental: 'true' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify every item's is_rental is true.", async () => {
      for (const item of body.data) {
        expect(item.is_rental, assertMessage({ request, expected: `Item ${item.id}: is_rental is true`, actual: item.is_rental })).toBe(true);
      }
    });
  });

  test('API-0007: Price range filter returns only products in the range', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with between=price,10,30.', async () => {
      ({ request, response } = await sendList(productsClient, { between: 'price,10,30' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify every item's price is at least 10 and at most 30.", async () => {
      for (const item of body.data) {
        const actual = { id: item.id, price: item.price };
        expect(item.price, assertMessage({ request, expected: 'price is at least 10', actual })).toBeGreaterThanOrEqual(10);
        expect(item.price, assertMessage({ request, expected: 'price is at most 30', actual })).toBeLessThanOrEqual(30);
      }
    });
  });

  test('API-0008: Sort by price descending orders the products by price', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with sort=price,desc.', async () => {
      ({ request, response } = await sendList(productsClient, { sort: 'price,desc' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify the items' prices are in descending order.", async () => {
      const prices = body.data.map((item) => item.price);
      const sorted = [...prices].sort((a, b) => b - a);
      expect(prices, assertMessage({ request, expected: `Prices in descending order: ${JSON.stringify(sorted)}`, actual: prices })).toEqual(sorted);
    });
  });

  test('API-0009: Eco-friendly filter returns only products rated A or B', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with eco_friendly=true.', async () => {
      ({ request, response } = await sendList(productsClient, { eco_friendly: 'true' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify every item's co2_rating is A or B (case-insensitive) and its is_eco_friendly is true.", async () => {
      for (const item of body.data) {
        const actual = { id: item.id, co2_rating: item.co2_rating, is_eco_friendly: item.is_eco_friendly };
        expect(isEcoRating(item.co2_rating), assertMessage({ request, expected: 'co2_rating is A or B (case-insensitive)', actual })).toBe(true);
        expect(item.is_eco_friendly, assertMessage({ request, expected: 'is_eco_friendly is true', actual })).toBe(true);
      }
    });
  });

  test('API-0010: Name filter returns only products whose name contains the text', async ({ productsClient }) => {
    const term = TestConstants.products.searchTerm;
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products with q=pliers.', async () => {
      ({ request, response } = await sendList(productsClient, { q: term }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify data is not empty and every item\'s name contains "pliers" (case-insensitive).', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.name.toLowerCase(), assertMessage({ request, expected: `Name contains "${term}" (case-insensitive)`, actual: item.name })).toContain(term.toLowerCase());
      }
    });
  });

  test('API-0011: Spec filter returns only products with that spec value', async ({ productsService, productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    const { specName, specValue } = await findProductSpec(productsService);

    await test.step('Send GET /products with by_spec=<spec_name>:<spec_value>.', async () => {
      ({ request, response } = await sendList(productsClient, { by_spec: `${specName}:${specValue}` }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify data is not empty.', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
    });

    await test.step("Verify every item's specs, from GET /products/{productId} for the item, include a spec with that spec_name and spec_value.", async () => {
      for (const item of body.data) {
        const details = await productsService.getById(item.id);
        await attachJson(`Get Product ${item.id} Response`, details);
        const specs = (details.specs ?? []).map((spec) => ({ spec_name: spec.spec_name, spec_value: spec.spec_value }));
        expect(
          specs.some((spec) => spec.spec_name === specName && spec.spec_value === specValue),
          assertMessage({
            request: { method: 'GET', path: `/products/${item.id}` },
            expected: `Item ${item.id} has the spec ${specName}: ${specValue}`,
            actual: specs,
          })
        ).toBe(true);
      }
    });
  });

  test('API-0012: Page 2 returns the next products', async ({ productsService, productsClient }) => {
    let pageOneIds: string[] = [];
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    await test.step('Send GET /products and keep the item ids of page 1.', async () => {
      const list = await productsService.list();
      await attachJson('List Products Response', list);
      pageOneIds = list.data.map((item) => item.id);
      expect(pageOneIds.length, assertMessage({ request: LIST_REQUEST, expected: 'Page 1 has items', actual: list.total })).toBeGreaterThan(0);
    });

    await test.step('Send GET /products with page=2.', async () => {
      ({ request, response } = await sendList(productsClient, { page: 2 }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify current_page is 2.', async () => {
      expect(body.current_page, assertMessage({ request, expected: 'current_page is 2', actual: body.current_page })).toBe(2);
    });

    await test.step('Verify no item id on page 2 is among the page 1 ids.', async () => {
      const repeated = body.data.map((item) => item.id).filter((id) => pageOneIds.includes(id));
      expect(repeated, assertMessage({ request, expected: 'No page 2 id is on page 1', actual: { repeated, pageOneIds } })).toEqual([]);
    });
  });

  test('API-0013: Unknown category id returns an empty list', async ({ productsClient }) => {
    /** A well-formed ULID that no category has. */
    const unknownCategoryId = '01ZZZZZZZZZZZZZZZZZZZZZZZZ';
    let request: ListRequest;
    let response: ApiResponse;

    await test.step('Send GET /products with by_category set to a well-formed ULID that no category has.', async () => {
      ({ request, response } = await sendList(productsClient, { by_category: unknownCategoryId }));
    });

    await test.step('Verify the response status is 200.', async () => {
      expectListOk(request, response);
    });

    await test.step('Verify data is an empty array.', async () => {
      const body = JSON.parse(response.body) as Paginated<Product>;
      expect(Array.isArray(body.data), assertMessage({ request, expected: 'data is an array', actual: body.data })).toBe(true);
      expect(body.data, assertMessage({ request, expected: 'data is empty', actual: body.data })).toEqual([]);
    });
  });

  test('API-0014: Unknown sort column is not a server error', async ({ productsClient }) => {
    test.fail(true, 'Known issue BUG-003: Returns 500 instead of a client error (or ignoring the column) for an unknown sort column.');
    let request: ListRequest;
    let response: ApiResponse;

    await test.step('Send GET /products with sort=no_such_column,asc.', async () => {
      ({ request, response } = await sendList(productsClient, { sort: 'no_such_column,asc' }));
    });

    await test.step('Verify the response status is not 500.', async () => {
      expect(response.status, assertMessage({ request, expected: 'Status is not 500', actual: response.status })).not.toBe(500);
    });
  });

  test('API-0319: Filter by two category ids returns only products of those two categories', async ({ productsService, productsClient }) => {
    await filterByTwoCategories(productsService, productsClient);
  });

  test('API-0320: Filter by two brand ids returns only products of those two brands', async ({ productsService, productsClient }) => {
    await filterByTwoBrands(productsService, productsClient);
  });

  test('API-0321: Filter by brand and category together returns only products that match both', async ({ productsService, productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;

    const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's brand id and category id.", ['brandId', 'categoryId']);

    await test.step('Send GET /products with by_brand set to that brand id and by_category set to that category id.', async () => {
      ({ request, response } = await sendList(productsClient, { by_brand: refs.brandId, by_category: refs.categoryId }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step('Verify data is not empty.', async () => {
      expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
    });

    await test.step("Verify every item's brand id equals that brand id and its category id equals that category id.", async () => {
      for (const item of body.data) {
        const actual = { id: item.id, brand: item.brand, category: item.category };
        expect(item.brand?.id, assertMessage({ request, expected: `Item ${item.id}: brand id is ${refs.brandId}`, actual })).toBe(refs.brandId);
        expect(item.category?.id, assertMessage({ request, expected: `Item ${item.id}: category id is ${refs.categoryId}`, actual })).toBe(refs.categoryId);
      }
    });
  });

  test.describe(() => {
    test.use({ authMode: 'none' });

    test('API-0322: A product created with stock 0 is listed as not in stock', async ({ productsService, productsClient, adminProductsService, cleanup }) => {
      await createAndFindByStock(productsService, productsClient, adminProductsService, cleanup, 0, false);
    });

    test('API-0323: A product created with stock above 0 is listed as in stock', async ({ productsService, productsClient, adminProductsService, cleanup }) => {
      await createAndFindByStock(productsService, productsClient, adminProductsService, cleanup, 10, true);
    });
  });

  test('API-0324: A product created as a rental is listed by the rental filter', async ({
    productsService,
    productsClientWithToken,
    productsClient,
    adminProductsService,
    cleanup,
  }) => {
    let createRequest: CreateProductRequestInfo;
    let createResponse: ApiResponse;
    let productName = '';
    let productId = '';
    let request: ListRequest;
    let response: ApiResponse;
    let body: Paginated<Product>;
    let item: Product;

    const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;

    await test.step(
      "Send POST /products with a unique product name, a positive price, those ids, is_location_offer false, is_rental true and stock 10, and take the new product's id.",
      async () => {
        ({ request: createRequest, response: createResponse, name: productName, productId } = await createListedProduct(
          productsClientWithToken,
          adminProductsService,
          cleanup,
          refs,
          { is_rental: true, stock: 10 },
          "the default user's token"
        ));
      }
    );

    await test.step('Verify the response status is 201.', async () => {
      expectStatus(createRequest, createResponse, 201);
    });

    await test.step('Send GET /products with is_rental=true and q set to that unique product name.', async () => {
      ({ request, response } = await sendList(productsClient, { is_rental: 'true', q: productName }));
    });

    await test.step('Verify the response status is 200.', async () => {
      body = expectListOk(request, response);
    });

    await test.step("Verify data has exactly one item and its id is the new product's id.", async () => {
      item = expectOnlyNewProduct(request, body, productId);
    });

    await test.step("Verify that item's is_rental is true.", async () => {
      expect(item.is_rental, assertMessage({ request, expected: 'is_rental is true', actual: { id: item.id, is_rental: item.is_rental } })).toBe(true);
    });
  });

  test('API-0325: Every rental in the rental list has a name, a description and a product image file name', async ({ productsClient }) => {
    let request: ListRequest;
    let response: ApiResponse;
    let rentals: Product[] = [];

    await test.step('Send GET /products with is_rental=true.', async () => {
      ({ request, response } = await sendList(productsClient, { is_rental: 'true' }));
    });

    await test.step('Verify the response status is 200.', async () => {
      rentals = expectListOk(request, response).data;
    });

    await test.step('Verify data is not empty after ignoring products created by tests (names starting with "Product-").', async () => {
      rentals = rentals.filter((item) => !isTestProduct(item));
      expect(rentals.length, assertMessage({ request, expected: 'At least one rental not created by a test', actual: rentals.length })).toBeGreaterThan(0);
    });

    await test.step('Verify every remaining item has a non-empty name, ignoring products created by tests (names starting with "Product-").', async () => {
      for (const item of rentals) {
        expect(
          typeof item.name === 'string' && item.name.trim().length > 0,
          assertMessage({ request, expected: `Item ${item.id}: name is not empty`, actual: item.name })
        ).toBe(true);
      }
    });

    await test.step(
      'Verify every remaining item has a non-empty description, ignoring products created by tests (names starting with "Product-").',
      async () => {
        for (const item of rentals) {
          expect(
            typeof item.description === 'string' && item.description.trim().length > 0,
            assertMessage({ request, expected: `Item ${item.id} (${item.name}): description is not empty`, actual: item.description })
          ).toBe(true);
        }
      }
    );

    await test.step(
      'Verify every remaining item has a product_image with a non-empty file_name, ignoring products created by tests (names starting with "Product-").',
      async () => {
        for (const item of rentals) {
          const fileName = item.product_image?.file_name;
          expect(
            typeof fileName === 'string' && fileName.trim().length > 0,
            assertMessage({ request, expected: `Item ${item.id} (${item.name}): product_image.file_name is not empty`, actual: item.product_image })
          ).toBe(true);
        }
      }
    );
  });
});
