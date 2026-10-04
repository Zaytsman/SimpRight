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

  /**
   * The price shown on each card, in grid order, without the currency sign: the discounted price when
   * the card has one (`product-discount-price`), otherwise `product-price`.
   */
  async getPrices(): Promise<number[]> {
    const prices: number[] = [];
    for (const card of await this.cardLinks.all()) {
      const discountPrice = card.getByTestId('product-discount-price');
      const shown = (await discountPrice.count()) > 0 ? discountPrice : card.getByTestId('product-price');
      prices.push(Number((await shown.textContent())?.replace('$', '').trim()));
    }
    return prices;
  }

  async openProduct(name: string): Promise<void> {
    await this.card(name).click();
  }
}
