import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';

export interface CartLine {
  title: string;
  quantity: number;
}

/** First step of checkout (`/checkout`): the cart contents. */
export class CartPage extends BasePage {
  readonly productTitles: Locator;
  readonly productQuantities: Locator;
  /** Total with currency sign, e.g. "$28.30". */
  readonly cartTotal: Locator;
  readonly proceedButton: Locator;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.productTitles = page.getByTestId('product-title');
    this.productQuantities = page.getByTestId('product-quantity');
    this.cartTotal = page.getByTestId('cart-total');
    this.proceedButton = page.getByTestId('proceed-1');
  }

  async open(): Promise<void> {
    await this.goto('/checkout');
    await this.waitForLoaded();
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.cartTotal).toBeVisible();
  }

  async getLines(): Promise<CartLine[]> {
    const titles = await this.productTitles.allTextContents();
    const quantities = await this.productQuantities.evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value));
    return titles.map((title, i) => ({ title: title.trim(), quantity: Number(quantities[i]) }));
  }

  async getTotal(): Promise<number> {
    return Number((await this.cartTotal.textContent())?.replace(/[^0-9.]/g, ''));
  }
}
