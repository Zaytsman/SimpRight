import { expect, type Locator, type Page } from '@playwright/test';
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

  /** The original price on the card of the named product, e.g. "$48.41"; struck through when the card shows a discount. */
  cardPriceOf(name: string): Locator {
    return this.card(name).getByTestId('product-price');
  }

  /** The discounted price on the card of the named product, shown only for a location offer seen from a discount location. */
  cardDiscountPriceOf(name: string): Locator {
    return this.card(name).getByTestId('product-discount-price');
  }

  /** The original price on the card of the named product, without the currency sign. */
  async getCardPrice(name: string): Promise<number> {
    return Number((await this.cardPriceOf(name).textContent())?.replace('$', '').trim());
  }

  /** The discounted price on the card of the named product, without the currency sign. */
  async getCardDiscountPrice(name: string): Promise<number> {
    return Number((await this.cardDiscountPriceOf(name).textContent())?.replace('$', '').trim());
  }

  /**
   * Runs `trigger`, an action that makes the page reload the grid with `QUERY /products` (a page change, a price
   * range), waits for the answer whose criteria (the request body) match, then until the cards show that answer's
   * products, in order. For changes that set no result marker.
   */
  async waitForQueryResults(trigger: () => Promise<void>, matches: (criteria: Record<string, string>) => boolean): Promise<void> {
    const answered = this.page.waitForResponse((response) => {
      const request = response.request();
      if (request.method() !== 'QUERY' || !new URL(response.url()).pathname.endsWith('/products')) return false;
      const criteria: unknown = request.postDataJSON();
      return typeof criteria === 'object' && criteria !== null && matches(criteria as Record<string, string>);
    });
    await trigger();
    const response = await answered;
    const body = (await response.json()) as { data: { name: string }[] };
    await expect(this.productNameTexts).toHaveText(body.data.map((product) => product.name.trim()));
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
