import type { Locator, Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/** Top navigation bar, shown on every page. */
export class NavBar extends BaseComponent {
  private readonly userMenuButton: Locator;
  /** Cart link; appears only once the cart has items. */
  private readonly cartLink: Locator;
  private readonly cartQuantityBadge: Locator;

  /**
   * CSS: the header's Angular host element. The bar has no test id, and `getByRole('navigation')` also matches
   * the pagination's `<nav>`.
   */
  constructor(page: Page, root: Locator = page.locator('app-header')) {
    super(page, root);
    this.userMenuButton = root.getByTestId('nav-menu');
    this.cartLink = root.getByTestId('nav-cart');
    this.cartQuantityBadge = root.getByTestId('cart-quantity');
  }

  /** User menu with the signed-in user's name; visible only when logged in. */
  get userMenu(): Locator {
    return this.userMenuButton;
  }

  /** Badge on the cart link with the total quantity of items. */
  get cartQuantity(): Locator {
    return this.cartQuantityBadge;
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }
}
