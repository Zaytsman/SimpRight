import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  readonly productName: Locator;
  /** Price without currency sign, e.g. "14.15". */
  readonly unitPrice: Locator;
  readonly quantityInput: Locator;
  readonly addToCartButton: Locator;
  /** Toast shown after adding to cart. */
  readonly addedToCartMessage: Locator;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.productName = page.getByTestId('product-name');
    this.unitPrice = page.getByTestId('unit-price');
    this.quantityInput = page.getByTestId('quantity');
    this.addToCartButton = page.getByTestId('add-to-cart');
    this.addedToCartMessage = page.getByRole('alert').filter({ hasText: 'Product added to shopping cart' });
  }

  async open(productId: string): Promise<void> {
    await this.goto(`/product/${productId}`);
    await expect(this.productName).toBeVisible();
  }

  async getUnitPrice(): Promise<number> {
    return Number((await this.unitPrice.textContent())?.trim());
  }

  async setQuantity(quantity: number): Promise<void> {
    await this.quantityInput.fill(String(quantity));
  }

  async addToCart(): Promise<void> {
    await this.addToCartButton.click();
    await expect(this.addedToCartMessage.first()).toBeVisible();
  }
}
