import type { Page } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { Product } from '../../api/dto/product';
import type { CartsService } from '../../api/services/CartsService';
import type { ProductsService } from '../../api/services/ProductsService';
import { TestConstants } from '../../data/TestConstants';
import { setVisitorCart } from '../auth/visitorCart';

/** A cart made through the API for the browser: its id and the product in it. */
export interface VisitorCart {
  cartId: string;
  product: Pick<Product, 'id' | 'name' | 'price'>;
}

/**
 * The state "a product is in the cart", for precondition fixtures: finds the seeded product by its exact name, creates
 * a cart through the API (its removal registered at once), adds the product with `quantity`, and gives the cart to the
 * browser (`setVisitorCart`) before any page is opened. Through the API, not the product page: the cart is the test's
 * starting point, not what it tests.
 */
export async function putProductInCart(
  page: Page,
  productsService: ProductsService,
  cartsService: CartsService,
  cleanup: Cleanup,
  productName: string = TestConstants.products.inStockProduct,
  quantity = 1
): Promise<VisitorCart> {
  const found = (await productsService.search(productName)).data.find((product) => product.name === productName);
  if (!found) throw new Error(`No product named exactly "${productName}" to put in the cart`);

  const { id: cartId } = await cartsService.create();
  cleanup.add(() => cartsService.deleteIfExists(cartId));
  await cartsService.addItem(cartId, { product_id: found.id, quantity });
  await setVisitorCart(page, cartId);

  return { cartId, product: { id: found.id, name: found.name, price: found.price } };
}
