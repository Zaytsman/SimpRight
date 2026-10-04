import type { Locator, Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorAlert: Locator;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.emailInput = page.getByTestId('email');
    this.passwordInput = page.getByTestId('password');
    this.submitButton = page.getByTestId('login-submit');
    this.errorAlert = page.getByTestId('login-error');
  }

  /** The login error, e.g. "Invalid email or password". */
  get errorMessage(): Locator {
    return this.errorAlert;
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
