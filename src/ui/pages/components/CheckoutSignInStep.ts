import { expect, type Locator, type Page } from '@playwright/test';
import { waitForApiResponse } from '../waitForApiResponse';
import { BaseComponent } from './BaseComponent';

/**
 * Step 2 of the checkout wizard ("Sign in"): for a guest, the "Sign in" tab with the login form (and a TOTP form after
 * the credentials of an account with TOTP enabled); for a logged-in customer, the signed-in message and "Proceed to
 * checkout". The wizard renders every step at once and hides the others, so locators stay inside this step.
 * Locators from the app source (checkout/login/login.component.html) and the live bundle: the inspector can't reach
 * this step, because it can't put anything in the cart.
 */
export class CheckoutSignInStep extends BaseComponent {
  /** CSS: the form has no name, role or test id; it's the one holding the email field (the TOTP form doesn't). */
  private readonly loginFormElement: Locator;
  /** By role and label: the hidden "Continue as Guest" tab has a second "Email address" field, which role queries skip. */
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginSubmitButton: Locator;
  private readonly totpCodeInput: Locator;
  private readonly verifyTotpSubmitButton: Locator;
  /**
   * "Proceed to checkout" of this step, shown only when signed in; the cart step has its own. By role and label,
   * because the steps name the button by its label.
   */
  private readonly proceedToCheckoutButton: Locator;
  /**
   * The message shown instead of the form when the customer is signed in.
   * CSS: the paragraph has no test id or role; it's the only direct paragraph of the step's column.
   */
  private readonly signedInMessageText: Locator;
  private readonly loginErrorAlert: Locator;

  /** CSS: the step's Angular host element; the step has no test id. Hidden while another step is the current one. */
  constructor(page: Page, root: Locator = page.locator('app-login')) {
    super(page, root);
    this.loginFormElement = root.locator('form').filter({ has: page.getByTestId('email') });
    this.emailInput = root.getByRole('textbox', { name: 'Email address' });
    this.passwordInput = root.getByLabel('Password');
    this.loginSubmitButton = root.getByRole('button', { name: 'Login', exact: true });
    this.totpCodeInput = root.getByLabel('TOTP Code');
    this.verifyTotpSubmitButton = root.getByRole('button', { name: 'Verify TOTP' });
    this.proceedToCheckoutButton = root.getByRole('button', { name: 'Proceed to checkout' });
    this.signedInMessageText = root.locator('.login-form-1 > p');
    this.loginErrorAlert = root.getByTestId('login-error');
  }

  /** The step's content (visible only while it's the current step). */
  get panel(): Locator {
    return this.root;
  }

  get loginForm(): Locator {
    return this.loginFormElement;
  }

  get emailField(): Locator {
    return this.emailInput;
  }

  get passwordField(): Locator {
    return this.passwordInput;
  }

  get loginButton(): Locator {
    return this.loginSubmitButton;
  }

  get totpCodeField(): Locator {
    return this.totpCodeInput;
  }

  get verifyTotpButton(): Locator {
    return this.verifyTotpSubmitButton;
  }

  get proceedButton(): Locator {
    return this.proceedToCheckoutButton;
  }

  get signedInMessage(): Locator {
    return this.signedInMessageText;
  }

  async enterEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async enterPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  /**
   * Clicks "Login", waits for the app's POST /users/login answer (any status), then until the step shows its outcome:
   * the TOTP field, the signed-in message or the login error.
   */
  async login(): Promise<void> {
    const answered = waitForApiResponse(this.page, 'POST', '/users/login');
    await this.loginSubmitButton.click();
    await answered;
    await expect(this.totpCodeInput.or(this.signedInMessageText).or(this.loginErrorAlert)).toBeVisible();
  }

  /** Fills the TOTP field, replacing what it held. */
  async enterTotpCode(code: string): Promise<void> {
    await this.totpCodeInput.fill(code);
  }

  /**
   * Clicks "Verify TOTP", waits for the app's answer (the TOTP step posts to /users/login too; app source: `verifyTotp()`),
   * then until the step shows its outcome: "Proceed to checkout" or the login error.
   */
  async verifyTotp(): Promise<void> {
    const answered = waitForApiResponse(this.page, 'POST', '/users/login');
    await this.verifyTotpSubmitButton.click();
    await answered;
    await expect(this.proceedToCheckoutButton.or(this.loginErrorAlert)).toBeVisible();
  }

  /** Clicks "Proceed to checkout" and waits until the wizard has left this step (the step is hidden again). */
  async proceed(): Promise<void> {
    await this.proceedToCheckoutButton.click();
    await expect(this.root).toBeHidden();
  }
}
