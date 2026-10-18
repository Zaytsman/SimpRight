import type { Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { HomePage } from '../pages/HomePage';
import { ProductPage } from '../pages/ProductPage';

/** Multi-page user journeys around finding products. */
export class ShoppingFlow {
  private readonly homePage: HomePage;
  private readonly productPage: ProductPage;

  constructor(page: Page, config: EnvConfig) {
    this.homePage = new HomePage(page, config);
    this.productPage = new ProductPage(page, config);
  }

  /** Home -> search -> open the product's page, like a user would. */
  async openProduct(productName: string): Promise<void> {
    await this.homePage.open();
    await this.homePage.search(productName);
    await this.homePage.productGrid.openProduct(productName);
    await this.productPage.waitForLoaded();
  }
}
