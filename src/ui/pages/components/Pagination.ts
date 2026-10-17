import type { Locator, Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';
import type { ProductGrid } from './ProductGrid';

/** The page numbers below the product grid, shown when there is more than one page. */
export class Pagination extends BaseComponent {
  private readonly grid: ProductGrid;
  private readonly paginationNav: Locator;

  /**
   * CSS: the Angular host element. The pagination has no test id, and `getByRole('navigation')` alone also matches
   * the header's `<nav>`. `grid` is the grid the pages belong to: a page change waits until it shows the new page.
   */
  constructor(page: Page, grid: ProductGrid, root: Locator = page.locator('app-pagination')) {
    super(page, root);
    this.grid = grid;
    this.paginationNav = root.getByRole('navigation');
  }

  /** The pagination controls (previous, the page numbers, next). */
  get navigation(): Locator {
    return this.paginationNav;
  }

  /** A page number's button; its accessible name is "Page-<n>" (no data-test). */
  private pageButton(pageNumber: number): Locator {
    return this.root.getByRole('button', { name: `Page-${pageNumber}`, exact: true });
  }

  /**
   * The list item holding a page number. The app marks the current page only with the class `active` on it
   * (no aria-current; app source: sprint5/UI/src/app/pagination/pagination.component.html).
   */
  pageItem(pageNumber: number): Locator {
    // `has` is resolved inside each list item, so it starts from the page, not from `root`.
    return this.root
      .getByRole('listitem')
      .filter({ has: this.page.getByRole('button', { name: `Page-${pageNumber}`, exact: true }) });
  }

  /**
   * Clicks a page number and waits until the grid shows that page. The page change sets no result marker and marks
   * the page active before its products arrive (app source: overview.component.ts, `onPageChange`), so this waits
   * for the `QUERY /products` answer for that page and then for the cards to show its products.
   */
  async goToPage(pageNumber: number): Promise<void> {
    await this.grid.waitForQueryResults(
      () => this.pageButton(pageNumber).click(),
      (criteria) => criteria.page === String(pageNumber),
    );
  }
}
