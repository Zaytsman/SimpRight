import { expect, type Locator, type Page } from '@playwright/test';
import { BaseComponent } from './BaseComponent';
import type { ProductGrid } from './ProductGrid';

/**
 * The price range slider of the home page's sidebar (ngx-slider): a lower and an upper handle, from $1 to $100 by
 * default on a scale of 0 to 200. Each handle announces its value in `aria-valuenow` and the scale in
 * `aria-valuemin` / `aria-valuemax`.
 */
export class PriceRangeSlider extends BaseComponent {
  private readonly grid: ProductGrid;
  private readonly lowerHandleSlider: Locator;
  private readonly upperHandleSlider: Locator;

  /**
   * The root is the sidebar `div` (the mobile "Filters" toggle button has the same `data-test`): it holds one slider,
   * whose handles are found by role and name. `grid` is the grid the range filters: a move waits until it shows the new range's products.
   */
  constructor(page: Page, grid: ProductGrid, root: Locator = page.locator('div[data-test="filters"]')) {
    super(page, root);
    this.grid = grid;
    this.lowerHandleSlider = root.getByRole('slider', { name: 'ngx-slider', exact: true });
    this.upperHandleSlider = root.getByRole('slider', { name: 'ngx-slider-max', exact: true });
  }

  get lowerHandle(): Locator {
    return this.lowerHandleSlider;
  }

  get upperHandle(): Locator {
    return this.upperHandleSlider;
  }

  /** Moves the lower handle to `value` and waits until the grid shows the new range's products (see `moveHandle`). */
  async setLower(value: number): Promise<void> {
    await this.moveHandle(this.lowerHandleSlider, value);
  }

  /** Moves the upper handle to `value` and waits until the grid shows the new range's products (see `moveHandle`). */
  async setUpper(value: number): Promise<void> {
    await this.moveHandle(this.upperHandleSlider, value);
  }

  /**
   * Moves a handle with the keyboard, holding the arrow key down like a user (one keydown per step, one keyup at the
   * end). ngx-slider reports the end of a change on keyup, and the page then sends one `QUERY /products` with the new
   * range (app source: overview.component.html `(userChangeEnd)`, `changePriceRange`, which sets no result marker);
   * a key press per step would send one request per step, whose answers could arrive out of order. Waits for the
   * answer with the final range, then for the cards to show its products.
   */
  private async moveHandle(handle: Locator, value: number): Promise<void> {
    await expect(handle).toHaveAttribute('aria-valuenow', /\d+/);
    const current = Number(await handle.getAttribute('aria-valuenow'));
    if (current === value) return;
    const isUpper = handle === this.upperHandleSlider;
    const other = isUpper ? this.lowerHandleSlider : this.upperHandleSlider;
    const otherValue = Number(await other.getAttribute('aria-valuenow'));
    const [low, high] = isUpper ? [otherValue, value] : [value, otherValue];
    const key = value > current ? 'ArrowRight' : 'ArrowLeft';

    await handle.focus();
    await this.grid.waitForQueryResults(
      async () => {
        for (let step = 0; step < Math.abs(value - current); step++) {
          await this.page.keyboard.down(key);
        }
        await this.page.keyboard.up(key);
      },
      (criteria) => criteria.between === `price,${low},${high}`,
    );
    await expect(handle).toHaveAttribute('aria-valuenow', String(value));
  }
}
