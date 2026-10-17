import type { Cleanup } from '../../fixtures/base';
import type { CartsService } from '../../api/services/CartsService';
import type { BasePage } from '../pages/BasePage';

/**
 * Registers the removal of the visitor's cart, for a test that adds a product through the UI: the app creates the
 * cart (its id is in sessionStorage), so the test removes it. Call it in a `finally` around the add
 * (`try { await productPage.addToCart(); } finally { ... }`): the app creates the cart before the item is added, so a
 * failed add can still leave one; with no cart id it does nothing. A cart item blocks deleting its product (409), and
 * cleanup runs newest first, so the cart goes before a product the test made.
 */
export async function removeCartAfterTest(page: BasePage, cartsService: CartsService, cleanup: Cleanup): Promise<void> {
  const cartId = await page.getCartId();
  if (cartId) cleanup.add(() => cartsService.delete(cartId));
}
