import type { Locator, Page } from '@playwright/test';
import type { EnvConfig } from '../../../config/env';

/**
 * Base for modal dialogs. Buttons are looked up inside `root` (the dialog element), so an "OK" or
 * "Delete" button elsewhere on the page is never clicked by mistake. Subclasses add their own
 * locators under `root` and expose actions.
 */
export abstract class BaseDialog {
  protected readonly page: Page;
  protected readonly config: EnvConfig;
  protected readonly root: Locator;
  private readonly cancelButton: Locator;
  private readonly okButton: Locator;
  private readonly deleteButton: Locator;

  constructor(page: Page, config: EnvConfig, root: Locator = page.getByRole('dialog')) {
    this.page = page;
    this.config = config;
    this.root = root;
    this.cancelButton = root.getByRole('button', { name: 'Cancel' });
    this.okButton = root.getByRole('button', { name: 'OK' });
    this.deleteButton = root.getByRole('button', { name: 'Delete' });
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async confirm(): Promise<void> {
    await this.okButton.click();
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
  }
}
