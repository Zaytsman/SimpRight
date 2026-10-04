import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  private readonly productNameHeading: Locator;
  /** Price without currency sign, e.g. "14.15". */
  private readonly unitPriceText: Locator;
  private readonly quantityInput: Locator;
  private readonly addToCartButton: Locator;
  /** Toast shown after adding to cart. */
  private readonly addedToCartToast: Locator;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.productNameHeading = page.getByTestId('product-name');
    this.unitPriceText = page.getByTestId('unit-price');
    this.quantityInput = page.getByTestId('quantity');
    this.addToCartButton = page.getByTestId('add-to-cart');
    this.addedToCartToast = page.getByRole('alert').filter({ hasText: 'Product added to shopping cart' });
  }

  async open(productId: string): Promise<void> {
    await this.goto(`/product/${productId}`);
    await expect(this.productNameHeading).toBeVisible();
  }

  async getUnitPrice(): Promise<number> {
    return Number((await this.unitPriceText.textContent())?.trim());
  }

  async setQuantity(quantity: number): Promise<void> {
    await this.quantityInput.fill(String(quantity));
  }

  async addToCart(): Promise<void> {
    await this.addToCartButton.click();
    await expect(this.addedToCartToast.first()).toBeVisible();
  }
}
