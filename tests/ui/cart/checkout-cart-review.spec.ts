// Carts are made through the API and given to the browser before the page is opened (removed after each test).
import {
  test,
  expect,
  openHomePageWithProductInCartTest,
  openHomePageWithRentalAndProductInCartTest,
  putProductsInCart,
  assertNoEcoRating,
  AMSTERDAM,
} from '@fixtures';
import { TestConstants } from '@data/TestConstants';
import { parseAmount } from '@utils/amounts';

/**
 * An amount as the cart shows it (Angular's `number: '1.2-2'`): 14.15 -> "$14.15", 1234.5 -> "$1,234.50" (rounded in
 * cents, so 3 × 14.15 isn't 42.449999...).
 */
function usd(amount: number): string {
  return `$${(Math.round(amount * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Scenarios: test-scenarios/ui/cart/checkout-cart-review.yml
test.describe('@cart - Checkout cart review', () => {
  test.describe(() => {
    // Precondition: A product that is in stock is in the cart (the seeded in-stock product, quantity 1). The fixture
    // also opens the home page first; the steps then open the checkout page.
    const test = openHomePageWithProductInCartTest;

    test('UI-049: The cart step shows the line under the labelled column headers', async ({ cartPage, visitorCart }) => {
      const { name, price } = visitorCart.product;
      const line = cartPage.line(name);
      let quantityShown: string;

      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Verify the column headers "Item", "Quantity", "Price" and "Total" are shown.', async () => {
        for (const header of ['Item', 'Quantity', 'Price', 'Total']) {
          await expect(cartPage.columnHeader(header), `The column header "${header}" is visible`).toBeVisible();
        }
      });

      // Approved reading of "under <header>": the line's cell at that header's column position.
      await test.step('Verify the line shows the product\'s name under "Item".', async () => {
        await expect(line.row, 'The product\'s line is visible').toBeVisible();
        expect(await line.getCellText('Item'), 'The Item column of the line holds the product\'s name').toBe(name);
      });

      await test.step('Verify the line shows its quantity under "Quantity".', async () => {
        quantityShown = await line.getCellText('Quantity');
        expect(quantityShown, 'The Quantity column of the line holds the quantity in the cart').toBe('1');
      });

      await test.step('Verify the line shows the product\'s unit price under "Price".', async () => {
        expect(await line.getCellText('Price'), 'The Price column of the line holds the product\'s unit price').toBe(usd(price));
      });

      await test.step('Verify the line shows its line total under "Total", equal to the quantity × the unit price.', async () => {
        const unitPrice = parseAmount(await line.getCellText('Price'));
        expect(
          await line.getCellText('Total'),
          `The Total column of the line holds ${quantityShown} × ${unitPrice}`
        ).toBe(usd(Number(quantityShown) * unitPrice));
      });
    });

    test('UI-050: Changing a line\'s quantity recalculates the totals and shows a confirmation', async ({ cartPage, visitorCart }) => {
      // Precondition: The product has no CO2 rating A or B (the page's eco discount would change the cart total).
      assertNoEcoRating([visitorCart.product]);
      const line = cartPage.line(visitorCart.product.name);
      let unitPrice: number;

      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Change the quantity of the line from 1 to 3.', async () => {
        unitPrice = await line.getUnitPrice();
        await line.changeQuantity(3);
      });

      await test.step('Verify the message "Product quantity updated." is shown.', async () => {
        await expect(cartPage.toast, 'The confirmation is visible').toBeVisible();
        await expect(cartPage.toast, 'The confirmation is shown').toHaveText('Product quantity updated.');
      });

      await test.step('Verify the line total equals 3 × the unit price.', async () => {
        await expect(line.lineTotal, `The line total is 3 × ${unitPrice}`).toHaveText(usd(3 * unitPrice));
      });

      await test.step('Verify the cart total equals 3 × the unit price.', async () => {
        await expect(cartPage.cartTotal, `The cart total is 3 × ${unitPrice}`).toHaveText(usd(3 * unitPrice));
      });
    });

    test('UI-053: Deleting the last line shows the empty cart message', async ({ cartPage, visitorCart }) => {
      test.fail(true, 'Known issue BUG-050: The Cart step of the checkout says "The cart is empty. Nothing to display." instead of "Your shopping cart is empty" after the last line is deleted.');

      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Click the delete button on the line.', async () => {
        await cartPage.line(visitorCart.product.name).delete();
      });

      await test.step('Verify the message "Your shopping cart is empty" is shown.', async () => {
        await expect(cartPage.emptyCartMessage, 'The empty cart message is visible').toBeVisible();
        await expect(cartPage.emptyCartMessage, 'The empty cart message is shown').toHaveText('Your shopping cart is empty');
      });

      await test.step('Verify the button "Proceed to checkout" is not shown.', async () => {
        await expect(cartPage.proceedToCheckoutButton, 'No "Proceed to checkout" for an empty cart').toBeHidden();
      });
    });

    test('UI-054: "Proceed to checkout" leads to the sign-in step', async ({ cartPage }) => {
      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Click "Proceed to checkout".', async () => {
        await cartPage.proceed();
      });

      await test.step('Verify the "Sign in" step is shown.', async () => {
        // Approved reading: the wizard marks "Sign in" as the current step, and that step's content is visible.
        await expect(cartPage.currentStep, 'The wizard marks "Sign in" as the current step').toHaveText('Sign in');
        await expect(cartPage.signInStepPanel, 'The Sign in step is visible').toBeVisible();
      });
    });
  });

  test('UI-051: Deleting a line removes it and recalculates the cart total', async ({
    page,
    cartPage,
    productsService,
    cartsService,
    cleanup,
  }) => {
    const firstProduct = TestConstants.products.inStockProduct;
    const secondProduct = 'Hammer';

    // Precondition: Two products that are in stock, neither with a CO2 rating A or B, are in the cart, one line each.
    // Neither is a rental (no combined discount), and the cart has no location (no location discount).
    const { products } = await putProductsInCart(page, productsService, cartsService, cleanup, [
      { name: firstProduct },
      { name: secondProduct },
    ]);
    assertNoEcoRating(products);

    await test.step('Open the checkout page.', async () => {
      await cartPage.open();
    });

    await test.step('Click the delete button on the line of the first product.', async () => {
      await cartPage.line(firstProduct).delete();
    });

    await test.step('Verify the line of the first product is no longer shown.', async () => {
      await expect(cartPage.line(firstProduct).row, 'The first product\'s line is gone').toBeHidden();
    });

    await test.step('Verify the cart has one line: the second product.', async () => {
      const titles = (await cartPage.getLines()).map((line) => line.title);
      expect(titles, 'Only the second product\'s line is left').toEqual([secondProduct]);
    });

    await test.step('Verify the cart total equals the remaining line\'s total.', async () => {
      const remaining = await cartPage.line(secondProduct).getLineTotal();
      expect(await cartPage.getTotal(), `The cart total is the remaining line's total, ${remaining}`).toBeCloseTo(remaining, 2);
    });
  });

  test('UI-052: A visitor with no cart sees the empty cart message', async ({ cartPage }) => {
    test.fail(true, 'Known issue BUG-049: The Cart step of the checkout shows nothing (no message, table or button) for a visitor without a cart, instead of "Your shopping cart is empty".');

    // Precondition: No cart exists yet: nothing has been added to a cart in this session. Nothing to set up: every test
    // gets a new browser context, and the app keeps the cart id only in that context's sessionStorage.

    await test.step('Open the checkout page.', async () => {
      await cartPage.openWithoutCart();
    });

    await test.step('Verify the message "Your shopping cart is empty" is shown.', async () => {
      await expect(cartPage.emptyCartMessage, 'The empty cart message is visible').toBeVisible();
      await expect(cartPage.emptyCartMessage, 'The empty cart message is shown').toHaveText('Your shopping cart is empty');
    });
  });

  test('UI-055: A discounted line shows the badge, the original price and the discounted price', async ({
    page,
    cartPage,
    productsService,
    cartsService,
    cleanup,
  }) => {
    // Precondition: The customer's location is Amsterdam, and a product with a location offer is added to the cart.
    // The location is set in the browser and given to the new cart, as the app does; the API then gives the line 20% off.
    const { products } = await putProductsInCart(
      page,
      productsService,
      cartsService,
      cleanup,
      [{ name: TestConstants.products.locationOfferProduct }],
      { location: AMSTERDAM }
    );
    const [product] = products;
    if (!product) throw new Error('Setup: the location offer was not put in the cart');
    const line = cartPage.line(product.name);

    await test.step('Open the checkout page.', async () => {
      await cartPage.open();
    });

    await test.step('Verify the discount badge "-20%" is shown next to the product name.', async () => {
      // The badge is looked up inside the product name's element, right after the name.
      await expect(line.discountBadge, 'The discount badge is visible next to the name').toBeVisible();
      await expect(line.discountBadge, 'The badge shows the discount').toHaveText('-20%');
    });

    // Approved reading: the Price column's unit prices (the line total's struck-through and discounted amounts aren't checked).
    await test.step('Verify the original price is shown struck through.', async () => {
      await expect(line.unitPrice, 'The original price is visible').toBeVisible();
      await expect(line.unitPrice, 'The original price is the product\'s price').toHaveText(usd(product.price));
      await expect(line.unitPrice, 'The original price is struck through').toHaveCSS('text-decoration-line', 'line-through');
    });

    await test.step('Verify the discounted price is shown, equal to 80% of the original price.', async () => {
      await expect(line.offerPrice, 'The discounted price is visible').toBeVisible();
      expect(await line.getOfferPrice(), `The discounted price is 80% of ${product.price}`).toBeCloseTo(product.price * 0.8, 2);
    });
  });

  test.describe(() => {
    // Precondition: A rental product and a product that is not a rental are in the cart; neither has a discount or a
    // CO2 rating A or B. The fixture also opens the home page first; the steps then open the checkout page.
    const test = openHomePageWithRentalAndProductInCartTest;

    test('UI-056: A cart with a rental and a non-rental item shows the subtotal, the 15% discount and the total', async ({ cartPage }) => {
      let subtotal: number;
      let discount: number;

      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Verify the "Subtotal" equals the sum of the line totals.', async () => {
        await expect(cartPage.subtotal, 'The subtotal is visible').toBeVisible();
        const lineTotals = await cartPage.getLineTotals();
        const sum = lineTotals.reduce((total, amount) => total + amount, 0);
        subtotal = await cartPage.getSubtotal();
        expect(subtotal, `The subtotal is the sum of the line totals ${JSON.stringify(lineTotals)}`).toBeCloseTo(sum, 2);
      });

      await test.step('Verify the row "Discount (15%)" shows 15% of the subtotal.', async () => {
        await expect(cartPage.discountRow, 'The discount row is visible').toBeVisible();
        await expect(cartPage.discountRow, 'The row is labelled "Discount (15%)"').toContainText('Discount (15%)');
        discount = await cartPage.getDiscount();
        expect(discount, `The discount is 15% of the subtotal ${subtotal}`).toBeCloseTo(subtotal * 0.15, 2);
      });

      await test.step('Verify the "Total" equals the subtotal minus the discount.', async () => {
        expect(await cartPage.getTotal(), `The total is ${subtotal} - ${discount}`).toBeCloseTo(subtotal - discount, 2);
      });
    });

    test('UI-057: Deleting the rental line removes the combined discount', async ({ cartPage, rentalAndProductCart }) => {
      const { rental, product } = rentalAndProductCart;

      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Click the delete button on the line of the rental product.', async () => {
        await cartPage.line(rental.name).delete();
      });

      await test.step('Verify the "Subtotal" row is no longer shown.', async () => {
        await expect(cartPage.subtotalRow, 'The Subtotal row is gone').toBeHidden();
      });

      await test.step('Verify the "Discount (15%)" row is no longer shown.', async () => {
        await expect(cartPage.discountRow, 'The Discount (15%) row is gone').toBeHidden();
      });

      await test.step('Verify the total equals the remaining line\'s total.', async () => {
        const remaining = await cartPage.line(product.name).getLineTotal();
        expect(await cartPage.getTotal(), `The total is the remaining line's total, ${remaining}`).toBeCloseTo(remaining, 2);
      });
    });

    test('UI-084: A rental line in the checkout cart is marked "This is a rental item"', async ({ cartPage, rentalAndProductCart }) => {
      test.fail(true, 'Known issue BUG-051: The checkout cart marks a rental line "Item for rent, price per hour" instead of "This is a rental item".');

      const rentalLine = cartPage.line(rentalAndProductCart.rental.name);
      const productLine = cartPage.line(rentalAndProductCart.product.name);

      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Verify the line of the rental product is marked "This is a rental item".', async () => {
        await expect(rentalLine.rentalNote, 'The rental line has a note').toBeVisible();
        await expect(rentalLine.rentalNote, 'The note marks the rental').toHaveText('This is a rental item');
      });

      await test.step('Verify the line of the product that is not a rental is not marked "This is a rental item".', async () => {
        await expect(productLine.row, 'The other product\'s line is visible').toBeVisible();
        await expect(productLine.row, 'The other product\'s line carries no rental mark').not.toContainText('This is a rental item');
      });
    });
  });
});
