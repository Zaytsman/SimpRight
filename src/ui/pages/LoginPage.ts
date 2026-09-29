import type { Locator, Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  /** e.g. "Invalid email or password". */
  readonly errorMessage: Locator;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.emailInput = page.getByTestId('email');
    this.passwordInput = page.getByTestId('password');
    this.submitButton = page.getByTestId('login-submit');
    this.errorMessage = page.getByTestId('login-error');
  }

  async open(): Promise<void> {
    await this.goto('/auth/login');
  }

  /** Submits the form only; the caller decides what success looks like (admin and customer land on different pages). */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
