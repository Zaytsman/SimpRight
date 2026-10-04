import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';

export interface CartLine {
  title: string;
  quantity: number;
}

/** First step of checkout (`/checkout`): the cart contents. */
export class CartPage extends BasePage {
  private readonly productTitleCells: Locator;
  private readonly productQuantityInputs: Locator;
  /** Total with currency sign, e.g. "$28.30". */
  private readonly cartTotalText: Locator;
  private readonly proceedButton: Locator;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.productTitleCells = page.getByTestId('product-title');
    this.productQuantityInputs = page.getByTestId('product-quantity');
    this.cartTotalText = page.getByTestId('cart-total');
    this.proceedButton = page.getByTestId('proceed-1');
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

  /** Goes on to the next checkout step (sign in). */
  async proceed(): Promise<void> {
    await this.proceedButton.click();
  }
}
