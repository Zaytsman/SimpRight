import type { Locator, Page } from '@playwright/test';

/** Grid of product cards on the home/search page. */
export class ProductGrid {
  /** Every card is a link with `data-test="product-<id>"`. */
  readonly cards: Locator;
  readonly productNames: Locator;
  readonly noResults: Locator;

  constructor(page: Page) {
    this.cards = page.locator('a[data-test^="product-"]');
    this.productNames = page.getByTestId('product-name');
    this.noResults = page.getByTestId('no-results');
  }

  card(name: string): Locator {
    return this.cards.filter({ has: this.productNames.getByText(name, { exact: true }) });
  }

  async getProductNames(): Promise<string[]> {
    return (await this.productNames.allTextContents()).map((name) => name.trim());
  }

  async openProduct(name: string): Promise<void> {
    await this.card(name).click();
  }
}
