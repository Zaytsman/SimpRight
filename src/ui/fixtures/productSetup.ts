import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { Product, ProductListQuery } from '../../api/dto/product';
import { firstProductRefs } from '../../api/fixtures/productSteps';
import type { BrandsService } from '../../api/services/BrandsService';
import type { CategoriesService } from '../../api/services/CategoriesService';
import type { ProductsService } from '../../api/services/ProductsService';
import { ProductFactory, type ProductRefs } from '../../data/factories/ProductFactory';
import { assertMessage, attachJson } from '../../utils/assertHelpers';

/** Setup step of UI tests that need a product to buy: one nobody else can change (no seeded product, which any visitor of the demo site can). */
const PRODUCT_IN_STOCK_STEP = 'Create a product for this test through the API: a unique name, in stock.';

/**
 * The PRODUCT_IN_STOCK_STEP step: takes the ids of seeded records from the first listed product, creates a product
 * in stock with them (as admin) and registers its removal right away. A cart holding the product blocks its removal
 * (409), so a test that adds it to a cart also registers the cart's removal, which then runs first.
 */
export async function createProductInStock(
  productsService: ProductsService,
  adminProductsService: ProductsService,
  cleanup: Cleanup
): Promise<Product> {
  return test.step(PRODUCT_IN_STOCK_STEP, async () => {
    const refs = firstProductRefs(await productsService.list());
    const body = ProductFactory.createProductInStock(refs as ProductRefs);
    const product = await adminProductsService.create(body);
    cleanup.add(() => adminProductsService.delete(product.id));
    await attachJson('Create Product Response', product);
    // An admin gets the stock count in in_stock, other users a boolean.
    expect(Boolean(product.in_stock), assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product is in stock', actual: product })).toBe(true);
    return product;
  });
}

/**
 * Not a step: the names the catalogue lists for the home page's filters, for the UI filter checks ("the products the
 * catalogue lists for it in the page's default price range, $1 to $100"). Reads GET /products with the criteria the
 * page sends: the category's id (found by slug), the brand's id (found by its exact name: other visitors leave brands
 * with other names) and `between=price,1,100`. Returns page 1's names, trimmed and sorted, so a test compares them
 * with the grid's page 1 in any order.
 */
export async function catalogueProductNames(
  services: { productsService: ProductsService; categoriesService: CategoriesService; brandsService: BrandsService },
  filters: { categorySlug?: string; brandName?: string }
): Promise<string[]> {
  const query: ProductListQuery = { between: 'price,1,100' };
  if (filters.categorySlug) {
    const categories = await services.categoriesService.list();
    const category = categories.find((item) => item.slug === filters.categorySlug);
    expect(category, `The catalogue has the category with the slug "${filters.categorySlug}"`).toBeTruthy();
    query.by_category = category!.id;
  }
  if (filters.brandName) {
    const brands = await services.brandsService.list();
    const brand = brands.find((item) => item.name === filters.brandName);
    expect(brand, `The catalogue has the brand "${filters.brandName}"`).toBeTruthy();
    query.by_brand = brand!.id;
  }
  const catalogue = await services.productsService.list(query);
  return catalogue.data.map((product) => product.name.trim()).sort();
}
