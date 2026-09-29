import type { Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { NavBar } from './components/NavBar';

/** The site marks elements with `data-test`; `page.getByTestId()` uses this attribute. */
export const TEST_ID_ATTRIBUTE = 'data-test';

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly config: EnvConfig;
  readonly navBar: NavBar;

  constructor(page: Page, config: EnvConfig) {
    this.page = page;
    this.config = config;
    this.navBar = new NavBar(page);
  }

  /** Navigates to a path relative to `baseUrl`, e.g. `/auth/login`. Subclasses expose `open()`. */
  protected async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }
}
