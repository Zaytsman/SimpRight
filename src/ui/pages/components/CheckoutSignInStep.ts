import { expect, type Locator, type Page } from '@playwright/test';
import { fillSecret } from '../fillSecret';
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
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginSubmitButton: Locator;
  private readonly totpCodeInput: Locator;
  private readonly verifyTotpSubmitButton: Locator;
  /** "Proceed to checkout" of this step, shown only when signed in; the cart step has its own (`proceed-1`). */
  private readonly proceedToCheckoutButton: Locator;
  /**
   * The message shown instead of the form when the customer is signed in.
   * CSS: the paragraph has no test id, and a role query would also match the login form's paragraphs ("Not yet an
   * account?"), which `login()` would take for its outcome; it's the only direct paragraph of the step's column.
   */
  private readonly signedInMessageText: Locator;
  private readonly loginErrorAlert: Locator;

  /** CSS: the step's Angular host element; the step has no test id. Hidden while another step is the current one. */
  constructor(page: Page, root: Locator = page.locator('app-login')) {
    super(page, root);
    this.loginFormElement = root.locator('form').filter({ has: page.getByTestId('email') });
    this.emailInput = root.getByTestId('email');
    this.passwordInput = root.getByTestId('password');
    this.loginSubmitButton = root.getByTestId('login-submit');
    this.totpCodeInput = root.getByTestId('totp-code');
    this.verifyTotpSubmitButton = root.getByTestId('verify-totp');
    this.proceedToCheckoutButton = root.getByTestId('proceed-2');
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

  /** With `fillSecret`, never `fill`: a fill step's title prints the value, and the reports are published. */
  async enterEmail(email: string): Promise<void> {
    await fillSecret(this.emailInput, email);
  }

  /** With `fillSecret`, never `fill`: a fill step's title prints the value, and the reports are published. */
  async enterPassword(password: string): Promise<void> {
    await fillSecret(this.passwordInput, password);
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

  /** Fills the TOTP field, replacing what it held; with `fillSecret`, because the reports mask TOTP codes too. */
  async enterTotpCode(code: string): Promise<void> {
    await fillSecret(this.totpCodeInput, code);
  }

  /**
   * Clicks "Verify TOTP", waits for the app's answer (the TOTP step posts to /users/login too; app source: `verifyTotp()`),
   * then for the outcome that answer means: "Proceed to checkout" when the code was accepted, the login error otherwise
   * (401 "Invalid TOTP"). Waiting for either would return at once on a second try, while the first try's error still shows.
   */
  async verifyTotp(): Promise<void> {
    const answered = waitForApiResponse(this.page, 'POST', '/users/login');
    await this.verifyTotpSubmitButton.click();
    const response = await answered;
    await expect(response.ok() ? this.proceedToCheckoutButton : this.loginErrorAlert).toBeVisible();
  }

  /** Clicks "Proceed to checkout" and waits until the wizard has left this step (the step is hidden again). */
  async proceed(): Promise<void> {
    await this.proceedToCheckoutButton.click();
    await expect(this.root).toBeHidden();
  }
}
