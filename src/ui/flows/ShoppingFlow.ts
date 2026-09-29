import type { Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { CartPage } from '../pages/CartPage';
import { HomePage } from '../pages/HomePage';
import { ProductPage } from '../pages/ProductPage';

/** Multi-page user journeys around finding products and filling the cart. */
export class ShoppingFlow {
  private readonly homePage: HomePage;
  private readonly productPage: ProductPage;
  private readonly cartPage: CartPage;

  constructor(page: Page, config: EnvConfig) {
    this.homePage = new HomePage(page, config);
    this.productPage = new ProductPage(page, config);
    this.cartPage = new CartPage(page, config);
  }

  /** Home -> search -> open product -> set quantity -> add to cart. Returns the product's unit price. */
  async addProductToCart(productName: string, quantity = 1): Promise<{ unitPrice: number }> {
    await this.homePage.open();
    await this.homePage.search(productName);
    await this.homePage.productGrid.openProduct(productName);

    const unitPrice = await this.productPage.getUnitPrice();
    await this.productPage.setQuantity(quantity);
    await this.productPage.addToCart();
    return { unitPrice };
  }

  /** Opens the cart via the nav bar, like a user would. */
  async goToCart(): Promise<CartPage> {
    await this.productPage.navBar.openCart();
    await this.cartPage.waitForLoaded();
    return this.cartPage;
  }
}
