import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';
import { ProductGrid } from './components/ProductGrid';

export class HomePage extends BasePage {
  private readonly searchInput: Locator;
  private readonly searchButton: Locator;
  private readonly searchCaptionText: Locator;
  /** Marker the app renders once search results are in. */
  private readonly searchCompletedMarker: Locator;
  readonly productGrid: ProductGrid;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.searchInput = page.getByTestId('search-query');
    this.searchButton = page.getByTestId('search-submit');
    this.searchCaptionText = page.getByTestId('search-caption');
    this.searchCompletedMarker = page.getByTestId('search_completed');
    this.productGrid = new ProductGrid(page);
  }

  /** "Searched for: <term>", shown after a search. */
  get searchCaption(): Locator {
    return this.searchCaptionText;
  }

  async open(): Promise<void> {
    await this.goto('/');
    await this.waitForLoaded();
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.searchInput).toBeVisible();
  }

  /** Searches and waits until the results (or the "no products" message) are rendered. */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchButton.click();
    await expect(this.searchCompletedMarker).toBeAttached();
  }
}
