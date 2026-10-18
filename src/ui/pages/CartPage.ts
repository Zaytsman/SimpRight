import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { parseAmount } from '../../utils/amounts';
import { BasePage } from './BasePage';
import { CART_REQUEST_PATH, CheckoutCartLine } from './components/CheckoutCartLine';
import { CheckoutSignInStep } from './components/CheckoutSignInStep';
import { HomePage } from './HomePage';
import { waitForApiResponse } from './waitForApiResponse';

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
  /** The page `open()` starts from when no page of the app is open yet. */
  private readonly homePage: HomePage;

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
    this.currentStepLabel = page.locator('aw-wizard-navigation-bar li.current .label');
    this.billingAddressTitle = page.locator('app-address').getByRole('heading', { name: 'Billing Address' });
    this.signInStep = new CheckoutSignInStep(page);
    this.homePage = new HomePage(page, config);
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

  /**
   * Opens the checkout page through the nav bar's cart link, so the browser never loads /checkout itself: Cloudflare
   * answers most direct loads of /checkout from GitHub-hosted runners with its bot check, and moving inside the app
   * sends no page request. Opens the home page first only when no page of the app is open yet (a precondition fixture
   * or an earlier step may have opened one), and waits until it has loaded: a click on the cart link right after the
   * load can be lost (seen: the page stayed on the home page, the link focused). The cart link shows only once the cart
   * has items. Then waits for the app's `GET /carts/{id}`, failing with what happened when the cart doesn't load, and
   * for the cart step to render.
   */
  async open(): Promise<void> {
    if (!this.page.url().startsWith(new URL(this.config.baseUrl).origin)) await this.homePage.open();
    const cartLoaded = waitForApiResponse(this.page, 'GET', CART_REQUEST_PATH);
    await this.navBar.openCart();
    const response = await cartLoaded.catch((error: unknown) => {
      throw new Error(`The cart didn't load: no answer to GET /carts/{id} after the click on the cart link (${(error as Error).message})`);
    });
    if (!response.ok()) throw new Error(`The cart didn't load: GET /carts/{id} answered ${response.status()}`);
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
