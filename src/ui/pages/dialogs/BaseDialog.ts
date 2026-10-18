import type { Locator, Page } from '@playwright/test';
import { BaseComponent } from '../components/BaseComponent';

/**
 * Base for modal dialogs: a component whose `root` is the dialog element, so an "OK" or "Delete" button elsewhere on
 * the page is never clicked by mistake. Subclasses add their own locators under `root` and expose actions.
 */
export abstract class BaseDialog extends BaseComponent {
  private readonly cancelButton: Locator;
  private readonly okButton: Locator;
  private readonly deleteButton: Locator;

  constructor(page: Page, root: Locator = page.getByRole('dialog')) {
    super(page, root);
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
