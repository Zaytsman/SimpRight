import { expect, type Locator, type Page } from '@playwright/test';

/** The filter sidebar of the home/search page: category and brand checkboxes. */
export class ProductFilters {
  private readonly page: Page;
  /**
   * The grid container's `data-test` is the app's result state: a brand or subcategory change turns it to
   * `filter_started` at once and to `filter_completed` once the filtered products are rendered. A top-level
   * category sets no started state, so after an earlier filter the marker is already there (see `checkCategory`).
   */
  private readonly filterCompletedMarker: Locator;

  constructor(page: Page) {
    this.page = page;
    this.filterCompletedMarker = page.getByTestId('filter_completed');
  }

  /** A category checkbox by its label. Its `data-test` is `category-<record id>`, so it's matched by prefix. */
  categoryCheckbox(label: string): Locator {
    return this.page.getByRole('checkbox', { name: label, exact: true }).and(this.page.locator('[data-test^="category-"]'));
  }

  /** A brand checkbox by its label. Its `data-test` is `brand-<record id>`, so it's matched by prefix. */
  brandCheckbox(label: string): Locator {
    return this.page.getByRole('checkbox', { name: label, exact: true }).and(this.page.locator('[data-test^="brand-"]'));
  }

  /**
   * Checks a category and waits until the filtered grid is rendered. A top-level category (one with
   * subcategories) leaves the result state as it was (app source: sprint5/UI/.../overview.component.ts,
   * `selectParentWithSubcategories`), so the marker alone could be an earlier filter's: this also waits for
   * the products request the change sends (`QUERY /products`) to finish.
   */
  async checkCategory(label: string): Promise<void> {
    const filtered = this.page.waitForResponse(
      (response) => response.request().method() === 'QUERY' && new URL(response.url()).pathname.endsWith('/products'),
    );
    await this.categoryCheckbox(label).check();
    await (await filtered).finished();
    await expect(this.filterCompletedMarker).toBeAttached();
  }

  /** Checks a brand and waits until the filtered grid is rendered. */
  async checkBrand(label: string): Promise<void> {
    await this.brandCheckbox(label).check();
    await expect(this.filterCompletedMarker).toBeAttached();
  }
}
