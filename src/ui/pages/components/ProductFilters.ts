import { expect, type Locator, type Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';

/** The filter sidebar of the home/search page: category and brand checkboxes. */
export class ProductFilters extends BaseComponent {
  /**
   * The grid container's `data-test` is the app's result state: a brand or subcategory change turns it to
   * `filter_started` at once and to `filter_completed` once the filtered products are rendered. A top-level
   * category sets no started state, so after an earlier filter the marker is already there (see `checkCategory`).
   * The grid is outside the sidebar, so this is looked up on the page.
   */
  private readonly filterCompletedMarker: Locator;

  /** The sidebar `div`: the mobile "Filters" toggle button has the same `data-test`. */
  constructor(page: Page, root: Locator = page.locator('div[data-test="filters"]')) {
    super(page, root);
    this.filterCompletedMarker = page.getByTestId('filter_completed');
  }

  /** A category checkbox by its label. Its `data-test` is `category-<record id>`, so it's matched by prefix. */
  categoryCheckbox(label: string): Locator {
    return this.root.getByRole('checkbox', { name: label, exact: true }).and(this.root.locator('[data-test^="category-"]'));
  }

  /** A brand checkbox by its label. Its `data-test` is `brand-<record id>`, so it's matched by prefix. */
  brandCheckbox(label: string): Locator {
    return this.root.getByRole('checkbox', { name: label, exact: true }).and(this.root.locator('[data-test^="brand-"]'));
  }

  /** Checks a category and waits until the filtered grid is rendered (see `setCategory`). */
  async checkCategory(label: string): Promise<void> {
    await this.setCategory(label, true);
  }

  /** Unchecks a category and waits until the filtered grid is rendered (see `setCategory`). */
  async uncheckCategory(label: string): Promise<void> {
    await this.setCategory(label, false);
  }

  /**
   * Checks or unchecks a category, then waits for the products request the change sends (`QUERY /products`)
   * and the `filter_completed` marker. A top-level category (one with subcategories) leaves the result state as
   * it was (app source: sprint5/UI/.../overview.component.ts, `selectParentWithSubcategories`), so the marker
   * alone could be an earlier filter's; a child category sets `filter_started` at once (`filterByCategory`).
   */
  private async setCategory(label: string, checked: boolean): Promise<void> {
    const filtered = this.page.waitForResponse(
      (response) => response.request().method() === 'QUERY' && new URL(response.url()).pathname.endsWith('/products'),
    );
    await this.categoryCheckbox(label).setChecked(checked);
    await (await filtered).finished();
    await expect(this.filterCompletedMarker).toBeAttached();
  }

  /** Checks a brand and waits until the filtered grid is rendered. */
  async checkBrand(label: string): Promise<void> {
    await this.brandCheckbox(label).check();
    await expect(this.filterCompletedMarker).toBeAttached();
  }
}
