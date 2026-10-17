import type { Locator, Page } from '@playwright/test';

/**
 * Base for reusable parts of pages (the nav bar, the product grid, the filter sidebar). Locators are looked up
 * inside `root` (the component's container), so an element with the same test id elsewhere on the page (a
 * `product-name` on the detail page, a second `<nav>`) is never matched by mistake. Each subclass gives its own
 * container as the default `root`; a page can pass another one when the component appears in a different place.
 * `page` is for what lies outside the container: the app's result markers, network waits.
 */
export abstract class BaseComponent {
  protected readonly page: Page;
  protected readonly root: Locator;

  constructor(page: Page, root: Locator) {
    this.page = page;
    this.root = root;
  }
}
