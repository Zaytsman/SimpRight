import type { Page } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { Product } from '../../api/dto/product';
import type { CartsService } from '../../api/services/CartsService';
import type { ProductsService } from '../../api/services/ProductsService';
import { TestConstants } from '../../data/TestConstants';
import { setVisitorCart } from '../auth/visitorCart';
import { setVisitorLocation } from '../auth/visitorLocation';

/** A product put in a cart through the API, with what the tests compare against. */
export type CartProduct = Pick<Product, 'id' | 'name' | 'price' | 'is_rental' | 'co2_rating'>;

/** A cart made through the API for the browser: its id and the product in it. */
export interface VisitorCart {
  cartId: string;
  product: CartProduct;
}

/** A cart made through the API for the browser: its id and its products, in the order they were added. */
export interface VisitorCartWithProducts {
  cartId: string;
  products: CartProduct[];
}

/** A product to put in the cart: its exact seeded name and the quantity (hours for a rental), 1 by default. */
export interface CartItemSpec {
  name: string;
  quantity?: number;
}

export interface PutProductsInCartOptions {
  /**
   * The visitor's location: set in the browser (`setVisitorLocation`) and given to `POST /carts`, as the app does when
   * it creates a cart itself (cart.service.ts). The API gives the cart's location offers their city discount then.
   */
  location?: { lat: number; lng: number };
}

/**
 * The state "these products are in the cart", for precondition fixtures and setup code: finds each seeded product by
 * its exact name, creates a cart through the API (its removal registered at once), adds the products in order, and
 * gives the cart to the browser (`setVisitorCart`) before any page is opened. Through the API, not the product page:
 * the cart is the test's starting point, not what it tests.
 */
export async function putProductsInCart(
  page: Page,
  productsService: ProductsService,
  cartsService: CartsService,
  cleanup: Cleanup,
  items: CartItemSpec[],
  options: PutProductsInCartOptions = {}
): Promise<VisitorCartWithProducts> {
  const lines: { product: CartProduct; quantity: number }[] = [];
  for (const { name, quantity = 1 } of items) {
    const found = (await productsService.search(name)).data.find((product) => product.name === name);
    if (!found) throw new Error(`No product named exactly "${name}" to put in the cart`);
    const product = { id: found.id, name: found.name, price: found.price, is_rental: found.is_rental, co2_rating: found.co2_rating };
    lines.push({ product, quantity });
  }

  if (options.location) await setVisitorLocation(page, options.location);
  const { id: cartId } = await cartsService.create(options.location ? { ...options.location } : {});
  cleanup.add(() => cartsService.deleteIfExists(cartId));
  for (const { product, quantity } of lines) {
    await cartsService.addItem(cartId, { product_id: product.id, quantity });
  }
  await setVisitorCart(page, cartId);

  return { cartId, products: lines.map((line) => line.product) };
}

/** `putProductsInCart` for a single product: the seeded in-stock product by default, with `quantity`. */
export async function putProductInCart(
  page: Page,
  productsService: ProductsService,
  cartsService: CartsService,
  cleanup: Cleanup,
  productName: string = TestConstants.products.inStockProduct,
  quantity = 1
): Promise<VisitorCart> {
  const { cartId, products } = await putProductsInCart(page, productsService, cartsService, cleanup, [{ name: productName, quantity }]);
  const [product] = products;
  if (!product) throw new Error(`Setup: "${productName}" was not put in the cart`);
  return { cartId, product };
}

/** Throws a setup error when a product would add the page's eco discount (CO2 rating A or B) to the cart's totals. */
export function assertNoEcoRating(products: CartProduct[]): void {
  const eco = products.filter((product) => ['A', 'B'].includes(product.co2_rating?.toUpperCase()));
  if (eco.length) {
    throw new Error(`Setup: ${eco.map((p) => `"${p.name}" has CO2 rating ${p.co2_rating}`).join(', ')}; the test needs products without A or B`);
  }
}
