import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { AppPage } from './AppPage';
import { RentalGrid } from './components/RentalGrid';

/** The rentals overview (`/rentals`): every rental product as a card. */
export class RentalsPage extends AppPage {
  private readonly pageTitleHeading: Locator;
  readonly rentalGrid: RentalGrid;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.pageTitleHeading = page.getByTestId('page-title');
    this.rentalGrid = new RentalGrid(page);
  }

  /** The page's h1 ("Rentals"). */
  get heading(): Locator {
    return this.pageTitleHeading;
  }

  async open(): Promise<void> {
    await this.goto('/rentals');
    await this.waitForLoaded();
  }

  /**
   * Waits for the heading and the first rental card. From the app source (products/rentals/overview): the whole page,
   * heading included, renders only once the rentals request has answered, so both mean the list is in. The home page
   * has no `page-title`, and its cards are links, not `div`s, so nothing left over from it can match.
   */
  async waitForLoaded(): Promise<void> {
    await expect(this.pageTitleHeading).toBeVisible();
    await expect(this.rentalGrid.cards.first()).toBeVisible();
  }
}
