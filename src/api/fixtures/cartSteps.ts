import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { CartsClient } from '../clients/CartsClient';
import type { Cart, CreateCartRequest } from '../dto/cart';
import type { CreateProductRequest, Product } from '../dto/product';
import type { CartsService } from '../services/CartsService';
import type { ProductsService } from '../services/ProductsService';
import { ProductFactory, type ProductRefs } from '../../data/factories/ProductFactory';
import { TestConstants } from '../../data/TestConstants';
import { assertMessage, attachJson } from '../../utils/assertHelpers';
import { takeProductRefs } from './productSteps';

/**
 * Steps shared by the Carts specs. The titles are the scenario steps verbatim; the carts files use the same wording,
 * and the variants (other flags, coordinates, a second product) pass their own title.
 */
export const CART_PRODUCT_IN_STOCK_STEP =
  "Send POST /products with a unique product name, a positive price, those ids, is_location_offer false, is_rental false and stock 10, and take the new product's id.";
export const CART_CREATE_STEP = "Send POST /carts with an empty body and take the returned id as the cart's id.";
/** The product-create steps of the scenarios that put a rental and a non-rental product in one cart. */
export const NON_RENTAL_PRODUCT_STEP =
  "Send POST /products with a unique product name, a positive price, those ids, is_location_offer false, is_rental false and stock 10, and take the new product's id as the non-rental product's id.";
export const RENTAL_PRODUCT_STEP =
  "Send POST /products with a unique product name, a positive price, the same brand, category and product image ids, is_location_offer false, is_rental true and stock 10, and take the new product's id as the rental product's id.";
/** The add-item steps of those scenarios. */
export const ADD_NON_RENTAL_STEP = "Send POST /carts/{cartId} with the cart's id and a body with the non-rental product's id as product_id and quantity 1.";
/** The add-item step for the one product a carts scenario created. */
export const ADD_PRODUCT_STEP = "Send POST /carts/{cartId} with the cart's id and a body with the new product's id as product_id and quantity 1.";
/** The step that finds the seeded Thor Hammer, and the message of the rule that allows one per cart. */
export const THOR_HAMMER_SEARCH_STEP = 'Send GET /products/search with q set to Thor Hammer and take the id of the item whose name is exactly "Thor Hammer".';
export const THOR_HAMMER_MESSAGE = 'You can only have one Thor Hammer in the cart.';
export const ADD_RENTAL_STEP = "Send POST /carts/{cartId} with the cart's id and a body with the rental product's id as product_id and quantity 1.";

/** The fixtures the setup steps use. */
export type CartSetupFixtures = {
  productsService: ProductsService;
  adminProductsService: ProductsService;
  cartsService: CartsService;
  cleanup: Cleanup;
};

/**
 * A product-create step (title `title`): creates a product with the given ids, a unique name, price 9.99, stock 10 and
 * both flags false unless `overrides` say otherwise, as admin, and registers its removal right away. Returns the new product.
 */
export async function createCartProduct(
  adminProductsService: ProductsService,
  cleanup: Cleanup,
  refs: Partial<ProductRefs>,
  title: string = CART_PRODUCT_IN_STOCK_STEP,
  overrides: Partial<CreateProductRequest> = {}
): Promise<Product> {
  let created: Product | undefined;

  await test.step(title, async () => {
    const body = ProductFactory.createProduct(refs as ProductRefs, { stock: 10, ...overrides });
    await attachJson('Create Product Request', { method: 'POST', path: '/products', auth: "admin's token", body });
    const product = await adminProductsService.create(body);
    cleanup.add(() => adminProductsService.delete(product.id));
    await attachJson('Create Product Response', product);
    expect(product.id, assertMessage({ request: { method: 'POST', path: '/products', body }, expected: 'The new product has an id', actual: product })).toBeTruthy();
    created = product;
  });

  return created!;
}

/**
 * A cart-create step (title `title`, default CART_CREATE_STEP; `body` holds the coordinates when the step names them):
 * creates the cart and registers its removal right away. Cleanup runs newest first, so a cart created after its products
 * goes before them (a cart item blocks the product delete with 409); a 404 counts as done, for tests that delete the cart.
 */
export async function createCart(cartsService: CartsService, cleanup: Cleanup, title: string = CART_CREATE_STEP, body: CreateCartRequest = {}): Promise<string> {
  let cartId = '';

  await test.step(title, async () => {
    await attachJson('Create Cart Request', { method: 'POST', path: '/carts', body });
    const cart = await cartsService.create(body);
    cleanup.add(() => cartsService.deleteIfExists(cart.id));
    await attachJson('Create Cart Response', cart);
    expect(cart.id, assertMessage({ request: { method: 'POST', path: '/carts', body }, expected: 'The new cart has an id', actual: cart })).toBeTruthy();
    cartId = cart.id;
  });

  return cartId;
}

