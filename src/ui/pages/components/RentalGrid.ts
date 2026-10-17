import type { Locator, Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/** The list of rental product cards on the rentals page (`/rentals`): an image, a name and a description each. */
export class RentalGrid extends BaseComponent {
  /**
   * Every card's clickable row is a `div` with `data-test="product-<id>"` (matched by prefix: the id changes at every
   * re-seed). The home grid's cards are links with the same prefix, so the element kind keeps the two apart.
   */
  private readonly cardRows: Locator;

  /**
   * CSS: the page's Angular host element (`app-overview`, the same selector the home overview uses); the list has no
   * test id of its own.
   */
  constructor(page: Page, root: Locator = page.locator('app-overview')) {
    super(page, root);
    this.cardRows = root.locator('div[data-test^="product-"]');
  }

  /** Every rental card on the page. */
  get cards(): Locator {
    return this.cardRows;
  }

  card(name: string): Locator {
    // `has` is resolved inside each card, so it starts from the page, not from `root`.
    return this.cardRows.filter({ has: this.page.getByRole('heading', { level: 5, name, exact: true }) });
  }

  /** The image of the card at `index` (0-based, page order); it has no data-test, its alt is the product name. */
  cardImage(index: number): Locator {
    return this.cardRows.nth(index).getByRole('img');
  }

  /** The product name on the card at `index` (0-based, page order): its level-5 heading, which has no data-test. */
  cardName(index: number): Locator {
    return this.cardRows.nth(index).getByRole('heading', { level: 5 });
  }

  /** The description on the card at `index` (0-based, page order): its only paragraph, which has no data-test. */
  cardDescription(index: number): Locator {
    return this.cardRows.nth(index).getByRole('paragraph');
  }

  /** Clicks the named card; the caller waits for the product page (`productPage.waitForLoaded()`). */
  async openProduct(name: string): Promise<void> {
    await this.card(name).click();
  }
}
