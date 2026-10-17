import type { Page } from '@playwright/test';

/** Where the app keeps the visitor's cart id (`CartService`); it loads the cart from `GET /carts/{id}` with it. */
const CART_ID_KEY = 'cart_id';
/** Our own marker: the cart id was set in this tab, so a later page load doesn't set it again. */
const CART_SET_MARKER_KEY = 'simpright_cart_set';

/**
 * Makes the browser the owner of the cart `cartId` (made through the API) from the next page load on: the app reads the
 * cart id from sessionStorage, so this runs as an init script, before any page is opened. It sets the id only once per
 * tab, so a later navigation doesn't bring back a cart the test emptied (the app removes the id then).
 * Source: the app's cart.service.ts (`getCart()`, which also sets `cart_quantity` for the nav bar's badge).
 */
export async function setVisitorCart(page: Page, cartId: string): Promise<void> {
  await page.addInitScript(
    ({ key, marker, value }) => {
      try {
        if (window.sessionStorage.getItem(marker)) return;
        window.sessionStorage.setItem(key, value);
        window.sessionStorage.setItem(marker, 'true');
      } catch {
        // about:blank and other opaque origins have no sessionStorage.
      }
    },
    { key: CART_ID_KEY, marker: CART_SET_MARKER_KEY, value: cartId }
  );
}
