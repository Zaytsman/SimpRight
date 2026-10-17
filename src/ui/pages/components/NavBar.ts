import { expect, type Locator, type Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/** Top navigation bar, shown on every page. */
export class NavBar extends BaseComponent {
  private readonly homeLink: Locator;
  private readonly categoriesMenuButton: Locator;
  /** "Rentals" in the Categories menu; visible only while the menu is open. */
  private readonly rentalsLink: Locator;
  private readonly signInLink: Locator;
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
    this.homeLink = root.getByTestId('nav-home');
    this.categoriesMenuButton = root.getByTestId('nav-categories');
    this.rentalsLink = root.getByTestId('nav-rentals');
    this.signInLink = root.getByTestId('nav-sign-in');
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

  async openHome(): Promise<void> {
    await this.homeLink.click();
  }

  /** Opens the "Categories" menu and waits until the dropdown says it is open (Bootstrap sets `aria-expanded`). */
  async openCategoriesMenu(): Promise<void> {
    await this.categoriesMenuButton.click();
    await expect(this.categoriesMenuButton).toHaveAttribute('aria-expanded', 'true');
  }

  /** Clicks "Rentals" in the open Categories menu; the caller waits for the rentals page (`rentalsPage.waitForLoaded()`). */
  async openRentals(): Promise<void> {
    await this.rentalsLink.click();
  }

  async openSignIn(): Promise<void> {
    await this.signInLink.click();
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }
}
