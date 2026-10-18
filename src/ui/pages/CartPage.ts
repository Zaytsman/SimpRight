import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { parseAmount } from '../../utils/amounts';
import { BasePage } from './BasePage';
import { CheckoutCartLine } from './components/CheckoutCartLine';
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
  /** CSS: the cart step's Angular host element; the step has no test id. */
  private readonly cartStep: Locator;
  private readonly lineTotalTexts: Locator;
  /** Shown only with the 15% combined discount or the eco discount. */
  private readonly subtotalText: Locator;
  /** CSS: the summary rows have no test id; the row is the one holding its amount. */
  private readonly subtotalTableRow: Locator;
  /** The amount of the combined discount, e.g. "- $22.60". */
  private readonly discountText: Locator;
  private readonly discountTableRow: Locator;
  /** CSS: the message has no test id or role; it's the cart step's only paragraph, rendered only for an empty cart. */
  private readonly emptyCartMessageText: Locator;
  /** The toast the app shows (ngx-toastr, role "alert") after a change, e.g. "Product quantity updated.". */
  private readonly toastAlert: Locator;
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
    this.cartStep = page.locator('app-cart');
    this.lineTotalTexts = this.cartStep.getByTestId('line-price');
    this.subtotalText = this.cartStep.getByTestId('cart-subtotal');
    this.subtotalTableRow = this.cartStep.locator('tr').filter({ has: page.getByTestId('cart-subtotal') });
    this.discountText = this.cartStep.getByTestId('cart-discount');
    this.discountTableRow = this.cartStep.locator('tr').filter({ has: page.getByTestId('cart-discount') });
    this.emptyCartMessageText = this.cartStep.locator('p');
    this.toastAlert = page.getByRole('alert');
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

  /** A column header of the cart table, by its exact label ("Item", "Quantity", "Price", "Total"). */
  columnHeader(name: string): Locator {
    return this.cartStep.getByRole('columnheader', { name, exact: true });
  }

  /** The cart line of the product named `productName`. */
  line(productName: string): CheckoutCartLine {
    return new CheckoutCartLine(this.page, productName);
  }

  get cartTotal(): Locator {
    return this.cartTotalText;
  }

  get subtotal(): Locator {
    return this.subtotalText;
  }

  get subtotalRow(): Locator {
    return this.subtotalTableRow;
  }

  get discountRow(): Locator {
    return this.discountTableRow;
  }

  get emptyCartMessage(): Locator {
    return this.emptyCartMessageText;
  }

  /** "Proceed to checkout" of the cart step. */
  get proceedToCheckoutButton(): Locator {
    return this.proceedButton;
  }

  get toast(): Locator {
    return this.toastAlert;
  }

  /**
   * Opens the checkout page from the home page through the nav bar's cart link, so the browser never loads /checkout
   * itself: Cloudflare answers most direct loads of /checkout from GitHub-hosted runners with its bot check, and
   * moving inside the app sends no page request. The cart link shows only once the cart has items.
   */
  async open(): Promise<void> {
    await this.goto('/');
    await this.navBar.openCart();
    await this.waitForLoaded();
  }

  /**
   * Opens the checkout page of a visitor who has no cart: the app then requests nothing and renders no table or total
   * (cart.service.ts `getCart()`), so the page is loaded once the wizard shows its Cart step.
   */
  async openWithoutCart(): Promise<void> {
    await this.goto('/checkout');
    await expect(this.currentStepLabel).toHaveText('Cart');
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
    return parseAmount(await this.cartTotalText.textContent());
  }

  async getSubtotal(): Promise<number> {
    return parseAmount(await this.subtotalText.textContent());
  }

  /** The combined discount's amount, without the minus and the currency sign. */
  async getDiscount(): Promise<number> {
    return parseAmount(await this.discountText.textContent());
  }

  /** Every line's total (the Total column), in line order. */
  async getLineTotals(): Promise<number[]> {
    return (await this.lineTotalTexts.allTextContents()).map(parseAmount);
  }

  /** Goes on to the next checkout step (sign in) and waits until that step is shown. */
  async proceed(): Promise<void> {
    await this.proceedButton.click();
    await expect(this.signInStep.panel).toBeVisible();
  }
}
