import { test, expect, visitorInLondonTest } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/product-detail.yml
test.describe('@products - Product detail', () => {
  test("UI-013: The product page shows the product's information and related products", async ({ shoppingFlow, productPage }) => {
    const productName = 'Combination Pliers';

    await test.step('Open the product "Combination Pliers".', async () => {
      await shoppingFlow.openProduct(productName);
    });

    await test.step('Verify the product image is shown.', async () => {
      await expect(productPage.image, 'The product image is shown').toBeVisible();
    });

    await test.step('Verify the name "Combination Pliers" is shown.', async () => {
      await expect(productPage.name, 'The product name is shown').toHaveText(productName);
    });

    await test.step('Verify the product description is shown.', async () => {
      await expect(productPage.description, 'The product description is shown').toBeVisible();
      await expect(productPage.description, 'The product description has text').not.toBeEmpty();
    });

    await test.step('Verify the price "$14.15" is shown.', async () => {
      await expect(productPage.price, 'The price is shown').toHaveText('$14.15');
    });

    await test.step('Verify the category badge "Pliers" is shown.', async () => {
      await expect(productPage.categoryBadge, 'The category badge names the category').toHaveText('Pliers');
    });

    await test.step('Verify the brand badge "ForgeFlex Tools" is shown.', async () => {
      await expect(productPage.brandBadge, 'The brand badge names the brand').toHaveText('ForgeFlex Tools');
    });

    await test.step('Verify the "Related products" section is shown below the product information.', async () => {
      await expect(productPage.relatedProductsHeading, 'The "Related products" heading is shown').toBeVisible();
      // Approved reading: "below the product information" = the heading's top is below the bottom of
      // "Add to cart", the last control of the information column.
      const heading = await productPage.relatedProductsHeading.boundingBox();
      const addToCart = await productPage.addToCartControl.boundingBox();
      expect(heading && addToCart, 'Both the heading and "Add to cart" have a position on the page').toBeTruthy();
      expect(heading!.y, 'The "Related products" heading starts below "Add to cart"').toBeGreaterThanOrEqual(addToCart!.y + addToCart!.height);
    });

    await test.step('Verify the "Related products" section shows at least one product.', async () => {
      await expect(productPage.relatedProducts.first(), 'At least one related product is shown').toBeVisible();
    });
  });

  test.describe(() => {
    // The precondition fixture under the name `test`, so the scenario validator finds this test by its title.
    const test = visitorInLondonTest;

    test(
      'UI-014: A discounted product shows the original price struck through, the discounted price and the discount badge',
      async ({ shoppingFlow, productPage }) => {
        // Discounts are location-based: only location offers get one, and only for a visitor near one of the
        // app's discount cities. The fixture makes the browser a visitor in London; Bolt Cutters is a seeded
        // location offer (the approved choice for "a product that has a discount").
        const productName = 'Bolt Cutters';

        await test.step('Open a product that has a discount.', async () => {
          await shoppingFlow.openProduct(productName);
        });

        await test.step('Verify the original price is shown struck through.', async () => {
          await expect(productPage.price, 'The original price is shown').toBeVisible();
          await expect(productPage.price, 'The original price is struck through').toHaveCSS('text-decoration-line', 'line-through');
        });

        await test.step('Verify the discounted price is shown.', async () => {
          await expect(productPage.discountedPrice, 'The discounted price is shown').toBeVisible();
          await expect(productPage.discountedPrice, 'The discounted price is a dollar amount').toHaveText(/^\$\d+(\.\d+)?$/);
        });

        await test.step('Verify a discount percentage badge is shown.', async () => {
          await expect(productPage.discountBadge, 'A discount percentage badge is shown').toBeVisible();
        });
      }
    );
  });

  test("UI-015: An out-of-stock product can't be added to the cart", async ({ shoppingFlow, productPage }) => {
    await test.step('Open the product "Long Nose Pliers".', async () => {
      await shoppingFlow.openProduct(TestConstants.products.outOfStockProduct);
    });

    await test.step('Verify "Add to cart" is disabled.', async () => {
      await expect(productPage.addToCartControl, '"Add to cart" is disabled').toBeDisabled();
    });

    await test.step('Verify "Out of stock" is shown.', async () => {
      await expect(productPage.outOfStock, '"Out of stock" is shown').toHaveText('Out of stock');
    });

    await test.step('Verify "Out of stock" is shown in red.', async () => {
      // Approved reading: "red" is the app's danger colour, #CA0B00.
      await expect(productPage.outOfStock, '"Out of stock" is red').toHaveCSS('color', 'rgb(202, 11, 0)');
    });
  });

  test('UI-016: A rental product shows a duration slider instead of the quantity buttons', async ({ shoppingFlow, productPage }) => {
    await test.step('Open the rental product "Excavator".', async () => {
      await shoppingFlow.openProduct(TestConstants.products.rentalProduct);
    });

    await test.step('Verify a duration slider is shown.', async () => {
      await expect(productPage.durationSlider, 'The duration slider is shown').toBeVisible();
    });

    await test.step('Verify the duration slider goes from 1 to 10 hours.', async () => {
      // Approved reading: the slider's range as it announces it (aria-valuemin/max). Its end labels are
      // hidden when the value's own label overlaps them, so they can't be relied on.
      await expect(productPage.durationSlider, 'The slider starts at 1 hour').toHaveAttribute('aria-valuemin', '1');
      await expect(productPage.durationSlider, 'The slider ends at 10 hours').toHaveAttribute('aria-valuemax', '10');
    });

    await test.step('Verify the "Increase quantity" (+) and "Decrease quantity" (-) buttons are not shown.', async () => {
      await expect(productPage.increaseQuantityControl, 'There is no "Increase quantity" button').toHaveCount(0);
      await expect(productPage.decreaseQuantityControl, 'There is no "Decrease quantity" button').toHaveCount(0);
    });
  });

  test("UI-017: A rental's total price is the hourly rate times the duration", async ({ shoppingFlow, productPage }) => {
    const hours = 3;

    await test.step('Open the rental product "Excavator".', async () => {
      await shoppingFlow.openProduct(TestConstants.products.rentalProduct);
    });

    await test.step('Set the duration slider to 3 hours.', async () => {
      // Approved: moved with the arrow keys, like a keyboard user.
      await productPage.setDuration(hours);
    });

    await test.step('Verify the total price equals 3 × the hourly rate.', async () => {
      const hourlyRate = await productPage.getUnitPrice();
      const total = await productPage.getTotalPrice();
      expect(total, `The total is ${hours} × ${hourlyRate}`).toBeCloseTo(hourlyRate * hours, 2);
    });
  });
});