/**
 * The three setup steps most carts scenarios start with, titles verbatim: take the first listed product's ids, create a
 * product in stock with them (as admin) and an empty cart.
 */
export async function createProductAndCart({ productsService, adminProductsService, cartsService, cleanup }: CartSetupFixtures): Promise<{ productId: string; cartId: string }> {
  const refs = await takeProductRefs(productsService);
  const productId = (await createCartProduct(adminProductsService, cleanup, refs)).id;
  const cartId = await createCart(cartsService, cleanup);
  return { productId, cartId };
}

/** An add-item step used as setup (title `title`): adds the product with the quantity through the service, which fails the step unless it succeeds. */
export async function addItemSetup(cartsService: CartsService, cartId: string, productId: string, quantity: number, title: string): Promise<void> {
  await test.step(title, async () => {
    const request = { method: 'POST', path: `/carts/${cartId}`, body: { product_id: productId, quantity } };
    await attachJson('Add Item Request', request);
    const result = await cartsService.addItem(cartId, request.body);
    await attachJson('Add Item Response', result);
  });
}

/**
 * The step "Send GET /products/search with q set to Thor Hammer and take the id of the item whose name is exactly
 * "Thor Hammer"." (title `title`). Returns that id.
 */
export async function findThorHammerId(productsService: ProductsService, title: string = THOR_HAMMER_SEARCH_STEP): Promise<string> {
  let id = '';

  await test.step(title, async () => {
    const name = TestConstants.carts.thorHammer;
    const result = await productsService.search(name);
    await attachJson('Search Products Response', result);
    const item = result.data.find((product) => product.name === name);
    expect(
      Boolean(item?.id),
      assertMessage({
        request: { method: 'GET', path: '/products/search', query: { q: name } },
        expected: `An item named exactly "${name}"`,
        actual: result.data.map((product) => product.name),
      })
    ).toBe(true);
    id = item!.id;
  });

  return id;
}

/** Not a step: the id of the first item of GET /products, for steps that need "an existing product's id (taken from GET /products)". */
export async function firstListedProductId(productsService: ProductsService): Promise<string> {
  const list = await productsService.list();
  await attachJson('List Products Response', list);
  const id = list.data[0]?.id;
  expect(Boolean(id), assertMessage({ request: { method: 'GET', path: '/products' }, expected: 'At least one product', actual: list.total })).toBe(true);
  return id!;
}

/** Sends GET /carts/{cartId}, attaches the response and checks it returns 200; returns the parsed cart. */
export async function getCartOk(cartsClient: CartsClient, cartId: string): Promise<Cart> {
  const request = { method: 'GET', path: `/carts/${cartId}` };
  const response = await cartsClient.getById(cartId);
  await attachJson('Get Cart Response', { status: response.status, body: response.body });
  expect(response.status, assertMessage({ request, expected: 'Status 200', actual: response.status })).toBe(200);
  return JSON.parse(response.body) as Cart;
}

/**
 * The checks of "its cart_items has exactly one item, with the new product's id as product_id and quantity <n>".
 * `productLabel` names the product in the failure message (default: the new product's id).
 */
export function expectSingleItem(cartId: string, cart: Cart, productId: string, quantity: number, productLabel = "the new product's id"): void {
  const request = { method: 'GET', path: `/carts/${cartId}` };
  const items = cart.cart_items.map((item) => ({ product_id: item.product_id, quantity: item.quantity }));
  expect(cart.cart_items.length, assertMessage({ request, expected: 'cart_items has exactly one item', actual: items })).toBe(1);
  const item = cart.cart_items[0]!;
  expect(item.product_id, assertMessage({ request, expected: `product_id is ${productLabel} (${productId})`, actual: items })).toBe(productId);
  expect(item.quantity, assertMessage({ request, expected: `quantity is ${quantity}`, actual: items })).toBe(quantity);
}

/** The checks of "the cart_items is empty". */
export function expectNoItems(cartId: string, cart: Cart): void {
  const request = { method: 'GET', path: `/carts/${cartId}` };
  expect(
    Array.isArray(cart.cart_items) && cart.cart_items.length === 0,
    assertMessage({ request, expected: 'cart_items is an empty array', actual: cart.cart_items })
  ).toBe(true);
}
