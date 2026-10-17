import { openProductPageTest as test, expect } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-quantity.yml
test.describe('@products - Product quantity', () => {
  // Precondition: The product page of "Combination Pliers" is open.
  test.use({ productName: TestConstants.products.inStockProduct });

  test('UI-018: An in-stock product shows the quantity selector set to 1', async ({ productPage }) => {
    await test.step('Verify the quantity field is shown.', async () => {
      await expect(productPage.quantity, 'The quantity field is visible').toBeVisible();
    });

    await test.step('Verify the "Increase quantity" (+) button is shown.', async () => {
      await expect(productPage.increaseQuantityControl, 'The "Increase quantity" button is visible').toBeVisible();
    });

    await test.step('Verify the "Decrease quantity" (-) button is shown.', async () => {
      await expect(productPage.decreaseQuantityControl, 'The "Decrease quantity" button is visible').toBeVisible();
    });

    await test.step('Verify the quantity is 1.', async () => {
      await expect(productPage.quantity, 'The quantity is 1').toHaveValue('1');
    });
  });

  test('UI-019: The plus button increases the quantity by 1', async ({ productPage }) => {
    await test.step('Click "Increase quantity".', async () => {
      await productPage.increaseQuantity();
    });

    await test.step('Verify the quantity is 2.', async () => {
      await expect(productPage.quantity, 'The quantity is 2').toHaveValue('2');
    });
  });

  test('UI-020: The minus button decreases the quantity by 1', async ({ productPage }) => {
    await test.step('Click "Increase quantity".', async () => {
      await productPage.increaseQuantity();
    });

    await test.step('Click "Increase quantity".', async () => {
      await productPage.increaseQuantity();
    });

    await test.step('Verify the quantity is 3.', async () => {
      await expect(productPage.quantity, 'The quantity is 3').toHaveValue('3');
    });

    await test.step('Click "Decrease quantity".', async () => {
      await productPage.decreaseQuantity();
    });

    await test.step('Verify the quantity is 2.', async () => {
      await expect(productPage.quantity, 'The quantity is 2').toHaveValue('2');
    });
  });

  test('UI-021: The minus button keeps the quantity at 1', async ({ productPage }) => {
    await test.step('Verify the quantity is 1.', async () => {
      await expect(productPage.quantity, 'The quantity is 1').toHaveValue('1');
    });

    await test.step('Click "Decrease quantity".', async () => {
      await productPage.decreaseQuantity();
    });

    await test.step('Verify the quantity is still 1.', async () => {
      await expect(productPage.quantity, 'The quantity is still 1').toHaveValue('1');
    });
  });

  test('UI-022: A quantity typed into the field is used', async ({ productPage }) => {
    await test.step('Enter 5 in the quantity field.', async () => {
      await productPage.setQuantity(5);
    });

    await test.step('Verify the quantity is 5.', async () => {
      await expect(productPage.quantity, 'The quantity is 5').toHaveValue('5');
    });

    await test.step('Click "Increase quantity".', async () => {
      await productPage.increaseQuantity();
    });

    await test.step('Verify the quantity is 6.', async () => {
      // "+" adds 1 to the app's own quantity, so 6 shows the app took the typed 5 (the field alone only echoes the typing).
      await expect(productPage.quantity, 'The app used the typed 5: one more is 6').toHaveValue('6');
    });
  });

  test('UI-023: A typed quantity of 0 is set to 1', async ({ productPage }) => {
    await test.step('Enter 0 in the quantity field.', async () => {
      await productPage.setQuantity(0);
    });

    await test.step('Verify the quantity is 1.', async () => {
      await expect(productPage.quantity, 'The typed 0 is set to 1').toHaveValue('1');
    });
  });

  test('UI-024: A typed quantity above 999,999,999 is set to 999,999,999', async ({ productPage }) => {
    test.fail(true, 'Known issue BUG-008: The field sets a typed quantity above 99 to 99 (with the warning "You can order at most 99 of this product.") instead of setting 1,000,000,000 to 999,999,999 as the story\'s range 1 to 999,999,999 requires.');

    await test.step('Enter 1000000000 in the quantity field.', async () => {
      await productPage.setQuantity(1000000000);
    });

    await test.step('Verify the quantity is 999999999.', async () => {
      await expect(productPage.quantity, 'The typed 1000000000 is set to 999999999').toHaveValue('999999999');
    });
  });

  test('UI-025: A typed quantity of 999,999,999 is accepted', async ({ productPage }) => {
    test.fail(true, 'Known issue BUG-008: The field changes a typed quantity of 999,999,999 to 99 (the app allows at most 99) instead of keeping it as the story\'s range 1 to 999,999,999 requires.');

    await test.step('Enter 999999999 in the quantity field.', async () => {
      await productPage.setQuantity(999999999);
    });

    await test.step('Verify the quantity is 999999999.', async () => {
      await expect(productPage.quantity, 'The typed 999999999 is kept').toHaveValue('999999999');
    });
  });

  test('UI-026: A typed quantity of 1 is accepted', async ({ productPage }) => {
    await test.step('Click "Increase quantity".', async () => {
      await productPage.increaseQuantity();
    });

    await test.step('Enter 1 in the quantity field.', async () => {
      await productPage.setQuantity(1);
    });

    await test.step('Verify the quantity is 1.', async () => {
      await expect(productPage.quantity, 'The typed 1 is kept').toHaveValue('1');
    });

    await test.step('Click "Increase quantity".', async () => {
      await productPage.increaseQuantity();
    });

    await test.step('Verify the quantity is 2.', async () => {
      // The app's quantity was 2 before the typing: 2 now (not 3) shows it took the typed 1.
      await expect(productPage.quantity, 'The app used the typed 1: one more is 2').toHaveValue('2');
    });
  });
});
