import { expect, type Locator, type Page } from '@playwright/test';
import { parseAmount } from '../../../utils/amounts';
import { BaseComponent } from './BaseComponent';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One line of the checkout's cart step (wizard step 1): a table row with the product's name (plus a discount badge or a
 * rental note), its quantity field, unit price, line total and the delete button.
 * Locators from the app source (checkout/cart/cart.component.html) and the live bundle: the inspector can't reach
 * this step with a cart, because it can't put anything in it.
 */
export class CheckoutCartLine extends BaseComponent {
  private readonly titleText: Locator;
  /** By its text ("-20%"): the badge has no test id or role; it sits inside the title. */
  private readonly discountBadgeText: Locator;
  /** CSS: the rental note under the name has no test id; it's the row's only `small`. */
  private readonly rentalNoteText: Locator;
  private readonly quantityInput: Locator;
  /** The unit price (struck through when the line has a discount). */
  private readonly unitPriceText: Locator;
  /** The discounted unit price in the Price column; the Total column has a second `offer-price` (`#discount-total-price`). */
  private readonly offerPriceText: Locator;
  /** The line total (quantity × unit price, struck through when the line has a discount). */
  private readonly lineTotalText: Locator;
  /** CSS: an `<a>` without href, test id or accessible name (only an icon), so it has no role to find it by. */
  private readonly deleteButton: Locator;
  /** CSS: the cart table's header cells, to find a column by its label. */
  private readonly headerCells: Locator;
  private readonly bodyCells: Locator;
  private readonly toastAlert: Locator;

  /**
   * The row whose product title is `productName`, optionally followed by the badge (the template puts a non-breaking
   * space between them); a longer name ("Hammer" vs "Hammer Drill") doesn't match.
   * CSS: the rows have no test id; the step's Angular host element is `app-cart`.
   */
  constructor(page: Page, productName: string, root?: Locator) {
    super(
      page,
      root ??
        page
          .locator('app-cart tbody tr')
          .filter({ has: page.getByTestId('product-title').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(productName)}(?!\\s*\\w)`) }) })
    );
    this.titleText = this.root.getByTestId('product-title');
    this.discountBadgeText = this.titleText.getByText(/^-\d+%$/);
    this.rentalNoteText = this.root.locator('small');
    this.quantityInput = this.root.getByTestId('product-quantity');
    this.unitPriceText = this.root.getByTestId('product-price');
    this.offerPriceText = this.root.getByTestId('offer-price').filter({ has: page.locator('#discount-price') });
    this.lineTotalText = this.root.getByTestId('line-price');
    this.deleteButton = this.root.locator('a.btn-danger');
    this.headerCells = page.locator('app-cart thead th');
    this.bodyCells = this.root.locator('td');
    this.toastAlert = page.getByRole('alert');
  }

  /** The whole row. */
  get row(): Locator {
    return this.root;
  }

  get discountBadge(): Locator {
    return this.discountBadgeText;
  }

  get rentalNote(): Locator {
    return this.rentalNoteText;
  }

  get unitPrice(): Locator {
    return this.unitPriceText;
  }

  get offerPrice(): Locator {
    return this.offerPriceText;
  }

  get lineTotal(): Locator {
    return this.lineTotalText;
  }

  /**
   * What the line shows under the column `header` ("Item", "Quantity", "Price", "Total"): the cell at that header's
   * position, as trimmed text with spaces collapsed, or the field's value when the cell holds a field.
   */
  async getCellText(header: string): Promise<string> {
    const headers = (await this.headerCells.allTextContents()).map((text) => text.trim());
    const index = headers.indexOf(header);
    if (index < 0) throw new Error(`No column "${header}" in the cart table (columns: ${JSON.stringify(headers)})`);
    const cell = this.bodyCells.nth(index);
    const field = cell.locator('input');
    if (await field.count()) return field.inputValue();
    return ((await cell.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  async getUnitPrice(): Promise<number> {
    return parseAmount(await this.unitPriceText.textContent());
  }

  async getLineTotal(): Promise<number> {
    return parseAmount(await this.lineTotalText.textContent());
  }

  async getOfferPrice(): Promise<number> {
    return parseAmount(await this.offerPriceText.textContent());
  }

  /**
   * Types the new quantity and leaves the field (the app reacts to `change`, not to typing), then waits for the app to
   * save it (PUT .../product/quantity), reload the cart (GET /carts/{id}, started after the save) and show its toast.
   */
  async changeQuantity(quantity: number): Promise<void> {
    const reloaded = this.cartAnswer('PUT', /\/carts\/[^/]+\/product\/quantity$/).then(() => this.cartReload());
    await this.quantityInput.fill(String(quantity));
    await this.quantityInput.press('Tab');
    await reloaded;
    await expect(this.toastAlert.first()).toBeVisible();
  }

  /** Clicks the delete button, then waits for the app to delete the line, reload the cart and show its toast. */
  async delete(): Promise<void> {
    const reloaded = this.cartAnswer('DELETE', /\/carts\/[^/]+\/product\/[^/]+$/).then(() => this.cartReload());
    await this.deleteButton.click();
    await reloaded;
    await expect(this.toastAlert.first()).toBeVisible();
  }

  /** The cart reload the app starts once a change is saved (`fetchCartItems()`); waited for only from then on. */
  private cartReload(): Promise<unknown> {
    return this.cartAnswer('GET', /\/carts\/[^/]+$/);
  }

  private cartAnswer(method: string, path: RegExp): Promise<unknown> {
    return this.page.waitForResponse((response) => response.request().method() === method && path.test(new URL(response.url()).pathname));
  }
}
