import type { Locator, Page } from '@playwright/test';

/** Grid of product cards on the home/search page. */
export class ProductGrid {
  /** Every card is a link with `data-test="product-<id>"`. */
  private readonly cardLinks: Locator;
  private readonly productNameTexts: Locator;
  private readonly noResultsText: Locator;

  constructor(page: Page) {
    this.cardLinks = page.locator('a[data-test^="product-"]');
    this.productNameTexts = page.getByTestId('product-name');
    this.noResultsText = page.getByTestId('no-results');
  }

  /** Every product card in the grid. */
  get cards(): Locator {
    return this.cardLinks;
  }

  /** The message shown when a search finds nothing. */
  get noResults(): Locator {
    return this.noResultsText;
  }

  card(name: string): Locator {
    return this.cardLinks.filter({ has: this.productNameTexts.getByText(name, { exact: true }) });
  }

  async getProductNames(): Promise<string[]> {
    return (await this.productNameTexts.allTextContents()).map((name) => name.trim());
  }

  async openProduct(name: string): Promise<void> {
    await this.card(name).click();
  }
}
