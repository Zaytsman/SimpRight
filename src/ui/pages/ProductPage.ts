import { expect, type Locator, type Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';

export class ProductPage extends BasePage {
  private readonly productImage: Locator;
  private readonly productNameHeading: Locator;
  private readonly productDescriptionText: Locator;
  /** Price without currency sign, e.g. "14.15". */
  private readonly unitPriceText: Locator;
  /**
   * The shown price with its currency sign ("$14.15"); struck through when the product has a discount.
   * CSS: the span has no data-test, role or label; it's the one holding the unit price.
   */
  private readonly priceText: Locator;
  /** Discounted price ("$36.31"), shown only for a location offer seen from a discount location. */
  private readonly discountedPriceText: Locator;
  /** Discount percentage badge ("-25%"), shown next to the brand badge when there is a discount. */
  private readonly discountBadgeText: Locator;
  private readonly categoryBadgeText: Locator;
  private readonly brandBadgeText: Locator;
  private readonly quantityInput: Locator;
  private readonly increaseQuantityButton: Locator;
  private readonly decreaseQuantityButton: Locator;
  private readonly addToCartButton: Locator;
  /** "Out of stock", shown for a product without stock that isn't a rental. */
  private readonly outOfStockText: Locator;
  /** Rentals only: the duration slider (1-10 hours) replaces the quantity buttons; its range is in aria-valuemin/max. */
  private readonly durationSliderHandle: Locator;
  /**
   * The hours in the "Duration (n hour(s))" label; the app updates it when the slider moves.
   * CSS: the app's own id, the element has no data-test, role or label.
   */
  private readonly durationValueText: Locator;
  /**
   * Rentals only: the total price, hourly rate (the discounted rate when there is a discount) times the duration,
   * without the currency sign. CSS: the app's own id, the element has no data-test, role or label.
   */
  private readonly totalPriceText: Locator;
  private readonly relatedProductsTitle: Locator;
  /** Related product cards: links with a level-5 heading, which nothing else on the page has. */
  private readonly relatedProductLinks: Locator;
  /** Toast shown after adding to cart. */
  private readonly addedToCartToast: Locator;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.productImage = page.getByRole('figure').getByRole('img');
    this.productNameHeading = page.getByTestId('product-name');
    this.productDescriptionText = page.getByTestId('product-description');
    this.unitPriceText = page.getByTestId('unit-price');
    this.priceText = page.locator('.price-section > span').filter({ has: this.unitPriceText });
    this.discountedPriceText = page.getByTestId('offer-price');
    this.discountBadgeText = page.getByText(/^-\d+%$/);
    this.categoryBadgeText = page.getByLabel('category', { exact: true });
    this.brandBadgeText = page.getByLabel('brand', { exact: true });
    this.quantityInput = page.getByTestId('quantity');
    this.increaseQuantityButton = page.getByTestId('increase-quantity');
    this.decreaseQuantityButton = page.getByTestId('decrease-quantity');
    this.addToCartButton = page.getByTestId('add-to-cart');
    this.outOfStockText = page.getByTestId('out-of-stock');
    this.durationSliderHandle = page.getByRole('slider');
    this.durationValueText = page.locator('#duration');
    this.totalPriceText = page.locator('#total-price');
    this.relatedProductsTitle = page.getByRole('heading', { name: 'Related products', level: 2 });
    this.relatedProductLinks = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 5 }) });
    this.addedToCartToast = page.getByRole('alert').filter({ hasText: 'Product added to shopping cart' });
  }

  get image(): Locator {
    return this.productImage;
  }

  get name(): Locator {
    return this.productNameHeading;
  }

  get description(): Locator {
    return this.productDescriptionText;
  }

  /** The shown price with its currency sign, e.g. "$14.15". */
  get price(): Locator {
    return this.priceText;
  }

  get discountedPrice(): Locator {
    return this.discountedPriceText;
  }

  get discountBadge(): Locator {
    return this.discountBadgeText;
  }

  get categoryBadge(): Locator {
    return this.categoryBadgeText;
  }

  get brandBadge(): Locator {
    return this.brandBadgeText;
  }

  /** The "Add to cart" button (the action is `addToCart()`). */
  get addToCartControl(): Locator {
    return this.addToCartButton;
  }

  /** The "+" button next to the quantity. */
  get increaseQuantityControl(): Locator {
    return this.increaseQuantityButton;
  }

  /** The "-" button next to the quantity. */
  get decreaseQuantityControl(): Locator {
    return this.decreaseQuantityButton;
  }

  get outOfStock(): Locator {
    return this.outOfStockText;
  }

  get durationSlider(): Locator {
    return this.durationSliderHandle;
  }

  get relatedProductsHeading(): Locator {
    return this.relatedProductsTitle;
  }

  get relatedProducts(): Locator {
    return this.relatedProductLinks;
  }

  async open(productId: string): Promise<void> {
    await this.goto(`/product/${productId}`);
    await this.waitForLoaded();
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.productNameHeading).toBeVisible();
  }

  async getUnitPrice(): Promise<number> {
    return Number((await this.unitPriceText.textContent())?.trim());
  }

  /** Rentals only: the total price shown next to the hourly rate. */
  async getTotalPrice(): Promise<number> {
    return Number((await this.totalPriceText.textContent())?.trim());
  }

  async setQuantity(quantity: number): Promise<void> {
    await this.quantityInput.fill(String(quantity));
  }

  /**
   * Rentals only: moves the duration slider with the arrow keys, like a keyboard user, and waits until
   * the app's "Duration (n hour(s))" label shows the new value.
   */
  async setDuration(hours: number): Promise<void> {
    await expect(this.durationSliderHandle).toHaveAttribute('aria-valuenow', /\d+/);
    const current = Number(await this.durationSliderHandle.getAttribute('aria-valuenow'));
    await this.durationSliderHandle.focus();
    const key = hours > current ? 'ArrowRight' : 'ArrowLeft';
    for (let step = 0; step < Math.abs(hours - current); step++) {
      await this.durationSliderHandle.press(key);
    }
    await expect(this.durationValueText).toHaveText(String(hours));
  }

  async addToCart(): Promise<void> {
    await this.addToCartButton.click();
    await expect(this.addedToCartToast.first()).toBeVisible();
  }
}
