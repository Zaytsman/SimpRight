import type { Locator, Page } from '@playwright/test';

/** Top navigation bar, shown on every page. */
export class NavBar {
  readonly homeLink: Locator;
  readonly signInLink: Locator;
  /** User menu with the signed-in user's name; visible only when logged in. */
  readonly userMenu: Locator;
  /** Cart link; appears only once the cart has items. */
  readonly cartLink: Locator;
  /** Badge on the cart link with the total quantity of items. */
  readonly cartQuantity: Locator;

  constructor(page: Page) {
    this.homeLink = page.getByTestId('nav-home');
    this.signInLink = page.getByTestId('nav-sign-in');
    this.userMenu = page.getByTestId('nav-menu');
    this.cartLink = page.getByTestId('nav-cart');
    this.cartQuantity = page.getByTestId('cart-quantity');
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }
}
