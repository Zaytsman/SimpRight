import type { Locator, Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/** Grid of product cards on the home/search page. */
export class ProductGrid extends BaseComponent {
  /** Every card is a link with `data-test="product-<id>"`. */
  private readonly cardLinks: Locator;
  private readonly productNameTexts: Locator;
  private readonly noResultsText: Locator;

  /**
   * CSS: the results column next to the filter sidebar (search caption, cards, "no results"), the same on the home
   * and category pages. The cards' own container has no fixed test id: its `data-test` is the app's result state.
   */
  constructor(page: Page, root: Locator = page.locator('div.col-md-9')) {
    super(page, root);
    this.cardLinks = root.locator('a[data-test^="product-"]');
    this.productNameTexts = root.getByTestId('product-name');
    this.noResultsText = root.getByTestId('no-results');
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
    // `has` is resolved inside each card, so it starts from the page, not from `root`.
    return this.cardLinks.filter({ has: this.page.getByTestId('product-name').getByText(name, { exact: true }) });
  }

  /** "Out of stock" on the card of the named product, shown when the product has no stock. */
  outOfStockLabel(name: string): Locator {
    return this.card(name).getByTestId('out-of-stock');
  }

  /** The image of the card at `index` (0-based, grid order); it has no data-test, its alt is the product name. */
  cardImage(index: number): Locator {
    return this.cardLinks.nth(index).getByRole('img');
  }

  /** The product name on the card at `index` (0-based, grid order). */
  cardName(index: number): Locator {
    return this.cardLinks.nth(index).getByTestId('product-name');
  }

  /** The price on the card at `index` (0-based, grid order), e.g. "$14.15"; the original price when the card shows a discount. */
  cardPrice(index: number): Locator {
    return this.cardLinks.nth(index).getByTestId('product-price');
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
