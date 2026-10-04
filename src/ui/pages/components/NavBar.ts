import type { Locator, Page } from '@playwright/test';

/** Top navigation bar, shown on every page. */
export class NavBar {
  private readonly homeLink: Locator;
  private readonly signInLink: Locator;
  private readonly userMenuButton: Locator;
  /** Cart link; appears only once the cart has items. */
  private readonly cartLink: Locator;
  private readonly cartQuantityBadge: Locator;

  constructor(page: Page) {
    this.homeLink = page.getByTestId('nav-home');
    this.signInLink = page.getByTestId('nav-sign-in');
    this.userMenuButton = page.getByTestId('nav-menu');
    this.cartLink = page.getByTestId('nav-cart');
    this.cartQuantityBadge = page.getByTestId('cart-quantity');
  }

  /** User menu with the signed-in user's name; visible only when logged in. */
  get userMenu(): Locator {
    return this.userMenuButton;
  }

  /** Badge on the cart link with the total quantity of items. */
  get cartQuantity(): Locator {
    return this.cartQuantityBadge;
  }

  async openHome(): Promise<void> {
    await this.homeLink.click();
  }

  async openSignIn(): Promise<void> {
    await this.signInLink.click();
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }
}
