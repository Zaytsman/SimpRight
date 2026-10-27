import type { Page, Response } from '@playwright/test';
import type { EnvConfig } from '../../config/env';

/**
 * Base for page objects: the page, the config and `goto`. Pages keep their locators in private readonly fields, expose
 * an `open()` that calls `goto('/path')`, and add their actions. The app's own base page (`AppPage`) extends this with
 * what every page of the app has.
 */
export abstract class BasePage {
  protected readonly page: Page;
  protected readonly config: EnvConfig;

  constructor(page: Page, config: EnvConfig) {
    this.page = page;
    this.config = config;
  }

  /** Navigates to a path relative to `baseUrl`, e.g. `/auth/login`, and returns the response. Subclasses expose `open()`. */
  protected async goto(path: string): Promise<Response | null> {
    return this.page.goto(path);
  }
}
