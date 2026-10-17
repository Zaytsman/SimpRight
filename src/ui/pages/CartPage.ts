import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';
import { CheckoutSignInStep } from './components/CheckoutSignInStep';

export interface CartLine {
  title: string;
  quantity: number;
}

/** The checkout page (`/checkout`), a wizard whose first step is the cart contents. */
export class CartPage extends BasePage {
  private readonly productTitleCells: Locator;
  private readonly productQuantityInputs: Locator;
  /** Total with currency sign, e.g. "$28.30". */
  private readonly cartTotalText: Locator;
  private readonly proceedButton: Locator;
  /**
   * The title of the wizard's current step ("Cart", "Sign in", "Billing Address", "Payment").
   * CSS: the step indicator has no test id, role state or aria-current; the wizard library marks the current one with
   * the class `current` (app source and live bundle).
   */
  private readonly currentStepLabel: Locator;
  /** The heading of the Billing Address step, inside its Angular host element (CSS: the step has no test id). */
  private readonly billingAddressTitle: Locator;
  /** Step 2 of the wizard. */
  readonly signInStep: CheckoutSignInStep;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.productTitleCells = page.getByTestId('product-title');
    this.productQuantityInputs = page.getByTestId('product-quantity');
    this.cartTotalText = page.getByTestId('cart-total');
    this.proceedButton = page.getByTestId('proceed-1');
    this.currentStepLabel = page.locator('aw-wizard-navigation-bar li.current .label');
    this.billingAddressTitle = page.locator('app-address').getByRole('heading', { name: 'Billing Address' });
    this.signInStep = new CheckoutSignInStep(page);
  }

  /** The title of the wizard's current step. */
  get currentStep(): Locator {
    return this.currentStepLabel;
  }

  /** The content of the Sign in step (visible only while it's the current step). */
  get signInStepPanel(): Locator {
    return this.signInStep.panel;
  }

  get billingAddressHeading(): Locator {
    return this.billingAddressTitle;
  }

  async open(): Promise<void> {
    await this.goto('/checkout');
    await this.waitForLoaded();
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.cartTotalText).toBeVisible();
  }

  async getLines(): Promise<CartLine[]> {
    const titles = await this.productTitleCells.allTextContents();
    const quantities = await this.productQuantityInputs.evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value));
    return titles.map((title, i) => ({ title: title.trim(), quantity: Number(quantities[i]) }));
  }

  async getTotal(): Promise<number> {
    return Number((await this.cartTotalText.textContent())?.replace(/[^0-9.]/g, ''));
  }

  /** Goes on to the next checkout step (sign in) and waits until that step is shown. */
  async proceed(): Promise<void> {
    await this.proceedButton.click();
    await expect(this.signInStep.panel).toBeVisible();
  }
}
